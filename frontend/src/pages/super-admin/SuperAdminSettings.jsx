import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import Input, { Textarea } from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { formatDate, relativeTime } from '../../lib/utils.js';
import {
  Palette, Shield, Megaphone, Link2,
  Plus, Trash2, Save, Eye, ExternalLink, Copy,
} from 'lucide-react';
import { cn } from '../../lib/utils.js';

const TABS = [
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'links', label: 'Portal Links', icon: Link2 },
];

// ── Branding Tab ─────────────────────────────────────────────

function BrandingTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['super-admin', 'platform-settings'],
    queryFn: () => api.get('/super-admin/platform-settings').then((r) => r.data),
  });

  useEffect(() => {
    if (settings && !form) {
      setForm({
        appName: settings.appName || 'StudyHub',
        appTagline: settings.appTagline || '',
        primaryColor: settings.primaryColor || '#6366f1',
        supportEmail: settings.supportEmail || '',
        studentPortalLabel: settings.studentPortalLabel || 'Student Portal',
        adminPortalLabel: settings.adminPortalLabel || 'Admin Portal',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (body) => api.put('/super-admin/platform-settings', body),
    onSuccess: (res) => {
      toast.success('Branding settings saved');
      qc.invalidateQueries(['super-admin', 'platform-settings']);
      // Persist appName in localStorage for immediate sidebar/layout use
      if (res.data.appName) {
        localStorage.setItem('appName', res.data.appName);
        window.dispatchEvent(new Event('appNameChanged'));
      }
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to save'),
  });

  if (isLoading || !form) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  const f = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Platform Identity</h3>
        <div className="space-y-4">
          <Input
            label="App Name"
            value={form.appName}
            onChange={(e) => f('appName', e.target.value)}
            hint="Shown in navbar, emails, and browser title"
          />
          <Input
            label="App Tagline"
            value={form.appTagline}
            onChange={(e) => f('appTagline', e.target.value)}
            hint="Short subtitle shown on the marketing page"
          />
          <Input
            label="Support Email"
            type="email"
            value={form.supportEmail}
            onChange={(e) => f('supportEmail', e.target.value)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Portal Labels</h3>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Student Portal Label"
            value={form.studentPortalLabel}
            onChange={(e) => f('studentPortalLabel', e.target.value)}
          />
          <Input
            label="Admin Portal Label"
            value={form.adminPortalLabel}
            onChange={(e) => f('adminPortalLabel', e.target.value)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Brand Color</h3>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.primaryColor}
            onChange={(e) => f('primaryColor', e.target.value)}
            className="h-10 w-16 rounded-lg border border-gray-200 cursor-pointer p-1"
          />
          <Input
            value={form.primaryColor}
            onChange={(e) => f('primaryColor', e.target.value)}
            placeholder="#6366f1"
            className="flex-1"
          />
        </div>
      </div>

      <Button
        leftIcon={<Save className="h-4 w-4" />}
        loading={saveMutation.isPending}
        onClick={() => saveMutation.mutate(form)}
      >
        Save Branding
      </Button>
    </div>
  );
}

// ── Security Tab ─────────────────────────────────────────────

function SecurityTab() {
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });

  const changeMutation = useMutation({
    mutationFn: (body) => api.post('/super-admin/platform-settings/change-password', body),
    onSuccess: () => {
      toast.success('Password updated successfully');
      setForm({ newPassword: '', confirmPassword: '' });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update password'),
  });

  const handleSubmit = () => {
    if (!form.newPassword) return toast.error('New password is required');
    if (form.newPassword.length < 8) return toast.error('Password must be at least 8 characters');
    if (form.newPassword !== form.confirmPassword) return toast.error('Passwords do not match');
    changeMutation.mutate(form);
  };

  return (
    <div className="space-y-5 max-w-md">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Change Password</h3>
        <p className="text-xs text-gray-400 mb-4">Update your super admin account password.</p>
        <div className="space-y-4">
          <Input
            label="New Password"
            type="password"
            required
            value={form.newPassword}
            onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
            hint="Minimum 8 characters"
          />
          <Input
            label="Confirm New Password"
            type="password"
            required
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          />
        </div>
      </div>

      <Button
        leftIcon={<Shield className="h-4 w-4" />}
        loading={changeMutation.isPending}
        onClick={handleSubmit}
      >
        Update Password
      </Button>
    </div>
  );
}

// ── Announcements Tab ─────────────────────────────────────────

const TYPE_VARIANTS = { info: 'info', warning: 'warning', maintenance: 'danger', update: 'primary' };

function AnnouncementsTab() {
  const [annModal, setAnnModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [annForm, setAnnForm] = useState({
    title: '', content: '', type: 'info', target: 'all', expiresAt: '',
  });
  const qc = useQueryClient();

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['super-admin', 'announcements'],
    queryFn: () => api.get('/super-admin/announcements').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/super-admin/announcements', body),
    onSuccess: () => {
      toast.success('Announcement created');
      qc.invalidateQueries(['super-admin', 'announcements']);
      setAnnModal(false);
      setAnnForm({ title: '', content: '', type: 'info', target: 'all', expiresAt: '' });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/super-admin/announcements/${id}`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries(['super-admin', 'announcements']);
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Platform Announcements</h3>
          </div>
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAnnModal(true)}>
            New
          </Button>
        </CardHeader>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-12 skeleton rounded" />)}
          </div>
        ) : (announcements || []).length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">No announcements</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {announcements.map((ann) => (
              <div key={ann.id} className="flex items-start gap-3 px-5 py-3">
                <Badge
                  variant={TYPE_VARIANTS[ann.type] || 'default'}
                  size="sm"
                  className="capitalize flex-shrink-0 mt-0.5"
                >
                  {ann.type}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{ann.title}</p>
                  <p className="text-xs text-gray-400">
                    {relativeTime(ann.created_at)}
                    {ann.expires_at ? ` · Expires ${formatDate(ann.expires_at)}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="xs" iconOnly onClick={() => setDeleteTarget(ann)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={annModal}
        onClose={() => setAnnModal(false)}
        title="New Platform Announcement"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAnnModal(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(annForm)} loading={createMutation.isPending}>
              Publish
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Title"
            required
            value={annForm.title}
            onChange={(e) => setAnnForm((f) => ({ ...f, title: e.target.value }))}
          />
          <Textarea
            label="Content"
            required
            rows={3}
            value={annForm.content}
            onChange={(e) => setAnnForm((f) => ({ ...f, content: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Type"
              value={annForm.type}
              onChange={(e) => setAnnForm((f) => ({ ...f, type: e.target.value }))}
              options={[
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Warning' },
                { value: 'maintenance', label: 'Maintenance' },
                { value: 'update', label: 'Update' },
              ]}
            />
            <Select
              label="Target"
              value={annForm.target}
              onChange={(e) => setAnnForm((f) => ({ ...f, target: e.target.value }))}
              options={[
                { value: 'all', label: 'All Users' },
                { value: 'admins_only', label: 'Admins Only' },
              ]}
            />
          </div>
          <Input
            label="Expires At (optional)"
            type="date"
            value={annForm.expiresAt}
            onChange={(e) => setAnnForm((f) => ({ ...f, expiresAt: e.target.value }))}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Delete Announcement"
        message={`Delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ── Portal Links Tab ─────────────────────────────────────────

function PortalLinksTab() {
  const { data: tenantsData, isLoading } = useQuery({
    queryKey: ['super-admin', 'tenants', 'all'],
    queryFn: () => api.get('/super-admin/tenants?limit=100').then((r) => r.data),
  });

  const tenants = tenantsData?.data || [];
  const origin = window.location.origin;

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  };

  const PLATFORM_LINKS = [
    { label: 'Marketing Site', url: `${origin}/` },
    { label: 'Super Admin Panel', url: `${origin}/super-admin` },
    { label: 'Admin Login', url: `${origin}/admin/login` },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-800">Platform Links</h3>
        </CardHeader>
        <div className="divide-y divide-gray-100">
          {PLATFORM_LINKS.map((link) => (
            <div key={link.label} className="flex items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{link.label}</p>
                <p className="text-xs text-gray-400 font-mono">{link.url}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => copy(link.url)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <a href={link.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-800">
            Tenant Student Portals
            <span className="ml-2 text-xs font-normal text-gray-400">({tenants.length} halls)</span>
          </h3>
        </CardHeader>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 skeleton rounded" />)}
          </div>
        ) : tenants.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">No tenants found</p>
        ) : (
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {tenants.map((tenant) => {
              const url = `${origin}/${tenant.slug}`;
              return (
                <div key={tenant.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tenant.hall_name}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{url}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={tenant.status === 'active' ? 'success' : tenant.status === 'suspended' ? 'danger' : 'warning'}
                      size="xs"
                      dot
                      className="capitalize"
                    >
                      {tenant.status}
                    </Badge>
                    <div className="flex gap-1">
                      <button onClick={() => copy(url)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a href={url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function SuperAdminSettings() {
  const [activeTab, setActiveTab] = useState('branding');

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Platform Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage platform-wide configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'branding' && <BrandingTab />}
      {activeTab === 'security' && <SecurityTab />}
      {activeTab === 'announcements' && <AnnouncementsTab />}
      {activeTab === 'links' && <PortalLinksTab />}
    </div>
  );
}
