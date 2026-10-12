import mongoose from 'mongoose';
import { connectDB } from './db.js';
import { Student } from './models/Student.js';
import { Payment } from './models/Payment.js';
import { MessBill } from './models/MessBill.js';
import { Message } from './models/Message.js';
import { TermFee } from './models/TermFee.js';
import { syncAllStudentFees } from './utils/finance.js';

/* Demo students. Fees are assigned term-wise by quota:
 *   ACAT  -> tuition ₹18,750 × 4, hostel ₹25,000 × 2
 *   BCAT  -> tuition ₹31,250 × 4, hostel ₹25,000 × 2
 */
const STUDENTS = [
  { rollNumber: 'CSE001', name: 'Aadi Sharma', college: 'KIET', branch: 'CSE', year: '2', section: 'A', quota: 'ACAT', phone: '9800000001' },
  { rollNumber: 'CSE002', name: 'Diya Patel', college: 'KIET', branch: 'CSE', year: '2', section: 'A', quota: 'ACAT', phone: '9800000002' },
  { rollNumber: 'ECE001', name: 'Vivaan Reddy', college: 'KIET', branch: 'ECE', year: '3', section: 'B', quota: 'BCAT', phone: '9800000003' },
  { rollNumber: 'ECE002', name: 'Ananya Iyer', college: 'KIEK', branch: 'ECE', year: '3', section: 'B', quota: 'ACAT', phone: '9800000004' },
  { rollNumber: 'MECH001', name: 'Kabir Singh', college: 'KIEK', branch: 'MECH', year: '1', section: 'A', quota: 'SPOT', phone: '9800000005' },
  { rollNumber: 'CIVIL001', name: 'Ishita Nair', college: 'KIET', branch: 'CIVIL', year: '4', section: 'A', quota: 'ACAT', phone: '9800000006' },
];

const MONTHS = ['2026-08', '2026-09'];
const TUITION_RATES = { ACAT: 18750, BCAT: 31250, SPOT: 31250 };
const HOSTEL_RATE = 25000;

const round = (n) => Math.round(n * 100) / 100;

async function run() {
  await connectDB();
  await Promise.all([
    Student.deleteMany({}),
    Payment.deleteMany({}),
    MessBill.deleteMany({}),
    TermFee.deleteMany({}),
    Message.deleteMany({}),
  ]);

  const students = await Student.insertMany(STUDENTS);

  const termFees = [];
  const payments = [];
  const messBills = [];
  const now = Date.now();

  students.forEach((s, i) => {
    const tuition = TUITION_RATES[s.quota] || TUITION_RATES.ACAT;
    for (let t = 1; t <= 4; t += 1) {
      termFees.push({ student: s._id, head: 'tuition', term: t, amount: tuition, note: `Tuition installment ${t}`, createdBy: 'seed' });
    }
    for (let t = 1; t <= 2; t += 1) {
      termFees.push({ student: s._id, head: 'hostel', term: t, amount: HOSTEL_RATE, note: `Hostel installment ${t}`, createdBy: 'seed' });
    }

    // A tuition payment for term 1 and a hostel payment for term 1.
    payments.push({
      student: s._id,
      amount: round(tuition),
      category: 'tuition',
      term: 1,
      transactionId: `TXN-TUITION-${1000 + i}`,
      paidOn: new Date(now - (i + 2) * 24 * 60 * 60 * 1000),
      method: ['upi', 'cash', 'netbanking'][i % 3],
      receiptNo: `RCPT-${1000 + i}`,
      note: 'Term 1 tuition',
      createdBy: 'admin',
    });
    payments.push({
      student: s._id,
      amount: round(HOSTEL_RATE * 0.5),
      category: 'hostel',
      term: 1,
      transactionId: `TXN-HOSTEL-${2000 + i}`,
      paidOn: new Date(now - i * 24 * 60 * 60 * 1000),
      method: 'cash',
      receiptNo: `RCPT-${2000 + i}`,
      note: 'Term 1 hostel (partial)',
      createdBy: 'admin',
    });

    if (i % 2 === 0) {
      MONTHS.forEach((month) => {
        messBills.push({ student: s._id, month, amount: 3500, note: 'Monthly mess', createdBy: 'admin' });
      });
    }
  });

  await TermFee.insertMany(termFees);
  await Payment.insertMany(payments);
  await MessBill.insertMany(messBills);
  await syncAllStudentFees();

  await Message.create({
    student: students[0]._id,
    rollNumber: students[0].rollNumber,
    subject: 'Fee receipt correction',
    body: 'Sir, my second term receipt number is missing. Please update it.',
    direction: 'student-to-admin',
    status: 'unread',
  });

  console.log(
    `Seeded ${students.length} students, ${termFees.length} term fees, ${payments.length} payments, ${messBills.length} mess bills, 1 message.`,
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
