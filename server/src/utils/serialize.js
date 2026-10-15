// Converts mongoose documents / aggregation rows into clean API shapes.

export function toId(value) {
  if (!value) return value;
  return typeof value === 'string' ? value : String(value);
}

export function studentPayload(student, finance = {}) {
  if (!student) return null;
  const raw = typeof student.toObject === 'function' ? student.toObject() : { ...student };
  return {
    id: toId(raw._id || raw.id),
    rollNumber: raw.rollNumber,
    name: raw.name,
    college: raw.college || '',
    branch: raw.branch || '',
    year: raw.year || '',
    section: raw.section || '',
    email: raw.email || '',
    phone: raw.phone || '',
    parentPhone: raw.parentPhone || '',
    address: raw.address || '',
    quota: (raw.quota || 'ACAT').toUpperCase(),
    active: raw.active !== false,
    tuitionFee: Number(raw.tuitionFee || 0),
    hostelFee: Number(raw.hostelFee || 0),
    totalFee: Number(raw.totalFee || 0),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    ...finance,
  };
}

export function paymentPayload(payment, student) {
  if (!payment) return null;
  const raw = typeof payment.toObject === 'function' ? payment.toObject() : { ...payment };
  const studentRaw = student
    ? (typeof student.toObject === 'function' ? student.toObject() : student)
    : raw.student && typeof raw.student === 'object'
      ? raw.student
      : null;
  return {
    id: toId(raw._id || raw.id),
    studentId: toId(studentRaw?._id || studentRaw?.id || raw.student),
    rollNumber: studentRaw?.rollNumber || raw.rollNumber || '',
    studentName: studentRaw?.name || raw.studentName || '',
    amount: Number(raw.amount || 0),
    category: raw.category || 'tuition',
    term: raw.term == null ? null : Number(raw.term),
    transactionId: raw.transactionId || '',
    submittedBy: raw.submittedBy || raw.createdBy || 'admin',
    paidOn: raw.paidOn,
    method: raw.method || 'cash',
    receiptNo: raw.receiptNo || '',
    note: raw.note || '',
    createdBy: raw.createdBy || 'admin',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function messBillPayload(bill, student) {
  if (!bill) return null;
  const raw = typeof bill.toObject === 'function' ? bill.toObject() : { ...bill };
  const studentRaw = student
    ? (typeof student.toObject === 'function' ? student.toObject() : student)
    : raw.student && typeof raw.student === 'object'
      ? raw.student
      : null;
  return {
    id: toId(raw._id || raw.id),
    studentId: toId(studentRaw?._id || studentRaw?.id || raw.student),
    rollNumber: studentRaw?.rollNumber || raw.rollNumber || '',
    studentName: studentRaw?.name || raw.studentName || '',
    month: raw.month || '',
    amount: Number(raw.amount || 0),
    note: raw.note || '',
    createdBy: raw.createdBy || 'admin',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function termFeePayload(fee, student) {
  if (!fee) return null;
  const raw = typeof fee.toObject === 'function' ? fee.toObject() : { ...fee };
  const studentRaw = student
    ? (typeof student.toObject === 'function' ? student.toObject() : student)
    : raw.student && typeof raw.student === 'object'
      ? raw.student
      : null;
  return {
    id: toId(raw._id || raw.id),
    studentId: toId(studentRaw?._id || studentRaw?.id || raw.student),
    rollNumber: studentRaw?.rollNumber || raw.rollNumber || '',
    studentName: studentRaw?.name || raw.studentName || '',
    quota: (studentRaw?.quota || raw.quota || 'ACAT').toUpperCase(),
    head: raw.head || 'tuition',
    term: Number(raw.term || 1),
    amount: Number(raw.amount || 0),
    note: raw.note || '',
    createdBy: raw.createdBy || 'admin',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function messagePayload(message) {
  if (!message) return null;
  const raw = typeof message.toObject === 'function' ? message.toObject() : { ...message };
  const studentRaw = raw.student && typeof raw.student === 'object' ? raw.student : null;
  return {
    id: toId(raw._id || raw.id),
    studentId: toId(studentRaw?._id || studentRaw?.id || raw.student),
    rollNumber: studentRaw?.rollNumber || raw.rollNumber || '',
    studentName: studentRaw?.name || raw.studentName || '',
    subject: raw.subject || '',
    body: raw.body || '',
    direction: raw.direction || 'student-to-admin',
    status: raw.status || 'unread',
    reply: raw.reply || '',
    repliedAt: raw.repliedAt || null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
