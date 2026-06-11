// ============================================================
// Auth Lockout Middleware
// Persistent brute force protection (DB-backed)
// ============================================================

import { supabaseAdmin } from '../config/supabase.js';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const checkAuthLockout = async (req, res, next) => {
  const identifier = req.body.email || req.body.phone || req.ip;
  if (!identifier) return next();

  try {
    const { data: lockout } = await supabaseAdmin
      .from('auth_lockouts')
      .select('*')
      .eq('identifier', identifier)
      .single();

    if (lockout) {
      // Check if currently locked out
      if (lockout.locked_until && new Date(lockout.locked_until) > new Date()) {
        const minutesLeft = Math.ceil(
          (new Date(lockout.locked_until) - new Date()) / (1000 * 60)
        );
        return res.status(429).json({
          error: 'ACCOUNT_LOCKED',
          message: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
          lockedUntil: lockout.locked_until,
        });
      }
    }

    // Attach identifier to req for failure tracking
    req.authIdentifier = identifier;
    next();
  } catch (error) {
    // Don't block login if lockout check fails
    console.error('Lockout check error:', error);
    req.authIdentifier = identifier;
    next();
  }
};

export const recordLoginFailure = async (identifier) => {
  if (!identifier) return;

  try {
    const { data: existing } = await supabaseAdmin
      .from('auth_lockouts')
      .select('*')
      .eq('identifier', identifier)
      .single();

    if (existing) {
      const newAttemptCount = (existing.attempt_count || 0) + 1;
      const isLocked = newAttemptCount >= MAX_ATTEMPTS;

      await supabaseAdmin
        .from('auth_lockouts')
        .update({
          attempt_count: newAttemptCount,
          last_attempt: new Date().toISOString(),
          locked_until: isLocked
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
            : null,
        })
        .eq('identifier', identifier);
    } else {
      await supabaseAdmin.from('auth_lockouts').insert({
        identifier,
        attempt_count: 1,
        last_attempt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Record login failure error:', error);
  }
};

export const clearLoginFailures = async (identifier) => {
  if (!identifier) return;

  try {
    await supabaseAdmin
      .from('auth_lockouts')
      .delete()
      .eq('identifier', identifier);
  } catch (error) {
    console.error('Clear login failures error:', error);
  }
};
