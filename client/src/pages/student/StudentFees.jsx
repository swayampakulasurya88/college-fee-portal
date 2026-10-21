import { categoryLabel, categoryShort, categoryTone, inr, monthLabel, paidPercent } from '../../format.js';
import { Badge, EmptyState, ProgressBar, SectionCard, Spinner, StatCard } from '../../components/ui.jsx';
import { Detail, StudentHeader, ExtraDetailsCard, useCustomFields, useStudentReport } from './studentShared.jsx';

export default function StudentFees() {
  const { report, loading, load } = useStudentReport();
  const customFields = useCustomFields();

  if (loading) return <Spinner label="Loading your fee details…" />;
  if (!report) return <EmptyState title="Could not load your fee details" hint="Please refresh the page." />;

  const s = report.student;
  const pct = paidPercent(s.totalPaid, s.totalFee);
  const heads = [
    { key: 'tuition', label: 'Tuition Fee', fee: s.tuitionFee, paid: s.tuitionPaid, due: s.tuitionDue },
    { key: 'hostel', label: 'Hostel Fee', fee: s.hostelFee, paid: s.hostelPaid, due: s.hostelDue },
    { key: 'mess', label: 'Mess Fee', fee: s.messFee, paid: s.messPaid, due: s.messDue },
  ];
  const termRows = ['tuition', 'hostel'].flatMap((head) =>
    (s.terms?.[head] || []).map((t) => ({ ...t, head })),
  );

  return (
    <>
      <StudentHeader
        student={s}
        title="My fee details"
        subtitle={`Grand total ${inr(s.totalFee)} · paid ${inr(s.totalPaid)} · due ${inr(s.totalDue)}`}
        onRefresh={() => load(true)}
      />

      <div className="stat-grid">
        <StatCard label="Grand Total Fee" value={inr(s.totalFee)} tone="indigo" icon="🧾" sub="Tuition + Hostel + Mess" />
        <StatCard label="Total Paid" value={inr(s.totalPaid)} tone="emerald" icon="✅" sub={`${s.paymentCount} payment${s.paymentCount === 1 ? '' : 's'}`} />
        <StatCard
          label="Total Due"
          value={inr(s.totalDue)}
          tone={s.totalDue > 0 ? 'rose' : 'emerald'}
          icon="⏳"
          sub={s.totalDue > 0 ? 'To be paid' : 'Nothing pending'}
        />
        <StatCard label="Progress" value={`${pct}%`} tone="amber" icon="📈" sub={`${inr(s.totalPaid)} / ${inr(s.totalFee)}`} />
      </div>

      <SectionCard title="Fee break-up" subtitle="Your fee is split into tuition, hostel and monthly mess">
        <div className="grid-3">
          {heads.map((h) => {
            const hp = paidPercent(h.paid, h.fee);
            return (
              <div key={h.key} className="card" style={{ padding: '1rem', margin: 0 }}>
                <div className="space-between" style={{ marginBottom: 6 }}>
                  <strong>{h.label}</strong>
                  <Badge variant={h.fee <= 0 ? 'neutral' : h.due <= 0 ? 'success' : h.paid > 0 ? 'warn' : 'danger'}>
                    {h.fee <= 0 ? 'Not set' : h.due <= 0 ? 'Cleared' : `${100 - hp}% left`}
                  </Badge>
                </div>
                <div className="stat-value" style={{ fontSize: '1.35rem' }}>
                  {inr(h.fee)}
                </div>
                <div className="muted small" style={{ margin: '4px 0 8px' }}>
                  Paid {inr(h.paid)} · Due{' '}
                  <strong style={{ color: h.due > 0 ? 'var(--rose)' : 'var(--emerald)' }}>{inr(h.due)}</strong>
                </div>
                <ProgressBar percent={hp} tone={categoryTone[h.key]} />
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Term-wise break-up"
        subtitle="Tuition runs over 4 terms and hostel over 2 · mess is billed monthly"
        style={{ marginTop: '1.25rem' }}
      >
        {termRows.length === 0 ? (
          <EmptyState icon="🧮" title="No term fees published yet" hint="The office assigns fixed fees term by term — check back soon." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Head</th>
                  <th>Term</th>
                  <th className="right">Fee</th>
                  <th className="right">Paid</th>
                  <th className="right">Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {termRows.map((t) => (
                  <tr key={`${t.head}-${t.term}`}>
                    <td>
                      <span className={`chip chip-${categoryTone[t.head]}`}>{categoryShort[t.head]}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>Term {t.term}</td>
                    <td className="right">{inr(t.fee)}</td>
                    <td className="right" style={{ color: 'var(--emerald)' }}>
                      {inr(t.paid)}
                    </td>
                    <td className="right" style={{ color: t.due > 0 ? 'var(--rose)' : 'var(--emerald)', fontWeight: 600 }}>
                      {inr(t.due)}
                    </td>
                    <td>
                      <Badge variant={t.due <= 0 ? 'success' : t.paid > 0 ? 'warn' : 'danger'}>
                        {t.due <= 0 ? 'Cleared' : t.paid > 0 ? 'Partial' : 'Unpaid'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Monthly mess fee"
        subtitle={`Mess is charged every month${s.messBillCount ? ` · ${s.messBillCount} bill${s.messBillCount === 1 ? '' : 's'}` : ''}`}
        style={{ marginTop: '1.25rem' }}
      >
        {report.messBills.length === 0 ? (
          <EmptyState icon="🍽️" title="No mess bills yet" hint="Monthly mess charges added by the office will be listed here." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Note</th>
                  <th className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {report.messBills.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{monthLabel(b.month)}</td>
                    <td className="muted small">{b.note || '—'}</td>
                    <td className="right" style={{ fontWeight: 700 }}>
                      {inr(b.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700 }}>
                    Mess Total
                  </td>
                  <td className="right" style={{ fontWeight: 800 }}>
                    {inr(s.messFee)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Summary" subtitle="How your account stands today" style={{ marginTop: '1.25rem' }}>
        <div className="grid-3">
          <Detail label="Quota" value={s.quota} />
          <Detail label="Staying" value={s.hostel ? 'Hosteller' : 'Day scholar'} />
          <Detail
            label="Loan"
            value={s.loan ? `Education loan${s.loanNote ? ` · ${s.loanNote}` : ''}` : 'Not on loan'}
          />
          <Detail label="Payments recorded" value={String(s.paymentCount)} />
          <Detail label="Mess bills" value={String(s.messBillCount)} />
          <Detail label="Status" value={s.totalDue <= 0 ? 'Fully paid' : s.totalPaid > 0 ? 'Partially paid' : 'Unpaid'} />
        </div>
        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          {categoryLabel.tuition} and {categoryLabel.hostel} are billed term-wise; {categoryLabel.mess} is billed
          every month. Pay from the <strong>Fee payments</strong> page and your due updates instantly.
        </p>
      </SectionCard>

      {customFields.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <ExtraDetailsCard student={s} fields={customFields} />
        </div>
      )}
    </>
  );
}
