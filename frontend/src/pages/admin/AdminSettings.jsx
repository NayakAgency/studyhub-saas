import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Input, { Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import FileUpload from '../../components/ui/FileUpload.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { formatFileSize } from '../../lib/utils.js';
import { Upload, Trash2, GripVertical, Image } from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

const TABS = [
  { value: 'general',      label: 'General' },
  { value: 'timing',       label: 'Timing' },
  { value: 'notifications',label: 'Notifications' },
  { value: 'website',      label: 'Public Website' },
  { value: 'gallery',      label: 'Gallery' },
];

export default function AdminSettings() {
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [deleteImageTarget, setDeleteImageTarget] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data),
  });

  const { data: galleryData, isLoading: galleryLoading } = useQuery({
    queryKey: ['admin', 'gallery'],
    queryFn: () => api.get('/admin/gallery').then((r) => r.data),
    enabled: tab === 'gallery',
  });

  const settings = data?.settings || {};
  const tenant   = data?.tenant   || {};
  const merged   = { ...settings, ...tenant, ...form };

  const saveMutation = useMutation({
    mutationFn: (body) => api.put('/admin/settings', body),
    onSuccess: () => { toast.success('Settings saved'); qc.invalidateQueries(['admin', 'settings']); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Save failed'),
  });

  const logoMutation = useMutation({
    mutationFn: (fd) => api.post('/admin/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { toast.success('Logo updated'); qc.invalidateQueries(['admin', 'settings']); setLogoFile(null); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Logo upload failed'),
  });

  const galleryUploadMutation = useMutation({
    mutationFn: (fd) => api.post('/admin/gallery', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { toast.success('Images uploaded'); qc.invalidateQueries(['admin', 'gallery']); setGalleryFiles([]); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Upload failed'),
  });

  const galleryDeleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/gallery/${id}`),
    onSuccess: () => { toast.success('Image deleted'); qc.invalidateQueries(['admin', 'gallery']); setDeleteImageTarget(null); },
  });

  const handleChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const handleSave = () => saveMutation.mutate({ ...form });

  const handleLogoUpload = () => {
    if (!logoFile) return toast.error('Select a logo file');
    const fd = new FormData();
    fd.append('logo', logoFile);
    logoMutation.mutate(fd);
  };

  const handleGalleryUpload = () => {
    if (!galleryFiles.length) return toast.error('Select at least one image');
    const fd = new FormData();
    (Array.isArray(galleryFiles) ? galleryFiles : [galleryFiles]).forEach((f) => fd.append('images', f));
    galleryUploadMutation.mutate(fd);
  };

  const lightboxSlides = (galleryData || []).map((img) => ({ src: img.image_url, title: img.caption }));

  if (isLoading) return <div className="p-6 text-gray-500">Loading settings…</div>;

  return (
    <div className="p-6 space-y-5 max-w-3xl pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Hall Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure your study hall</p>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ── General ── */}
      {tab === 'general' && (
        <div className="space-y-5">
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-gray-800">Hall Information</h3></CardHeader>
            <CardBody className="space-y-4">
              <Input label="Hall Name" value={merged.hall_name || ''}
                onChange={(e) => handleChange('hallName', e.target.value)} />
              <Input label="City" value={merged.city || ''}
                onChange={(e) => handleChange('city', e.target.value)} />
              <Textarea label="Address" rows={2} value={merged.address || ''}
                onChange={(e) => handleChange('address', e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Currency Symbol" value={merged.currency_symbol || '₹'}
                  onChange={(e) => handleChange('currencySymbol', e.target.value)} className="w-full" />
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Theme Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={merged.theme_color || '#2563EB'}
                      onChange={(e) => handleChange('themeColor', e.target.value)}
                      className="h-9 w-16 rounded-lg border border-gray-300 p-1 cursor-pointer" />
                    <span className="text-xs text-gray-500">{merged.theme_color || '#2563EB'}</span>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Logo upload */}
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-gray-800">Hall Logo</h3></CardHeader>
            <CardBody className="space-y-4">
              {tenant.logo_url && (
                <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <img src={tenant.logo_url} alt="Current logo"
                    className="h-16 w-16 object-contain rounded-lg bg-white border border-gray-200 p-1" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Current Logo</p>
                    <p className="text-xs text-gray-400">Upload a new one to replace</p>
                  </div>
                </div>
              )}
              <FileUpload
                label="Upload New Logo"
                accept="image/jpeg,image/png,image/webp"
                hint="JPEG, PNG or WebP · Recommended: 200×200px"
                value={logoFile}
                onChange={setLogoFile}
              />
              {logoFile && (
                <Button
                  leftIcon={<Upload className="h-4 w-4" />}
                  onClick={handleLogoUpload}
                  loading={logoMutation.isPending}
                  size="sm"
                >
                  Upload Logo
                </Button>
              )}
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saveMutation.isPending}>Save General Settings</Button>
          </div>
        </div>
      )}

      {/* ── Timing ── */}
      {tab === 'timing' && (
        <div className="space-y-5">
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-gray-800">Operating Hours</h3></CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Opening Time" type="time"
                  value={merged.hall_open_time || '06:00'}
                  onChange={(e) => handleChange('hallOpenTime', e.target.value)} />
                <Input label="Closing Time" type="time"
                  value={merged.hall_close_time || '22:00'}
                  onChange={(e) => handleChange('hallCloseTime', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Working Days</label>
                <div className="flex flex-wrap gap-2">
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => {
                    const workingDays = Array.isArray(merged.working_days)
                      ? merged.working_days
                      : (typeof merged.working_days === 'string'
                          ? JSON.parse(merged.working_days || '[]')
                          : ['Mon','Tue','Wed','Thu','Fri','Sat']);
                    const isActive = workingDays.includes(day);
                    return (
                      <button key={day} type="button"
                        onClick={() => {
                          const parsed = Array.isArray(merged.working_days)
                            ? merged.working_days
                            : (typeof merged.working_days === 'string'
                                ? JSON.parse(merged.working_days || '[]')
                                : ['Mon','Tue','Wed','Thu','Fri','Sat']);
                          const updated = isActive ? parsed.filter((d) => d !== day) : [...parsed, day];
                          handleChange('workingDays', updated);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          isActive
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardBody>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saveMutation.isPending}>Save Timing</Button>
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {tab === 'notifications' && (
        <div className="space-y-5">
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-gray-800">Reminder Settings</h3></CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Fee Due Day (day of month)"
                type="number" min="1" max="31"
                hint="Students will be reminded on this day each month"
                value={merged.fee_due_day || 5}
                onChange={(e) => handleChange('feeDueDay', parseInt(e.target.value))}
              />
              <Input
                label="Renewal Reminder (days before expiry)"
                type="number" min="1"
                hint="Send reminder this many days before membership expires"
                value={merged.renewal_reminder_days || 7}
                onChange={(e) => handleChange('renewalReminderDays', parseInt(e.target.value))}
              />
              <Input
                label="Max Complaint Resolution Days"
                type="number" min="1"
                hint="Target number of days to resolve complaints"
                value={merged.max_complaint_days || 7}
                onChange={(e) => handleChange('maxComplaintDays', parseInt(e.target.value))}
              />
              <Input
                label="Grace Period Days (after fee due date)"
                type="number" min="0" max="30"
                hint="Allow this many extra days after the due date before auto-suspending"
                value={merged.grace_period_days ?? 7}
                onChange={(e) => handleChange('gracePeriodDays', parseInt(e.target.value))}
              />
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">Auto-suspend Overdue Memberships</p>
                  <p className="text-xs text-gray-500">Automatically suspend seats when fees are overdue beyond the grace period</p>
                </div>
                <input type="checkbox"
                  checked={merged.auto_suspend_overdue !== false}
                  onChange={(e) => handleChange('autoSuspendOverdue', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 cursor-pointer" />
              </label>
            </CardBody>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saveMutation.isPending}>Save Notification Settings</Button>
          </div>
        </div>
      )}

      {/* ── Public Website ── */}
      {tab === 'website' && (
        <div className="space-y-5">
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-gray-800">Public Website Settings</h3></CardHeader>
            <CardBody className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">Enable Public Website</p>
                  <p className="text-xs text-gray-500">Show your hall's public page at /{tenant.slug}</p>
                </div>
                <input type="checkbox"
                  checked={merged.website_enabled !== false}
                  onChange={(e) => handleChange('websiteEnabled', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 cursor-pointer" />
              </label>

              <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-800">Show Seat Map Publicly</p>
                  <p className="text-xs text-gray-500">Allow visitors to see live seat availability</p>
                </div>
                <input type="checkbox"
                  checked={merged.public_seat_visibility !== false}
                  onChange={(e) => handleChange('publicSeatVisibility', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 cursor-pointer" />
              </label>

              <Textarea
                label="Terms & Conditions"
                rows={5}
                placeholder="Enter your hall's terms and conditions…"
                value={merged.terms_and_conditions || ''}
                onChange={(e) => handleChange('termsAndConditions', e.target.value)}
              />

              {tenant.slug && (
                <div className="p-3 bg-primary-50 border border-primary-100 rounded-xl">
                  <p className="text-xs text-primary-700">
                    Your public URL:{' '}
                    <a
                      href={`/${tenant.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline"
                    >
                      /{tenant.slug}
                    </a>
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saveMutation.isPending}>Save Website Settings</Button>
          </div>
        </div>
      )}

      {/* ── Gallery ── */}
      {tab === 'gallery' && (
        <div className="space-y-5">
          {/* Upload new images */}
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-gray-800">Upload Gallery Images</h3></CardHeader>
            <CardBody className="space-y-4">
              <FileUpload
                label="Select Images"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hint="JPEG, PNG, WebP · Max 5 MB each · Up to 10 at once"
                value={galleryFiles.length > 0 ? galleryFiles : null}
                onChange={(files) => setGalleryFiles(Array.isArray(files) ? files : [files].filter(Boolean))}
              />
              {galleryFiles.length > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">{galleryFiles.length} file{galleryFiles.length !== 1 ? 's' : ''} selected</p>
                  <Button
                    size="sm"
                    leftIcon={<Upload className="h-4 w-4" />}
                    onClick={handleGalleryUpload}
                    loading={galleryUploadMutation.isPending}
                  >
                    Upload Images
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Existing gallery */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Gallery Images</h3>
              <Badge variant="default" size="sm">{galleryData?.length || 0} images</Badge>
            </CardHeader>
            <CardBody>
              {galleryLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[1,2,3,4,5,6].map((i) => (
                    <div key={i} className="aspect-video rounded-xl skeleton" />
                  ))}
                </div>
              ) : !galleryData?.length ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Image className="h-7 w-7 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">No gallery images yet</p>
                  <p className="text-xs text-gray-400">Upload images to showcase your hall</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {galleryData.map((img, i) => (
                    <div
                      key={img.id}
                      className="group relative aspect-video rounded-xl overflow-hidden bg-gray-100 cursor-pointer"
                      onClick={() => setLightboxIndex(i)}
                    >
                      <img
                        src={img.image_url}
                        alt={img.caption || `Gallery ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {/* Caption overlay */}
                      {img.caption && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                          <p className="text-white text-xs truncate">{img.caption}</p>
                        </div>
                      )}
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteImageTarget(img); }}
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-red-500 flex items-center justify-center
                          opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-white" />
                      </button>
                      {/* Active indicator */}
                      {!img.is_active && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="default" size="sm">Hidden</Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* Gallery lightbox */}
      <Lightbox
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        index={lightboxIndex}
        slides={lightboxSlides}
      />

      {/* Delete gallery image confirm */}
      <ConfirmDialog
        open={!!deleteImageTarget}
        onClose={() => setDeleteImageTarget(null)}
        onConfirm={() => galleryDeleteMutation.mutate(deleteImageTarget.id)}
        title="Delete Image"
        message="Remove this image from your gallery? This cannot be undone."
        confirmLabel="Delete Image"
        loading={galleryDeleteMutation.isPending}
      />
    </div>
  );
}
