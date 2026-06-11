const API = 'https://studyhub-api-delta.vercel.app/api';

async function call(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, data: json };
}

async function main() {
  console.log('=== Student Flow Test ===\n');

  // 1. Register new student
  const phone = `98${Math.floor(Math.random() * 100000000).toString().padStart(8,'0')}`;
  console.log(`1. Registering student: phone=${phone}`);
  const reg = await call('POST', '/auth/register-student', {
    fullName: 'Kavya Reddy', phone, password: 'Student@123',
    tenantSlug: 'sri-ramana', gender: 'female', address: 'Hyderabad'
  });
  console.log(`   Register: ${reg.status} — ${JSON.stringify(reg.data)}`);

  if (!reg.ok) { console.log('Registration failed, aborting'); process.exit(1); }

  // 2. Login as student
  console.log('\n2. Student login...');
  const login = await call('POST', '/auth/login-student', { phone, password: 'Student@123', tenantSlug: 'sri-ramana' });
  console.log(`   Login: ${login.status} — role=${login.data.user?.role} name=${login.data.user?.fullName}`);

  const token = login.data.accessToken;
  if (!token) { console.log('Login failed:', login.data); process.exit(1); }

  // 3. Get profile
  console.log('\n3. Student profile...');
  const prof = await call('GET', '/student/profile', null, token);
  console.log(`   Profile: ${prof.status} — name=${prof.data.student?.full_name} status=${prof.data.student?.status}`);

  // 4. Get membership
  const mem = await call('GET', '/student/membership', null, token);
  console.log(`4. Membership: ${mem.status}`);

  // 5. Get fees
  const fees = await call('GET', '/student/fees', null, token);
  console.log(`5. Fees: ${fees.status}`);

  // 6. Announcements
  const ann = await call('GET', '/student/announcements', null, token);
  console.log(`6. Announcements: ${ann.status} count=${ann.data.data?.length ?? 0}`);

  // 7. Submit complaint
  const cmp = await call('POST', '/student/complaints', {
    category: 'facility', subject: 'AC not working',
    description: 'AC in premium zone not working since 2 days.', priority: 'high'
  }, token);
  console.log(`7. Complaint: ${cmp.status} — id=${cmp.data.complaint?.id}`);

  // 8. Submit suggestion
  const sug = await call('POST', '/student/suggestions', {
    subject: 'Add more whiteboards', description: 'Need more whiteboards.',
    category: 'facility', isAnonymous: false
  }, token);
  console.log(`8. Suggestion: ${sug.status}`);

  // 9. Update profile
  const upd = await call('PUT', '/student/profile', {
    address: 'Updated: Banjara Hills, Hyderabad',
    emergencyContactName: 'Ravi Reddy', emergencyContactPhone: '9900000001'
  }, token);
  console.log(`9. Profile update: ${upd.status}`);

  // 10. Notifications
  const notif = await call('GET', '/student/notifications', null, token);
  console.log(`10. Notifications: ${notif.status} count=${notif.data.data?.length ?? 0}`);

  // 11. Logout
  const logout = await call('POST', '/auth/logout', null, token);
  console.log(`11. Logout: ${logout.status}`);

  console.log('\n=== STUDENT FLOW COMPLETE ===');
  console.log(`Student credentials: phone=${phone} / Student@123 @ sri-ramana`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
