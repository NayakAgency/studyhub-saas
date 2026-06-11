// ============================================================
// Admin: Gallery Routes
// GET    /api/admin/gallery
// POST   /api/admin/gallery        (multipart/form-data, field: images)
// PUT    /api/admin/gallery/:id
// DELETE /api/admin/gallery/:id
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateParams } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { upload, validateFileMagicBytes, processImage, handleUploadError } from '../../middleware/upload.js';
import { uploadGalleryImage } from '../../services/storage.service.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

// GET /api/admin/gallery
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('hall_gallery')
      .select('*')
      .eq('tenant_id', req.user.tenant_id)
      .order('display_order');

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/gallery — upload multiple images
router.post('/',
  upload.array('images', 10),
  handleUploadError,
  validateFileMagicBytes,
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
      }

      const results = [];
      for (const file of req.files) {
        const processed = await processImage(file.buffer, { width: 1200, height: 900 });
        const { url } = await uploadGalleryImage(processed, req.user.tenant_id);

        const { data } = await supabaseAdmin
          .from('hall_gallery')
          .insert({
            tenant_id: req.user.tenant_id,
            image_url: url,
            caption: req.body.caption || null,
            uploaded_by: req.user.id,
          })
          .select()
          .single();

        if (data) results.push(data);
      }

      res.status(201).json(results);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/admin/gallery/:id
router.put('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const schema = z.object({
      caption:      z.string().optional(),
      displayOrder: z.number().optional(),
      isActive:     z.boolean().optional(),
    });
    const body = schema.parse(req.body);

    const updateData = {};
    if (body.caption !== undefined)      updateData.caption       = body.caption;
    if (body.displayOrder !== undefined) updateData.display_order = body.displayOrder;
    if (body.isActive !== undefined)     updateData.is_active     = body.isActive;

    const { data, error } = await supabaseAdmin
      .from('hall_gallery')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Image not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/gallery/:id
router.delete('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('hall_gallery')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id);

    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
