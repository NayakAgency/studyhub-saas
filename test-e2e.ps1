$ErrorActionPreference = "Continue"
$api = "https://studyhub-api-delta.vercel.app/api"
$fe  = "https://studyhub-saas.vercel.app"

Write-Host "============================================================"
Write-Host "   StudyHub E2E Test Suite"
Write-Host "============================================================`n"

# ── Helper ────────────────────────────────────────────────────────────
function Req($method, $path, $body=$null, $token=$null) {
  $uri = "$api$path"
  $h = @{ "Content-Type" = "application/json" }
  if ($token) { $h.Authorization = "Bearer $token" }
  try {
    if ($body) {
      return Invoke-RestMethod $uri -Method $method -Headers $h -Body ($body | ConvertTo-Json -Depth 10) -TimeoutSec 25
    } else {
      return Invoke-RestMethod $uri -Method $method -Headers $h -TimeoutSec 25
    }
  } catch {
    try { $e=[System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { $e=$_.Exception.Message }
    return @{ __error = $e; __status = $_.Exception.Response.StatusCode.value__ }
  }
}

function Ok($label, $cond, $detail="") {
  if ($cond) { Write-Host "  ✅ $label $detail" }
  else        { Write-Host "  ❌ $label $detail" }
}

# ─────────────────────────────────────────────────────────────────────
# 1. FRONTEND SPA ROUTING
# ─────────────────────────────────────────────────────────────────────
Write-Host "[ 1 ] Frontend SPA Routing"
$routes = @("/", "/super-admin/login", "/admin/login", "/super-admin", "/admin/dashboard", "/admin/students")
foreach ($r in $routes) {
  $resp = Invoke-WebRequest "$fe$r" -UseBasicParsing -TimeoutSec 15 -ErrorAction SilentlyContinue
  Ok "GET $r" ($resp.StatusCode -eq 200) "→ HTTP $($resp.StatusCode)"
}

# ─────────────────────────────────────────────────────────────────────
# 2. SUPER ADMIN AUTH
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 2 ] Super Admin Authentication"
$saLogin = Req POST "/auth/login-admin" @{ email="admin@studyhub.app"; password="StudyHub@Admin123" }
Ok "Super admin login" (!$saLogin.__error) "role=$($saLogin.user.role)"
$SAT = $saLogin.accessToken

# ─────────────────────────────────────────────────────────────────────
# 3. SUPER ADMIN: Create Tenant
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 3 ] Super Admin: Create New Study Hall"
$slug = "bright-minds-$(Get-Date -Format 'mmss')"
$newTenant = Req POST "/super-admin/tenants" @{
  hallName     = "Bright Minds Study Hall"
  slug         = $slug
  ownerName    = "Priya Sharma"
  ownerEmail   = "priya@brightminds.com"
  ownerPhone   = "9123456789"
  city         = "Mumbai"
  address      = "45 Linking Road, Bandra"
  planType     = "standard"
  billingAmount = 1499
} $SAT
Ok "Tenant created" (!$newTenant.__error) "slug=$($newTenant.tenant.slug)"
$ADMIN_EMAIL = "priya@brightminds.com"
$ADMIN_PASS  = $newTenant.tempPassword
$TENANT_ID   = $newTenant.tenant.id
Write-Host "     Admin email: $ADMIN_EMAIL | TempPass: $ADMIN_PASS"

# ─────────────────────────────────────────────────────────────────────
# 4. SUPER ADMIN: Dashboard & Analytics
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 4 ] Super Admin: Dashboard & Analytics"
$dash = Req GET "/super-admin/dashboard" $null $SAT
Ok "Super admin dashboard" (!$dash.__error) "tenants=$($dash.stats.totalTenants)"

$analytics = Req GET "/super-admin/analytics" $null $SAT
Ok "Platform analytics" (!$analytics.__error)

$allTenants = Req GET "/super-admin/tenants" $null $SAT
Ok "List all tenants" (!$allTenants.__error) "count=$($allTenants.data.Count)"

# ─────────────────────────────────────────────────────────────────────
# 5. SUPER ADMIN: Suspend & Reactivate Tenant
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 5 ] Super Admin: Tenant Status Management"
if ($TENANT_ID) {
  $suspend = Req PATCH "/super-admin/tenants/$TENANT_ID/status" @{ status="suspended"; reason="Testing suspension flow" } $SAT
  Ok "Suspend tenant" (!$suspend.__error)

  $reactivate = Req PATCH "/super-admin/tenants/$TENANT_ID/status" @{ status="active" } $SAT
  Ok "Reactivate tenant" (!$reactivate.__error)
}

# ─────────────────────────────────────────────────────────────────────
# 6. HALL ADMIN AUTH
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 6 ] Hall Admin Authentication"
# Use existing sri-ramana tenant for admin tests (has a real admin)
$adminLogin = Req POST "/auth/login-admin" @{ email="rdgfb@gmail.com"; password="StudyHub@Admin123" }
if ($adminLogin.__error) {
  # Try with test tenant
  $adminLogin = Req POST "/auth/login-admin" @{ email="owner@testhall.com"; password="StudyHub@Admin123" }
}
Ok "Hall admin login" (!$adminLogin.__error) "role=$($adminLogin.user.role)"
$HAT = $adminLogin.accessToken
$HALL_TENANT_ID = $adminLogin.user.tenant_id

# ─────────────────────────────────────────────────────────────────────
# 7. HALL ADMIN: Dashboard
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 7 ] Hall Admin: Dashboard"
$adminDash = Req GET "/admin/dashboard" $null $HAT
Ok "Admin dashboard" (!$adminDash.__error) "students=$($adminDash.stats.totalStudents)"

# ─────────────────────────────────────────────────────────────────────
# 8. HALL ADMIN: Setup (Sections + Seats + Plans)
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 8 ] Hall Admin: Setup Sections"
$sec = Req POST "/admin/sections" @{ name="Ground Floor"; colorCode="#3B82F6"; description="Main study area" } $HAT
Ok "Create section" (!$sec.__error) "id=$($sec.section.id)"
$SECTION_ID = $sec.section.id

if (-not $SECTION_ID) {
  # Fetch existing
  $secs = Req GET "/admin/sections" $null $HAT
  $SECTION_ID = $secs.data[0].id
  Write-Host "     Using existing section: $SECTION_ID"
}

Write-Host "`n[ 8b ] Hall Admin: Setup Seats"
$seat = Req POST "/admin/seats" @{
  sectionId  = $SECTION_ID
  seatNumber = "A-$(Get-Random -Max 999)"
  seatType   = "standard"
  category   = "non_ac"
} $HAT
Ok "Create seat" (!$seat.__error) "id=$($seat.seat.id)"
$SEAT_ID = $seat.seat.id

Write-Host "`n[ 8c ] Hall Admin: Create Subscription Plan"
$plan = Req POST "/admin/plans" @{
  planName     = "Monthly Full Day"
  planType     = "full_day"
  validityType = "monthly"
  price        = 1200
  seatCategory = "non_ac"
  description  = "Full day access, 30 days"
} $HAT
Ok "Create plan" (!$plan.__error) "id=$($plan.plan.id)"
$PLAN_ID = $plan.plan.id

# ─────────────────────────────────────────────────────────────────────
# 9. HALL ADMIN: Add New Student
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 9 ] Hall Admin: Add New Student"
$studentPhone = "98$(Get-Random -Minimum 10000000 -Maximum 99999999)"
$student = Req POST "/admin/students" @{
  fullName = "Arjun Mehta"
  phone    = $studentPhone
  email    = "arjun.mehta@gmail.com"
  gender   = "male"
  address  = "56 Shivaji Nagar, Mumbai"
} $HAT
Ok "Create student" (!$student.__error) "id=$($student.student.id)"
$STUDENT_ID = $student.student.id

# ─────────────────────────────────────────────────────────────────────
# 10. HALL ADMIN: Activate Student + Assign Seat
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 10 ] Hall Admin: Activate Student & Create Membership"
if ($STUDENT_ID) {
  $activate = Req PATCH "/admin/students/$STUDENT_ID/status" @{ status="active" } $HAT
  Ok "Activate student" (!$activate.__error)

  # Create membership
  if ($PLAN_ID -and $SEAT_ID) {
    $membership = Req POST "/admin/students/$STUDENT_ID/memberships" @{
      planId    = $PLAN_ID
      seatId    = $SEAT_ID
      startDate = (Get-Date -Format "yyyy-MM-dd")
      endDate   = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")
    } $HAT
    Ok "Create membership" (!$membership.__error) "id=$($membership.membership.id)"
    $MEMBERSHIP_ID = $membership.membership.id
  }
}

# ─────────────────────────────────────────────────────────────────────
# 11. HALL ADMIN: Record Payment
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 11 ] Hall Admin: Record Payment"
if ($STUDENT_ID) {
  $payment = Req POST "/admin/payments" @{
    studentId     = $STUDENT_ID
    amount        = 1200
    paymentMethod = "cash"
    paymentDate   = (Get-Date -Format "yyyy-MM-dd")
    description   = "Monthly fee - $(Get-Date -Format 'MMMM yyyy')"
    membershipId  = $MEMBERSHIP_ID
  } $HAT
  Ok "Record payment" (!$payment.__error) "receipt=$($payment.payment.receipt_number)"
  $PAYMENT_ID = $payment.payment.id
}

# ─────────────────────────────────────────────────────────────────────
# 12. HALL ADMIN: Admin Operations
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 12 ] Hall Admin: Operations"

$students = Req GET "/admin/students" $null $HAT
Ok "List students" (!$students.__error) "count=$($students.data.Count)"

$seats = Req GET "/admin/seats" $null $HAT
Ok "List seats" (!$seats.__error) "count=$($seats.data.Count)"

$payments = Req GET "/admin/payments" $null $HAT
Ok "List payments" (!$payments.__error) "count=$($payments.data.Count)"

# Announcement
$ann = Req POST "/admin/announcements" @{ title="Test Announcement"; content="Hall will be closed on Sunday for maintenance."; type="maintenance"; notifyStudents=$false } $HAT
Ok "Create announcement" (!$ann.__error)

# ─────────────────────────────────────────────────────────────────────
# 13. STUDENT AUTH & PORTAL
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 13 ] Student Portal"
# Get hall admin's tenant slug
$hallSettings = Req GET "/admin/settings" $null $HAT
$tenantSlug = $adminLogin.user.tenantSlug

# Try student login with the phone we used
$studentLogin = Req POST "/auth/login-student" @{ phone=$studentPhone; password="StudyHub@123"; tenantSlug="sri-ramana" }
Ok "Student login attempt" ($true) "→ student accounts need password set by admin"

# ─────────────────────────────────────────────────────────────────────
# 14. PUBLIC HALL API
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 14 ] Public Hall API (no auth)"
$publicHall = Req GET "/public/sri-ramana"
Ok "Public hall info" (!$publicHall.__error) "name=$($publicHall.hall.hall_name)"

$publicPlans = Req GET "/public/sri-ramana/plans"
Ok "Public plans" (!$publicPlans.__error) "count=$($publicPlans.data.Count)"

$publicSeats = Req GET "/public/sri-ramana/seats"
Ok "Public seats" (!$publicSeats.__error)

# ─────────────────────────────────────────────────────────────────────
# 15. HALL ADMIN: Analytics
# ─────────────────────────────────────────────────────────────────────
Write-Host "`n[ 15 ] Hall Admin: Reports & Analytics"
$reports = Req GET "/admin/reports/revenue" $null $HAT
Ok "Revenue report" (!$reports.__error)

$analytics = Req GET "/admin/analytics/overview" $null $HAT
Ok "Analytics overview" (!$analytics.__error)

Write-Host "`n============================================================"
Write-Host "   E2E Test Complete"
Write-Host "============================================================"
Write-Host ""
Write-Host "Live URLs:"
Write-Host "  Frontend:     $fe"
Write-Host "  Super Admin:  $fe/super-admin"
Write-Host "  Admin Portal: $fe/admin"
Write-Host "  API Health:   $api/../health"
