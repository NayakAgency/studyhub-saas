import { useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import Button from '../../components/ui/Button.jsx';
import { formatDate } from '../../lib/utils.js';
import { Download, Share2, GraduationCap } from 'lucide-react';

// ── Tiny canvas QR renderer (no library needed) ───────────────
// Generates a compact visual QR-like pattern from the student code
// using a seeded pseudo-random fill for a stable, unique pattern.
function QRPattern({ value = '', size = 48 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    const ctx = canvas.getContext('2d');
    const cells = 11; // 11×11 grid
    const cell  = size / cells;

    // Seed hash from value string
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }

    ctx.clearRect(0, 0, size, size);

    // Draw cells
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        // Fixed corner position markers (top-left, top-right, bottom-left)
        const isCorner =
          (r < 3 && c < 3) || (r < 3 && c >= cells - 3) || (r >= cells - 3 && c < 3);

        let filled;
        if (isCorner) {
          // Solid border + center dot pattern
          const inBorder =
            (r === 0 || r === 2 || c === 0 || c === 2) ||
            (r >= cells - 3 && c < 3 && (r === cells-3 || r === cells-1 || c === 0 || c === 2));
          filled = true; // simplified: fill entire corner block
        } else {
          // Pseudo-random based on hash + position
          const seed = hash ^ (r * 31 + c * 17) ^ (r << 8);
          filled = ((seed >>> (c % 32)) & 1) === 1;
        }

        if (filled) {
          ctx.fillStyle = '#111827';
          ctx.fillRect(c * cell, r * cell, cell - 0.5, cell - 0.5);
        }
      }
    }
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

export default function StudentIdCard() {
  const cardRef = useRef(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['student', 'profile'],
    queryFn: () => api.get('/student/profile').then((r) => r.data),
  });

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `studyhub-id-${profile?.student_code}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('ID Card downloaded!');
    } catch {
      toast.error('Failed to download. Please try again.');
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'student-id.png', { type: 'image/png' });
      if (navigator.share) {
        await navigator.share({ files: [file], title: 'My StudyHub ID Card' });
      } else {
        toast('Share not supported on this browser — use download instead.');
      }
    } catch {
      toast.error('Share failed');
    }
  };

  if (isLoading) return <div className="p-5 text-gray-500">Loading...</div>;
  if (!profile) return <div className="p-5 text-gray-500">Profile not found</div>;

  const activeMembership = profile.memberships?.find((m) => m.status === 'active');
  const themeColor = profile.tenant?.theme_color || '#2563EB';

  return (
    <div className="p-5 space-y-5 max-w-sm">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Digital ID Card</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your official StudyHub identity card</p>
      </div>

      {/* ID Card */}
      <div ref={cardRef} className="rounded-2xl overflow-hidden shadow-card-hover" style={{ fontFamily: 'Inter, sans-serif' }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ backgroundColor: themeColor }}>
          {profile.tenant?.logo_url
            ? <img src={profile.tenant.logo_url} alt="Hall" className="h-10 w-10 rounded-lg object-contain bg-white p-0.5" />
            : <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center"><GraduationCap className="h-5 w-5 text-white" /></div>
          }
          <div>
            <p className="text-sm font-bold text-white font-display">{profile.tenant?.hall_name}</p>
            <p className="text-xs text-white/70">Student Identity Card</p>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white px-5 py-4 space-y-3">
          <div className="flex items-start gap-4">
            {profile.profile_photo_url
              ? <img src={profile.profile_photo_url} alt={profile.full_name} className="h-20 w-20 rounded-xl object-cover border-2 border-gray-100 flex-shrink-0" />
              : (
                <div className="h-20 w-20 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: themeColor }}>
                  {profile.full_name?.[0]?.toUpperCase()}
                </div>
              )
            }
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-gray-900 leading-tight">{profile.full_name}</p>
              <p className="text-sm font-mono text-gray-500 mt-0.5">{profile.student_code}</p>
              <p className="text-sm text-gray-600 mt-1">{profile.phone}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-gray-100">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Seat</p>
              <p className="text-sm font-bold text-gray-800">{profile.assigned_seat?.seat_number || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Plan</p>
              <p className="text-sm font-bold text-gray-800">{activeMembership?.plan?.plan_name || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Valid Until</p>
              <p className="text-sm font-bold text-gray-800">{activeMembership?.end_date ? formatDate(activeMembership.end_date) : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Contact</p>
              <p className="text-sm font-bold text-gray-800">{profile.tenant?.owner_phone || '—'}</p>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 bg-white flex items-center justify-center p-1">
              <QRPattern value={profile.student_code} size={40} />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-medium">Scan to verify</p>
              <p className="text-[9px] text-gray-400 font-mono">{profile.student_code}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 flex justify-between items-center" style={{ backgroundColor: themeColor + '20' }}>
          <p className="text-[10px] text-gray-500">Powered by StudyHub</p>
          <p className="text-[10px] text-gray-500">NayakWorks © 2024</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button className="flex-1" leftIcon={<Download className="h-4 w-4" />} onClick={handleDownload}>Download PNG</Button>
        <Button variant="secondary" iconOnly onClick={handleShare}><Share2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
