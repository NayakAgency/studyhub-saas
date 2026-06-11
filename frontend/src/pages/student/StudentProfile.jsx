import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import { api } from '../../lib/api.js';
import Input, { Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import PasswordStrengthIndicator from '../../components/ui/PasswordStrengthIndicator.jsx';
import { formatDate } from '../../lib/utils.js';
import { Camera, Lock } from 'lucide-react';

async function getCroppedImg(imageSrc, croppedAreaPixels) {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((r) => { image.onload = r; });
  const canvas = document.createElement('canvas');
  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height, 0, 0, croppedAreaPixels.width, croppedAreaPixels.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

export default function StudentProfile() {
  const qc = useQueryClient();
  const [editForm, setEditForm] = useState({});
  const [editing, setEditing] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [cropModal, setCropModal] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['student', 'profile'],
    queryFn: () => api.get('/student/profile').then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: (body) => api.put('/student/profile', body),
    onSuccess: () => { toast.success('Profile updated'); qc.invalidateQueries(['student', 'profile']); setEditing(false); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const photoMutation = useMutation({
    mutationFn: (fd) => api.post('/student/profile/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { toast.success('Photo updated'); qc.invalidateQueries(['student', 'profile']); setCropModal(false); },
    onError: () => toast.error('Photo upload failed'),
  });

  const pwMutation = useMutation({
    mutationFn: (body) => api.post('/student/profile/change-password', body),
    onSuccess: () => { toast.success('Password changed — please log in again'); setPwModal(false); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setImageSrc(reader.result); setCropModal(true); };
    reader.readAsDataURL(file);
  };

  const handleCropSave = async () => {
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
    const fd = new FormData();
    fd.append('photo', blob, 'photo.jpg');
    photoMutation.mutate(fd);
  };

  if (isLoading) return <div className="p-5 text-gray-500">Loading…</div>;
  if (!profile) return <div className="p-5 text-gray-500">Profile not found</div>;

  const p = { ...profile, ...editForm };

  return (
    <div className="p-5 space-y-5 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 font-display">My Profile</h1>

      {/* Photo + name */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar src={profile.profile_photo_url} name={profile.full_name} size="xl" />
            <label className="absolute bottom-0 right-0 h-7 w-7 bg-primary-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-700 transition-colors">
              <Camera className="h-3.5 w-3.5 text-white" />
              <input type="file" accept="image/*" className="sr-only" onChange={handlePhotoSelect} />
            </label>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{profile.full_name}</p>
            <p className="text-sm font-mono text-gray-500">{profile.student_code}</p>
            <p className="text-xs text-gray-400 mt-0.5">Registered {formatDate(profile.registered_at)}</p>
          </div>
        </div>
      </Card>

      {/* Editable info */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Personal Information</h3>
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</Button>
        </CardHeader>
        <CardBody className="space-y-3">
          {[
            { label: 'Full Name', key: 'full_name', readOnly: true },
            { label: 'Phone', key: 'phone', readOnly: true },
            { label: 'Email', key: 'email', editable: true },
            { label: 'Address', key: 'address', editable: true },
          ].map(({ label, key, readOnly, editable }) => (
            <div key={key}>
              {editing && editable
                ? <Input label={label} value={p[key] || ''} onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))} />
                : <div><p className="text-xs text-gray-500">{label}</p><p className="text-sm text-gray-800 mt-0.5">{profile[key] || '—'}</p></div>
              }
            </div>
          ))}
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Emergency Contact</p>
            {editing ? (
              <div className="space-y-2">
                <Input label="Name" value={p.emergency_contact_name || ''} onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_name: e.target.value }))} />
                <Input label="Phone" value={p.emergency_contact_phone || ''} onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))} />
                <Input label="Relation" value={p.emergency_contact_relation || ''} onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_relation: e.target.value }))} />
              </div>
            ) : (
              <div className="text-sm text-gray-700">
                <p>{profile.emergency_contact_name || '—'} {profile.emergency_contact_relation ? `(${profile.emergency_contact_relation})` : ''}</p>
                <p className="text-gray-500">{profile.emergency_contact_phone}</p>
              </div>
            )}
          </div>
          {editing && (
            <Button className="w-full" onClick={() => updateMutation.mutate({ email: p.email, address: p.address, emergencyContactName: p.emergency_contact_name, emergencyContactPhone: p.emergency_contact_phone, emergencyContactRelation: p.emergency_contact_relation })} loading={updateMutation.isPending}>
              Save Changes
            </Button>
          )}
        </CardBody>
      </Card>

      {/* Password */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-800">Password</p>
            <p className="text-xs text-gray-500">Change your account password</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setPwModal(true)}>Change</Button>
      </Card>

      {/* Change password modal */}
      <Modal open={pwModal} onClose={() => setPwModal(false)} title="Change Password" size="sm"
        footer={<><Button variant="secondary" onClick={() => setPwModal(false)}>Cancel</Button><Button onClick={() => pwMutation.mutate({ newPassword })} loading={pwMutation.isPending}>Update Password</Button></>}>
        <div className="space-y-3">
          <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <PasswordStrengthIndicator password={newPassword} />
        </div>
      </Modal>

      {/* Crop modal */}
      <Modal open={cropModal} onClose={() => setCropModal(false)} title="Crop Profile Photo" size="md"
        footer={<><Button variant="secondary" onClick={() => setCropModal(false)}>Cancel</Button><Button onClick={handleCropSave} loading={photoMutation.isPending}>Save Photo</Button></>}>
        <div className="relative h-48 sm:h-64 bg-gray-900 rounded-xl overflow-hidden">
          {imageSrc && (
            <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1}
              onCropChange={setCrop} onZoomChange={setZoom}
              onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)} />
          )}
        </div>
        <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full mt-3" />
      </Modal>
    </div>
  );
}
