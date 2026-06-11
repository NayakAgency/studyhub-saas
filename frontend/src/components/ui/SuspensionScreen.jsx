import { ShieldX, Clock } from 'lucide-react';
import Button from './Button.jsx';
import useAuthStore from '../../store/authStore.js';
import useUIStore from '../../store/uiStore.js';

export default function SuspensionScreen({ data }) {
  const { logout } = useAuthStore();
  const { clearTenantRestriction } = useUIStore();

  const isSuspended = data?.error === 'TENANT_SUSPENDED';
  const isTrialExpired = data?.error === 'TRIAL_EXPIRED';

  const handleLogout = async () => {
    await logout();
    clearTenantRestriction();
    window.location.href = '/admin/login';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-card border border-gray-200 overflow-hidden">
        <div className={`p-6 ${isSuspended ? 'bg-red-50' : 'bg-amber-50'}`}>
          <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isSuspended ? 'bg-red-100' : 'bg-amber-100'}`}>
            {isSuspended
              ? <ShieldX className="h-8 w-8 text-red-600" />
              : <Clock className="h-8 w-8 text-amber-600" />
            }
          </div>
          <h1 className={`text-xl font-bold text-center font-display ${isSuspended ? 'text-red-900' : 'text-amber-900'}`}>
            {isSuspended ? 'Account Suspended' : 'Trial Period Ended'}
          </h1>
        </div>

        <div className="p-6 text-center space-y-3">
          {data?.hallName && (
            <p className="text-sm text-gray-500">
              Study Hall: <span className="font-semibold text-gray-800">{data.hallName}</span>
            </p>
          )}
          <p className="text-sm text-gray-600">{data?.message}</p>

          <div className="pt-2 space-y-2">
            <p className="text-xs text-gray-500">
              Contact support at{' '}
              <a href="mailto:support@studyhub.app" className="text-primary-600 hover:underline">
                support@studyhub.app
              </a>
            </p>
          </div>

          <Button variant="secondary" className="w-full mt-4" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
