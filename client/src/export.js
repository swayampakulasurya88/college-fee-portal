/**
 * Excel (.xlsx) and PDF export helpers.
 *
 * Libraries are imported lazily (only when an export button is pressed) so they
 * never weigh down the initial page bundle.
 *
 * A "column" is `{ header, get, money }` where `get(row)` returns the raw value
 * (numbers stay numbers in Excel so they can be summed) and `money` formats it
 * with thousands separators for the PDF.
 */

export const money = (n) =>
  Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const stamp = () => new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Export rows to a single-sheet .xlsx file. */
export async function exportToExcel({ columns, rows, filename, sheetName = 'Sheet1', title, subtitle }) {
  const XLSX = await import('xlsx');

  const matrix = [];
  if (title) matrix.push([title]);
  if (subtitle) matrix.push([subtitle]);
  matrix.push([`Exported: ${stamp()}`]);
  matrix.push([]);
  matrix.push(columns.map((c) => c.header));
  rows.forEach((r) => matrix.push(columns.map((c) => c.get(r))));

  const ws = XLSX.utils.aoa_to_sheet(matrix);
  ws['!cols'] = columns.map((c) => {
    const longest = rows.reduce((m, r) => Math.max(m, String(c.get(r) ?? '').length), String(c.header).length);
    return { wch: Math.min(34, Math.max(10, longest + 2)) };
  });
  const firstDataRow = matrix.length - rows.length; // 0-based row index of first data row
  if (title) {
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, columns.length - 1) } }];
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(sheetName).slice(0, 31) || 'Sheet1');
  XLSX.writeFile(wb, filename);
}

/** Export rows to a nicely formatted PDF table. */
export async function exportToPdf({ columns, rows, filename, title, subtitle, orientation = 'portrait' }) {
  const { jsPDF } = await import('jspdf');
  const autoTableMod = await import('jspdf-autotable');
  // jspdf-autotable ships CJS/UMD and ESM; normalise whichever shape we get.
  const autoTable =
    [autoTableMod?.default, autoTableMod?.default?.default, autoTableMod?.applyPlugin, autoTableMod].find(
      (c) => typeof c === 'function',
    );
  if (!autoTable) throw new Error('jspdf-autotable failed to load');

  const landscape = orientation === 'landscape' || columns.length > 7;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = 40;
  if (title) {
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(title, pageWidth / 2, y, { align: 'center' });
    y += 18;
  }
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
    y += 14;
  }
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exported: ${stamp()}`, pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0);
  y += 8;

  const columnStyles = {};
  columns.forEach((c, i) => {
    columnStyles[i] = { halign: c.money ? 'right' : c.align || 'left' };
  });

  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => (c.money ? money(c.get(r)) : String(c.get(r) ?? '')))),
    startY: y,
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 58, 130], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 246, 251] },
    columnStyles,
    margin: { left: 24, right: 24 },
  });

  doc.save(filename);
}
