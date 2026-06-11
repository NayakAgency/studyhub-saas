// ============================================================
// Super Admin: Platform Settings Routes
// GET /api/super-admin/platform-settings
// PUT /api/super-admin/platform-settings
// POST /api/super-admin/platform-settings/change-password
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('super_admin'));

const SETTINGS_KEY = 'platform_settings';

const defaultSettings = {
  appName: 'StudyHub',
  appTagline: 'The complete SaaS platform for study hall owners',
  primaryColor: '#6366f1',
  supportEmail: 'support@studyhub.app',
  studentPortalLabel: 'Student Portal',
  adminPortalLabel: 'Admin Portal',
  maxTenantsPerPlan: { standard: 1, premium: 5, enterprise: -1 },
};

async function getSettings() {
  const { data } = await supabaseAdmin
    .from('platform_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single();
  if (!data) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(data.value) };
  } catch {
    return defaultSettings;
  }
}

// GET /api/super-admin/platform-settings
router.get('/', async (_req, res, next) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (e) {
    next(e);
  }
});

// PUT /api/super-admin/platform-settings
router.put('/', validateBody(z.object({
  appName: z.string().min(1).optional(),
  appTagline: z.string().optional(),
  primaryColor: z.string().optional(),
  supportEmail: z.string().email().optional(),
  studentPortalLabel: z.string().optional(),
  adminPortalLabel: z.string().optional(),
  maxTenantsPerPlan: z.record(z.number()).optional(),
})), async (req, res, next) => {
  try {
    const current = await getSettings();
    const updated = { ...current, ...req.body };

    await supabaseAdmin
      .from('platform_settings')
      .upsert({ key: SETTINGS_KEY, value: JSON.stringify(updated) }, { onConflict: 'key' });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /api/super-admin/platform-settings/change-password
router.post('/change-password', validateBody(z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8),
})), async (req, res, next) => {
  try {
    const { newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, {
      password: newPassword,
    });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (e) {
    next(e);
  }
});

export default router;
