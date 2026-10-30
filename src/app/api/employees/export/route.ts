import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getEmployeesWithMonthlyStatus } from '@/lib/db-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isTemplate = searchParams.get('template') === 'true';
    const month = searchParams.get('month') || 'October';
    const year = searchParams.get('year') || '2026';

    const workbook = XLSX.utils.book_new();

    if (isTemplate) {
      // ----------------- SHEET 1: Beautified Import Template -----------------
      const templateRows = [
        {
          'Employee ID': 'EMP001',
          'Employee Name': 'Sarah Connor',
          'Email Address': 'sarah.connor@sterlingdistillers.com',
          Department: 'Operations',
        },
        {
          'Employee ID': 'EMP002',
          'Employee Name': 'John Miller',
          'Email Address': 'john.miller@sterlingdistillers.com',
          Department: 'Engineering',
        },
        {
          'Employee ID': 'EMP003',
          'Employee Name': 'Elena Rostova',
          'Email Address': 'elena.rostova@sterlingdistillers.com',
          Department: 'Finance',
        },
        {
          'Employee ID': 'EMP004',
          'Employee Name': 'Michael Davis',
          'Email Address': 'michael.davis@sterlingdistillers.com',
          Department: 'Human Resources',
        },
        {
          'Employee ID': 'EMP005',
          'Employee Name': 'Aisha Patel',
          'Email Address': 'aisha.patel@sterlingdistillers.com',
          Department: 'Production',
        },
      ];

      const templateSheet = XLSX.utils.json_to_sheet(templateRows);

      // Auto-set generous column widths for clean readability
      templateSheet['!cols'] = [
        { wch: 20 }, // Employee ID
        { wch: 28 }, // Employee Name
        { wch: 38 }, // Email Address
        { wch: 26 }, // Department
      ];

      XLSX.utils.book_append_sheet(workbook, templateSheet, 'Employees_Template');

      // ----------------- SHEET 2: HR Instructions & Guidelines -----------------
      const instructionRows = [
        {
          Field: 'Employee ID',
          Required: 'YES (Mandatory)',
          Format: 'Unique string (e.g. EMP001, 1042)',
          'Payslip Matching Impact':
            'CRITICAL: Used by the matching engine to pair files like "EMP001.pdf" or "Payslip_EMP001_Oct.pdf"',
        },
        {
          Field: 'Employee Name',
          Required: 'YES (Mandatory)',
          Format: 'Full legal name (e.g. Sarah Connor)',
          'Payslip Matching Impact':
            'Secondary fallback matcher for files named like "Sarah_Connor_Salary.pdf"',
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
        {
          Field: '--- IMPORTANT TIP ---',
          Required: 'INFO',
          Format: 'Naming payslip PDF files',
          'Payslip Matching Impact':
            'For 100% instant auto-matching, name your PDF files with the Employee ID (e.g., EMP001.pdf)',
        },
      ];

      const guideSheet = XLSX.utils.json_to_sheet(instructionRows);
      guideSheet['!cols'] = [
        { wch: 24 }, // Field
        { wch: 18 }, // Required
        { wch: 42 }, // Format
        { wch: 75 }, // Payslip Matching Impact
      ];

      XLSX.utils.book_append_sheet(workbook, guideSheet, 'Instructions_&_Guide');
    } else {
      // ----------------- EXPORT: Beautified Employee Master Roster -----------------
      const statusData = await getEmployeesWithMonthlyStatus({ month, year });
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
        { wch: 18 }, // Employee ID
        { wch: 28 }, // Employee Name
        { wch: 38 }, // Email Address
        { wch: 24 }, // Department
        { wch: 30 }, // Payslip Status (Month Year)
        { wch: 16 }, // Email Validity
        { wch: 18 }, // Registration Date
      ];

      XLSX.utils.book_append_sheet(workbook, rosterSheet, 'Employee_Directory');

      // ----------------- SHEET 2: Export Summary Metadata -----------------
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
        { Metric: 'Generated By', Value: 'Sterling Distillers Private Limited HR System' },
      ];

      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      summarySheet['!cols'] = [
        { wch: 32 },
        { wch: 55 },
      ];

      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Export_Summary');
    }

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = isTemplate
      ? 'Sterling_Distillers_Employee_Import_Template.xlsx'
      : `Sterling_Distillers_Employee_Directory_${new Date().toISOString().split('T')[0]}.xlsx`;

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
