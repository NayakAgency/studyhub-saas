import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { api } from '../../lib/api.js';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import Input, { Textarea } from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { formatCurrency } from '../../lib/utils.js';
import { Plus, Pencil, Trash2, Copy, ToggleLeft, ToggleRight, Wind, Thermometer, Box } from 'lucide-react';

const CATEGORY_ICONS = { ac: Wind, non_ac: Thermometer, other: Box, any: Box };
const CATEGORY_LABELS = { ac: 'AC', non_ac: 'Non-AC', other: 'Other', any: 'Any Type' };
const CATEGORY_COLORS = { ac: 'bg-blue-100 text-blue-700', non_ac: 'bg-orange-100 text-orange-700', other: 'bg-gray-100 text-gray-700', any: 'bg-purple-100 text-purple-700' };

const EMPTY_PLAN = {
  planName: '', description: '',
  planType: 'full_day', seatCategory: 'any',
  validityType: 'monthly', validityDays: '',
  price: '', features: '', isActive: true,
};

export default function AdminPlans() {
  const [modal, setModal] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_PLAN);
  const qc = useQueryClient();

  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api.get('/admin/plans').then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editPlan
        ? api.put(`/admin/plans/${editPlan.id}`, data)
        : api.post('/admin/plans', data),
    onSuccess: () => {
      toast.success(editPlan ? 'Plan updated' : 'Plan created');
      qc.invalidateQueries(['admin', 'plans']);
      closeModal();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/plans/${id}`),
    onSuccess: () => {
      toast.success('Plan deleted');
      qc.invalidateQueries(['admin', 'plans']);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Cannot delete — active memberships exist'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id) => api.post(`/admin/plans/${id}/duplicate`),
    onSuccess: () => { toast.success('Plan duplicated'); qc.invalidateQueries(['admin', 'plans']); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/admin/plans/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries(['admin', 'plans']),
  });

  const openEdit = (plan) => {
    setEditPlan(plan);
    setForm({
      planName: plan.plan_name,
      description: plan.description || '',
      planType: plan.plan_type,
      seatCategory: plan.seat_category || 'any',
      validityType: plan.validity_type,
      validityDays: plan.validity_days || '',
      price: plan.price,
      features: (plan.features || []).join('\n'),
      isActive: plan.is_active,
    });
    setModal(true);
  };

  const closeModal = () => { setModal(false); setEditPlan(null); setForm(EMPTY_PLAN); };

  const handleSave = () => {
    if (!form.planName || !form.price) return toast.error('Name and price are required');
    saveMutation.mutate({
      planName: form.planName,
      description: form.description || undefined,
      planType: form.planType,
      seatCategory: form.seatCategory,
      validityType: form.validityType,
      validityDays: form.validityDays ? parseInt(form.validityDays) : undefined,
      price: parseFloat(form.price),
      features: form.features ? form.features.split('\n').map(s => s.trim()).filter(Boolean) : [],
      isActive: form.isActive,
    });
  };

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const planTypeLabel = { slot_based: 'Slot Based', full_day: 'Full Day', open_hours: 'Open Hours', half_day: 'Half Day', custom: 'Custom' };
  const validityLabel = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', half_yearly: 'Half Yearly', yearly: 'Yearly', custom: 'Custom' };

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Subscription Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">{plans?.length || 0} plans configured</p>
        </div>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModal(true)}>
          Add Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map((i) => <div key={i} className="h-44 rounded-xl skeleton" />)}
        </div>
      ) : (plans || []).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-3">No plans yet. Create your first plan.</p>
          <Button size="sm" onClick={() => setModal(true)}>Create Plan</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(plans || []).map((plan, i) => {
            const catKey = plan.seat_category || 'any';
            const CatIcon = CATEGORY_ICONS[catKey] || Box;
            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={`p-5 h-full flex flex-col ${!plan.is_active ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-gray-900 truncate">{plan.plan_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {planTypeLabel[plan.plan_type] || plan.plan_type} · {validityLabel[plan.validity_type] || plan.validity_type}
                        {plan.validity_days ? ` (${plan.validity_days}d)` : ''}
                      </p>
                    </div>
                    <Badge variant={plan.is_active ? 'success' : 'default'} size="sm">
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Seat Category Badge */}
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full w-fit mb-2 ${CATEGORY_COLORS[catKey]}`}>
                    <CatIcon className="h-3 w-3" />
                    {CATEGORY_LABELS[catKey]}
                  </span>

                  {plan.description && (
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">{plan.description}</p>
                  )}

                  {(plan.features || []).length > 0 && (
                    <ul className="space-y-0.5 mb-2">
                      {(plan.features || []).slice(0, 3).map((f, idx) => (
                        <li key={idx} className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="h-1 w-1 rounded-full bg-primary-400 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                      {(plan.features || []).length > 3 && (
                        <li className="text-xs text-gray-400">+{plan.features.length - 3} more</li>
                      )}
                    </ul>
                  )}

                  <p className="text-2xl font-bold text-primary-600 font-display mt-auto">
                    {formatCurrency(plan.price)}
                  </p>

                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
                    <Button variant="ghost" size="xs" onClick={() => openEdit(plan)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => duplicateMutation.mutate(plan.id)} title="Duplicate">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => toggleMutation.mutate({ id: plan.id, isActive: !plan.is_active })} title={plan.is_active ? 'Deactivate' : 'Activate'}>
                      {plan.is_active
                        ? <ToggleRight className="h-3.5 w-3.5 text-emerald-500" />
                        : <ToggleLeft className="h-3.5 w-3.5 text-gray-400" />}
                    </Button>
                    <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setDeleteTarget(plan)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modal}
        onClose={closeModal}
        title={editPlan ? 'Edit Plan' : 'Create Plan'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={saveMutation.isPending}>Save Plan</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Plan Name"
            required
            placeholder="e.g. Monthly Full Day AC"
            value={form.planName}
            onChange={(e) => f('planName', e.target.value)}
          />

          {/* Seat Category — prominent selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Seat Category <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-400 mb-2">This determines which seats are shown to students when they register</p>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => {
                const Icon = CATEGORY_ICONS[val];
                const selected = form.seatCategory === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => f('seatCategory', val)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-semibold transition-all
                      ${selected ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                  >
                    <Icon className={`h-4 w-4 ${selected ? 'text-primary-600' : 'text-gray-400'}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Plan Type"
              value={form.planType}
              onChange={(e) => f('planType', e.target.value)}
              options={[
                { value: 'full_day', label: 'Full Day' },
                { value: 'half_day', label: 'Half Day' },
                { value: 'slot_based', label: 'Slot Based' },
                { value: 'open_hours', label: 'Open Hours' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
            <Select
              label="Validity"
              value={form.validityType}
              onChange={(e) => f('validityType', e.target.value)}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'quarterly', label: 'Quarterly' },
                { value: 'half_yearly', label: 'Half Yearly' },
                { value: 'yearly', label: 'Yearly' },
                { value: 'custom', label: 'Custom Days' },
              ]}
            />
            <Input
              label="Price (₹)"
              type="number"
              required
              placeholder="999"
              value={form.price}
              onChange={(e) => f('price', e.target.value)}
            />
            {(form.validityType === 'custom' || form.validityType === 'daily') && (
              <Input
                label="Validity Days"
                type="number"
                placeholder="30"
                value={form.validityDays}
                onChange={(e) => f('validityDays', e.target.value)}
              />
            )}
          </div>

          <Textarea
            label="Description (optional)"
            placeholder="Describe this plan…"
            rows={2}
            value={form.description}
            onChange={(e) => f('description', e.target.value)}
          />

          <Textarea
            label="Features (one per line)"
            placeholder={"Full day access\nAC hall\nFree WiFi\nLockers included"}
            rows={4}
            value={form.features}
            onChange={(e) => f('features', e.target.value)}
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => f('isActive', e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm text-gray-700">Plan is active (visible to students)</span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Delete Plan"
        message={`Delete "${deleteTarget?.plan_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
