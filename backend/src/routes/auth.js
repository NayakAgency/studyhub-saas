// ============================================================
// Auth Routes
// POST /api/auth/login-admin
// POST /api/auth/login-student
// POST /api/auth/refresh
// POST /api/auth/logout
// POST /api/auth/change-password
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { checkAuthLockout } from '../middleware/auth-lockout.js';
import { auditMiddleware, AUDIT_ACTIONS } from '../middleware/audit.js';
import {
  loginAdmin,
  loginStudent,
  refreshAccessToken,
  logout,
  changePassword,
} from '../services/auth.service.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

// Password policy schema
const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters')
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Must contain at least one number');

const adminLoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

const studentLoginSchema = z.object({
  phone: z.string().min(10, 'Invalid phone number'),
  password: z.string().min(1, 'Password required'),
  tenantSlug: z.string().min(1, 'Study hall slug required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: passwordSchema,
});

// POST /api/auth/login-admin
router.post(
  '/login-admin',
  checkAuthLockout,
  validateBody(adminLoginSchema),
  async (req, res, next) => {
    try {
      const result = await loginAdmin({
        email: req.body.email,
        password: req.body.password,
        identifier: req.body.email,
      });

      req.logAudit({
        action: AUDIT_ACTIONS.LOGIN,
        resourceType: 'auth',
      });

      res.json(result);
    } catch (error) {
      if (
        error.message.includes('Invalid email') ||
        error.message.includes('not found')
      ) {
        return res.status(401).json({ error: error.message });
      }
      next(error);
    }
  }
);

// POST /api/auth/login-student
router.post(
  '/login-student',
  checkAuthLockout,
  validateBody(studentLoginSchema),
  async (req, res, next) => {
    try {
      const result = await loginStudent({
        phone: req.body.phone,
        password: req.body.password,
        tenantSlug: req.body.tenantSlug,
        identifier: req.body.phone,
      });

      res.json(result);
    } catch (error) {
      if (
        error.message.includes('Invalid') ||
        error.message.includes('not found')
      ) {
        return res.status(401).json({ error: error.message });
      }
      next(error);
    }
  }
);

// POST /api/auth/refresh
router.post('/refresh', validateBody(refreshSchema), async (req, res, next) => {
  try {
    const result = await refreshAccessToken(
      req.body.refreshToken,
      req.headers['user-agent'],
      req.ip
    );
    res.json(result);
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await logout(req.user.id);
    req.logAudit({ action: AUDIT_ACTIONS.LOGOUT, resourceType: 'auth' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  validateBody(changePasswordSchema),
  async (req, res, next) => {
    try {
      await changePassword(req.user.id, req.body.newPassword);
      req.logAudit({
        action: AUDIT_ACTIONS.PASSWORD_CHANGE,
        resourceType: 'auth',
      });
      res.json({
        success: true,
        message: 'Password changed. Please log in again.',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/register-student
// Self-registration by student (creates pending application)
const registerStudentSchema = z.object({
  tenantSlug: z.string().min(1),
  fullName: z.string().min(2, 'Full name required'),
  phone: z.string().min(10, 'Valid phone required'),
  password: passwordSchema,
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  preferredSeatId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  paymentMethod: z.enum(['cash', 'upi']).optional(),
  utrNumber: z.string().optional(),
});

router.post(
  '/register-student',
  validateBody(registerStudentSchema),
  async (req, res, next) => {
    try {
      const { tenantSlug, phone, password, email, ...profileData } = req.body;

      // Find tenant by slug
      const { data: tenant, error: tenantErr } = await supabaseAdmin
        .from('tenants')
        .select('id, status, hall_name')
        .eq('slug', tenantSlug)
        .single();

      if (tenantErr || !tenant) {
        return res.status(404).json({ error: 'Study hall not found' });
      }

      if (!['active', 'trial'].includes(tenant.status)) {
        return res
          .status(403)
          .json({ error: 'This study hall is not accepting registrations' });
      }

      // Check phone uniqueness within tenant
      const { data: existing } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('phone', phone)
        .single();

      if (existing) {
        return res
          .status(409)
          .json({ error: 'Phone number already registered at this study hall' });
      }

      // Create auth user
      const authEmail =
        email || `${phone.replace(/\D/g, '')}@${tenantSlug}.studyhub.local`;
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: authEmail,
          password,
          email_confirm: true,
        });

      if (authError) {
        return res.status(400).json({ error: authError.message });
      }

      // Create student record
      const { data: student, error: studentError } = await supabaseAdmin
        .from('students')
        .insert({
          tenant_id: tenant.id,
          user_id: authData.user.id,
          full_name: profileData.fullName,
          phone,
          email: email || null,
          date_of_birth: profileData.dateOfBirth || null,
          gender: profileData.gender || null,
          address: profileData.address || null,
          emergency_contact_name: profileData.emergencyContactName || null,
          emergency_contact_phone: profileData.emergencyContactPhone || null,
          emergency_contact_relation:
            profileData.emergencyContactRelation || null,
          preferred_seat_id: profileData.preferredSeatId || null,
          status: 'pending',
        })
        .select()
        .single();

      if (studentError) {
        // Rollback: delete auth user
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw new Error(studentError.message);
      }

      // Create seat booking request if plan + seat selected
      if (profileData.preferredSeatId && profileData.planId) {
        await supabaseAdmin.from('seat_booking_requests').insert({
          tenant_id: tenant.id,
          student_id: student.id,
          requested_seat_id: profileData.preferredSeatId,
          plan_id: profileData.planId,
          utr_number: profileData.utrNumber || null,
          payment_method: profileData.paymentMethod || null,
          status: 'pending',
        });
      }

      res.status(201).json({
        success: true,
        message:
          'Registration submitted! You will be notified once approved by the hall admin.',
        studentId: student.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
