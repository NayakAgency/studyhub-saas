import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { SEAT_STATUS, cn } from '../../lib/utils.js';
import { Armchair, ArrowLeftRight } from 'lucide-react';

export default function StudentSeat() {
  const [changeModal, setChangeModal] = useState(false);
  const [requestedSeat, setRequestedSeat] = useState(null);
  const [reason, setReason] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'seat'],
    queryFn: () => api.get('/student/seat').then((r) => r.data),
  });

  const changeMutation = useMutation({
    mutationFn: (body) => api.post('/student/seat/change-request', body),
    onSuccess: () => {
      toast.success('Seat change request submitted!');
      qc.invalidateQueries(['student', 'seat']);
      setChangeModal(false);
      setRequestedSeat(null);
      setReason('');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to submit request'),
  });

  const handleSubmitChange = () => {
    if (!requestedSeat) return toast.error('Select a seat to change to');
    if (reason.length < 10) return toast.error('Please provide a reason (min 10 characters)');
    changeMutation.mutate({ requestedSeatId: requestedSeat.id, reason });
  };

  if (isLoading) return <div className="p-5 text-gray-500">Loading…</div>;

  const { currentSeat, layoutSeats } = data || {};
  const sectionMap = {};
  (layoutSeats || []).forEach((s) => {
    const key = s.section_id || 'unsectioned';
    if (!sectionMap[key]) sectionMap[key] = [];
    sectionMap[key].push(s);
  });

  return (
    <div className="p-5 space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 font-display">My Seat</h1>

      {/* Current seat card */}
      {currentSeat ? (
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary-100 flex items-center justify-center">
              <Armchair className="h-8 w-8 text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="text-3xl font-bold text-gray-900 font-display">{currentSeat.seat_number}</p>
              <p className="text-sm text-gray-500">{currentSeat.section?.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="success" dot>Assigned</Badge>
                <Badge variant="default" size="sm" className="capitalize">{currentSeat.seat_type}</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" leftIcon={<ArrowLeftRight className="h-4 w-4" />}
              onClick={() => setChangeModal(true)}>
              Request Change
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <Armchair className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No seat assigned yet</p>
          <p className="text-gray-400 text-xs mt-1">Your admin will assign a seat after approval</p>
        </Card>
      )}

      {/* Seat layout */}
      {Object.keys(sectionMap).length > 0 && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-800">Hall Seat Map</h3></CardHeader>
          <CardBody className="space-y-4">
            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {Object.entries(SEAT_STATUS).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <div className={cn('h-3 w-3 rounded', val.bg)} />
                  <span className="text-gray-500">{val.label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs">
                <div className="h-3 w-3 rounded bg-primary-500" />
                <span className="text-gray-500">My Seat</span>
              </div>
            </div>

            {Object.values(sectionMap).map((sectionSeats) => (
              <div key={sectionSeats[0]?.section_id}>
                <p className="text-xs font-medium text-gray-500 mb-2">{sectionSeats[0]?.section?.name || 'Section'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {sectionSeats.sort((a, b) => a.seat_number.localeCompare(b.seat_number, undefined, { numeric: true })).map((seat) => {
                    const isMine = seat.id === currentSeat?.id;
                    const cfg = SEAT_STATUS[seat.status] || SEAT_STATUS.available;
                    return (
                      <div key={seat.id}
                        title={isMine ? 'Your seat' : seat.status}
                        className={cn(
                          'h-9 min-w-[44px] px-1.5 rounded-lg border-2 text-xs font-semibold flex items-center justify-center',
                          isMine ? 'border-primary-600 bg-primary-500 text-white' : `${cfg.bg} ${cfg.color} border-transparent`
                        )}>
                        {seat.seat_number}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Seat change modal */}
      <Modal open={changeModal} onClose={() => setChangeModal(false)} title="Request Seat Change" size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setChangeModal(false)}>Cancel</Button>
            <Button onClick={handleSubmitChange} loading={changeMutation.isPending}>Submit Request</Button>
          </>
        }>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Select an available seat and provide your reason.</p>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Select New Seat</p>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
              {(layoutSeats || []).filter((s) => s.status === 'available' && s.id !== currentSeat?.id).map((seat) => (
                <button key={seat.id} type="button"
                  onClick={() => setRequestedSeat(seat)}
                  className={cn(
                    'h-9 min-w-[44px] px-1.5 rounded-lg border-2 text-xs font-semibold transition-all',
                    requestedSeat?.id === seat.id
                      ? 'border-primary-600 bg-primary-500 text-white scale-105'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:scale-105'
                  )}>
                  {seat.seat_number}
                </button>
              ))}
            </div>
            {requestedSeat && (
              <p className="text-xs text-primary-600 mt-1">Selected: <strong>{requestedSeat.seat_number}</strong></p>
            )}
          </div>
          <Textarea label="Reason for Change" required rows={3}
            placeholder="Why do you want to change your seat? (min 10 characters)"
            value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
