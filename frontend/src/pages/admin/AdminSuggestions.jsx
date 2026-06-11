import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import { Table, Pagination } from '../../components/ui/Table.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Select from '../../components/ui/Select.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { formatDate } from '../../lib/utils.js';
import { Lightbulb, User, EyeOff } from 'lucide-react';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'received', label: 'Received' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'implemented', label: 'Implemented' },
];

const STATUS_VARIANTS = {
  received: 'default',
  reviewed: 'info',
  implemented: 'success',
};

const STATUS_LABELS = {
  received: 'Received',
  reviewed: 'Reviewed',
  implemented: 'Implemented',
};

export default function AdminSuggestions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'suggestions', { page, status }],
    queryFn: () =>
      api.get('/admin/suggestions', { params: { page, limit: 20, status } }).then((r) => r.data),
    keepPreviousData: true,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/suggestions/${id}`, body),
    onSuccess: () => {
      toast.success('Suggestion updated');
      qc.invalidateQueries(['admin', 'suggestions']);
      setSelected(null);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update'),
  });

  const openDetail = (suggestion) => {
    setSelected(suggestion);
    setNewStatus(suggestion.status);
  };

  const handleUpdate = () => {
    updateMutation.mutate({ id: selected.id, status: newStatus });
  };

  const columns = [
    {
      key: 'subject',
      label: 'Suggestion',
      render: (v, row) => (
        <div>
          <p className="text-sm font-medium text-gray-900 line-clamp-1">{v}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'student',
      label: 'From',
      render: (student, row) =>
        row.is_anonymous ? (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <EyeOff className="h-3.5 w-3.5" />
            Anonymous
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-gray-600">
            <User className="h-3.5 w-3.5" />
            {student?.full_name || '—'}
          </span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <Badge variant={STATUS_VARIANTS[v] || 'default'} size="sm" className="capitalize">
          {STATUS_LABELS[v] || v}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (v) => <span className="text-xs text-gray-500">{formatDate(v)}</span>,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (_, row) => (
        <Button variant="ghost" size="xs" onClick={() => openDetail(row)}>
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Suggestions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} total suggestions from students
          </p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-2 rounded-xl text-sm">
          <Lightbulb className="h-4 w-4" />
          <span className="font-medium">
            {(data?.data || []).filter((s) => s.status === 'received').length} new
          </span>
        </div>
      </div>

      <Card>
        <div className="px-4 pt-4">
          <Tabs
            tabs={STATUS_TABS}
            active={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          />
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination
          page={page}
          pages={data?.pagination?.pages || 1}
          total={data?.pagination?.total || 0}
          limit={20}
          onPageChange={setPage}
        />
      </Card>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Review Suggestion"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
            <Button onClick={handleUpdate} loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* Suggestion content */}
            <div className="p-4 bg-gray-50 rounded-xl space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{selected.subject}</p>
                <Badge
                  variant={STATUS_VARIANTS[selected.status] || 'default'}
                  size="sm"
                  className="capitalize shrink-0"
                >
                  {STATUS_LABELS[selected.status] || selected.status}
                </Badge>
              </div>
              <p className="text-sm text-gray-700">{selected.description}</p>
              <div className="flex items-center gap-2 pt-1">
                {selected.is_anonymous ? (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <EyeOff className="h-3 w-3" />
                    Anonymous submission
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <User className="h-3 w-3" />
                    {selected.student?.full_name} ({selected.student?.student_code})
                  </span>
                )}
                <span className="text-xs text-gray-400 ml-auto">{formatDate(selected.created_at)}</span>
              </div>
            </div>

            {/* Update status */}
            <Select
              label="Update Status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              options={[
                { value: 'received', label: 'Received' },
                { value: 'reviewed', label: 'Reviewed' },
                { value: 'implemented', label: 'Implemented' },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
