// ============================================================
// Seed Super Admin
// Run once after setting up Supabase: node scripts/seed-super-admin.js
// ============================================================

import '../src/config/env.js';
import { supabaseAdmin } from '../src/config/supabase.js';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@studyhub.app';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'NayakWorks Admin';

async function seedSuperAdmin() {
  console.log('🌱 Seeding super admin...');

  try {
    // Check if already exists
    const { data: existing } = await supabaseAdmin
      .from('super_admins')
      .select('id, email')
      .eq('email', SUPER_ADMIN_EMAIL)
      .single();

    if (existing) {
      console.log(`✅ Super admin already exists: ${existing.email}`);
      return;
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
      email_confirm: true,
    });

    if (authError) {
      // User might already exist in auth
      console.warn('Auth user creation note:', authError.message);

      // Try to find existing auth user
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = users?.users?.find((u) => u.email === SUPER_ADMIN_EMAIL);

      if (!existingUser) {
        throw authError;
      }

      // Create super_admin record for existing user
      const { error: insertError } = await supabaseAdmin.from('super_admins').insert({
        user_id: existingUser.id,
        full_name: SUPER_ADMIN_NAME,
        email: SUPER_ADMIN_EMAIL,
        is_active: true,
      });

      if (insertError) throw insertError;
      console.log(`✅ Super admin record created for existing user: ${SUPER_ADMIN_EMAIL}`);
      return;
    }

    // Create super_admin record
    const { error: insertError } = await supabaseAdmin.from('super_admins').insert({
      user_id: authData.user.id,
      full_name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      is_active: true,
    });

    if (insertError) throw insertError;

    console.log('✅ Super admin created successfully!');
    console.log(`   Email: ${SUPER_ADMIN_EMAIL}`);
    console.log(`   Password: ${SUPER_ADMIN_PASSWORD}`);
    console.log('\n⚠️  IMPORTANT: Change this password immediately after first login!');

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seedSuperAdmin().then(() => process.exit(0));
