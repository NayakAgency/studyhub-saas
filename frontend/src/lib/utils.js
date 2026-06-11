// ============================================================
// Utility Functions
// ============================================================

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';

// Tailwind class merger
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format date
export const formatDate = (date, fmt = 'dd MMM yyyy') => {
  if (!date) return '—';
  try {
    return format(typeof date === 'string' ? parseISO(date) : date, fmt);
  } catch {
    return '—';
  }
};

// Relative time
export const relativeTime = (date) => {
  if (!date) return '';
  try {
    return formatDistanceToNow(
      typeof date === 'string' ? parseISO(date) : date,
      { addSuffix: true }
    );
  } catch {
    return '';
  }
};

// Days remaining
export const daysRemaining = (endDate) => {
  if (!endDate) return null;
  try {
    return differenceInDays(parseISO(endDate), new Date());
  } catch {
    return null;
  }
};

// Format currency
export const formatCurrency = (amount, symbol = '₹') => {
  if (amount === null || amount === undefined) return '—';
  return `${symbol}${parseFloat(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

// Format file size
export const formatFileSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Generate initials
export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
};

// Seat status config
export const SEAT_STATUS = {
  available:   { label: 'Available',   color: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  occupied:    { label: 'Occupied',    color: 'text-blue-700',    bg: 'bg-blue-100',    dot: 'bg-blue-500' },
  blocked:     { label: 'Blocked',     color: 'text-red-700',     bg: 'bg-red-100',     dot: 'bg-red-500' },
  reserved:    { label: 'Reserved',    color: 'text-amber-700',   bg: 'bg-amber-100',   dot: 'bg-amber-500' },
  maintenance: { label: 'Maintenance', color: 'text-gray-700',    bg: 'bg-gray-100',    dot: 'bg-gray-500' },
};

// Student status config
export const STUDENT_STATUS = {
  active:    { label: 'Active',    variant: 'success' },
  pending:   { label: 'Pending',   variant: 'warning' },
  inactive:  { label: 'Inactive',  variant: 'default' },
  suspended: { label: 'Suspended', variant: 'danger' },
  rejected:  { label: 'Rejected',  variant: 'danger' },
};

// Membership status config
export const MEMBERSHIP_STATUS = {
  active:    { label: 'Active',    variant: 'success' },
  expired:   { label: 'Expired',   variant: 'orange' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  pending:   { label: 'Pending',   variant: 'warning' },
};

// Complaint status config
export const COMPLAINT_STATUS = {
  open:        { label: 'Open',        variant: 'danger' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  resolved:    { label: 'Resolved',    variant: 'success' },
  closed:      { label: 'Closed',      variant: 'default' },
};

// Debounce
export const debounce = (fn, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

// Download CSV
export const downloadCSV = (csvString, filename) => {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

// Slugify
export const slugify = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Phone formatter
export const formatPhone = (phone) => {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  return phone;
};

// Truncate text
export const truncate = (str, length = 50) => {
  if (!str) return '';
  return str.length > length ? `${str.slice(0, length)}...` : str;
};
