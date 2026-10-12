export const inr = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

export const num = (n) => new Intl.NumberFormat('en-IN').format(Number(n || 0));

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const statusLabel = {
  paid: 'Fully Paid',
  partial: 'Partially Paid',
  unpaid: 'Unpaid',
};

export const categoryLabel = {
  tuition: 'Tuition Fee',
  hostel: 'Hostel Fee',
  mess: 'Mess Fee',
};

export const categoryShort = {
  tuition: 'Tuition',
  hostel: 'Hostel',
  mess: 'Mess',
};

export const categoryTone = {
  tuition: 'indigo',
  hostel: 'amber',
  mess: 'emerald',
};

// Fixed fee heads are billed term-wise: tuition across 4 terms, hostel across 2.
export const HEAD_TERMS = { tuition: 4, hostel: 2 };
export const FIXED_HEADS = ['tuition', 'hostel'];

export const termLabel = (head, term) =>
  `${categoryShort[head] || head} · Term ${term}`;

export const quotaLabel = {
  ACAT: 'ACAT · Rank',
  BCAT: 'BCAT · Management',
  SPOT: 'SPOT',
};

export const quotaShort = {
  ACAT: 'ACAT',
  BCAT: 'BCAT',
  SPOT: 'Spot',
};

export const quotaTone = {
  ACAT: 'indigo',
  BCAT: 'amber',
  SPOT: 'rose',
};

// Default per-term rates used by the Fee Structure presets (₹).
export const TERM_RATES = {
  ACAT: { tuition: 18750, hostel: 25000 },
  BCAT: { tuition: 31250, hostel: 25000 },
  SPOT: { tuition: 31250, hostel: 25000 },
};

// 'YYYY-MM' -> 'Aug 2026'
export const monthLabel = (month) => {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month || '—';
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export const methodLabel = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net Banking',
  cheque: 'Cheque',
  dd: 'Demand Draft',
  other: 'Other',
};

export const paidPercent = (paid, total) => {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
};
