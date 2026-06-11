const API = 'https://studyhub-api-delta.vercel.app/api';
const FE  = 'https://studyhub-saas.vercel.app';
let pass = 0, fail = 0;

async function req(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  try {
    const r = await fetch(`${API}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text();
    let d; try { d = JSON.parse(t); } catch { d = { raw: t }; }
    return { ok: r.ok, status: r.status, data: d };
  } catch (e) {
    return { ok: false, status: 0, data: { error: e.message } };
  }
}

async function get(path, token) { return req('GET', path, null, token); }
async function post(path, body, token) { return req('POST', path, body, token); }
async function put(path, body, token) { return req('PUT', path, body, token); }
async function patch(path, body, token) { return req('PATCH', path, body, token); }

function check(label, ok, detail = '') {
  if (ok) { pass++; console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`); }
  else    { fail++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
}

function section(title) { console.log(`\n=== ${title} ===`); }

// ── 1. Frontend SPA Routing ──────────────────────────────────────────
section('1. FRONTEND SPA ROUTING');
for (const path of ['/', '/super-admin/login', '/admin/login', '/super-admin', '/admin/dashboard', '/admin/students', '/admin/analytics']) {
  try {
    const r = await fetch(`${FE}${path}`);
    check(`GET ${path}`, r.status === 200, `HTTP ${r.status}`);
  } catch (e) { check(`GET ${path}`, false, e.message); }
}

// ── 2. Backend Health ────────────────────────────────────────────────
section('2. BACKEND HEALTH');
const health = await get('/health'); // hits the non-api path
const hR = await fetch('https://studyhub-api-delta.vercel.app/health');
const hD = await hR.json();
check('Health endpoint', hD.status === 'ok', `env=${hD.environment}`);

// ── 3. Super Admin Auth ──────────────────────────────────────────────
section('3. SUPER ADMIN AUTH');
const saR = await post('/auth/login-admin', { email: 'admin@studyhub.app', password: 'StudyHub@Admin123' });
check('Super admin login', saR.ok && saR.data.user?.role === 'super_admin', `role=${saR.data.user?.role}`);
const SAT = saR.data.accessToken;

// ── 4. Super Admin Dashboard & Analytics ────────────────────────────
section('4. SUPER ADMIN — DASHBOARD & ANALYTICS');
const dash = await get('/super-admin/dashboard', SAT);
check('SA Dashboard', dash.ok, `totalTenants=${dash.data.stats?.totalTenants}`);
const analytics = await get('/super-admin/analytics', SAT);
check('SA Analytics', analytics.ok);
const allTenants = await get('/super-admin/tenants', SAT);
check('List all tenants', allTenants.ok, `count=${allTenants.data.data?.length}`);
const billing = await get('/super-admin/billing', SAT);
check('SA Billing', billing.ok);

// ── 5. Super Admin: Create Tenant ────────────────────────────────────
section('5. SUPER ADMIN — CREATE NEW STUDY HALL');
const ts = Date.now().toString().slice(-6);
const newSlug = `nexus-${ts}`, newEmail = `nexus.${ts}@studyhub.test`;
const ntR = await post('/super-admin/tenants', {
  hallName: 'Nexus Study Center', slug: newSlug,
  ownerName: 'Nexus Owner', ownerEmail: newEmail,
  ownerPhone: '9333444555', city: 'Chennai', address: 'Anna Salai',
  planType: 'standard', billingAmount: 999
}, SAT);
check('Create tenant', ntR.ok && ntR.data.tenant?.id, `slug=${ntR.data.tenant?.slug} pass=${ntR.data.tempPassword ? 'set' : 'missing'}`);
const NEW_TENANT_ID = ntR.data.tenant?.id;

// ── 6. Super Admin: Tenant Operations ───────────────────────────────
section('6. SUPER ADMIN — TENANT OPERATIONS');
if (NEW_TENANT_ID) {
  const sus = await patch(`/super-admin/tenants/${NEW_TENANT_ID}/status`, { status: 'suspended', reason: 'Test' }, SAT);
  check('Suspend tenant', sus.ok);
  const rev = await patch(`/super-admin/tenants/${NEW_TENANT_ID}/status`, { status: 'active' }, SAT);
  check('Reactivate tenant', rev.ok);
  const det = await get(`/super-admin/tenants/${NEW_TENANT_ID}`, SAT);
  check('Get tenant detail', det.ok, `hall=${det.data.tenant?.hall_name}`);
}
const annR = await post('/super-admin/announcements', { title: 'Maintenance', content: 'Sunday 2-4 AM', type: 'maintenance', target: 'all' }, SAT);
check('Platform announcement', annR.ok);

// ── 7. Hall Admin Auth ───────────────────────────────────────────────
section('7. HALL ADMIN AUTH');
const haR = await post('/auth/login-admin', { email: 'rdgfb@gmail.com', password: 'Admin@123456' });
check('Hall admin login', haR.ok && haR.data.user?.role === 'hall_admin', `role=${haR.data.user?.role}`);
const HAT = haR.data.accessToken;

// ── 8. Hall Admin Dashboard & Settings ──────────────────────────────
section('8. HALL ADMIN — DASHBOARD & SETTINGS');
const aDash = await get('/admin/dashboard', HAT);
check('Admin dashboard', aDash.ok, `students=${aDash.data.stats?.totalStudents}`);
const settings = await get('/admin/settings', HAT);
check('Get hall settings', settings.ok);
const settUpd = await put('/admin/settings', { hallOpenTime: '06:00', hallCloseTime: '23:00', feeDueDay: 5, gracePeriodDays: 5, currencySymbol: 'Rs', websiteEnabled: true }, HAT);
check('Update hall settings', settUpd.ok);

// ── 9. Sections ──────────────────────────────────────────────────────
section('9. HALL ADMIN — SECTIONS');
const secList = await get('/admin/sections', HAT);
check('List sections', secList.ok, `count=${Array.isArray(secList.data) ? secList.data.length : secList.data.data?.length}`);
const newSec = await post('/admin/sections', { name: 'AC Zone', colorCode: '#10B981', description: 'Air-conditioned area' }, HAT);
check('Create section', newSec.ok, `id=${newSec.data.section?.id}`);
const SEC_ID = newSec.data.section?.id || (Array.isArray(secList.data) ? secList.data[0]?.id : secList.data.data?.[0]?.id);

// ── 10. Seats ────────────────────────────────────────────────────────
section('10. HALL ADMIN — SEATS');
const seatNum = `V${Math.floor(Math.random() * 9999)}`;
const newSeat = await post('/admin/seats', { sectionId: SEC_ID, seatNumber: seatNum, seatType: 'standard', category: 'non_ac' }, HAT);
check('Create seat', newSeat.ok, `id=${newSeat.data.seat?.id}`);
let SEAT_ID = newSeat.data.seat?.id;
const allSeats = await get('/admin/seats', HAT);
check('List seats', allSeats.ok, `count=${allSeats.data.data?.length ?? allSeats.data.length}`);
if (!SEAT_ID) {
  const seats = Array.isArray(allSeats.data) ? allSeats.data : allSeats.data.data;
  SEAT_ID = seats?.find(s => s.status === 'available')?.id;
}

// ── 11. Plans ────────────────────────────────────────────────────────
section('11. HALL ADMIN — SUBSCRIPTION PLANS');
const plans = await get('/admin/plans', HAT);
check('List plans', plans.ok, `count=${plans.data.data?.length}`);
const newPlan = await post('/admin/plans', { planName: 'Monthly Full Day', planType: 'full_day', validityType: 'monthly', price: 1400, seatCategory: 'non_ac', description: '30 days full access' }, HAT);
check('Create plan', newPlan.ok, `id=${newPlan.data.plan?.id}`);
let PLAN_ID = newPlan.data.plan?.id || plans.data.data?.[0]?.id;

// ── 12. Students ─────────────────────────────────────────────────────
section('12. HALL ADMIN — STUDENTS');
const stuPhone = `91${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
const newStu = await post('/admin/students', { fullName: 'Arjun Mehta', phone: stuPhone, email: 'arjun@test.com', gender: 'male', address: 'Hyderabad' }, HAT);
check('Create student', newStu.ok, `id=${newStu.data.student?.id}`);
const STU_ID = newStu.data.student?.id;
if (STU_ID) {
  const getStu = await get(`/admin/students/${STU_ID}`, HAT);
  check('Get student detail', getStu.ok, `name=${getStu.data.student?.full_name}`);
  const actStu = await patch(`/admin/students/${STU_ID}/status`, { status: 'active' }, HAT);
  check('Activate student', actStu.ok);
}
const stuList = await get('/admin/students', HAT);
check('List students', stuList.ok, `count=${stuList.data.data?.length}`);

// ── 13. Memberships ──────────────────────────────────────────────────
section('13. HALL ADMIN — MEMBERSHIPS');
let MEM_ID;
if (STU_ID && PLAN_ID && SEAT_ID) {
  const today = new Date().toISOString().split('T')[0];
  const end30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const mem = await post(`/admin/students/${STU_ID}/memberships`, { planId: PLAN_ID, seatId: SEAT_ID, startDate: today, endDate: end30 }, HAT);
  check('Create membership', mem.ok, `id=${mem.data.membership?.id}`);
  MEM_ID = mem.data.membership?.id;
}

// ── 14. Payments ─────────────────────────────────────────────────────
section('14. HALL ADMIN — PAYMENTS');
let PAY_ID;
if (STU_ID) {
  const pay1 = await post('/admin/payments', { studentId: STU_ID, amount: 1400, paymentMethod: 'cash', paymentDate: new Date().toISOString().split('T')[0], description: 'Monthly fee', membershipId: MEM_ID }, HAT);
  check('Record cash payment', pay1.ok, `receipt=${pay1.data.payment?.receipt_number}`);
  PAY_ID = pay1.data.payment?.id;
  const pay2 = await post('/admin/payments', { studentId: STU_ID, amount: 700, paymentMethod: 'upi', utrNumber: `UTR${Math.floor(Math.random() * 999999999)}`, paymentDate: new Date().toISOString().split('T')[0], description: 'Partial payment' }, HAT);
  check('Record UPI payment', pay2.ok, `receipt=${pay2.data.payment?.receipt_number}`);
  if (PAY_ID) {
    const ver = await patch(`/admin/payments/${PAY_ID}/verify`, { status: 'verified' }, HAT);
    check('Verify payment', ver.ok);
  }
}
const payList = await get('/admin/payments', HAT);
check('List payments', payList.ok, `count=${payList.data.data?.length}`);

// ── 15. Hall Admin Misc Operations ──────────────────────────────────
section('15. HALL ADMIN — ANNOUNCEMENTS, FAQS, WAITING LIST');
const ann = await post('/admin/announcements', { title: 'Holiday Notice', content: 'Hall closed Sunday', type: 'holiday', isPinned: true, notifyStudents: false }, HAT);
check('Create announcement', ann.ok);
const annList = await get('/admin/announcements', HAT);
check('List announcements', annList.ok);
const faq = await post('/admin/faqs', { question: 'Opening hours?', answer: '6 AM to 11 PM', displayOrder: 1, isActive: true }, HAT);
check('Create FAQ', faq.ok);
const faqList = await get('/admin/faqs', HAT);
check('List FAQs', faqList.ok);
const wl = await post('/admin/waiting-list', { fullName: 'Sneha Patel', phone: '9800123456', email: 'sneha@test.com', notes: 'Wants AC section' }, HAT);
check('Add to waiting list', wl.ok);
const bookings = await get('/admin/bookings', HAT);
check('List booking requests', bookings.ok);
const complaints = await get('/admin/complaints', HAT);
check('List complaints', complaints.ok, `count=${complaints.data.data?.length}`);
const renewals = await get('/admin/renewals', HAT);
check('List renewals', renewals.ok);

// ── 16. Reports & Analytics ──────────────────────────────────────────
section('16. HALL ADMIN — REPORTS & ANALYTICS');
const revenue = await get('/admin/reports/revenue?period=monthly', HAT);
check('Revenue report', revenue.ok);
const occupancy = await get('/admin/reports/occupancy', HAT);
check('Occupancy report', occupancy.ok);
const aOverview = await get('/admin/analytics/overview', HAT);
check('Analytics overview', aOverview.ok);

// ── 17. Public Hall API ──────────────────────────────────────────────
section('17. PUBLIC HALL API (no auth)');
const pubHall = await get('/public/sri-ramana');
check('Public hall info', pubHall.ok, `hall=${pubHall.data.hall?.hall_name}`);
const pubPlans = await get('/public/sri-ramana/plans');
check('Public plans', pubPlans.ok, `count=${pubPlans.data.data?.length}`);
const pubSeats = await get('/public/sri-ramana/seats');
check('Public seats', pubSeats.ok);
const pubFaqs = await get('/public/sri-ramana/faqs');
check('Public FAQs', pubFaqs.ok);
const pubGallery = await get('/public/sri-ramana/gallery');
check('Public gallery', pubGallery.ok);

// ── 18. Student Self-Register & Login ───────────────────────────────
section('18. STUDENT — REGISTER & LOGIN');
const stuSelfPhone = `88${Math.floor(Math.random() * 100000000).toString().padStart(8,'0')}`;
const reg = await post('/auth/register-student', { fullName: 'Kavya Reddy', phone: stuSelfPhone, password: 'Student@123', tenantSlug: 'sri-ramana', gender: 'female', address: 'Hyderabad' });
check('Student self-register', reg.ok, `id=${reg.data.studentId}`);
const stuLogin = await post('/auth/login-student', { phone: stuSelfPhone, password: 'Student@123', tenantSlug: 'sri-ramana' });
check('Student login', stuLogin.ok && stuLogin.data.user?.role === 'student', `role=${stuLogin.data.user?.role} status=${stuLogin.data.user?.status}`);
const STUT = stuLogin.data.accessToken;

// ── 19. Student Portal Operations ───────────────────────────────────
section('19. STUDENT PORTAL OPERATIONS');
if (STUT) {
  const prof = await get('/student/profile', STUT);
  check('Get profile', prof.ok, `name=${prof.data.student?.full_name}`);
  const mem2 = await get('/student/membership', STUT);
  check('Get membership', mem2.ok);
  const fees2 = await get('/student/fees', STUT);
  check('Get fees', fees2.ok);
  const anns2 = await get('/student/announcements', STUT);
  check('Get announcements', anns2.ok, `count=${anns2.data.data?.length ?? 0}`);
  const notifs = await get('/student/notifications', STUT);
  check('Get notifications', notifs.ok);
  const cmp = await post('/student/complaints', { category: 'facility', subject: 'AC not working', description: 'AC in room B not working since 2 days.', priority: 'high' }, STUT);
  check('Submit complaint', cmp.ok, `id=${cmp.data.complaint?.id}`);
  const SUG_ID = cmp.data.complaint?.id;
  const sug = await post('/student/suggestions', { subject: 'Add whiteboards', description: 'Need more in study area', category: 'facility', isAnonymous: false }, STUT);
  check('Submit suggestion', sug.ok);
  const updProf = await put('/student/profile', { address: 'Updated: Banjara Hills, Hyderabad', emergencyContactName: 'Mom', emergencyContactPhone: '9900000001' }, STUT);
  check('Update profile', updProf.ok);
  if (SUG_ID) {
    const res2 = await patch(`/admin/complaints/${SUG_ID}`, { status: 'resolved', adminResponse: 'AC has been repaired.' }, HAT);
    check('Admin resolves complaint', res2.ok);
  }
}

// ── 20. Token Refresh & Logout ──────────────────────────────────────
section('20. TOKEN REFRESH & LOGOUT');
const saRef = await post('/auth/refresh', { refreshToken: saR.data.refreshToken });
check('SA token refresh', saRef.ok);
const haRef = await post('/auth/refresh', { refreshToken: haR.data.refreshToken });
check('HA token refresh', haRef.ok);
if (STUT) {
  const logout = await post('/auth/logout', null, STUT);
  check('Student logout', logout.ok);
}

// ── Final Summary ────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log(`FINAL RESULTS: ${pass} PASSED  |  ${fail} FAILED  |  ${pass + fail} TOTAL`);
console.log('='.repeat(60));
console.log('\nLive Production URLs:');
console.log(`  Frontend:       ${FE}`);
console.log(`  API Health:     https://studyhub-api-delta.vercel.app/health`);
console.log(`  Super Admin:    ${FE}/super-admin`);
console.log(`  Admin Portal:   ${FE}/admin`);
console.log(`  Student Demo:   ${FE}/sri-ramana`);
console.log(`  GitHub:         https://github.com/NayakAgency/studyhub-saas`);
console.log('\nCredentials:');
console.log(`  Super Admin:    admin@studyhub.app / StudyHub@Admin123`);
console.log(`  Hall Admin:     rdgfb@gmail.com / Admin@123456  (sri-ramana)`);
console.log(`  Student:        ${stuSelfPhone} / Student@123  (sri-ramana)`);
if (NEW_TENANT_ID) { console.log(`  New Hall Admin: ${newEmail} / (reset to Admin@123456)  (${newSlug})`); }
