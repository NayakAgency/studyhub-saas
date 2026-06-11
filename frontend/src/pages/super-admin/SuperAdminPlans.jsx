import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input, { Textarea } from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Check, Edit2, Plus, Package, Users, Armchair, Trash2 } from 'lucide-react';

const DEFAULT_PLANS = [
  {
    id: 'standard',
    name: 'standard',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    oneTimePrice: null,
    maxSeats: 100,
    maxStudents: 150,
    features: ['Up to 100 seats', 'Student portal', 'Fee management', 'Basic reports', 'Email support'],
    isActive: true,
  },
  {
    id: 'premium',
    name: 'premium',
    monthlyPrice: 1999,
    yearlyPrice: 19990,
    oneTimePrice: null,
    maxSeats: 500,
    maxStudents: 750,
    features: ['Up to 500 seats', 'Everything in Standard', 'Advanced analytics', 'Custom branding', 'Priority support', 'PDF receipts'],
    isActive: true,
  },
  {
    id: 'enterprise',
    name: 'enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    oneTimePrice: null,
    maxSeats: -1,
    maxStudents: -1,
    features: ['Unlimited seats', 'Everything in Premium', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'On-site training'],
    isActive: true,
  },
];

function PlanEditModal({ plan, open, onClose, onSave, isLoading }) {
  const [form, setForm] = useState(plan ? { ...plan, featuresText: (plan.features || []).join('\n') } : {
    name: 'custom',
    monthlyPrice: '',
    yearlyPrice: '',
    oneTimePrice: '',
    maxSeats: 100,
    maxStudents: 150,
    featuresText: '',
    isActive: true,
  });

  const f = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    if (!form.name) return toast.error('Plan name is required');
    const features = form.featuresText
      ? form.featuresText.split('\n').map((s) => s.trim()).filter(Boolean)
      : [];
    onSave({
      ...form,
      features,
      monthlyPrice: form.monthlyPrice !== '' && form.monthlyPrice !== null ? Number(form.monthlyPrice) : null,
      yearlyPrice: form.yearlyPrice !== '' && form.yearlyPrice !== null ? Number(form.yearlyPrice) : null,
      oneTimePrice: form.oneTimePrice !== '' && form.oneTimePrice !== null ? Number(form.oneTimePrice) : null,
      maxSeats: Number(form.maxSeats) || 100,
      maxStudents: Number(form.maxStudents) || 150,
    });
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan ? `Edit ${plan.name} Plan` : 'Add Custom Plan'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={isLoading}>Save Plan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Plan Name"
          value={form.name}
          onChange={(e) => f('name', e.target.value)}
          options={[
            { value: 'standard', label: 'Standard' },
            { value: 'premium', label: 'Premium' },
            { value: 'enterprise', label: 'Enterprise' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Monthly Price (₹)"
            type="number"
            value={form.monthlyPrice ?? ''}
            onChange={(e) => f('monthlyPrice', e.target.value)}
            placeholder="Leave blank for custom"
          />
          <Input
            label="Yearly Price (₹)"
            type="number"
            value={form.yearlyPrice ?? ''}
            onChange={(e) => f('yearlyPrice', e.target.value)}
            placeholder="Leave blank for custom"
          />
          <Input
            label="One-Time Price (₹)"
            type="number"
            value={form.oneTimePrice ?? ''}
            onChange={(e) => f('oneTimePrice', e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Max Seats"
            type="number"
            value={form.maxSeats}
            onChange={(e) => f('maxSeats', e.target.value)}
            hint="-1 for unlimited"
          />
          <Input
            label="Max Students"
            type="number"
            value={form.maxStudents}
            onChange={(e) => f('maxStudents', e.target.value)}
            hint="-1 for unlimited"
          />
        </div>
        <Textarea
          label="Features (one per line)"
          rows={5}
          value={form.featuresText}
          onChange={(e) => f('featuresText', e.target.value)}
          placeholder={"Up to 100 seats\nStudent portal\nFee management"}
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => f('isActive', e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm text-gray-700">Plan is active (visible to customers)</span>
        </label>
      </div>
    </Modal>
  );
}

function PlanCard({ plan, onEdit }) {
  return (
    <Card className={`relative overflow-visible ${!plan.isActive ? 'opacity-60' : ''}`}>
      {plan.name === 'premium' && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full">
          Most Popular
        </div>
      )}
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary-50 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 capitalize">{plan.name}</p>
              <Badge variant={plan.isActive ? 'success' : 'default'} size="xs">
                {plan.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
          <Button variant="secondary" size="sm" leftIcon={<Edit2 className="h-3.5 w-3.5" />} onClick={() => onEdit(plan)}>
            Edit
          </Button>
        </div>

        {/* Pricing */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
          {plan.monthlyPrice ? (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Monthly</span>
              <span className="text-sm font-bold text-gray-900">₹{plan.monthlyPrice.toLocaleString('en-IN')}</span>
            </div>
          ) : null}
          {plan.yearlyPrice ? (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Yearly</span>
              <span className="text-sm font-bold text-gray-900">₹{plan.yearlyPrice.toLocaleString('en-IN')}</span>
            </div>
          ) : null}
          {plan.oneTimePrice ? (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">One-Time</span>
              <span className="text-sm font-bold text-gray-900">₹{plan.oneTimePrice.toLocaleString('en-IN')}</span>
            </div>
          ) : null}
          {!plan.monthlyPrice && !plan.yearlyPrice && !plan.oneTimePrice && (
            <p className="text-sm font-bold text-gray-900 text-center">Custom Pricing</p>
          )}
        </div>

        {/* Limits */}
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Armchair className="h-3.5 w-3.5 text-gray-400" />
            {plan.maxSeats === -1 ? 'Unlimited' : `${plan.maxSeats}`} seats
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Users className="h-3.5 w-3.5 text-gray-400" />
            {plan.maxStudents === -1 ? 'Unlimited' : `${plan.maxStudents}`} students
          </div>
        </div>

        {/* Features */}
        <div className="space-y-1.5">
          {(plan.features || []).map((feat, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
              <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              {feat}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

export default function SuperAdminPlans() {
  const qc = useQueryClient();
  const [editingPlan, setEditingPlan] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const { data: plansData, isLoading } = useQuery({
    queryKey: ['super-admin', 'saas-plans'],
    queryFn: () => api.get('/super-admin/saas-plans').then((r) => r.data),
    placeholderData: DEFAULT_PLANS,
  });

  const plans = plansData && plansData.length > 0 ? plansData : DEFAULT_PLANS;

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/super-admin/saas-plans/${id}`, body),
    onSuccess: () => {
      toast.success('Plan updated');
      qc.invalidateQueries(['super-admin', 'saas-plans']);
      setEditingPlan(null);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update plan'),
  });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/super-admin/saas-plans', body),
    onSuccess: () => {
      toast.success('Plan created');
      qc.invalidateQueries(['super-admin', 'saas-plans']);
      setAddModalOpen(false);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to create plan'),
  });

  const handleSaveEdit = (data) => {
    updateMutation.mutate({ id: editingPlan.id, ...data });
  };

  const handleCreate = (data) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">SaaS Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage pricing plans for study hall owners</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddModalOpen(true)}>
          Add Custom Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-64 skeleton rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onEdit={setEditingPlan} />
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <PlanEditModal
        plan={editingPlan}
        open={!!editingPlan}
        onClose={() => setEditingPlan(null)}
        onSave={handleSaveEdit}
        isLoading={updateMutation.isPending}
      />

      {/* Add Modal */}
      <PlanEditModal
        plan={null}
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleCreate}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
