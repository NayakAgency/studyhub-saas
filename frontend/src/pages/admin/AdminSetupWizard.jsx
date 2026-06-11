import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { api } from '../../lib/api.js';
import Stepper from '../../components/ui/Stepper.jsx';
import Button from '../../components/ui/Button.jsx';
import Input, { Textarea } from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { GraduationCap, Plus, Trash2, CheckCircle } from 'lucide-react';

const STEPS = [
  { label: 'Hall Profile',   description: 'Basic info & timing' },
  { label: 'Sections',       description: 'Create seat sections' },
  { label: 'Seats',          description: 'Generate seats' },
  { label: 'Plans',          description: 'Subscription plans' },
  { label: 'Settings',       description: 'Preferences' },
  { label: 'Done!',          description: 'You\'re ready' },
];

export default function AdminSetupWizard() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState([{ name: '', colorCode: '#3B82F6' }]);
  const [seatConfigs, setSeatConfigs] = useState([]);
  const [plans, setPlans] = useState([{ planName: '', price: '', validityType: 'monthly', planType: 'full_day' }]);
  const navigate = useNavigate();
  const { register, handleSubmit, watch, getValues, formState: { errors } } = useForm({
    defaultValues: { hallOpenTime: '06:00', hallCloseTime: '22:00', feeDueDay: 5, currencySymbol: '₹', renewalReminderDays: 7 }
  });

  const fireConfetti = () => {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#2563EB', '#10B981', '#F59E0B'] });
  };

  const handleNext = async () => {
    if (step === 0) {
      // Save hall settings
      try {
        setLoading(true);
        const vals = getValues();
        await api.put('/admin/settings', {
          hallOpenTime: vals.hallOpenTime,
          hallCloseTime: vals.hallCloseTime,
          hallName: vals.hallName,
          address: vals.address,
        });
        setStep(1);
      } catch (e) { toast.error(e?.response?.data?.error || 'Failed to save'); }
      finally { setLoading(false); }
      return;
    }

    if (step === 1) {
      // Save sections
      try {
        setLoading(true);
        const created = [];
        for (const sec of sections.filter((s) => s.name)) {
          const { data } = await api.post('/admin/sections', {
            name: sec.name, colorCode: sec.colorCode, displayOrder: created.length,
          });
          created.push(data);
        }
        setSeatConfigs(created.map((s) => ({ sectionId: s.id, sectionName: s.name, prefix: s.name.slice(0, 2).toUpperCase(), startNumber: 1, count: 10, seatType: 'standard' })));
        setStep(2);
      } catch (e) { toast.error(e?.response?.data?.error || 'Failed to create sections'); }
      finally { setLoading(false); }
      return;
    }

    if (step === 2) {
      // Generate seats
      try {
        setLoading(true);
        for (const cfg of seatConfigs.filter((c) => c.count > 0)) {
          await api.post('/admin/seats/generate', {
            sectionId: cfg.sectionId, prefix: cfg.prefix,
            startNumber: cfg.startNumber, count: parseInt(cfg.count), seatType: cfg.seatType,
          });
        }
        setStep(3);
      } catch (e) { toast.error(e?.response?.data?.error || 'Failed to generate seats'); }
      finally { setLoading(false); }
      return;
    }

    if (step === 3) {
      // Create plans
      try {
        setLoading(true);
        for (const plan of plans.filter((p) => p.planName && p.price)) {
          await api.post('/admin/plans', {
            planName: plan.planName, price: parseFloat(plan.price),
            validityType: plan.validityType, planType: plan.planType,
            validityDays: plan.validityType === 'monthly' ? 30 : plan.validityType === 'weekly' ? 7 : 1,
          });
        }
        setStep(4);
      } catch (e) { toast.error(e?.response?.data?.error || 'Failed to create plans'); }
      finally { setLoading(false); }
      return;
    }

    if (step === 4) {
      // Save settings
      try {
        setLoading(true);
        const vals = getValues();
        await api.put('/admin/settings', {
          feeDueDay: parseInt(vals.feeDueDay), currencySymbol: vals.currencySymbol,
          renewalReminderDays: parseInt(vals.renewalReminderDays),
        });
        setStep(5);
        setTimeout(fireConfetti, 300);
      } catch (e) { toast.error(e?.response?.data?.error || 'Failed to save settings'); }
      finally { setLoading(false); }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-modal border border-gray-200 overflow-hidden">

        {/* Header */}
        <div className="bg-primary-600 px-8 py-6">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="h-6 w-6 text-white" />
            <h1 className="text-lg font-bold text-white font-display">StudyHub Setup Wizard</h1>
          </div>
          <Stepper steps={STEPS} currentStep={step} />
        </div>

        {/* Step content */}
        <div className="px-8 py-7 min-h-[320px]">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

              {/* Step 0: Hall Profile */}
              {step === 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">Hall Profile</h2>
                  <Input label="Hall Name" placeholder="e.g. Sunrise Study Hall" required {...register('hallName', { required: true })} />
                  <Input label="Address" placeholder="Full address" {...register('address')} />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Open Time" type="time" {...register('hallOpenTime')} />
                    <Input label="Close Time" type="time" {...register('hallCloseTime')} />
                  </div>
                </div>
              )}

              {/* Step 1: Sections */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">Create Sections</h2>
                  <p className="text-sm text-gray-500">Sections group your seats (e.g. AC, Non-AC, Cabin)</p>
                  {sections.map((sec, i) => (
                    <div key={i} className="flex gap-3 items-end">
                      <Input label={i === 0 ? 'Section Name' : ''} placeholder="e.g. AC Section" value={sec.name}
                        onChange={(e) => setSections((s) => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        containerClassName="flex-1" />
                      <div className="flex flex-col gap-1">
                        {i === 0 && <label className="text-sm font-medium text-gray-700">Color</label>}
                        <input type="color" value={sec.colorCode}
                          onChange={(e) => setSections((s) => s.map((x, j) => j === i ? { ...x, colorCode: e.target.value } : x))}
                          className="h-9 w-14 rounded-lg border border-gray-300 cursor-pointer p-1" />
                      </div>
                      {sections.length > 1 && (
                        <Button variant="ghost" size="md" iconOnly onClick={() => setSections((s) => s.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => setSections((s) => [...s, { name: '', colorCode: '#10B981' }])}>
                    Add Section
                  </Button>
                </div>
              )}

              {/* Step 2: Seats */}
              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">Generate Seats</h2>
                  <p className="text-sm text-gray-500">Configure seats for each section</p>
                  {seatConfigs.map((cfg, i) => (
                    <div key={i} className="p-4 rounded-xl border border-gray-200 space-y-3">
                      <p className="text-sm font-semibold text-gray-700">{cfg.sectionName}</p>
                      <div className="grid grid-cols-3 gap-3">
                        <Input label="Prefix" placeholder="AC" value={cfg.prefix}
                          onChange={(e) => setSeatConfigs((s) => s.map((x, j) => j === i ? { ...x, prefix: e.target.value } : x))} />
                        <Input label="Start No." type="number" value={cfg.startNumber}
                          onChange={(e) => setSeatConfigs((s) => s.map((x, j) => j === i ? { ...x, startNumber: +e.target.value } : x))} />
                        <Input label="Total Seats" type="number" value={cfg.count}
                          onChange={(e) => setSeatConfigs((s) => s.map((x, j) => j === i ? { ...x, count: +e.target.value } : x))} />
                      </div>
                      <p className="text-xs text-gray-500">Preview: {cfg.prefix}-{String(cfg.startNumber).padStart(2,'0')} → {cfg.prefix}-{String(cfg.startNumber + cfg.count - 1).padStart(2,'0')}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Step 3: Plans */}
              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">Subscription Plans</h2>
                  {plans.map((plan, i) => (
                    <div key={i} className="p-4 rounded-xl border border-gray-200 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="Plan Name" placeholder="Monthly Full Day" value={plan.planName}
                          onChange={(e) => setPlans((p) => p.map((x, j) => j === i ? { ...x, planName: e.target.value } : x))} />
                        <Input label="Price (₹)" type="number" placeholder="1500" value={plan.price}
                          onChange={(e) => setPlans((p) => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                        <Select label="Type" value={plan.planType}
                          onChange={(e) => setPlans((p) => p.map((x, j) => j === i ? { ...x, planType: e.target.value } : x))}
                          options={[{ value: 'full_day', label: 'Full Day' }, { value: 'slot_based', label: 'Slot Based' }, { value: 'open_hours', label: 'Open Hours' }]} />
                        <Select label="Validity" value={plan.validityType}
                          onChange={(e) => setPlans((p) => p.map((x, j) => j === i ? { ...x, validityType: e.target.value } : x))}
                          options={[{ value: 'monthly', label: 'Monthly (30 days)' }, { value: 'weekly', label: 'Weekly (7 days)' }, { value: 'daily', label: 'Daily' }]} />
                      </div>
                      {plans.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => setPlans((p) => p.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4 text-red-400 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />}
                    onClick={() => setPlans((p) => [...p, { planName: '', price: '', validityType: 'monthly', planType: 'full_day' }])}>
                    Add Plan
                  </Button>
                </div>
              )}

              {/* Step 4: Settings */}
              {step === 4 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">Hall Settings</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Currency Symbol" placeholder="₹" {...register('currencySymbol')} />
                    <Input label="Fee Due Day" type="number" min="1" max="31" hint="Day of month fees are due" {...register('feeDueDay')} />
                    <Input label="Renewal Reminder (days)" type="number" hint="Days before expiry to remind" {...register('renewalReminderDays')} />
                  </div>
                </div>
              )}

              {/* Step 5: Done */}
              {step === 5 && (
                <div className="flex flex-col items-center text-center py-4 space-y-4">
                  <div className="h-20 w-20 rounded-2xl bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 font-display">You're all set! 🎉</h2>
                  <p className="text-gray-500 text-sm max-w-sm">
                    Your study hall is configured and ready. Start adding students and managing your hall.
                  </p>
                  <Button size="lg" onClick={() => navigate('/admin/dashboard')} className="mt-2">
                    Go to Dashboard
                  </Button>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step < 5 && (
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-between rounded-b-2xl">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
            <Button onClick={handleNext} loading={loading}>
              {step === 4 ? 'Finish Setup' : 'Next Step →'}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
