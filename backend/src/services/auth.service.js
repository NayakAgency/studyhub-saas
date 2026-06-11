// ============================================================
// Auth Service
// Handles authentication logic for all roles
// ============================================================

import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { generateAccessToken, generateRefreshToken } from '../middleware/auth.js';
import { recordLoginFailure, clearLoginFailures } from '../middleware/auth-lockout.js';

const secret = new TextEncoder().encode(env.jwtSecret);

// ============================================================
// Login for hall admin or super admin
// ============================================================
export const loginAdmin = async ({ email, password, identifier }) => {
  // Authenticate with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    await recordLoginFailure(identifier || email);
    throw new Error('Invalid email or password');
  }

  // Clear lockout on success
  await clearLoginFailures(identifier || email);

  const userId = authData.user.id;

  // Check if super admin
  const { data: superAdmin } = await supabaseAdmin
    .from('super_admins')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (superAdmin) {
    // Update last login
    await supabaseAdmin
      .from('super_admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', superAdmin.id);

    const tokenPayload = {
      sub: userId,
      role: 'super_admin',
      email: superAdmin.email,
      full_name: superAdmin.full_name,
    };

    const accessToken = await generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken({ sub: userId, role: 'super_admin' });

    // Store refresh token
    await storeRefreshToken(userId, refreshToken);

    return {
      user: {
        id: userId,
        role: 'super_admin',
        email: superAdmin.email,
        fullName: superAdmin.full_name,
      },
      accessToken,
      refreshToken,
    };
  }

  // Check if hall admin
  const { data: hallAdmin } = await supabaseAdmin
    .from('hall_admins')
    .select('*, tenants(id, hall_name, slug, status, logo_url, theme_color)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (hallAdmin) {
    const tokenPayload = {
      sub: userId,
      role: 'hall_admin',
      admin_role: hallAdmin.role,
      tenant_id: hallAdmin.tenant_id,
      email: hallAdmin.email,
      full_name: hallAdmin.full_name,
    };

    const accessToken = await generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken({
      sub: userId,
      role: 'hall_admin',
      tenant_id: hallAdmin.tenant_id,
    });

    await storeRefreshToken(userId, refreshToken);

    return {
      user: {
        id: userId,
        role: 'hall_admin',
        adminRole: hallAdmin.role,
        email: hallAdmin.email,
        fullName: hallAdmin.full_name,
        tenantId: hallAdmin.tenant_id,
        tenant: hallAdmin.tenants,
      },
      accessToken,
      refreshToken,
    };
  }

  throw new Error('Admin account not found or inactive');
};

// ============================================================
// Login for students (by phone + password, scoped to tenant)
// ============================================================
export const loginStudent = async ({ phone, password, tenantSlug, identifier }) => {
  // Find tenant by slug
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id, hall_name, status')
    .eq('slug', tenantSlug)
    .single();

  if (tenantError || !tenant) {
    throw new Error('Study hall not found');
  }

  // Find student by phone + tenant
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('id, user_id, full_name, phone, email, status, student_code')
    .eq('tenant_id', tenant.id)
    .eq('phone', phone)
    .single();

  if (!student) {
    await recordLoginFailure(identifier || phone);
    throw new Error('Invalid phone number or password');
  }

  // Derive auth email: use stored email if it looks like a real email,
  // otherwise reconstruct the phone-based email used during registration
  let authEmail = student.email;
  if (!authEmail || authEmail.includes('.studyhub.local') === false) {
    // Try the self-registration pattern: phone@tenantSlug.studyhub.local
    authEmail = `${phone.replace(/\D/g, '')}@${tenantSlug}.studyhub.local`;
  }

  // Sign in with Supabase
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  });

  if (authError) {
    await recordLoginFailure(identifier || phone);
    throw new Error('Invalid phone number or password');
  }

  await clearLoginFailures(identifier || phone);

  const tokenPayload = {
    sub: student.user_id,
    role: 'student',
    tenant_id: tenant.id,
    student_id: student.id,
    full_name: student.full_name,
  };

  const accessToken = await generateAccessToken(tokenPayload);
  const refreshToken = await generateRefreshToken({
    sub: student.user_id,
    role: 'student',
    tenant_id: tenant.id,
    student_id: student.id,
  });

  await storeRefreshToken(student.user_id, refreshToken);

  // Update last_login_at and log activity (fire-and-forget)
  const now = new Date().toISOString();
  Promise.all([
    supabaseAdmin
      .from('students')
      .update({ last_login_at: now })
      .eq('id', student.id),
    supabaseAdmin
      .from('student_activity_logs')
      .insert({
        tenant_id: tenant.id,
        student_id: student.id,
        activity_type: 'login',
        activity_data: { platform: 'web' },
        created_at: now,
      }),
  ]).catch((err) => console.error('[auth] activity log error:', err.message));

  return {
    user: {
      id: student.user_id,
      role: 'student',
      studentId: student.id,
      studentCode: student.student_code,
      fullName: student.full_name,
      phone: student.phone,
      tenantId: tenant.id,
      status: student.status,
    },
    accessToken,
    refreshToken,
  };
};

// ============================================================
// Refresh token rotation
// ============================================================
export const refreshAccessToken = async (refreshToken, userAgent, ipAddress) => {
  // Verify refresh token JWT signature first (fast, no DB)
  let payload;
  try {
    const verified = await jose.jwtVerify(refreshToken, secret);
    payload = verified.payload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }

  // Check if a valid non-revoked token exists for this user
  const { data: storedToken } = await supabaseAdmin
    .from('refresh_tokens')
    .select('id')
    .eq('user_id', payload.sub)
    .eq('is_revoked', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!storedToken) {
    throw new Error('Refresh token not found or revoked');
  }

  // Revoke old refresh token
  await supabaseAdmin
    .from('refresh_tokens')
    .update({ is_revoked: true })
    .eq('id', storedToken.id);

  // Generate new tokens
  const tokenPayload = {
    sub: payload.sub,
    role: payload.role,
    tenant_id: payload.tenant_id || null,
    student_id: payload.student_id || null,
  };

  const newAccessToken = await generateAccessToken(tokenPayload);
  const newRefreshToken = await generateRefreshToken(tokenPayload);

  // Store new refresh token
  await storeRefreshToken(payload.sub, newRefreshToken, userAgent, ipAddress);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

// ============================================================
// Logout - revoke all refresh tokens
// ============================================================
export const logout = async (userId) => {
  await supabaseAdmin
    .from('refresh_tokens')
    .update({ is_revoked: true })
    .eq('user_id', userId)
    .eq('is_revoked', false);
};

// ============================================================
// Change password + invalidate all sessions
// ============================================================
export const changePassword = async (userId, newPassword) => {
  // Update password in Supabase Auth
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) throw new Error(error.message);

  // Revoke ALL refresh tokens for this user
  await supabaseAdmin
    .from('refresh_tokens')
    .update({ is_revoked: true })
    .eq('user_id', userId);
};

// ============================================================
// Helper: Store refresh token
// DB schema: refresh_tokens(id, user_id, token_hash, is_revoked, expires_at, user_agent, ip_address)
// ============================================================
const storeRefreshToken = async (userId, token, userAgent, ipAddress) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  // Store first 500 chars as the hash reference
  const tokenHash = token.substring(0, 500);

  const { error } = await supabaseAdmin.from('refresh_tokens').insert({
    user_id:    userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    user_agent: userAgent || null,
    ip_address: ipAddress || null,
  });

  if (error) {
    console.error('[auth] storeRefreshToken error:', error.message);
  }
};

// ============================================================
// Verify JWT (used by WebSocket service)
// ============================================================
export const verifyJWT = async (token) => {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
};
