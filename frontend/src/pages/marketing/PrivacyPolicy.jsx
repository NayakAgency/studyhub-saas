import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary-600 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">StudyHub</span>
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-600">Privacy Policy</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-16 prose prose-gray">
        <h1>Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: June 2025</p>

        <h2>1. Information We Collect</h2>
        <p>
          StudyHub collects information you provide directly: name, phone number, email address,
          date of birth, and payment details (UTR numbers for UPI, no card data stored).
          We also collect usage data such as login timestamps and in-app activity.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>
          Your information is used to manage your study hall membership, process fee payments,
          send in-app notifications, and provide administrative tools to hall managers.
          We do not sell your personal data to any third parties.
        </p>

        <h2>3. Data Storage</h2>
        <p>
          All data is stored securely on Supabase (PostgreSQL) with row-level security policies
          ensuring complete isolation between study halls. Your data is never accessible to
          other tenants on the platform.
        </p>

        <h2>4. Data Retention</h2>
        <p>
          Student data is retained while your account is active and for up to 1 year after
          account closure for billing and compliance purposes. You may request deletion at any
          time by contacting your study hall administrator.
        </p>

        <h2>5. Your Rights</h2>
        <p>
          You have the right to access, correct, or delete your personal data. Contact your
          study hall admin or reach us at support@studyhub.app.
        </p>

        <h2>6. Cookies</h2>
        <p>
          StudyHub uses only essential session cookies (localStorage tokens) required for
          authentication. No tracking or advertising cookies are used.
        </p>

        <h2>7. Contact</h2>
        <p>
          For privacy-related queries, contact: <a href="mailto:support@studyhub.app">support@studyhub.app</a>
        </p>
      </main>
    </div>
  );
}
