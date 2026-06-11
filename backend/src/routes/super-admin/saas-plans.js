// ============================================================
// Super Admin: SaaS Pricing Plans Routes
// Stored as JSON in platform_settings table with key 'saas_plans'
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('super_admin'));

const PLANS_KEY = 'saas_plans';

const defaultPlans = [
  {
    id: 'standard',
    name: 'standard',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    oneTimePrice: null,
    maxSeats: 100,
    maxStudents: 150,
    features: [
      'Up to 100 seats',
      'Student self-registration portal',
      'Fee & payment management',
      'Seat booking & management',
      'Complaints & suggestions',
      'Basic reports',
      'In-app notifications',
      'Email support',
    ],
    isActive: true,
  },
  {
    id: 'premium',
    name: 'premium',
    monthlyPrice: 1999,
    yearlyPrice: 19990,
    oneTimePrice: null,
    maxSeats: 500,
    maxStudents: 750,
    features: [
      'Up to 500 seats',
      'Everything in Standard',
      'Advanced analytics & ML forecasting',
      'Churn risk analysis',
      'Custom hall branding & theme',
      'Gallery & resources management',
      'Real-time WebSocket dashboards',
      'Priority support',
    ],
    isActive: true,
  },
  {
    id: 'enterprise',
    name: 'enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    oneTimePrice: null,
    maxSeats: -1,
    maxStudents: -1,
    features: [
      'Unlimited seats & students',
      'Everything in Premium',
      'Custom domain support',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
      'On-site onboarding & training',
    ],
    isActive: true,
  },
];

async function getPlans() {
  const { data } = await supabaseAdmin
    .from('platform_settings')
    .select('value')
    .eq('key', PLANS_KEY)
    .single();
  if (!data) return defaultPlans;
  try {
    const plans = JSON.parse(data.value);
    return Array.isArray(plans) && plans.length > 0 ? plans : defaultPlans;
  } catch {
    return defaultPlans;
  }
}

async function savePlans(plans) {
  await supabaseAdmin
    .from('platform_settings')
    .upsert({ key: PLANS_KEY, value: JSON.stringify(plans) }, { onConflict: 'key' });
}

const planSchema = z.object({
  name: z.enum(['standard', 'premium', 'enterprise', 'custom']),
  monthlyPrice: z.number().nullable().optional(),
  yearlyPrice: z.number().nullable().optional(),
  oneTimePrice: z.number().nullable().optional(),
  maxSeats: z.number().default(100),
  maxStudents: z.number().default(150),
  features: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

// GET /api/super-admin/saas-plans
router.get('/', async (_req, res, next) => {
  try {
    const plans = await getPlans();
    res.json(plans);
  } catch (e) {
    next(e);
  }
});

// POST /api/super-admin/saas-plans
router.post('/', validateBody(planSchema), async (req, res, next) => {
  try {
    const plans = await getPlans();
    const newPlan = {
      id: `${req.body.name}-${Date.now()}`,
      ...req.body,
    };
    plans.push(newPlan);
    await savePlans(plans);
    res.status(201).json(newPlan);
  } catch (e) {
    next(e);
  }
});

// PUT /api/super-admin/saas-plans/:id
router.put('/:id', async (req, res, next) => {
  try {
    const plans = await getPlans();
    const idx = plans.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Plan not found' });

    plans[idx] = { ...plans[idx], ...req.body, id: req.params.id };
    await savePlans(plans);
    res.json(plans[idx]);
  } catch (e) {
    next(e);
  }
});

// DELETE /api/super-admin/saas-plans/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const plans = await getPlans();
    const idx = plans.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Plan not found' });

    plans.splice(idx, 1);
    await savePlans(plans);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

export default router;
