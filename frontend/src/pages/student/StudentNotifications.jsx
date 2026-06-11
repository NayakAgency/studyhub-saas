import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { relativeTime, cn } from '../../lib/utils.js';
import { Bell, CheckCheck } from 'lucide-react';
import { useWebSocket } from '../../lib/hooks/useWebSocket.js';

const TYPE_ICONS = { announcement: '📢', fee_reminder: '💳', seat_change: '🪑', complaint_update: '💬', membership_expiry: '⏰', renewal_reminder: '🔄', general: '🔔' };
const TYPE_COLORS = { announcement: 'info', fee_reminder: 'warning', membership_expiry: 'danger', renewal_reminder: 'orange', complaint_update: 'primary', general: 'default' };

export default function StudentNotifications() {
  const qc = useQueryClient();

  // Live notification updates via WebSocket
  useWebSocket(['notifications'], {
    'notification': (_msg, queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['student', 'notifications'] });
      queryClient.invalidateQueries({ queryKey: ['student', 'notifications', 'count'] });
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'notifications'],
    queryFn: () => api.get('/student/notifications', { params: { limit: 50 } }).then((r) => r.data),
  });

  const readMutation = useMutation({
    mutationFn: (id) => api.patch(`/student/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries(['student', 'notifications']),
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.patch('/student/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries(['student', 'notifications']),
  });

  const unread = data?.unreadCount || 0;
  const notifications = data?.data || [];

  return (
    <div className="p-5 space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Notifications</h1>
          {unread > 0 && <p className="text-sm text-gray-500 mt-0.5">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <Button variant="ghost" size="sm" leftIcon={<CheckCheck className="h-4 w-4" />}
            onClick={() => readAllMutation.mutate()} loading={readAllMutation.isPending}>
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-16 rounded-xl skeleton" />)}</div>
      ) : notifications.length === 0 ? (
        <Card className="p-10 text-center">
          <Bell className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No notifications yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button key={n.id} onClick={() => !n.is_read && readMutation.mutate(n.id)}
              className={cn('w-full text-left p-4 rounded-xl border transition-all',
                n.is_read ? 'bg-white border-gray-100' : 'bg-primary-50 border-primary-100 hover:bg-primary-50/80')}>
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{TYPE_ICONS[n.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={cn('text-sm font-semibold', !n.is_read ? 'text-gray-900' : 'text-gray-700')}>{n.title}</p>
                    {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{relativeTime(n.created_at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
