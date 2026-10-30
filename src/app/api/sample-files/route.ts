import { NextRequest, NextResponse } from 'next/server';
import { generateSamplePayslipPdf } from '@/lib/sample-pdf';
import { getEmployees } from '@/lib/db-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month') || 'October';
    const year = searchParams.get('year') || '2026';

    const employees = await getEmployees();

    if (employeeId) {
      const emp = employees.find((e) => e.employeeId.toLowerCase() === employeeId.toLowerCase());
      const name = emp ? emp.name : `Employee ${employeeId}`;
      const dept = emp?.department || 'Operations';

      const pdfBuf = generateSamplePayslipPdf({
        employeeId,
        name,
        month,
        year,
        department: dept,
      });

      return new NextResponse(new Uint8Array(pdfBuf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Payslip_${employeeId}_${month}_${year}.pdf"`,
        },
      });
    }

    // Return metadata and base64 payloads for quick one-click test loading
    const samples = employees.slice(0, 5).map((emp, idx) => {
      // Intentionally vary naming formats to test our pattern matcher:
      // 1. EMP001_SalarySlip.pdf
      // 2. payslip-EMP002.pdf
      // 3. John_Miller.pdf (Name based)
      // 4. EMP004.pdf
      let filename = `Payslip_${emp.employeeId}.pdf`;
      if (idx === 1) filename = `payslip_${emp.employeeId}_${month}.pdf`;
      if (idx === 2) filename = `${emp.name.replace(/\s+/g, '_')}_Salary_Slip.pdf`;
      if (idx === 3) filename = `${emp.employeeId}.pdf`;

      const pdfBuf = generateSamplePayslipPdf({
        employeeId: emp.employeeId,
        name: emp.name,
        month,
        year,
        department: emp.department || 'General',
        basicPay: 4000 + idx * 800,
        allowances: 1200 + idx * 200,
        deductions: 600 + idx * 100,
      });

      return {
        filename,
        employeeId: emp.employeeId,
        name: emp.name,
        base64: pdfBuf.toString('base64'),
        size: pdfBuf.length,
      };
    });

    // Also include one unmatched file to demonstrate unmatched handling
    const unmatchedBuf = generateSamplePayslipPdf({
      employeeId: 'EMP999',
      name: 'External Contractor',
      month,
      year,
      department: 'Consulting',
    });
    samples.push({
      filename: 'Contractor_EMP999_Unknown.pdf',
      employeeId: 'EMP999',
      name: 'External Contractor',
      base64: unmatchedBuf.toString('base64'),
      size: unmatchedBuf.length,
    });

    return NextResponse.json({ success: true, samples });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to generate sample files' },
      { status: 500 }
    );
  }
}

