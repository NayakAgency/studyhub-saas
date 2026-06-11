import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore.js';
import useUIStore from './store/uiStore.js';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import SuspensionScreen from './components/ui/SuspensionScreen.jsx';
import PageLoader from './components/ui/PageLoader.jsx';

// ── Marketing ────────────────────────────────────────────────
const MarketingHome    = lazy(() => import('./pages/marketing/Home.jsx'));
const PrivacyPolicy    = lazy(() => import('./pages/marketing/PrivacyPolicy.jsx'));
const TermsOfService   = lazy(() => import('./pages/marketing/TermsOfService.jsx'));

// ── Hall Public Website ──────────────────────────────────────
const HallLayout     = lazy(() => import('./pages/hall/HallLayout.jsx'));
const HallHome       = lazy(() => import('./pages/hall/HallHome.jsx'));
const HallAbout      = lazy(() => import('./pages/hall/HallAbout.jsx'));
const HallFacilities = lazy(() => import('./pages/hall/HallFacilities.jsx'));
const HallPlans      = lazy(() => import('./pages/hall/HallPlans.jsx'));
const HallSeats      = lazy(() => import('./pages/hall/HallSeats.jsx'));
const HallGallery    = lazy(() => import('./pages/hall/HallGallery.jsx'));
const HallContact    = lazy(() => import('./pages/hall/HallContact.jsx'));
const HallFAQs       = lazy(() => import('./pages/hall/HallFAQs.jsx'));

// ── Student Portal ────────────────────────────────────────────
const StudentLogin        = lazy(() => import('./pages/student/StudentLogin.jsx'));
const StudentRegister     = lazy(() => import('./pages/student/StudentRegister.jsx'));
const StudentLayout       = lazy(() => import('./pages/student/StudentLayout.jsx'));
const StudentDashboard    = lazy(() => import('./pages/student/StudentDashboard.jsx'));
const StudentProfile      = lazy(() => import('./pages/student/StudentProfile.jsx'));
const StudentSeat         = lazy(() => import('./pages/student/StudentSeat.jsx'));
const StudentMembership   = lazy(() => import('./pages/student/StudentMembership.jsx'));
const StudentFees         = lazy(() => import('./pages/student/StudentFees.jsx'));
const StudentBookSeat     = lazy(() => import('./pages/student/StudentBookSeat.jsx'));
const StudentComplaints   = lazy(() => import('./pages/student/StudentComplaints.jsx'));
const StudentSuggestions  = lazy(() => import('./pages/student/StudentSuggestions.jsx'));
const StudentNotifications = lazy(() => import('./pages/student/StudentNotifications.jsx'));
const StudentIdCard       = lazy(() => import('./pages/student/StudentIdCard.jsx'));
const StudentResources    = lazy(() => import('./pages/student/StudentResources.jsx'));

// ── Admin Portal ──────────────────────────────────────────────
const AdminLogin            = lazy(() => import('./pages/admin/AdminLogin.jsx'));
const AdminSetupWizard      = lazy(() => import('./pages/admin/AdminSetupWizard.jsx'));
const AdminLayout           = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const AdminDashboard        = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminStudents         = lazy(() => import('./pages/admin/students/AdminStudents.jsx'));
const AdminStudentDetail    = lazy(() => import('./pages/admin/students/AdminStudentDetail.jsx'));
const AdminStudentNew       = lazy(() => import('./pages/admin/students/AdminStudentNew.jsx'));
const AdminApplications     = lazy(() => import('./pages/admin/AdminApplications.jsx'));
const AdminSeats            = lazy(() => import('./pages/admin/seats/AdminSeats.jsx'));
const AdminPlans            = lazy(() => import('./pages/admin/AdminPlans.jsx'));
const AdminFees             = lazy(() => import('./pages/admin/fees/AdminFees.jsx'));
const AdminPaymentRecord    = lazy(() => import('./pages/admin/fees/AdminPaymentRecord.jsx'));
const AdminRenewals         = lazy(() => import('./pages/admin/AdminRenewals.jsx'));
const AdminBookings         = lazy(() => import('./pages/admin/AdminBookings.jsx'));
const AdminComplaints       = lazy(() => import('./pages/admin/AdminComplaints.jsx'));
const AdminAnnouncements    = lazy(() => import('./pages/admin/AdminAnnouncements.jsx'));
const AdminResources        = lazy(() => import('./pages/admin/AdminResources.jsx'));
const AdminWaitingList      = lazy(() => import('./pages/admin/AdminWaitingList.jsx'));
const AdminReports          = lazy(() => import('./pages/admin/AdminReports.jsx'));
const AdminSettings         = lazy(() => import('./pages/admin/AdminSettings.jsx'));
const AdminContactInquiries = lazy(() => import('./pages/admin/AdminContactInquiries.jsx'));
const AdminReceiptPreview   = lazy(() => import('./pages/admin/AdminReceiptPreview.jsx'));
const AdminAnalytics        = lazy(() => import('./pages/admin/AdminAnalytics.jsx'));
const AdminPayments         = lazy(() => import('./pages/admin/fees/AdminPayments.jsx'));
const AdminGallery          = lazy(() => import('./pages/admin/AdminGallery.jsx'));
const AdminSuggestions      = lazy(() => import('./pages/admin/AdminSuggestions.jsx'));
const AdminFAQs             = lazy(() => import('./pages/admin/AdminFAQs.jsx'));
const AdminSeatChanges      = lazy(() => import('./pages/admin/AdminSeatChanges.jsx'));

// ── Super Admin Portal ────────────────────────────────────────
const SuperAdminLogin        = lazy(() => import('./pages/super-admin/SuperAdminLogin.jsx'));

// ── Unified Login ─────────────────────────────────────────────
const UnifiedLogin = lazy(() => import('./pages/auth/UnifiedLogin.jsx'));
const SuperAdminLayout       = lazy(() => import('./pages/super-admin/SuperAdminLayout.jsx'));
const SuperAdminDashboard    = lazy(() => import('./pages/super-admin/SuperAdminDashboard.jsx'));
const SuperAdminTenants      = lazy(() => import('./pages/super-admin/SuperAdminTenants.jsx'));
const SuperAdminTenantDetail = lazy(() => import('./pages/super-admin/SuperAdminTenantDetail.jsx'));
const SuperAdminTenantNew    = lazy(() => import('./pages/super-admin/SuperAdminTenantNew.jsx'));
const SuperAdminBilling      = lazy(() => import('./pages/super-admin/SuperAdminBilling.jsx'));
const SuperAdminAnalytics    = lazy(() => import('./pages/super-admin/SuperAdminAnalytics.jsx'));
const SuperAdminSupport      = lazy(() => import('./pages/super-admin/SuperAdminSupport.jsx'));
const SuperAdminSettings     = lazy(() => import('./pages/super-admin/SuperAdminSettings.jsx'));
const SuperAdminPlans        = lazy(() => import('./pages/super-admin/SuperAdminPlans.jsx'));
const SuperAdminInquiries    = lazy(() => import('./pages/super-admin/SuperAdminInquiries.jsx'));

// ── Error ─────────────────────────────────────────────────────
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

export default function App() {
  const { tenantRestriction } = useUIStore();

  useEffect(() => {
    const handler = (e) => useUIStore.getState().setTenantRestriction(e.detail);
    window.addEventListener('tenant:restricted', handler);
    return () => window.removeEventListener('tenant:restricted', handler);
  }, []);

  if (tenantRestriction) {
    return <SuspensionScreen data={tenantRestriction} />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>

        {/* ── Marketing ── */}
        <Route path="/" element={<MarketingHome />} />
        <Route path="/login" element={<UnifiedLogin />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms"   element={<TermsOfService />} />

        {/* ── Super Admin ── */}
        <Route path="/super-admin/login" element={<SuperAdminLogin />} />
        <Route path="/super-admin" element={
          <ProtectedRoute role="super_admin"><SuperAdminLayout /></ProtectedRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"  element={<SuperAdminDashboard />} />
          <Route path="tenants"    element={<SuperAdminTenants />} />
          <Route path="tenants/new" element={<SuperAdminTenantNew />} />
          <Route path="tenants/:id" element={<SuperAdminTenantDetail />} />
          <Route path="billing"    element={<SuperAdminBilling />} />
          <Route path="analytics"  element={<SuperAdminAnalytics />} />
          <Route path="support"    element={<SuperAdminSupport />} />
          <Route path="settings"   element={<SuperAdminSettings />} />
          <Route path="plans"      element={<SuperAdminPlans />} />
          <Route path="requests"   element={<SuperAdminInquiries />} />
        </Route>

        {/* ── Hall Admin ── */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/setup" element={
          <ProtectedRoute role="hall_admin"><AdminSetupWizard /></ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute role="hall_admin"><AdminLayout /></ProtectedRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"          element={<AdminDashboard />} />
          <Route path="students"           element={<AdminStudents />} />
          <Route path="students/new"       element={<AdminStudentNew />} />
          <Route path="students/:id"       element={<AdminStudentDetail />} />
          <Route path="applications"       element={<AdminApplications />} />
          <Route path="seats"              element={<AdminSeats />} />
          <Route path="plans"              element={<AdminPlans />} />
          <Route path="fees"               element={<AdminFees />} />
          <Route path="payments/record"    element={<AdminPaymentRecord />} />
          <Route path="renewals"           element={<AdminRenewals />} />
          <Route path="bookings"           element={<AdminBookings />} />
          <Route path="complaints"         element={<AdminComplaints />} />
          <Route path="announcements"      element={<AdminAnnouncements />} />
          <Route path="resources"          element={<AdminResources />} />
          <Route path="waiting-list"       element={<AdminWaitingList />} />
          <Route path="reports"            element={<AdminReports />} />
          <Route path="settings"           element={<AdminSettings />} />
          <Route path="contact-inquiries"  element={<AdminContactInquiries />} />
          <Route path="payments/:id/receipt-preview" element={<AdminReceiptPreview />} />
          <Route path="analytics"          element={<AdminAnalytics />} />
          <Route path="payments"           element={<AdminPayments />} />
          <Route path="gallery"            element={<AdminGallery />} />
          <Route path="suggestions"        element={<AdminSuggestions />} />
          <Route path="faqs"               element={<AdminFAQs />} />
          <Route path="seat-changes"       element={<AdminSeatChanges />} />
        </Route>

        {/* ── Hall Public Website + Student Portal (slug-scoped) ── */}
        <Route path="/:slug" element={<HallLayout />}>
          {/* Public pages */}
          <Route index             element={<HallHome />} />
          <Route path="about"      element={<HallAbout />} />
          <Route path="facilities" element={<HallFacilities />} />
          <Route path="plans"      element={<HallPlans />} />
          <Route path="seats"      element={<HallSeats />} />
          <Route path="gallery"    element={<HallGallery />} />
          <Route path="contact"    element={<HallContact />} />
          <Route path="faqs"       element={<HallFAQs />} />

          {/* Auth pages (inside hall layout) */}
          <Route path="login"    element={<StudentLogin />} />
          <Route path="register" element={<StudentRegister />} />

          {/* Student portal — protected, uses StudentLayout */}
          <Route element={
            <ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>
          }>
            <Route path="dashboard"    element={<StudentDashboard />} />
            <Route path="profile"      element={<StudentProfile />} />
            <Route path="seat"         element={<StudentSeat />} />
            <Route path="membership"   element={<StudentMembership />} />
            <Route path="fees"         element={<StudentFees />} />
            <Route path="book-seat"    element={<StudentBookSeat />} />
            <Route path="complaints"   element={<StudentComplaints />} />
            <Route path="suggestions"  element={<StudentSuggestions />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="id-card"      element={<StudentIdCard />} />
            <Route path="resources"    element={<StudentResources />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
