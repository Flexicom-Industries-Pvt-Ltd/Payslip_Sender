import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getAuthSession } from '@/lib/auth';
import { getEmployeesWithMonthlyStatus, getWorkspaceById } from '@/lib/db-store';
import { MONTHS } from '@/lib/email-templates';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const workspace = await getWorkspaceById(session.workspaceId);
    const companyName = workspace?.legalName || workspace?.name || 'Company HR';
    const fileSlug = (workspace?.name || 'Company')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const domain = `${(workspace?.slug || 'company').replace(/[^a-z0-9-]/g, '')}.com`;

    const { searchParams } = new URL(request.url);
    const isTemplate = searchParams.get('template') === 'true';
    const month = searchParams.get('month') || 'October';
    const year = searchParams.get('year') || '2026';

    const workbook = XLSX.utils.book_new();

    if (isTemplate) {
      const templateRows = [
        {
          'Employee ID': 'EMP001',
          'Employee Name': 'Sarah Connor',
          'Email Address': `sarah.connor@${domain}`,
          Department: 'Operations',
        },
        {
          'Employee ID': 'EMP002',
          'Employee Name': 'John Miller',
          'Email Address': `john.miller@${domain}`,
          Department: 'Engineering',
        },
        {
          'Employee ID': 'EMP003',
          'Employee Name': 'Elena Rostova',
          'Email Address': `elena.rostova@${domain}`,
          Department: 'Finance',
        },
        {
          'Employee ID': 'EMP004',
          'Employee Name': 'Michael Davis',
          'Email Address': `michael.davis@${domain}`,
          Department: 'Human Resources',
        },
        {
          'Employee ID': 'EMP005',
          'Employee Name': 'Aisha Patel',
          'Email Address': `aisha.patel@${domain}`,
          Department: 'Production',
        },
      ];

      const templateSheet = XLSX.utils.json_to_sheet(templateRows);
      templateSheet['!cols'] = [
        { wch: 20 },
        { wch: 28 },
        { wch: 38 },
        { wch: 26 },
      ];
      XLSX.utils.book_append_sheet(workbook, templateSheet, 'Employees_Template');

      const instructionRows = [
        {
          Field: 'Employee ID',
          Required: 'YES (Mandatory)',
          Format: 'Unique string (e.g. EMP001, 1042)',
          'Payslip Matching Impact':
            'CRITICAL: Used to match files like "EMP001.pdf" or "Payslip_EMP001_Oct.pdf"',
        },
        {
          Field: 'Employee Name',
          Required: 'YES (Mandatory)',
          Format: 'Full legal name (e.g. Sarah Connor)',
          'Payslip Matching Impact': 'Displayed across HR directory and payslip emails',
        },
        {
          Field: 'Email Address',
          Required: 'YES (Mandatory)',
          Format: 'Valid email format (user@domain.com)',
          'Payslip Matching Impact':
            'Target destination where individual payslip is sent separately (never CC/BCC)',
        },
        {
          Field: 'Department',
          Required: 'OPTIONAL',
          Format: 'Department or business unit name',
          'Payslip Matching Impact':
            'Used for organizational grouping and filtering in the HR dashboard',
        },
      ];

      const guideSheet = XLSX.utils.json_to_sheet(instructionRows);
      guideSheet['!cols'] = [
        { wch: 24 },
        { wch: 18 },
        { wch: 42 },
        { wch: 75 },
      ];
      XLSX.utils.book_append_sheet(workbook, guideSheet, 'Instructions_&_Guide');
    } else {
      const statusData = await getEmployeesWithMonthlyStatus({
        workspaceId: session.workspaceId,
        month,
        year,
      });
      const employees = statusData.employees;
      const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const exportRows = employees.map((e) => {
        let payslipLabel = 'Missed / Not Sent';
        if (e.payslipStatus === 'SENT') {
          payslipLabel = `Sent (${e.lastSentAt ? new Date(e.lastSentAt).toLocaleDateString() : 'Delivered'})`;
        } else if (e.payslipStatus === 'FAILED') {
          payslipLabel = `Failed (${e.lastError || 'Delivery error'})`;
        }

        return {
          'Employee ID': e.employeeId,
          'Employee Name': e.name,
          'Email Address': e.email,
          Department: e.department || 'Unassigned',
          [`Payslip Status (${month} ${year})`]: payslipLabel,
          'Email Validity': validEmailRegex.test(e.email) ? 'Valid' : 'Invalid Format',
          'Registration Date': new Date(e.createdAt).toISOString().split('T')[0],
        };
      });

      const rosterSheet = XLSX.utils.json_to_sheet(exportRows);
      rosterSheet['!cols'] = [
        { wch: 18 },
        { wch: 28 },
        { wch: 38 },
        { wch: 24 },
        { wch: 30 },
        { wch: 16 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(workbook, rosterSheet, 'Employee_Directory');

      const matrixRows = employees.map((e) => {
        const row: Record<string, string> = {
          'Employee ID': e.employeeId,
          'Employee Name': e.name,
          Department: e.department || 'Unassigned',
        };
        MONTHS.forEach((m) => {
          const st = e.yearlyStatusMap?.[m];
          row[m.slice(0, 3)] = st === 'SENT' ? 'SENT' : st === 'FAILED' ? 'FAILED' : '—';
        });
        return row;
      });
      const matrixSheet = XLSX.utils.json_to_sheet(matrixRows);
      XLSX.utils.book_append_sheet(workbook, matrixSheet, `Annual_Matrix_${year}`);

      const totalEmployees = statusData.counts.total;
      const sentCount = statusData.counts.sentCount;
      const missedCount = statusData.counts.missedCount;
      const validEmailCount = employees.filter((e) => validEmailRegex.test(e.email)).length;
      const invalidEmailCount = totalEmployees - validEmailCount;
      const departments = Array.from(
        new Set(employees.map((e) => e.department).filter(Boolean) as string[])
      );

      const summaryRows = [
        { Metric: 'Report Name', Value: 'HR Employee Master Directory Export' },
        { Metric: 'Workspace / Company', Value: companyName },
        { Metric: 'Reporting Period', Value: `${month} ${year}` },
        { Metric: 'Export Timestamp', Value: new Date().toLocaleString() },
        { Metric: 'Total Registered Employees', Value: totalEmployees },
        { Metric: `Payslips Sent (${month} ${year})`, Value: `${sentCount} (${Math.round((sentCount / (totalEmployees || 1)) * 100)}%)` },
        { Metric: `Payslips Missed (${month} ${year})`, Value: `${missedCount} (${Math.round((missedCount / (totalEmployees || 1)) * 100)}%)` },
        { Metric: 'Employees with Valid Email', Value: validEmailCount },
        { Metric: 'Employees with Invalid Email', Value: invalidEmailCount },
        { Metric: 'Total Active Departments', Value: departments.length },
        { Metric: 'Departments List', Value: departments.join(', ') || 'None' },
        { Metric: 'Database Engine', Value: 'Neon PostgreSQL (Prisma ORM)' },
        { Metric: 'Generated By', Value: `${companyName} HR System` },
      ];

      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      summarySheet['!cols'] = [{ wch: 32 }, { wch: 55 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Export_Summary');
    }

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = isTemplate
      ? `${fileSlug}_Employee_Import_Template.xlsx`
      : `${fileSlug}_Employee_Directory_${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to export employees' },
      { status: 500 }
    );
  }
}
