import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { bulkUpsertEmployees } from '@/lib/db-store';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    const filename = file.name.toLowerCase();
    if (
      !filename.endsWith('.xlsx') &&
      !filename.endsWith('.xls') &&
      !filename.endsWith('.csv')
    ) {
      return NextResponse.json(
        { success: false, error: 'File must be an Excel (.xlsx, .xls) or CSV file' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { success: false, error: 'The uploaded spreadsheet contains no sheets' },
        { status: 400 }
      );
    }

    // Helper to find matching column value regardless of case, punctuation, or annotations like "(Required)"
    const normalizeHeader = (header: string) => {
      return header
        .toLowerCase()
        .replace(/\(.*?\)/g, '') // remove (Required), (Optional), etc.
        .replace(/[^a-z0-9]/g, ''); // keep only alphanumeric
    };

    const findField = (row: Record<string, any>, candidateKeys: string[]): string => {
      const rowKeys = Object.keys(row);
      const normalizedCandidates = candidateKeys.map(normalizeHeader);

      for (const key of rowKeys) {
        const normKey = normalizeHeader(key);
        if (normalizedCandidates.includes(normKey)) {
          return String(row[key] ?? '').trim();
        }
      }
      return '';
    };

    // Find the best sheet that contains employee data
    let targetSheetName = workbook.SheetNames[0];
    for (const sheetName of workbook.SheetNames) {
      const lower = sheetName.toLowerCase();
      if (lower.includes('employee') || lower.includes('roster') || lower.includes('data')) {
        targetSheetName = sheetName;
        break;
      }
    }

    // Parse the selected sheet
    const sheet = workbook.Sheets[targetSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    if (rawRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `The sheet "${targetSheetName}" contains no data rows.`,
        },
        { status: 400 }
      );
    }

    const parsedRecords: Array<{
      employeeId: string;
      name: string;
      email: string;
      department?: string | null;
    }> = [];

    for (const row of rawRows) {
      const employeeId = findField(row, [
        'Employee ID',
        'employee_id',
        'emp_id',
        'EmployeeID',
        'EmpId',
        'ID',
        'Emp ID',
      ]);
      const name = findField(row, [
        'Employee Name',
        'employee_name',
        'Name',
        'Full Name',
        'fullname',
      ]);
      const email = findField(row, [
        'Email Address',
        'email_address',
        'Email',
        'mail',
        'E-mail',
      ]);
      const department = findField(row, [
        'Department',
        'dept',
        'department_name',
        'Dept Name',
        'Unit',
      ]);

      // Skip non-data rows or instruction rows (e.g., headers or placeholders)
      if (
        employeeId.includes('---') ||
        employeeId.toLowerCase().includes('example') ||
        name.includes('---')
      ) {
        continue;
      }

      // If at least an employee ID or name is provided, include for processing
      if (employeeId || name || email) {
        parsedRecords.push({
          employeeId,
          name,
          email,
          department: department || null,
        });
      }
    }

    if (parsedRecords.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Could not find recognizable employee columns. Please download and use the official template with columns: "Employee ID", "Employee Name", "Email Address", and "Department".',
        },
        { status: 400 }
      );
    }

    const result = await bulkUpsertEmployees(parsedRecords);

    return NextResponse.json({
      success: true,
      summary: {
        totalRows: parsedRecords.length,
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        errors: result.errors,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to process file import' },
      { status: 500 }
    );
  }
}
