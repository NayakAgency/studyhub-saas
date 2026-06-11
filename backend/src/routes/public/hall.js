// ============================================================
// Public Routes: Hall Website Data (no auth required)
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendContactInquiryNotification } from '../../services/email.service.js';

const router = Router();

const slugSchema = z.object({ slug: z.string().min(1) });

// POST /api/public/inquire — Hall owner demo/partner request
router.post('/inquire', async (req, res, next) => {
  try {
    const schema = z.object({
      ownerName:    z.string().min(2),
      ownerEmail:   z.string().email(),
      ownerPhone:   z.string().min(10),
      hallName:     z.string().min(2),
      city:         z.string().optional(),
      seatCount:    z.coerce.number().optional(),
      message:      z.string().optional(),
      planInterest: z.enum(['standard','premium','enterprise']).optional(),
    });
    const body = schema.parse(req.body);

    const { data, error } = await supabaseAdmin.from('hall_inquiries').insert({
      owner_name:    body.ownerName,
      owner_email:   body.ownerEmail,
      owner_phone:   body.ownerPhone,
      hall_name:     body.hallName,
      city:          body.city || null,
      seat_count:    body.seatCount || null,
      message:       body.message || null,
      plan_interest: body.planInterest || null,
      status:        'new',
      is_read:       false,
    }).select().single();

    if (error) throw new Error(error.message);

    res.status(201).json({ success: true, id: data.id, message: 'Your request has been submitted. We will contact you within 24 hours.' });
  } catch (e) {
    next(e);
  }
});

// GET /api/public/halls — list all active halls with min plan price
router.get('/halls', async (req, res, next) => {
  try {
    const { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('id, hall_name, slug, city, logo_url, theme_color, address')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    // Get min price for each
    const halls = await Promise.all((tenants || []).map(async (t) => {
      const { data: plans } = await supabaseAdmin
        .from('subscription_plans')
        .select('price')
        .eq('tenant_id', t.id)
        .eq('is_active', true)
        .order('price', { ascending: true })
        .limit(1);
      return { ...t, minPrice: plans?.[0]?.price || null };
    }));
    res.json(halls);
  } catch (e) {
    next(e);
  }
});

// GET /api/public/nearest?lat=X&lng=Y — nearest hall by geolocation (simplified)
router.get('/nearest', async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin
      .from('tenants')
      .select('id, hall_name, slug, city, address')
      .eq('status', 'active')
      .limit(3);
    res.json(data || []);
  } catch (e) {
    next(e);
  }
});

// GET /api/public/:slug
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = slugSchema.parse(req.params);

    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, hall_name, slug, address, city, logo_url, theme_color, owner_phone, owner_email')
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (error || !tenant) return res.status(404).json({ error: 'Study hall not found' });

    const { data: settings } = await supabaseAdmin
      .from('hall_settings')
      .select('hall_open_time, hall_close_time, working_days, website_enabled, public_seat_visibility, terms_and_conditions')
      .eq('tenant_id', tenant.id)
      .single();

    if (settings && !settings.website_enabled) {
      return res.status(403).json({ error: 'This study hall website is currently disabled' });
    }

    res.json({ tenant, settings });
  } catch (error) {
    next(error);
  }
});

// GET /api/public/:slug/plans
router.get('/:slug/plans', async (req, res, next) => {
  try {
    const { slug } = slugSchema.parse(req.params);
    const { category } = req.query; // optional: ac | non_ac | other | any

    const { data: tenant } = await supabaseAdmin
      .from('tenants').select('id').eq('slug', slug).eq('status', 'active').single();
    if (!tenant) return res.status(404).json({ error: 'Hall not found' });

    let query = supabaseAdmin
      .from('subscription_plans')
      .select('id, plan_name, description, plan_type, seat_category, time_slots, validity_type, validity_days, price, features')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('display_order');

    // Filter by seat category if provided (also include 'any' plans)
    if (category && category !== 'any') {
      query = query.or(`seat_category.eq.${category},seat_category.eq.any`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

// GET /api/public/:slug/seats
router.get('/:slug/seats', async (req, res, next) => {
  try {
    const { slug } = slugSchema.parse(req.params);
    const { category } = req.query; // optional filter: ac | non_ac | other

    const { data: tenant } = await supabaseAdmin
      .from('tenants').select('id').eq('slug', slug).eq('status', 'active').single();
    if (!tenant) return res.status(404).json({ error: 'Hall not found' });

    // Check visibility setting
    const { data: settings } = await supabaseAdmin
      .from('hall_settings').select('public_seat_visibility').eq('tenant_id', tenant.id).single();
    if (settings && !settings.public_seat_visibility) {
      return res.json({ sections: [], message: 'Seat map not publicly visible' });
    }

    const { data: sections } = await supabaseAdmin
      .from('sections')
      .select(`
        id, name, color_code,
        seats(id, seat_number, status, seat_type, category, row_position, col_position)
      `)
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('display_order');

    // Map seats: public view shows available/reserved/occupied (no student names)
    const sectionsWithStatus = (sections || []).map(sec => {
      let seats = (sec.seats || []);

      // Filter by category if requested
      if (category && category !== 'any') {
        seats = seats.filter(s => s.category === category || !s.category);
      }

      return {
        ...sec,
        seats: seats.map(seat => ({
          id: seat.id,
          seat_number: seat.seat_number,
          seat_type: seat.seat_type,
          category: seat.category || 'non_ac',
          row_position: seat.row_position,
          col_position: seat.col_position,
          status: seat.status === 'available' ? 'available'
                : seat.status === 'reserved'  ? 'reserved'
                : 'occupied',
        })),
      };
    });

    res.json({ sections: sectionsWithStatus });
  } catch (error) {
    next(error);
  }
});

// GET /api/public/:slug/gallery
router.get('/:slug/gallery', async (req, res, next) => {
  try {
    const { slug } = slugSchema.parse(req.params);
    const { data: tenant } = await supabaseAdmin
      .from('tenants').select('id').eq('slug', slug).eq('status', 'active').single();
    if (!tenant) return res.status(404).json({ error: 'Hall not found' });

    const { data } = await supabaseAdmin
      .from('hall_gallery')
      .select('id, image_url, caption, display_order')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('display_order');

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

// GET /api/public/:slug/faqs
router.get('/:slug/faqs', async (req, res, next) => {
  try {
    const { slug } = slugSchema.parse(req.params);
    const { data: tenant } = await supabaseAdmin
      .from('tenants').select('id').eq('slug', slug).eq('status', 'active').single();
    if (!tenant) return res.status(404).json({ error: 'Hall not found' });

    const { data, error } = await supabaseAdmin
      .from('hall_faqs')
      .select('id, question, answer, display_order')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('display_order')
      .order('created_at');

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

// POST /api/public/validate-utr — check if a UTR has already been used (fraud prevention)
router.post('/validate-utr', async (req, res, next) => {
  try {
    const schema = z.object({ utrNumber: z.string().min(1) });
    const { utrNumber } = schema.parse(req.body);

    const { data: existing } = await supabaseAdmin
      .from('used_utrs')
      .select('id, tenant_id, created_at')
      .eq('utr_number', utrNumber.trim().toUpperCase())
      .single();

    if (existing) {
      return res.json({ valid: false, message: 'This UTR number has already been used for a previous payment. Please use a different UTR.' });
    }

    // Also check in payments table (for UTRs not yet migrated to used_utrs)
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('utr_number', utrNumber.trim().toUpperCase())
      .eq('status', 'verified')
      .single();

    if (payment) {
      return res.json({ valid: false, message: 'This UTR number has already been used. Please use a new transaction UTR.' });
    }

    return res.json({ valid: true, message: 'UTR is valid and not previously used.' });
  } catch (e) {
    next(e);
  }
});

// POST /api/public/:slug/contact
router.post('/:slug/contact', async (req, res, next) => {
  try {
    const { slug } = slugSchema.parse(req.params);

    const schema = z.object({
      name: z.string().min(2),
      phone: z.string().min(10),
      email: z.string().email().optional().or(z.literal('')),
      message: z.string().min(10),
    });
    const body = schema.parse(req.body);

    const { data: tenant } = await supabaseAdmin
      .from('tenants').select('id, hall_name, owner_email').eq('slug', slug).eq('status', 'active').single();
    if (!tenant) return res.status(404).json({ error: 'Hall not found' });

    await supabaseAdmin.from('contact_inquiries').insert({
      tenant_id: tenant.id,
      name: body.name,
      phone: body.phone,
      email: body.email || null,
      message: body.message,
    });

    // Email admin
    await sendContactInquiryNotification({
      adminEmail: tenant.owner_email,
      inquiryName: body.name,
      inquiryPhone: body.phone,
      message: body.message,
      hallName: tenant.hall_name,
    });

    res.status(201).json({ success: true, message: 'Your message has been sent!' });
  } catch (error) {
    next(error);
  }
});

export default router;
