// ============================================================
// Receipt Preview / Print Page
// Accessed at /admin/payments/:id/receipt-preview
// Generates a printable receipt using data from the API
// ============================================================

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import Button from '../../components/ui/Button.jsx';
import { formatDate, formatCurrency } from '../../lib/utils.js';
import { Download, Printer, ArrowLeft, GraduationCap } from 'lucide-react';

export default function AdminReceiptPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const receiptRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'receipt', id],
    queryFn: () => api.get(`/admin/payments/${id}/receipt`).then((r) => r.data),
  });

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    if (!receiptRef.current) return;
    try {
      const dataUrl = await toPng(receiptRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `receipt-${data?.payment?.receipt_number || id}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Receipt downloaded!');
    } catch {
      toast.error('Download failed');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading receipt…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-500">Receipt not found</div>
      </div>
    );
  }

  const { payment, tenant, currencySymbol = '₹' } = data;
  const membership = payment?.membership;
  const student = payment?.student;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Actions (hidden on print) */}
      <div className="max-w-md mx-auto mb-4 flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(-1)}>Back</Button>
        <div className="flex-1" />
        <Button variant="secondary" size="sm" leftIcon={<Printer className="h-4 w-4" />}
          onClick={handlePrint}>Print</Button>
        <Button size="sm" leftIcon={<Download className="h-4 w-4" />}
          onClick={handleDownload}>Download</Button>
      </div>

      {/* Receipt card */}
      <div
        ref={receiptRef}
        className="max-w-md mx-auto bg-white rounded-2xl overflow-hidden shadow-card-hover print:shadow-none print:rounded-none"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {/* Header */}
        <div className="bg-primary-600 px-6 py-6 text-center">
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.hall_name}
              className="h-12 w-12 rounded-xl object-contain mx-auto mb-3 bg-white p-1" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-3">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
          )}
          <p className="text-lg font-bold text-white font-display">{tenant?.hall_name}</p>
          <p className="text-sm text-primary-200 mt-0.5">Payment Receipt</p>
        </div>

        {/* Receipt number banner */}
        <div className="bg-primary-50 border-b border-primary-100 px-6 py-2 text-center">
          <p className="text-xs text-primary-600 font-semibold tracking-widest uppercase">
            Receipt No: {payment?.receipt_number}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Student info */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="h-11 w-11 rounded-full bg-primary-100 flex items-center justify-center text-base font-bold text-primary-700 flex-shrink-0">
              {student?.full_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">{student?.full_name}</p>
              <p className="text-xs text-gray-500 font-mono">{student?.student_code}</p>
              <p className="text-xs text-gray-400">{student?.phone}</p>
            </div>
          </div>

          {/* Payment details */}
          <div className="space-y-2.5">
            {[
              ['Plan',           membership?.plan?.plan_name || '—'],
              ['Seat',           membership?.seat?.seat_number || '—'],
              ['Period',         membership ? `${formatDate(membership.start_date)} – ${formatDate(membership.end_date)}` : '—'],
              ['Amount',         formatCurrency(payment?.amount, currencySymbol)],
              ['Payment Method', payment?.payment_method?.toUpperCase() || '—'],
              payment?.utr_number ? ['UTR Number', payment.utr_number] : null,
              ['Payment Date',   formatDate(payment?.payment_date)],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{label}</span>
                <span className={`text-sm font-semibold text-right ${label === 'Amount' ? 'text-emerald-700 text-base' : 'text-gray-800'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">
              Thank you for your payment!
            </p>
            {tenant?.owner_phone && (
              <p className="text-xs text-gray-400 mt-0.5">Contact: {tenant.owner_phone}</p>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">Powered by StudyHub</p>
          <p className="text-[10px] text-gray-400">{formatDate(payment?.created_at, 'dd MMM yyyy, HH:mm')}</p>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          #receipt-content, #receipt-content * { visibility: visible; }
          #receipt-content { position: absolute; left: 0; top: 0; }
        }
      `}</style>
    </div>
  );
}
