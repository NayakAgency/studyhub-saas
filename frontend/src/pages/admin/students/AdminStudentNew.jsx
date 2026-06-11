import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card.jsx';
import Input, { Textarea } from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Button from '../../../components/ui/Button.jsx';
import { ArrowLeft, User } from 'lucide-react';

const schema = z.object({
  fullName: z.string().min(2, 'Name required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  assignedSeatId: z.string().optional(),
  planId: z.string().optional(),
  status: z.enum(['active', 'pending']).default('active'),
});

export default function AdminStudentNew() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { status: 'active' } });

  const { data: seats } = useQuery({
    queryKey: ['admin', 'seats'],
    queryFn: () => api.get('/admin/seats').then((r) => r.data),
  });

  const { data: plans } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api.get('/admin/plans').then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (data) => api.post('/admin/students', data),
    onSuccess: (res) => {
      toast.success('Student added successfully');
      qc.invalidateQueries(['admin', 'students']);
      navigate(`/admin/students/${res.data.id}`);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to create student'),
  });

  const availableSeats = (seats || []).filter((s) => s.status === 'available');
  const seatOptions = availableSeats.map((s) => ({ value: s.id, label: `${s.seat_number} (${s.section?.name || ''})` }));
  const planOptions = (plans || []).filter((p) => p.is_active).map((p) => ({ value: p.id, label: `${p.plan_name} — ₹${p.price}` }));

  return (
    <div className="p-6 space-y-5 max-w-3xl pb-20 md:pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Add Student</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manually register a new student</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><User className="h-4 w-4" />Personal Info</h3></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Full Name" required placeholder="Ravi Kumar" error={errors.fullName?.message} {...register('fullName')} />
            <Input label="Phone" required placeholder="9876543210" error={errors.phone?.message} {...register('phone')} />
            <Input label="Email" placeholder="student@email.com" {...register('email')} />
            <Input label="Date of Birth" type="date" {...register('dateOfBirth')} />
            <Select label="Gender" placeholder="Select gender" options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} {...register('gender')} />
            <Select label="Status" options={[{ value: 'active', label: 'Active (Immediate)' }, { value: 'pending', label: 'Pending (Approval)' }]} {...register('status')} />
            <Textarea label="Address" placeholder="Full address" containerClassName="col-span-full" {...register('address')} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-800">Emergency Contact</h3></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Contact Name" {...register('emergencyContactName')} />
            <Input label="Contact Phone" {...register('emergencyContactPhone')} />
            <Input label="Relation" placeholder="Parent / Sibling" {...register('emergencyContactRelation')} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-800">Seat & Plan Assignment</h3></CardHeader>
          <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Assign Seat" placeholder="Select available seat" options={seatOptions} {...register('assignedSeatId')} />
            <Select label="Subscription Plan" placeholder="Select plan" options={planOptions} {...register('planId')} />
          </CardBody>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Add Student</Button>
        </div>
      </form>
    </div>
  );
}
