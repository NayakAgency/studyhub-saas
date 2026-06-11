import { Link } from 'react-router-dom';
import { GraduationCap, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button.jsx';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="h-20 w-20 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-6">
          <GraduationCap className="h-10 w-10 text-primary-600" />
        </div>
        <h1 className="text-6xl font-bold text-gray-900 font-display mb-3">404</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Page Not Found</h2>
        <p className="text-sm text-gray-500 mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/">
          <Button leftIcon={<ArrowLeft className="h-4 w-4" />}>Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
