// ============================================================
// Image Cropper Modal — react-easy-crop based
// Supports circular and square modes with zoom slider
// ============================================================

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import { ZoomIn, ZoomOut } from 'lucide-react';

async function getCroppedBlob(imageSrc, croppedAreaPixels, shape = 'square') {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const canvas = document.createElement('canvas');
  const { width, height } = croppedAreaPixels;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    ctx.clip();
  }

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    width,
    height,
    0,
    0,
    width,
    height,
  );

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

export default function ImageCropper({
  open,
  onClose,
  imageSrc,
  onSave,
  shape = 'square',
  aspect = 1,
  loading = false,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    const blob = await getCroppedBlob(imageSrc, croppedAreaPixels, shape);
    onSave?.(blob);
  };

  const handleClose = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Crop Image"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading}>
            Save Photo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Crop area */}
        <div className="relative h-72 bg-gray-900 rounded-xl overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={shape}
              showGrid={shape !== 'circle'}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        {/* Zoom slider */}
        <div className="flex items-center gap-3 px-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-1.5 rounded-full accent-primary-600"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <span className="text-xs text-gray-400 w-10 text-right">{zoom.toFixed(1)}×</span>
        </div>

        <p className="text-xs text-gray-400 text-center">
          Drag to reposition · Scroll or use slider to zoom
        </p>
      </div>
    </Modal>
  );
}
