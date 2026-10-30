/**
 * Lightweight, zero-dependency valid PDF generator for generating realistic sample payslips
 * for HR testing and verification.
 */
export function generateSamplePayslipPdf(data: {
  employeeId: string;
  name: string;
  month: string;
  year: string;
  department?: string;
  basicPay?: number;
  allowances?: number;
  deductions?: number;
}): Buffer {
  const basic = data.basicPay || 5000;
  const allow = data.allowances || 1500;
  const deduct = data.deductions || 750;
  const gross = basic + allow;
  const net = gross - deduct;

  // Formatted PDF stream content
  const textStream = [
    'BT',
    '/F1 18 Tf',
    '50 750 Td',
    `(CONFIDENTIAL SALARY SLIP) Tj`,
    'ET',
    'BT',
    '/F1 11 Tf',
    '50 725 Td',
    `(Pay Period: ${data.month} ${data.year}) Tj`,
    'ET',
    'BT',
    '/F1 10 Tf',
    '50 680 Td',
    `(Employee ID:    ${data.employeeId}) Tj`,
    '0 -18 Td',
    `(Employee Name:  ${data.name}) Tj`,
    '0 -18 Td',
    `(Department:     ${data.department || 'General'}) Tj`,
    '0 -28 Td',
    '------------------------------------------------------- Tj',
    '0 -20 Td',
    `/F1 11 Tf`,
    `(EARNINGS & DEDUCTIONS SUMMARY) Tj`,
    '0 -20 Td',
    `/F1 10 Tf`,
    `(Basic Salary:            $${basic.toFixed(2)}) Tj`,
    '0 -18 Td',
    `(Allowances & Bonuses:    $${allow.toFixed(2)}) Tj`,
    '0 -18 Td',
    `(Gross Total Earnings:    $${gross.toFixed(2)}) Tj`,
    '0 -22 Td',
    `(Tax & Benefit Deductions: -$${deduct.toFixed(2)}) Tj`,
    '0 -26 Td',
    '------------------------------------------------------- Tj',
    '0 -24 Td',
    `/F1 13 Tf`,
    `(NET DISBURSEMENT AMOUNT: $${net.toFixed(2)}) Tj`,
    '0 -36 Td',
    `/F1 9 Tf`,
    `(Payment Mode: Direct Bank Transfer) Tj`,
    '0 -14 Td',
    `(Status: Processed and Approved) Tj`,
    'ET',
  ].join('\n');

  const streamLength = Buffer.byteLength(textStream, 'utf-8');

  // Construct PDF objects with exact xref offsets
  const objects = [
    `%PDF-1.4\n`,
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${textStream}\nendstream\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
  ];

  let currentOffset = 0;
  const offsets: number[] = [0];

  for (let i = 1; i < objects.length; i++) {
    currentOffset += Buffer.byteLength(objects[i - 1], 'utf-8');
    offsets.push(currentOffset);
  }

  const finalObjectOffset = currentOffset + Buffer.byteLength(objects[objects.length - 1], 'utf-8');

  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${finalObjectOffset}\n%%EOF\n`;

  const fullPdf = objects.join('') + xref + trailer;
  return Buffer.from(fullPdf, 'utf-8');
}

