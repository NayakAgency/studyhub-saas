import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
const env = {};
readFileSync('c:/Users/lokes/Desktop/New folder/backend/.env', 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const phone = '9846862276';
const password = 'Student@123';

// 1. Find student record
const { data: student } = await supabaseAdmin.from('students').select('id,user_id,phone,full_name,status').eq('phone', phone).single();
console.log('Student record:', student);

if (!student?.user_id) { console.log('No user_id'); process.exit(1); }

// 2. Get auth user email
const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(student.user_id);
console.log('Auth email:', authUser?.user?.email);

// 3. Try Supabase signIn
const email = authUser?.user?.email;
if (email) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.log('Supabase auth error:', error.message);
  } else {
    console.log('Supabase auth OK! user_id:', data.user?.id);
  }
}

// 4. Check if lockout exists
const { data: lockout } = await supabaseAdmin.from('auth_lockouts').select('*').eq('identifier', phone).single();
console.log('Lockout:', lockout);
