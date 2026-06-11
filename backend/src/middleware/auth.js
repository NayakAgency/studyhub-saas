// ============================================================
// JWT Authentication Middleware
// Verifies JWT, extracts user context (role, tenant_id)
// ============================================================

import * as jose from 'jose';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

const secret = new TextEncoder().encode(env.jwtSecret);

// Verify JWT and attach user to req
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    let payload;
    try {
      const verified = await jose.jwtVerify(token, secret);
      payload = verified.payload;
    } catch (jwtError) {
      if (jwtError.code === 'ERR_JWT_EXPIRED') {
        return res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Token has expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Attach user context to request
    req.user = {
      id: payload.sub,
      userId: payload.sub,
      role: payload.role,
      tenant_id: payload.tenant_id || null,
      student_id: payload.student_id || null,
      email: payload.email,
      fullName: payload.full_name,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Role guard - check if user has required role
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden', message: `Required role: ${roles.join(' or ')}` });
  }
  next();
};

// Tenant isolation - ensure user has tenant context
export const requireTenant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!req.user.tenant_id && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Tenant context required' });
  }
  next();
};

// Generate JWT access token
export const generateAccessToken = async (payload) => {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.jwtExpiresIn)
    .sign(secret);
};

// Generate JWT refresh token
export const generateRefreshToken = async (payload) => {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.jwtRefreshExpiresIn)
    .sign(secret);
};
