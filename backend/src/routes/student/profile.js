// ============================================================
// Student: Profile Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { upload, validateFileMagicBytes, processProfilePhoto, handleUploadError } from '../../middleware/upload.js';
import { uploadProfilePhoto } from '../../services/storage.service.js';
import { changePassword } from '../../services/auth.service.js';

const router = Router();
router.use(authenticate, requireRole('student'));

// GET /api/student/profile
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        assigned_seat:seats!assigned_seat_id(*, section:sections(name, color_code)),
        memberships(*, plan:subscription_plans(*)),
        tenant:tenants(hall_name, slug, logo_url, theme_color, owner_phone)
      `)
      .eq('user_id', req.user.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Student not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// PUT /api/student/profile
router.put('/', async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email().optional().or(z.literal('')),
      address: z.string().optional(),
      emergencyContactName: z.string().optional(),
      emergencyContactPhone: z.string().optional(),
      emergencyContactRelation: z.string().optional(),
    });
    const body = schema.parse(req.body);

    const updateData = {};
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.emergencyContactName !== undefined) updateData.emergency_contact_name = body.emergencyContactName;
    if (body.emergencyContactPhone !== undefined) updateData.emergency_contact_phone = body.emergencyContactPhone;
    if (body.emergencyContactRelation !== undefined) updateData.emergency_contact_relation = body.emergencyContactRelation;

    const { data, error } = await supabaseAdmin
      .from('students')
      .update(updateData)
      .eq('user_id', req.user.id)
      .eq('tenant_id', req.user.tenant_id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/student/profile/photo
router.post('/photo',
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
        .eq('user_id', req.user.id)
        .eq('tenant_id', req.user.tenant_id);

      res.json({ url });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/student/profile/change-password
router.post('/change-password', async (req, res, next) => {
  try {
    const schema = z.object({
      newPassword: z.string().min(8)
        .regex(/[A-Z]/, 'Needs uppercase')
        .regex(/[0-9]/, 'Needs number'),
    });
    const { newPassword } = schema.parse(req.body);
    await changePassword(req.user.id, newPassword);
    res.json({ success: true, message: 'Password changed. Please log in again.' });
  } catch (error) {
    next(error);
  }
});

export default router;
