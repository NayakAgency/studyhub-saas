$api    = "https://studyhub-api-delta.vercel.app/api"
$fe     = "https://studyhub-saas.vercel.app"
$pass   = "Admin@123456"
$saPass = "StudyHub@Admin123"
$pass_count = 0; $fail_count = 0

function ApiCall($method, $path, $body=$null, $token=$null, $tSec=25) {
  $uri = "$api$path"
  $h = @{ "Content-Type"="application/json" }
  if ($token) { $h.Authorization = "Bearer $token" }
  try {
    $params = @{ Uri=$uri; Method=$method; Headers=$h; TimeoutSec=$tSec; ErrorAction="Stop" }
    if ($body) { $params.Body = ($body|ConvertTo-Json -Depth 10) }
    return Invoke-RestMethod @params
  } catch {
    try { $e=[System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { $e=$_.Exception.Message }
    return [PSCustomObject]@{ _err=$e }
  }
}

function Check($label, $ok, $detail="") {
  $script:pass_count += [int]$ok
  $script:fail_count += [int](-not $ok)
  $sym = if ($ok) {"PASS"} else {"FAIL"}
  if ($detail) { Write-Host "  [$sym] $label -- $detail" }
  else         { Write-Host "  [$sym] $label" }
}

function Sep($title) { Write-Host "" ; Write-Host "=== $title ===" }

# ============================================================
Sep "1. FRONTEND SPA ROUTING"
foreach ($path in @("/", "/super-admin/login", "/admin/login", "/super-admin", "/admin/dashboard")) {
  try {
    $r = Invoke-WebRequest "$fe$path" -UseBasicParsing -TimeoutSec 15 -ErrorAction Stop
    Check "GET $path" ($r.StatusCode -eq 200) "HTTP $($r.StatusCode)"
  } catch { Check "GET $path" $false $_.Exception.Message }
}

# ============================================================
Sep "2. BACKEND HEALTH"
try {
  $health = Invoke-RestMethod "https://studyhub-api-delta.vercel.app/health" -TimeoutSec 15
  Check "Health endpoint" ($health.status -eq "ok") "env=$($health.environment)"
} catch { Check "Health endpoint" $false }

# ============================================================
Sep "3. SUPER ADMIN AUTH"
$sa = ApiCall POST "/auth/login-admin" @{email="admin@studyhub.app"; password=$saPass}
Check "Super admin login" (-not $sa._err) "role=$($sa.user.role)"
$SAT = $sa.accessToken

# ============================================================
Sep "4. SUPER ADMIN DASHBOARD AND ANALYTICS"
$dash = ApiCall GET "/super-admin/dashboard" $null $SAT
Check "SA Dashboard" (-not $dash._err) "totalTenants=$($dash.stats.totalTenants)"

$analytics = ApiCall GET "/super-admin/analytics" $null $SAT
Check "SA Analytics" (-not $analytics._err)

$tenantList = ApiCall GET "/super-admin/tenants" $null $SAT
Check "List all tenants" (-not $tenantList._err) "count=$($tenantList.data.Count)"

$billing = ApiCall GET "/super-admin/billing" $null $SAT
Check "SA Billing" (-not $billing._err)

# ============================================================
Sep "5. SUPER ADMIN CREATE NEW STUDY HALL"
$envLines = Get-Content "c:\Users\lokes\Desktop\New folder\backend\.env"
$envVars = @{}; foreach ($l in $envLines) { if ($l -match '^([A-Z_]+)=(.+)$') { $envVars[$matches[1]]=$matches[2] } }
$supaUrl = $envVars.SUPABASE_URL; $svcKey = $envVars.SUPABASE_SERVICE_ROLE_KEY
$supaH = @{ "apikey"=$svcKey; "Authorization"="Bearer $svcKey"; "Content-Type"="application/json" }

$ts = [int]((Get-Date).TimeOfDay.TotalSeconds) % 100000
$newSlug  = "elitezone-$ts"
$newEmail = "elite.$ts@studyhub.test"

$newTenant = ApiCall POST "/super-admin/tenants" @{
  hallName="EliteZone Study Hub"; slug=$newSlug
  ownerName="Elite Owner"; ownerEmail=$newEmail
  ownerPhone="9222333444"; city="Pune"; address="FC Road, Pune"
  planType="premium"; billingAmount=1999
} $SAT 60

Check "Create new tenant" (-not $newTenant._err) "slug=$($newTenant.tenant.slug)"
$NEW_TENANT_ID   = $newTenant.tenant.id
$NEW_TENANT_SLUG = $newTenant.tenant.slug

if ($NEW_TENANT_ID) {
  # Reset new admin password to known value
  $allUsers = Invoke-RestMethod "$supaUrl/auth/v1/admin/users?per_page=100" -Headers $supaH -TimeoutSec 15
  $nu = $allUsers.users | Where-Object { $_.email -eq $newEmail }
  if ($nu) {
    Invoke-RestMethod "$supaUrl/auth/v1/admin/users/$($nu.id)" -Method PUT -Headers $supaH -Body (@{password=$pass}|ConvertTo-Json) -ContentType "application/json" -TimeoutSec 15 | Out-Null
    Write-Host "     New hall: $newSlug | admin: $newEmail / $pass"
  }
}

# ============================================================
Sep "6. SUPER ADMIN TENANT OPERATIONS"
if ($NEW_TENANT_ID) {
  $suspend = ApiCall PATCH "/super-admin/tenants/$NEW_TENANT_ID/status" @{status="suspended"; reason="Test"} $SAT
  Check "Suspend tenant" (-not $suspend._err)

  $reactivate = ApiCall PATCH "/super-admin/tenants/$NEW_TENANT_ID/status" @{status="active"} $SAT
  Check "Reactivate tenant" (-not $reactivate._err)

  $detail = ApiCall GET "/super-admin/tenants/$NEW_TENANT_ID" $null $SAT
  Check "Get tenant detail" (-not $detail._err) "hall=$($detail.tenant.hall_name)"
}

$ann = ApiCall POST "/super-admin/announcements" @{title="Maintenance Window"; content="Scheduled maintenance Sunday 2-4 AM"; type="maintenance"; target="all"} $SAT
Check "SA platform announcement" (-not $ann._err)

# ============================================================
Sep "7. HALL ADMIN AUTH"
$ha = ApiCall POST "/auth/login-admin" @{email="rdgfb@gmail.com"; password=$pass}
Check "Hall admin login" (-not $ha._err) "role=$($ha.user.role)"
$HAT = $ha.accessToken

# ============================================================
Sep "8. HALL ADMIN DASHBOARD AND SETTINGS"
$aDash = ApiCall GET "/admin/dashboard" $null $HAT
Check "Admin dashboard" (-not $aDash._err) "students=$($aDash.stats.totalStudents)"

$settings = ApiCall GET "/admin/settings" $null $HAT
Check "Get hall settings" (-not $settings._err)

$settingsUpd = ApiCall PUT "/admin/settings" @{hallOpenTime="06:00";hallCloseTime="23:00";feeDueDay=5;gracePeriodDays=5;currencySymbol="Rs";websiteEnabled=$true} $HAT
Check "Update hall settings" (-not $settingsUpd._err)

# ============================================================
Sep "9. HALL ADMIN SECTIONS"
$secs = ApiCall GET "/admin/sections" $null $HAT
Check "List sections" (-not $secs._err) "count=$($secs.data.Count)"

$newSec = ApiCall POST "/admin/sections" @{name="AC Premium Zone"; colorCode="#F59E0B"; description="Air-conditioned premium area"} $HAT
Check "Create section" (-not $newSec._err) "id=$($newSec.section.id)"
$SEC_ID = if ($newSec.section.id) { $newSec.section.id } else { $secs.data[0].id }

# ============================================================
Sep "10. HALL ADMIN SEATS"
$seatNum = "Z-$(Get-Random -Max 9999)"
$newSeat = ApiCall POST "/admin/seats" @{sectionId=$SEC_ID; seatNumber=$seatNum; seatType="standard"; category="non_ac"} $HAT
Check "Create seat" (-not $newSeat._err) "id=$($newSeat.seat.id)"
$SEAT_ID = $newSeat.seat.id

$allSeats = ApiCall GET "/admin/seats" $null $HAT
Check "List seats" (-not $allSeats._err) "count=$($allSeats.data.Count)"

if (-not $SEAT_ID) {
  $av = $allSeats.data | Where-Object { $_.status -eq "available" } | Select-Object -First 1
  $SEAT_ID = $av.id
}

# ============================================================
Sep "11. HALL ADMIN SUBSCRIPTION PLANS"
$plans = ApiCall GET "/admin/plans" $null $HAT
Check "List plans" (-not $plans._err) "count=$($plans.data.Count)"

$newPlan = ApiCall POST "/admin/plans" @{planName="Monthly Full Day";planType="full_day";validityType="monthly";price=1400;seatCategory="non_ac";description="30 days full access"} $HAT
Check "Create plan" (-not $newPlan._err) "id=$($newPlan.plan.id)"
$PLAN_ID = if ($newPlan.plan.id) { $newPlan.plan.id } else { $plans.data[0].id }

# ============================================================
Sep "12. HALL ADMIN STUDENTS"
$phone = "91$(Get-Random -Min 10000000 -Max 99999999)"
$newStu = ApiCall POST "/admin/students" @{fullName="Arjun Mehta";phone=$phone;email="arjun.test@example.com";gender="male";address="Hyderabad"} $HAT
Check "Create student" (-not $newStu._err) "id=$($newStu.student.id)"
$STU_ID = $newStu.student.id

if ($STU_ID) {
  $getStu = ApiCall GET "/admin/students/$STU_ID" $null $HAT
  Check "Get student detail" (-not $getStu._err) "name=$($getStu.student.full_name)"

  $activateStu = ApiCall PATCH "/admin/students/$STU_ID/status" @{status="active"} $HAT
  Check "Activate student" (-not $activateStu._err)
}

# ============================================================
Sep "13. HALL ADMIN MEMBERSHIPS"
if ($STU_ID -and $PLAN_ID -and $SEAT_ID) {
  $today = Get-Date -Format "yyyy-MM-dd"
  $end30 = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")
  $mem = ApiCall POST "/admin/students/$STU_ID/memberships" @{planId=$PLAN_ID;seatId=$SEAT_ID;startDate=$today;endDate=$end30} $HAT
  Check "Create membership" (-not $mem._err) "id=$($mem.membership.id)"
  $MEM_ID = $mem.membership.id
}

# ============================================================
Sep "14. HALL ADMIN PAYMENTS"
if ($STU_ID) {
  $pay1 = ApiCall POST "/admin/payments" @{studentId=$STU_ID;amount=1400;paymentMethod="cash";paymentDate=(Get-Date -Format "yyyy-MM-dd");description="Monthly fee June 2026";membershipId=$MEM_ID} $HAT
  Check "Record cash payment" (-not $pay1._err) "receipt=$($pay1.payment.receipt_number)"
  $PAY_ID = $pay1.payment.id

  $pay2 = ApiCall POST "/admin/payments" @{studentId=$STU_ID;amount=700;paymentMethod="upi";utrNumber="UTR$(Get-Random -Max 999999999)";paymentDate=(Get-Date -Format "yyyy-MM-dd");description="Partial payment"} $HAT
  Check "Record UPI payment" (-not $pay2._err) "receipt=$($pay2.payment.receipt_number)"

  if ($PAY_ID) {
    $verify = ApiCall PATCH "/admin/payments/$PAY_ID/verify" @{status="verified"} $HAT
    Check "Verify payment" (-not $verify._err)
  }
}

$payList = ApiCall GET "/admin/payments" $null $HAT
Check "List all payments" (-not $payList._err) "count=$($payList.data.Count)"

# ============================================================
Sep "15. HALL ADMIN FEES AND OVERDUE"
$fees = ApiCall GET "/admin/fees" $null $HAT
Check "List fees" (-not $fees._err)

# ============================================================
Sep "16. HALL ADMIN ANNOUNCEMENTS"
$newAnn = ApiCall POST "/admin/announcements" @{title="Diwali Holiday";content="Hall closed Sunday for Diwali.";type="holiday";isPinned=$true;notifyStudents=$false} $HAT
Check "Create announcement" (-not $newAnn._err)

$annList = ApiCall GET "/admin/announcements" $null $HAT
Check "List announcements" (-not $annList._err)

# ============================================================
Sep "17. HALL ADMIN REPORTS AND ANALYTICS"
$revenue = ApiCall GET "/admin/reports/revenue?period=monthly" $null $HAT
Check "Revenue report" (-not $revenue._err)

$occupancy = ApiCall GET "/admin/reports/occupancy" $null $HAT
Check "Occupancy report" (-not $occupancy._err)

$analyticsOv = ApiCall GET "/admin/analytics/overview" $null $HAT
Check "Analytics overview" (-not $analyticsOv._err)

# ============================================================
Sep "18. HALL ADMIN WAITING LIST"
$wl = ApiCall POST "/admin/waiting-list" @{fullName="Sneha Patel";phone="9800000002";email="sneha@example.com";notes="Wants AC section"} $HAT
Check "Add to waiting list" (-not $wl._err)

$wlList = ApiCall GET "/admin/waiting-list" $null $HAT
Check "List waiting list" (-not $wlList._err) "count=$($wlList.data.Count)"

# ============================================================
Sep "19. HALL ADMIN FAQs AND GALLERY"
$faq = ApiCall POST "/admin/faqs" @{question="What are the timings?";answer="6 AM to 11 PM, Mon-Sat.";displayOrder=1;isActive=$true} $HAT
Check "Create FAQ" (-not $faq._err)

$faqList = ApiCall GET "/admin/faqs" $null $HAT
Check "List FAQs" (-not $faqList._err)

# ============================================================
Sep "20. HALL ADMIN BOOKING REQUESTS"
$bookings = ApiCall GET "/admin/bookings" $null $HAT
Check "List bookings" (-not $bookings._err)

$renewals = ApiCall GET "/admin/renewals" $null $HAT
Check "List renewals" (-not $renewals._err)

$seatChanges = ApiCall GET "/admin/seat-changes" $null $HAT
Check "List seat changes" (-not $seatChanges._err)

$cmpList = ApiCall GET "/admin/complaints" $null $HAT
Check "List complaints" (-not $cmpList._err) "count=$($cmpList.data.Count)"

# ============================================================
Sep "21. PUBLIC HALL API"
$pubHall = ApiCall GET "/public/sri-ramana"
Check "Public hall info" (-not $pubHall._err) "hall=$($pubHall.hall.hall_name)"

$pubPlans = ApiCall GET "/public/sri-ramana/plans"
Check "Public plans" (-not $pubPlans._err) "count=$($pubPlans.data.Count)"

$pubSeats = ApiCall GET "/public/sri-ramana/seats"
Check "Public seats" (-not $pubSeats._err)

$pubFaqs = ApiCall GET "/public/sri-ramana/faqs"
Check "Public FAQs" (-not $pubFaqs._err)

# ============================================================
Sep "22. STUDENT SELF-REGISTER AND LOGIN"
$stuPhone = "88$(Get-Random -Min 10000000 -Max 99999999)"
$reg = ApiCall POST "/auth/register-student" @{fullName="Kavya Reddy";phone=$stuPhone;password="Student@123";tenantSlug="sri-ramana";gender="female";address="Ameerpet, Hyderabad"}
Check "Student self-register" (-not $reg._err) "id=$($reg.user.id)"

$stuLogin = ApiCall POST "/auth/login-student" @{phone=$stuPhone;password="Student@123";tenantSlug="sri-ramana"}
Check "Student login" (-not $stuLogin._err) "role=$($stuLogin.user.role)"
$STUT = $stuLogin.accessToken

# ============================================================
Sep "23. STUDENT PORTAL OPERATIONS"
if ($STUT) {
  $stuProfile = ApiCall GET "/student/profile" $null $STUT
  Check "Get profile" (-not $stuProfile._err) "name=$($stuProfile.student.full_name)"

  $stuMem = ApiCall GET "/student/membership" $null $STUT
  Check "Get membership" (-not $stuMem._err)

  $stuFees = ApiCall GET "/student/fees" $null $STUT
  Check "Get fees" (-not $stuFees._err)

  $stuAnn = ApiCall GET "/student/announcements" $null $STUT
  Check "Get announcements" (-not $stuAnn._err)

  $stuNotif = ApiCall GET "/student/notifications" $null $STUT
  Check "Get notifications" (-not $stuNotif._err)

  $complaint = ApiCall POST "/student/complaints" @{category="facility";subject="AC not working";description="AC in room B not working since 2 days.";priority="high"} $STUT
  Check "Submit complaint" (-not $complaint._err) "id=$($complaint.complaint.id)"
  $CMP_ID = $complaint.complaint.id

  $suggestion = ApiCall POST "/student/suggestions" @{subject="Add whiteboards";description="Need more whiteboards in study area.";category="facility";isAnonymous=$false} $STUT
  Check "Submit suggestion" (-not $suggestion._err)

  $updProfile = ApiCall PUT "/student/profile" @{address="New Address, Hyderabad";emergencyContactName="Mom";emergencyContactPhone="9900000001"} $STUT
  Check "Update profile" (-not $updProfile._err)
}

# ============================================================
Sep "24. ADMIN RESOLVES STUDENT COMPLAINT"
if ($CMP_ID) {
  $resolve = ApiCall PATCH "/admin/complaints/$CMP_ID" @{status="resolved";adminResponse="AC repaired and working now."} $HAT
  Check "Resolve complaint" (-not $resolve._err)
}

# ============================================================
Sep "25. TOKEN REFRESH AND LOGOUT"
$saRef = ApiCall POST "/auth/refresh" @{refreshToken=$sa.refreshToken}
Check "SA token refresh" (-not $saRef._err)

$haRef = ApiCall POST "/auth/refresh" @{refreshToken=$ha.refreshToken}
Check "HA token refresh" (-not $haRef._err)

if ($STUT) {
  $stuLogout = ApiCall POST "/auth/logout" $null $STUT
  Check "Student logout" (-not $stuLogout._err)
}

# ============================================================
Write-Host ""
Write-Host "============================================================"
Write-Host "RESULTS: $pass_count PASSED  |  $fail_count FAILED"
Write-Host "============================================================"
Write-Host ""
Write-Host "Live URLs"
Write-Host "  Frontend:       $fe"
Write-Host "  API Health:     https://studyhub-api-delta.vercel.app/health"
Write-Host "  Super Admin:    $fe/super-admin"
Write-Host "  Admin Portal:   $fe/admin"
Write-Host "  Hall Public:    $fe/sri-ramana"
Write-Host "  Student Login:  $fe/sri-ramana/login"
Write-Host ""
Write-Host "Credentials"
Write-Host "  Super Admin:  admin@studyhub.app / StudyHub@Admin123"
Write-Host "  Hall Admin:   rdgfb@gmail.com / $pass  (sri-ramana)"
Write-Host "  Student:      $stuPhone / Student@123  (sri-ramana)"
if ($NEW_TENANT_SLUG) {
  Write-Host "  New Hall:     $newEmail / $pass  ($NEW_TENANT_SLUG)"
}
