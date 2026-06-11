// ============================================================
// Admin: Student Management Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { AUDIT_ACTIONS } from '../../middleware/audit.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { upload, validateFileMagicBytes, processProfilePhoto, handleUploadError } from '../../middleware/upload.js';
import { uploadProfilePhoto } from '../../services/storage.service.js';
import { createNotification, NOTIFICATION_TYPES } from '../../services/notification.service.js';
import { sendStudentWelcomeEmail } from '../../services/email.service.js';
import { env } from '../../config/env.js';

const router = Router();

// Apply auth to all routes
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['pending', 'active', 'inactive', 'suspended', 'rejected', 'all']).default('all'),
  section: z.string().uuid().optional(),
  plan: z.string().uuid().optional(),
});

const uuidSchema = z.object({ id: z.string().uuid() });

const createStudentSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  assignedSeatId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  status: z.enum(['pending', 'active']).default('pending'),
});

const updateStudentSchema = createStudentSchema.partial();

const statusSchema = z.object({
  status: z.enum(['pending', 'active', 'inactive', 'suspended', 'rejected']),
  reason: z.string().optional(),
});

// GET /api/admin/students
router.get('/', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { page, limit, search, status, section } = req.q;
    const tenantId = req.user.tenant_id;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('students')
      .select(`
        id, student_code, full_name, phone, email, status,
        registered_at, activated_at,
        profile_photo_url,
        assigned_seat:seats!assigned_seat_id(id, seat_number, section:sections(name)),
        memberships(id, plan:subscription_plans(plan_name), start_date, end_date, status)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,student_code.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    res.json({
      data,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/students/:id
router.get('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        assigned_seat:seats!assigned_seat_id(*, section:sections(name, color_code)),
        preferred_seat:seats!preferred_seat_id(*, section:sections(name)),
        memberships(*, plan:subscription_plans(*), seat:seats(seat_number)),
        payments(*, receipt_number, payment_date, amount, payment_method),
        complaints(id, complaint_number, subject, status, priority, created_at),
        seat_change_requests(id, status, reason, created_at)
      `)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Student not found' });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/students
router.post('/', validateBody(createStudentSchema), async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const { fullName, phone, email, assignedSeatId, planId, startDate, ...rest } = req.body;

    // Check phone uniqueness
    const { data: existing } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .single();

    if (existing) return res.status(409).json({ error: 'Phone number already registered' });

    // Create auth user with temp email (fire-and-forget — don't block response)
    const authEmail = email || `${phone.replace(/\D/g, '')}@${tenantId}.internal`;
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

    // Create auth user asynchronously — don't await, don't block student creation
    const authUserPromise = supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: tempPassword,
      email_confirm: true,
    }).catch(err => console.error('[student create] auth user error:', err.message));

    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        tenant_id: tenantId,
        user_id: null, // will be patched async after auth user creation
        full_name: fullName,
        phone,
        email: email || null,
        date_of_birth: rest.dateOfBirth || null,
        gender: rest.gender || null,
        address: rest.address || null,
        emergency_contact_name: rest.emergencyContactName || null,
        emergency_contact_phone: rest.emergencyContactPhone || null,
        emergency_contact_relation: rest.emergencyContactRelation || null,
        assigned_seat_id: assignedSeatId || null,
        status: rest.status || 'active',
        activated_at: rest.status === 'active' ? new Date().toISOString() : null,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (studentError) throw new Error(studentError.message);

    // Patch user_id once auth user is ready (background)
    authUserPromise.then(async (authResult) => {
      if (authResult?.data?.user?.id) {
        await supabaseAdmin.from('students')
          .update({ user_id: authResult.data.user.id })
          .eq('id', student.id)
          .catch(e => console.error('[student create] patch user_id error:', e.message));
      }
    });

    // Create membership if plan provided
    if (planId && assignedSeatId) {
      const { data: plan } = await supabaseAdmin
        .from('subscription_plans')
        .select('validity_days, validity_type')
        .eq('id', planId)
        .single();

      if (plan) {
        const start = startDate ? new Date(startDate) : new Date();
        const end = new Date(start);
        const days = plan.validity_days || (plan.validity_type === 'monthly' ? 30 : plan.validity_type === 'weekly' ? 7 : 30);
        end.setDate(end.getDate() + days);

        await supabaseAdmin.from('memberships').insert({
          tenant_id: tenantId,
          student_id: student.id,
          plan_id: planId,
          seat_id: assignedSeatId,
          start_date: start.toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0],
          status: 'active',
          created_by: req.user.id,
        });

        // Update seat status
        await supabaseAdmin.from('seats').update({ status: 'occupied' }).eq('id', assignedSeatId);

        // Update student assigned seat
        await supabaseAdmin.from('students').update({
          assigned_seat_id: assignedSeatId,
          activated_at: new Date().toISOString(),
        }).eq('id', student.id);
      }
    }

    req.logAudit({
      action: AUDIT_ACTIONS.STUDENT_CREATE,
      resourceType: 'students',
      resourceId: student.id,
      newValues: { fullName, phone, status: student.status },
    });

    // Send welcome email if student has a real email address
    if (email && !email.includes('.internal')) {
      const { data: tenant } = await supabaseAdmin
        .from('tenants').select('hall_name, slug').eq('id', tenantId).single();
      await sendStudentWelcomeEmail({
        studentEmail: email,
        studentName: fullName,
        hallName: tenant?.hall_name,
        tempPassword,
        slug: tenant?.slug,
      });
    }

    res.status(201).json(student);
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/students/:id
router.put('/:id', validateParams(uuidSchema), validateBody(updateStudentSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenant_id;

    const { data: existing } = await supabaseAdmin
      .from('students').select('*').eq('id', id).eq('tenant_id', tenantId).single();
    if (!existing) return res.status(404).json({ error: 'Student not found' });

    const updateData = {};
    const fields = ['fullName', 'email', 'dateOfBirth', 'gender', 'address',
      'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation'];

    const dbFieldMap = {
      fullName: 'full_name', email: 'email', dateOfBirth: 'date_of_birth',
      gender: 'gender', address: 'address',
      emergencyContactName: 'emergency_contact_name',
      emergencyContactPhone: 'emergency_contact_phone',
      emergencyContactRelation: 'emergency_contact_relation',
    };

    fields.forEach((f) => {
      if (req.body[f] !== undefined) updateData[dbFieldMap[f]] = req.body[f] || null;
    });

    const { data, error } = await supabaseAdmin
      .from('students').update(updateData).eq('id', id).eq('tenant_id', tenantId).select().single();

    if (error) throw new Error(error.message);

    req.logAudit({
      action: AUDIT_ACTIONS.STUDENT_UPDATE,
      resourceType: 'students',
      resourceId: id,
      oldValues: existing,
      newValues: updateData,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/students/:id/status
router.patch('/:id/status', validateParams(uuidSchema), validateBody(statusSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = req.user.tenant_id;

    const updateData = { status };
    if (status === 'active') updateData.activated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('students')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Student not found' });

    req.logAudit({
      action: AUDIT_ACTIONS.STUDENT_STATUS_CHANGE,
      resourceType: 'students',
      resourceId: id,
      newValues: { status },
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/students/:id
router.delete('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenant_id;

    const { data: student } = await supabaseAdmin
      .from('students').select('user_id, assigned_seat_id').eq('id', id).eq('tenant_id', tenantId).single();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Free the seat
    if (student.assigned_seat_id) {
      await supabaseAdmin.from('seats').update({ status: 'available' }).eq('id', student.assigned_seat_id);
    }

    // Cancel active memberships
    await supabaseAdmin.from('memberships').update({ status: 'cancelled' })
      .eq('student_id', id).eq('status', 'active');

    // Delete student
    await supabaseAdmin.from('students').delete().eq('id', id).eq('tenant_id', tenantId);

    // Delete auth user
    if (student.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(student.user_id);
    }

    req.logAudit({
      action: AUDIT_ACTIONS.STUDENT_DELETE,
      resourceType: 'students',
      resourceId: id,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/students/:id/history
router.get('/:id/history', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .or(`resource_id.eq.${req.params.id},new_values->>student_id.eq.${req.params.id}`)
      .eq('tenant_id', req.user.tenant_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/students/:id/photo
router.post('/:id/photo',
  validateParams(uuidSchema),
  upload.single('photo'),
  handleUploadError,
  validateFileMagicBytes,
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const processed = await processProfilePhoto(req.file.buffer);
      const { url } = await uploadProfilePhoto(processed, req.user.tenant_id);

      await supabaseAdmin
        .from('students')
        .update({ profile_photo_url: url })
        .eq('id', req.params.id)
        .eq('tenant_id', req.user.tenant_id);

      res.json({ url });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

