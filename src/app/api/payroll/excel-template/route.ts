import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getAuthSession } from '@/lib/auth';
import { getEmployees, getPayslipTemplateById, getWorkspaceById } from '@/lib/db-store';
import { buildDefaultMasterTemplates } from '@/lib/payslip-template-presets';

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    const [ws, employees, tpl] = await Promise.all([
      getWorkspaceById(session.workspaceId),
      getEmployees(undefined, session.workspaceId),
      templateId ? getPayslipTemplateById(templateId) : Promise.resolve(null),
    ]);

    const activeTemplate = tpl || buildDefaultMasterTemplates()[0];
    const cfg = activeTemplate.config;

    const baseHeaders = [
      'Employee ID',
      'Employee Name',
      'Email',
      'Department',
      'Designation',
      'Location',
      'Date of Joining',
      'PAN',
      'UAN',
      'ESIC No',
      'Bank Name',
      'Bank Account',
      'Total Days',
      'Paid Days',
      'LOP Days',
    ];

    const earnHeaders = cfg.earningsHeads.map((h) => h.label);
    const dedHeaders = cfg.deductionsHeads.map((h) => h.label);

    const rows =
      employees.length > 0
        ? employees.map((emp) => {
            const row: Record<string, any> = {
              'Employee ID': emp.employeeId,
              'Employee Name': emp.name,
              Email: emp.email,
              Department: emp.department || '',
              Designation: emp.designation || '',
              Location: emp.location || '',
              'Date of Joining': emp.dateOfJoining || '',
              PAN: emp.pan || '',
              UAN: emp.uan || '',
              'ESIC No': emp.esicNo || '',
              'Bank Name': emp.bankName || '',
              'Bank Account': emp.bankAccount || '',
              'Total Days': 30,
              'Paid Days': 30,
              'LOP Days': 0,
            };

            let savedStruct: Record<string, any> = {};
            if (emp.salaryStructureJson) {
              try {
                savedStruct = JSON.parse(emp.salaryStructureJson);
              } catch {
                savedStruct = {};
              }
            }

            for (const head of cfg.earningsHeads) {
              row[head.label] = savedStruct[head.key] ?? head.defaultValue ?? 0;
            }
            for (const head of cfg.deductionsHeads) {
              row[head.label] = savedStruct[head.key] ?? head.defaultValue ?? 0;
            }
            return row;
          })
        : [
            Object.fromEntries([
              ...baseHeaders.map((h) => [
                h,
                h === 'Employee ID'
                  ? 'EMP001'
                  : h === 'Employee Name'
                  ? 'Sample Employee'
                  : h === 'Email'
                  ? 'employee@company.com'
                  : h === 'Total Days' || h === 'Paid Days'
                  ? 30
                  : h === 'LOP Days'
                  ? 0
                  : '',
              ]),
              ...earnHeaders.map((h) => [h, 0]),
              ...dedHeaders.map((h) => [h, 0]),
            ]),
          ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll Register');
    const xlsxBuf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `Payroll_Format_${ws?.slug || 'company'}.xlsx`;
    return new NextResponse(new Uint8Array(xlsxBuf), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to generate Excel format' },
      { status: 500 }
    );
  }
}
