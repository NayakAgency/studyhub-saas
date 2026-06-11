import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Modal, { ConfirmDialog } from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import { Tabs } from '../../../components/ui/Tabs.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { SEAT_STATUS, cn } from '../../../lib/utils.js';
import { Plus, Wand2, Settings2, Lock, Unlock } from 'lucide-react';
import { useWebSocket } from '../../../lib/hooks/useWebSocket.js';

export default function AdminSeats() {
  const [tab, setTab] = useState('layout');
  const [selectedSection, setSelectedSection] = useState(null);
  const [generateModal, setGenerateModal] = useState(false);
  const [sectionModal, setSectionModal] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [seatDetail, setSeatDetail] = useState(null);
  const qc = useQueryClient();

  // Real-time seat updates via WebSocket
  useWebSocket(['seat-updates'], {
    'seat-update': (_msg, queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'seats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
    },
  });

  const { data: sections, isLoading: sectionsLoading } = useQuery({
    queryKey: ['admin', 'sections'],
    queryFn: () => api.get('/admin/sections').then((r) => r.data),
  });

  const { data: seats, isLoading: seatsLoading } = useQuery({
    queryKey: ['admin', 'seats', selectedSection],
    queryFn: () => api.get('/admin/seats', { params: selectedSection ? { sectionId: selectedSection } : {} }).then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/admin/seats/${id}/status`, { status }),
    onSuccess: () => { toast.success('Seat status updated'); qc.invalidateQueries(['admin', 'seats']); setSeatDetail(null); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }) => api.patch('/admin/seats/bulk-status', { ids, status }),
    onSuccess: () => { toast.success('Seats updated'); qc.invalidateQueries(['admin', 'seats']); setSelectedSeats([]); },
  });

  const sectionsBySection = (seats || []).reduce((acc, seat) => {
    const secId = seat.section_id;
    if (!acc[secId]) acc[secId] = { section: seat.section, seats: [] };
    acc[secId].seats.push(seat);
    return acc;
  }, {});

  const toggleSeat = (id) => {
    setSelectedSeats((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Seat Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{seats?.length || 0} total seats</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Settings2 className="h-4 w-4" />} onClick={() => setSectionModal(true)}>Sections</Button>
          <Button size="sm" leftIcon={<Wand2 className="h-4 w-4" />} onClick={() => setGenerateModal(true)}>Generate Seats</Button>
        </div>
      </div>

      {/* Section filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setSelectedSection(null)}
          className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
            !selectedSection ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}>
          All Sections
        </button>
        {(sections || []).map((sec) => (
          <button key={sec.id} onClick={() => setSelectedSection(sec.id)}
            className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              selectedSection === sec.id ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}
            style={selectedSection === sec.id ? { backgroundColor: sec.color_code } : {}}>
            {sec.name}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {selectedSeats.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-primary-800">{selectedSeats.length} seats selected</span>
          <Button size="sm" variant="secondary" leftIcon={<Lock className="h-3.5 w-3.5" />}
            onClick={() => bulkStatusMutation.mutate({ ids: selectedSeats, status: 'blocked' })}>Block</Button>
          <Button size="sm" variant="secondary" leftIcon={<Unlock className="h-3.5 w-3.5" />}
            onClick={() => bulkStatusMutation.mutate({ ids: selectedSeats, status: 'available' })}>Unblock</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedSeats([])}>Clear</Button>
        </motion.div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(SEAT_STATUS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            <div className={cn('h-3 w-3 rounded', val.bg, 'border', 'border-current opacity-80')} style={{ borderColor: 'currentColor' }} />
            <span className="text-gray-600">{val.label}</span>
          </div>
        ))}
      </div>

      {/* Seat grid per section */}
      {Object.values(sectionsBySection).map(({ section, seats: sectionSeats }) => (
        <Card key={section?.id}>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: section?.color_code || '#3B82F6' }} />
              <h3 className="text-sm font-semibold text-gray-800">{section?.name}</h3>
              <span className="text-xs text-gray-500">({sectionSeats.length} seats)</span>
            </div>
            <div className="flex gap-2 text-xs text-gray-500">
              <span className="text-emerald-600 font-medium">{sectionSeats.filter((s) => s.status === 'available').length} available</span>
              <span>·</span>
              <span className="text-blue-600 font-medium">{sectionSeats.filter((s) => s.status === 'occupied').length} occupied</span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {sectionSeats.sort((a, b) => a.seat_number.localeCompare(b.seat_number, undefined, { numeric: true })).map((seat) => {
                const isSelected = selectedSeats.includes(seat.id);
                const cfg = SEAT_STATUS[seat.status] || SEAT_STATUS.available;
                return (
                  <button key={seat.id}
                    onClick={() => seat.status === 'available' || seat.status === 'blocked' || seat.status === 'maintenance' || seat.status === 'reserved'
                      ? toggleSeat(seat.id) : setSeatDetail(seat)}
                    className={cn(
                      'h-10 min-w-[48px] px-2 rounded-lg border-2 text-xs font-semibold transition-all',
                      isSelected ? 'border-primary-600 bg-primary-100 text-primary-800 scale-105 shadow-sm' : `${cfg.bg} ${cfg.color}`,
                      seat.status === 'available' ? 'hover:scale-105 cursor-pointer' : '',
                      seat.status === 'occupied' ? 'cursor-pointer' : '',
                    )}
                    title={seat.status === 'occupied' ? seat.student?.full_name : seat.status}
                  >
                    {seat.seat_number}
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      ))}

      {/* Seat detail popover */}
      <Modal open={!!seatDetail} onClose={() => setSeatDetail(null)} title={`Seat ${seatDetail?.seat_number}`} size="sm">
        {seatDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Status</p><Badge variant={seatDetail.status === 'occupied' ? 'info' : 'success'} dot>{seatDetail.status}</Badge></div>
              <div><p className="text-xs text-gray-500">Type</p><p className="font-medium capitalize">{seatDetail.seat_type}</p></div>
              {seatDetail.student && <div className="col-span-2"><p className="text-xs text-gray-500">Assigned To</p><p className="font-medium">{seatDetail.student?.full_name}</p><p className="text-xs text-gray-400">{seatDetail.student?.student_code}</p></div>}
            </div>
            {seatDetail.status !== 'occupied' && (
              <div className="flex gap-2 flex-wrap">
                {['available', 'blocked', 'reserved', 'maintenance'].filter((s) => s !== seatDetail.status).map((s) => (
                  <Button key={s} size="sm" variant="secondary" className="capitalize"
                    loading={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ id: seatDetail.id, status: s })}>
                    Mark {s}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Generate seats modal */}
      <GenerateSeatsModal open={generateModal} onClose={() => setGenerateModal(false)} sections={sections || []} onSuccess={() => { qc.invalidateQueries(['admin', 'seats']); setGenerateModal(false); }} />

      {/* Section manager modal */}
      <SectionManagerModal open={sectionModal} onClose={() => setSectionModal(false)} sections={sections || []} onSuccess={() => qc.invalidateQueries(['admin', 'sections'])} />
    </div>
  );
}

function GenerateSeatsModal({ open, onClose, sections, onSuccess }) {
  const [form, setForm] = useState({ sectionId: '', prefix: '', startNumber: 1, count: 10, seatType: 'standard' });
  const [loading, setLoading] = useState(false);
  const sectionOptions = sections.map((s) => ({ value: s.id, label: s.name }));

  const handleGenerate = async () => {
    if (!form.sectionId || !form.prefix) return toast.error('Fill all fields');
    try {
      setLoading(true);
      const { data } = await api.post('/admin/seats/generate', { ...form, startNumber: +form.startNumber, count: +form.count });
      toast.success(`Created ${data.created} seats`);
      onSuccess();
    } catch (e) { toast.error(e?.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Generate Seats" size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleGenerate} loading={loading}>Generate</Button></>}>
      <div className="space-y-3">
        <Select label="Section" required options={sectionOptions} placeholder="Select section" value={form.sectionId}
          onChange={(e) => setForm((f) => ({ ...f, sectionId: e.target.value }))} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prefix" placeholder="AC" value={form.prefix} onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))} />
          <Input label="Start No." type="number" value={form.startNumber} onChange={(e) => setForm((f) => ({ ...f, startNumber: e.target.value }))} />
          <Input label="Count" type="number" value={form.count} onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))} />
          <Select label="Seat Type" value={form.seatType} onChange={(e) => setForm((f) => ({ ...f, seatType: e.target.value }))}
            options={[{ value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }, { value: 'cabin', label: 'Cabin' }]} />
        </div>
        <p className="text-xs text-gray-500">Preview: {form.prefix}-{String(form.startNumber).padStart(2,'0')} → {form.prefix}-{String(+form.startNumber + +form.count - 1).padStart(2,'0')}</p>
      </div>
    </Modal>
  );
}

function SectionManagerModal({ open, onClose, sections, onSuccess }) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3B82F6');
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const create = async () => {
    if (!newName) return;
    try { setLoading(true); await api.post('/admin/sections', { name: newName, colorCode: newColor }); toast.success('Section created'); onSuccess(); setNewName(''); }
    catch (e) { toast.error(e?.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const deleteSection = async (id) => {
    try { await api.delete(`/admin/sections/${id}`); toast.success('Section deleted'); onSuccess(); }
    catch (e) { toast.error(e?.response?.data?.error || 'Cannot delete section with seats'); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage Sections" size="sm">
      <div className="space-y-4">
        <div className="space-y-2">
          {sections.map((sec) => (
            <div key={sec.id} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100">
              <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: sec.color_code }} />
              <span className="flex-1 text-sm font-medium">{sec.name}</span>
              <span className="text-xs text-gray-400">{sec.seats?.length || 0} seats</span>
              <Button variant="ghost" size="xs" onClick={() => deleteSection(sec.id)} className="text-red-400 hover:text-red-600">✕</Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <Input placeholder="New section name" value={newName} onChange={(e) => setNewName(e.target.value)} containerClassName="flex-1" />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-9 w-12 rounded-lg border border-gray-300 p-1 cursor-pointer" />
          <Button size="sm" onClick={create} loading={loading}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
    </Modal>
  );
}
