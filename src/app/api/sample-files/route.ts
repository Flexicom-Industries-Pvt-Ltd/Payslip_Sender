import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { generateSamplePayslipPdf } from '@/lib/sample-pdf';
import { getEmployees, getWorkspaceById } from '@/lib/db-store';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month') || 'October';
    const year = searchParams.get('year') || '2026';

    const [employees, workspace] = await Promise.all([
      getEmployees(undefined, session.workspaceId),
      getWorkspaceById(session.workspaceId),
    ]);
    const companyName = workspace?.legalName || workspace?.name || 'Company Payroll';

    if (employeeId) {
      const emp = employees.find((e) => e.employeeId.toLowerCase() === employeeId.toLowerCase());
      const name = emp ? emp.name : `Employee ${employeeId}`;
      const dept = emp?.department || 'Operations';

      const pdfBuf = generateSamplePayslipPdf({
        employeeId,
        name,
        month,
        year,
        companyName,
        department: dept,
      });

      return new NextResponse(new Uint8Array(pdfBuf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Payslip_${employeeId}_${month}_${year}.pdf"`,
        },
      });
    }

    const samples = employees.slice(0, 5).map((emp, idx) => {
      let filename = `Payslip_${emp.employeeId}.pdf`;
      if (idx === 1) filename = `payslip_${emp.employeeId}_${month}.pdf`;
      if (idx === 2) filename = `${emp.name.replace(/\s+/g, '_')}_Salary_Slip.pdf`;
      if (idx === 3) filename = `${emp.employeeId}.pdf`;

      const pdfBuf = generateSamplePayslipPdf({
        employeeId: emp.employeeId,
        name: emp.name,
        month,
        year,
        companyName,
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

    const unmatchedBuf = generateSamplePayslipPdf({
      employeeId: 'EMP999',
      name: 'External Contractor',
      month,
      year,
      companyName,
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
