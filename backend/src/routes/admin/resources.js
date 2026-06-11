// ============================================================
// Admin: Study Resources Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateParams } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { uploadPdf, validateFileMagicBytes, handleUploadError } from '../../middleware/upload.js';
import { uploadStudyResource } from '../../services/storage.service.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

// GET /api/admin/resources
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('study_resources')
      .select('*')
      .eq('tenant_id', req.user.tenant_id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/resources
router.post('/',
  uploadPdf.single('file'),
  handleUploadError,
  validateFileMagicBytes,
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No PDF file provided' });

      const { url } = await uploadStudyResource(req.file.buffer, req.user.tenant_id);

      const { data, error } = await supabaseAdmin
        .from('study_resources')
        .insert({
          tenant_id: req.user.tenant_id,
          title: req.body.title || 'Untitled Resource',
          description: req.body.description || null,
          file_url: url,
          file_size_bytes: req.file.size,
          subject_tag: req.body.subjectTag || null,
          uploaded_by: req.user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/admin/resources/:id
router.put('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      subjectTag: z.string().optional(),
      isActive: z.boolean().optional(),
    });
    const body = schema.parse(req.body);
    const updateData = {};
    if (body.title) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.subjectTag !== undefined) updateData.subject_tag = body.subjectTag;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    const { data, error } = await supabaseAdmin
      .from('study_resources')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Resource not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/resources/:id
router.delete('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    await supabaseAdmin.from('study_resources').delete()
      .eq('id', req.params.id).eq('tenant_id', req.user.tenant_id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
