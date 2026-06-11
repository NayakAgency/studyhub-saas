// ============================================================
// Receipt Service
// Generates receipt data objects for PDF rendering (frontend)
// The actual PDF is rendered client-side using html-to-image
// or can be generated server-side using puppeteer if needed
// ============================================================

import { supabaseAdmin } from '../config/supabase.js';

/**
 * Get full receipt data for a payment
 * Returns a structured object ready for PDF/PNG generation
 */
export const getReceiptData = async (paymentId, tenantId) => {
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select(`
      id,
      receipt_number,
      amount,
      payment_method,
      utr_number,
      payment_screenshot_url,
      payment_date,
      status,
      notes,
      created_at,
      student:students (
        id,
        full_name,
        student_code,
        phone,
        email
      ),
      membership:memberships (
        id,
        start_date,
        end_date,
        seat:seats ( seat_number, section:sections(name) ),
        plan:subscription_plans ( plan_name, plan_type, validity_type, price )
      )
    `)
    .eq('id', paymentId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !payment) throw new Error('Payment not found');

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('hall_name, address, city, owner_phone, owner_email, logo_url, theme_color')
    .eq('id', tenantId)
    .single();

  const { data: settings } = await supabaseAdmin
    .from('hall_settings')
    .select('currency_symbol')
    .eq('tenant_id', tenantId)
    .single();

  return {
    payment,
    tenant,
    currencySymbol: settings?.currency_symbol || '₹',
    generatedAt: new Date().toISOString(),
  };
};

/**
 * Generate a receipt number preview string (for display only)
 */
export const formatReceiptNumber = (receiptNumber) => {
  if (!receiptNumber) return '—';
  return receiptNumber;
};

/**
 * Get all payment receipts for a student (summary list)
 */
export const getStudentReceipts = async (studentId, tenantId) => {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select(`
      id,
      receipt_number,
      amount,
      payment_method,
      payment_date,
      status
    `)
    .eq('student_id', studentId)
    .eq('tenant_id', tenantId)
    .eq('status', 'verified')
    .order('payment_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
};
