// ============================================================
// Admin: Hall Settings Routes
// GET  /api/admin/settings
// PUT  /api/admin/settings
// POST /api/admin/settings/logo
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { upload, validateFileMagicBytes, processImage, handleUploadError } from '../../middleware/upload.js';
import { uploadHallLogo } from '../../services/storage.service.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

// GET /api/admin/settings
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;

    const [settingsRes, tenantRes] = await Promise.all([
      supabaseAdmin.from('hall_settings').select('*').eq('tenant_id', tenantId).single(),
      supabaseAdmin.from('tenants').select('hall_name, logo_url, address, city, owner_phone, owner_email, theme_color').eq('id', tenantId).single(),
    ]);

    res.json({
      settings: settingsRes.data,
      tenant: tenantRes.data,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/settings
router.put('/', async (req, res, next) => {
  try {
    const schema = z.object({
      hallOpenTime: z.string().optional(),
      hallCloseTime: z.string().optional(),
      workingDays: z.array(z.string()).optional(),
      feeDueDay: z.number().min(1).max(31).optional(),
      renewalReminderDays: z.number().min(1).optional(),
      maxComplaintDays: z.number().min(1).optional(),
      gracePeriodDays: z.number().min(0).max(30).optional(),
      autoSuspendOverdue: z.boolean().optional(),
      currencySymbol: z.string().optional(),
      websiteEnabled: z.boolean().optional(),
      publicSeatVisibility: z.boolean().optional(),
      termsAndConditions: z.string().optional(),
      // Tenant fields
      hallName: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      ownerPhone: z.string().optional(),
      themeColor: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const tenantId = req.user.tenant_id;

    // Update hall_settings
    const settingsUpdate = {};
    const settingsFieldMap = {
      hallOpenTime: 'hall_open_time', hallCloseTime: 'hall_close_time',
      workingDays: 'working_days', feeDueDay: 'fee_due_day',
      renewalReminderDays: 'renewal_reminder_days', maxComplaintDays: 'max_complaint_days',
      gracePeriodDays: 'grace_period_days', autoSuspendOverdue: 'auto_suspend_overdue',
      currencySymbol: 'currency_symbol', websiteEnabled: 'website_enabled',
      publicSeatVisibility: 'public_seat_visibility', termsAndConditions: 'terms_and_conditions',
    };
    Object.entries(settingsFieldMap).forEach(([k, v]) => {
      if (body[k] !== undefined) settingsUpdate[v] = body[k];
    });

    if (Object.keys(settingsUpdate).length > 0) {
      await supabaseAdmin.from('hall_settings').upsert({ tenant_id: tenantId, ...settingsUpdate });
    }

    // Update tenant info
    const tenantUpdate = {};
    if (body.hallName) tenantUpdate.hall_name = body.hallName;
    if (body.address) tenantUpdate.address = body.address;
    if (body.city) tenantUpdate.city = body.city;
    if (body.ownerPhone) tenantUpdate.owner_phone = body.ownerPhone;
    if (body.themeColor) tenantUpdate.theme_color = body.themeColor;

    if (Object.keys(tenantUpdate).length > 0) {
      await supabaseAdmin.from('tenants').update(tenantUpdate).eq('id', tenantId);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/settings/logo
router.post('/logo',
  upload.single('logo'),
  handleUploadError,
  validateFileMagicBytes,
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file provided' });
      const processed = await processImage(req.file.buffer, { width: 400, height: 400, fit: 'contain' });
      const { url } = await uploadHallLogo(processed, req.user.tenant_id);
      await supabaseAdmin.from('tenants').update({ logo_url: url }).eq('id', req.user.tenant_id);
      res.json({ url });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
