// ============================================================
// Admin Gallery Management
// Upload, manage, reorder hall photos shown on public website
// ============================================================

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Image, Plus, Trash2, Upload, X, Eye,
  ToggleLeft, ToggleRight, ImageOff, Loader2,
} from 'lucide-react';
import { api, getErrorMessage } from '../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { cn, formatDate } from '../../lib/utils.js';

// ── Upload Panel ──────────────────────────────────────────────

function UploadPanel({ onClose }) {
  const [files, setFiles]   = useState([]);
  const [caption, setCaption] = useState('');
  const [previews, setPreviews] = useState([]);
  const inputRef = useRef(null);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (fd) => api.post('/admin/gallery', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: () => {
      toast.success('Images uploaded!');
      qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleFilePick = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const valid = picked.filter(f => validTypes.includes(f.type) && f.size <= 8 * 1024 * 1024);
    const invalid = picked.length - valid.length;
    if (invalid > 0) toast.error(`${invalid} file(s) skipped — must be JPEG/PNG/WebP under 8MB`);

    setFiles(prev => [...prev, ...valid].slice(0, 10));
    const newPreviews = valid.map(f => URL.createObjectURL(f));
    setPreviews(prev => [...prev, ...newPreviews].slice(0, 10));
  };

  const removeFile = (i) => {
    URL.revokeObjectURL(previews[i]);
    setFiles(f => f.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const handleUpload = () => {
    if (!files.length) return toast.error('Select at least one image');
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));
    if (caption) fd.append('caption', caption);
    mutation.mutate(fd);
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary-600" /> Upload Photos
        </h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardBody className="space-y-4">

        {/* Drop zone */}
        {previews.length < 10 && (
          <label
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200
              rounded-xl py-8 cursor-pointer hover:border-primary-400 hover:bg-primary-50/20 transition-all"
            onClick={() => inputRef.current?.click()}
          >
            <Image className="h-8 w-8 text-gray-300 mb-2" />
            <span className="text-sm font-medium text-gray-600">Click to upload photos</span>
            <span className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP · max 8MB · up to 10 photos</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />
          </label>
        )}

        {/* Previews */}
        {previews.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden aspect-square">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {previews.length < 10 && (
              <button
                onClick={() => inputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-200
                  flex items-center justify-center text-gray-400 hover:border-primary-400 transition-colors"
              >
                <Plus className="h-6 w-6" />
              </button>
            )}
          </div>
        )}

        <Input
          label="Caption (optional)"
          placeholder="Applied to all uploaded images"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={handleUpload}
            loading={mutation.isPending}
            disabled={!files.length}
            className="flex-1"
            leftIcon={<Upload className="h-4 w-4" />}
          >
            Upload {files.length > 0 ? `${files.length} Photo${files.length > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Edit Caption Modal ────────────────────────────────────────

function EditModal({ image, onClose }) {
  const [caption, setCaption] = useState(image.caption || '');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.put(`/admin/gallery/${image.id}`, { caption }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
      toast.success('Caption updated');
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Modal title="Edit Caption" onClose={onClose} size="sm">
      <div className="space-y-4">
        <img src={image.image_url} alt="" className="w-full h-40 object-cover rounded-xl" />
        <Input
          label="Caption"
          placeholder="Describe this photo…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function AdminGallery() {
  const [showUpload, setShowUpload]   = useState(false);
  const [lightbox, setLightbox]       = useState(null);
  const [editTarget, setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const qc = useQueryClient();

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['admin', 'gallery'],
    queryFn: () => api.get('/admin/gallery').then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/gallery/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
      toast.success('Image deleted');
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/admin/gallery/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'gallery'] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const active   = images.filter(i => i.is_active !== false);
  const inactive = images.filter(i => i.is_active === false);

  return (
    <div className="p-6 space-y-6 pb-20 md:pb-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Gallery</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {active.length} active · {inactive.length} hidden · shown on public hall website
          </p>
        </div>
        {!showUpload && (
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowUpload(true)}>
            Upload Photos
          </Button>
        )}
      </div>

      {/* ── Upload panel ── */}
      <AnimatePresence>
        {showUpload && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <UploadPanel onClose={() => setShowUpload(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Gallery Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <Card className="py-16 text-center">
          <ImageOff className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No photos yet</p>
          <p className="text-sm text-gray-400 mt-1">Upload photos to showcase your study hall</p>
          <Button
            className="mt-4"
            size="sm"
            leftIcon={<Upload className="h-4 w-4" />}
            onClick={() => setShowUpload(true)}
          >
            Upload First Photo
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((img, i) => (
            <motion.div
              key={img.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                'relative group rounded-xl overflow-hidden aspect-square bg-gray-100',
                img.is_active === false && 'opacity-50'
              )}
            >
              <img
                src={img.image_url}
                alt={img.caption || 'Gallery photo'}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-end">
                <div className="p-2 w-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
                  <div className="flex gap-1">
                    {/* Fullscreen */}
                    <button
                      onClick={() => setLightbox(img)}
                      className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white transition-colors"
                      title="View full size"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {/* Toggle active */}
                    <button
                      onClick={() => toggleMutation.mutate({ id: img.id, isActive: img.is_active === false })}
                      className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white transition-colors"
                      title={img.is_active === false ? 'Show on website' : 'Hide from website'}
                    >
                      {img.is_active === false
                        ? <ToggleLeft className="h-3.5 w-3.5 text-gray-400" />
                        : <ToggleRight className="h-3.5 w-3.5 text-emerald-600" />
                      }
                    </button>
                    {/* Edit caption */}
                    <button
                      onClick={() => setEditTarget(img)}
                      className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white transition-colors"
                      title="Edit caption"
                    >
                      <span className="text-xs font-bold leading-none">Aa</span>
                    </button>
                  </div>
                  {/* Delete */}
                  <button
                    onClick={() => setDeleteTarget(img)}
                    className="p-1.5 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Caption chip */}
              {img.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 pt-4 pb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <p className="text-white text-xs truncate">{img.caption}</p>
                </div>
              )}

              {/* Hidden badge */}
              {img.is_active === false && (
                <div className="absolute top-2 right-2 bg-gray-800/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                  Hidden
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={lightbox.image_url}
            alt={lightbox.caption || ''}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox.caption && (
            <p className="absolute bottom-6 left-0 right-0 text-center text-white/80 text-sm px-4">
              {lightbox.caption}
            </p>
          )}
        </div>
      )}

      {/* ── Edit Caption Modal ── */}
      {editTarget && <EditModal image={editTarget} onClose={() => setEditTarget(null)} />}

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Delete Photo"
        message="Remove this photo from the gallery? This cannot be undone."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        variant="danger"
      />
    </div>
  );
}
