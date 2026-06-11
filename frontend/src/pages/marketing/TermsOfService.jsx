import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary-600 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">StudyHub</span>
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-600">Terms of Service</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-16 prose prose-gray">
        <h1>Terms of Service</h1>
        <p className="text-gray-500 text-sm">Last updated: June 2025</p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using StudyHub, you agree to be bound by these Terms of Service.
          If you do not agree, you may not use the platform.
        </p>

        <h2>2. Description of Service</h2>
        <p>
          StudyHub is a SaaS platform that enables study hall owners to manage seat bookings,
          memberships, fee collections, and student communications. Students can register, book
          seats, and track their membership through the platform.
        </p>

        <h2>3. Study Hall Operators</h2>
        <p>
          Operators (hall admins) are responsible for their own compliance with local laws,
          fee collection, and student data management within their portal. StudyHub provides
          the technology platform only and is not responsible for individual hall operations.
        </p>

        <h2>4. Student Accounts</h2>
        <p>
          Students register under a specific study hall. Your account is scoped to that hall.
          Seat booking approval is at the sole discretion of the hall administrator.
          Application approval or rejection does not constitute any contractual obligation.
        </p>

        <h2>5. Payments</h2>
        <p>
          StudyHub facilitates the recording of UPI and cash payments. All payment disputes
          are between the student and the study hall operator. StudyHub does not process
          payments and holds no funds.
        </p>

        <h2>6. Intellectual Property</h2>
        <p>
          StudyHub and the StudyHub logo are trademarks of NayakWorks. You may not use our
          branding without written permission.
        </p>

        <h2>7. Limitation of Liability</h2>
        <p>
          StudyHub is provided "as is." NayakWorks is not liable for any indirect, incidental,
          or consequential damages arising from use of the platform.
        </p>

        <h2>8. Governing Law</h2>
        <p>
          These terms are governed by the laws of India. Any disputes shall be subject to the
          jurisdiction of courts in India.
        </p>

        <h2>9. Contact</h2>
        <p>
          For legal queries: <a href="mailto:legal@studyhub.app">legal@studyhub.app</a>
        </p>
      </main>
    </div>
  );
}
