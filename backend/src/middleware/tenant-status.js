// ============================================================
// Tenant Status Enforcement Middleware
// Blocks access for suspended or trial-expired tenants
// ============================================================

import { supabaseAdmin } from '../config/supabase.js';

export const enforceTenantActive = async (req, res, next) => {
  // Super admins bypass this check
  if (!req.user || req.user.role === 'super_admin') return next();

  // No tenant context (shouldn't reach here if requireTenant runs first)
  if (!req.user.tenant_id) return next();

  try {
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('status, trial_ends_at, hall_name')
      .eq('id', req.user.tenant_id)
      .single();

    if (error || !tenant) {
      return res.status(403).json({ error: 'Tenant not found' });
    }

    if (tenant.status === 'suspended') {
      return res.status(403).json({
        error: 'TENANT_SUSPENDED',
        message: 'Your study hall account has been suspended. Please contact support.',
        hallName: tenant.hall_name,
      });
    }

    if (tenant.status === 'pending') {
      return res.status(403).json({
        error: 'TENANT_PENDING',
        message: 'Your study hall account is pending approval.',
        hallName: tenant.hall_name,
      });
    }

    if (tenant.status === 'trial' && tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()) {
      return res.status(403).json({
        error: 'TRIAL_EXPIRED',
        message: 'Your trial period has ended. Please contact the platform to continue.',
        hallName: tenant.hall_name,
        trialEndedAt: tenant.trial_ends_at,
      });
    }

    // Attach tenant info for downstream use
    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('Tenant status check error:', error);
    return res.status(500).json({ error: 'Failed to verify tenant status' });
  }
};
