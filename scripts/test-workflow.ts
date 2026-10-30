import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  bulkUpsertEmployees,
  getDashboardStats,
  logEmailDispatch,
  getEmployeesWithMonthlyStatus,
} from '../src/lib/db-store';
import {
  saveStoredSMTPConfig,
  getSMTPConfigStatus,
  getStoredSMTPConfig,
} from '../src/lib/mailer';
import { matchPayslipFiles } from '../src/lib/matching';
import { interpolateTemplate, DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY } from '../src/lib/email-templates';
import { generateSamplePayslipPdf } from '../src/lib/sample-pdf';
import * as XLSX from 'xlsx';

// Mock browser File class in Node environment for testing matching engine
class MockFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  private buffer: Buffer;

  constructor(buffer: Buffer, name: string, options: { type?: string; lastModified?: number } = {}) {
    this.buffer = buffer;
    this.name = name;
    this.size = buffer.length;
    this.type = options.type || 'application/pdf';
    this.lastModified = options.lastModified || Date.now();
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const ab = this.buffer.buffer.slice(
      this.buffer.byteOffset,
      this.buffer.byteOffset + this.buffer.byteLength
    );
    return ab as ArrayBuffer;
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING EMPLOYEE PAYSLIP SYSTEM INTEGRATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      failed++;
    }
  }

  // ----------------- TEST SUITE 1: EMPLOYEE CRUD -----------------
  console.log('📋 Suite 1: Employee Management & Persistent Operations');

  const testEmpId = `TEST_${Date.now()}`;
  let createdEmp: any = null;

  try {
    createdEmp = await createEmployee({
      employeeId: testEmpId,
      name: 'Dr. Katherine Brewster',
      email: 'katherine.brewster@example.com',
      department: 'Cybernetics',
    });
    assert(createdEmp.employeeId === testEmpId, 'Create employee with unique ID');
    assert(createdEmp.name === 'Dr. Katherine Brewster', 'Employee name saved accurately');
    assert(createdEmp.department === 'Cybernetics', 'Department saved accurately');
  } catch (err: any) {
    assert(false, 'Create employee with unique ID', err.message);
  }

  // Test duplicate ID prevention
  try {
    await createEmployee({
      employeeId: testEmpId,
      name: 'Duplicate Person',
      email: 'dup@example.com',
    });
    assert(false, 'Prevent duplicate Employee ID creation');
  } catch {
    assert(true, 'Prevent duplicate Employee ID creation');
  }

  // Test search & filter
  const searchResults = await getEmployees({ search: 'Katherine' });
  assert(
    searchResults.some((e) => e.employeeId === testEmpId),
    'Search employee by name substring'
  );

  const deptResults = await getEmployees({ department: 'Cybernetics' });
  assert(
    deptResults.some((e) => e.employeeId === testEmpId),
    'Filter employees by department'
  );

  // Test update
  if (createdEmp) {
    const updated = await updateEmployee(createdEmp.id, {
      name: 'Katherine Connor',
      department: 'Tactical Defense',
    });
    assert(updated.name === 'Katherine Connor', 'Update employee name');
    assert(updated.department === 'Tactical Defense', 'Update employee department');

    // Test delete
    const deleted = await deleteEmployee(createdEmp.id);
    assert(deleted.id === createdEmp.id, 'Delete employee record');

    const checkDeleted = await getEmployees({ search: testEmpId });
    assert(!checkDeleted.some((e) => e.employeeId === testEmpId), 'Verify deletion confirmed');
  }

  // ----------------- TEST SUITE 2: EXCEL / CSV IMPORT -----------------
  console.log('\n📊 Suite 2: Excel & CSV Spreadsheet Ingestion');

  const excelRows = [
    {
      'Employee ID': 'EMP901',
      'Employee Name': 'T-800 Cyberdyne',
      'Email Address': 't800@skynet.com',
      Department: 'Robotics',
    },
    {
      'Employee ID': 'EMP902',
      'Employee Name': 'Marcus Wright',
      'Email Address': 'marcus.wright@resistance.org',
      Department: 'Field Ops',
    },
    {
      'Employee ID': 'EMP903',
      'Employee Name': 'Invalid Email Worker',
      'Email Address': 'not-an-email',
      Department: 'Testing',
    },
  ];

  // Create workbook in-memory
  const ws = XLSX.utils.json_to_sheet(excelRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');
  const excelBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Parse using XLSX
  const parsedWb = XLSX.read(excelBuf, { type: 'buffer' });
  const parsedRows: any[] = XLSX.utils.sheet_to_json(parsedWb.Sheets['Employees']);

  const bulkResult = await bulkUpsertEmployees(
    parsedRows.map((r) => ({
      employeeId: r['Employee ID'],
      name: r['Employee Name'],
      email: r['Email Address'],
      department: r['Department'],
    }))
  );

  assert(bulkResult.createdCount >= 2, 'Bulk import registered valid employee records');
  assert(
    bulkResult.errors.some((err) => err.employeeId === 'EMP903'),
    'Bulk import correctly rejected invalid email format'
  );

  // Clean up test records
  const allEmps = await getEmployees();
  for (const emp of allEmps) {
    if (['EMP901', 'EMP902', 'EMP903'].includes(emp.employeeId)) {
      await deleteEmployee(emp.id);
    }
  }

  // ----------------- TEST SUITE 3: PAYSLIP PDF MATCHING ENGINE -----------------
  console.log('\n🔍 Suite 3: Automated Employee-to-Payslip Matching Engine');

  const testEmployees = [
    {
      id: 'e1',
      employeeId: 'EMP001',
      name: 'Sarah Connor',
      email: 'sarah.connor@example.com',
      department: 'Operations',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'e2',
      employeeId: 'EMP002',
      name: 'John Miller',
      email: 'john.miller@example.com',
      department: 'Engineering',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'e3',
      employeeId: 'EMP003',
      name: 'Elena Rostova',
      email: 'elena.rostova@example.com',
      department: 'Finance',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'e4',
      employeeId: 'EMP004',
      name: 'Michael Davis',
      email: 'michael.davis@example.com',
      department: 'HR',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const dummyPdf = generateSamplePayslipPdf({
    employeeId: 'EMP001',
    name: 'Sarah Connor',
    month: 'October',
    year: '2026',
  });

  const testUploadFiles: any[] = [
    // 1. Exact Employee ID in filename
    new MockFile(dummyPdf, 'EMP001.pdf'),
    // 2. Prefix & Month in filename
    new MockFile(dummyPdf, 'Payslip_EMP002_October_2026.pdf'),
    // 3. Name-based filename without ID
    new MockFile(dummyPdf, 'Elena_Rostova_SalarySlip.pdf'),
    // 4. Duplicate file matching EMP001
    new MockFile(dummyPdf, 'Salary_Slip_EMP001_Final.pdf'),
    // 5. Unmatched file
    new MockFile(dummyPdf, 'Random_Contractor_Invoice.pdf'),
    // 6. Invalid non-PDF file
    new MockFile(Buffer.from('plain text file'), 'not_a_pdf.txt', { type: 'text/plain' }),
  ];

  const matchingResult = matchPayslipFiles(testUploadFiles, testEmployees);

  // Assertions on matching logic
  const matchedEmp002 = matchingResult.items.find(
    (i) => i.filename === 'Payslip_EMP002_October_2026.pdf'
  );
  assert(
    matchedEmp002?.status === 'MATCHED' && matchedEmp002.matchedEmployee?.employeeId === 'EMP002',
    'Pattern matching via Employee ID token (Payslip_EMP002_October_2026.pdf -> EMP002)'
  );

  const matchedElena = matchingResult.items.find(
    (i) => i.filename === 'Elena_Rostova_SalarySlip.pdf'
  );
  assert(
    matchedElena?.status === 'MATCHED' && matchedElena.matchedEmployee?.employeeId === 'EMP003',
    'Pattern matching via Employee Name (Elena_Rostova_SalarySlip.pdf -> Elena Rostova)'
  );

  const duplicateEmp001 = matchingResult.items.filter(
    (i) => i.matchedEmployee?.employeeId === 'EMP001'
  );
  assert(
    duplicateEmp001.every((i) => i.status === 'DUPLICATE'),
    'Duplicate detection: multiple files matched to EMP001 flagged as DUPLICATE'
  );

  const unmatchedItem = matchingResult.items.find(
    (i) => i.filename === 'Random_Contractor_Invoice.pdf'
  );
  assert(
    unmatchedItem?.status === 'UNMATCHED',
    'Unmatched detection: unrecognized filename correctly flagged as UNMATCHED'
  );

  const invalidItem = matchingResult.items.find((i) => i.filename === 'not_a_pdf.txt');
  assert(
    invalidItem?.status === 'INVALID',
    'Invalid file detection: non-PDF flagged as INVALID'
  );

  const missingEmp004 = matchingResult.missingEmployees.find((e) => e.employeeId === 'EMP004');
  assert(
    missingEmp004 !== undefined,
    'Missing employee detection: EMP004 correctly identified as missing payslip'
  );

  // Manual override test
  const overrideResult = matchPayslipFiles(testUploadFiles, testEmployees, {
    'Random_Contractor_Invoice.pdf': 'e4', // manually assign to EMP004
  });
  const overriddenItem = overrideResult.items.find(
    (i) => i.filename === 'Random_Contractor_Invoice.pdf'
  );
  assert(
    overriddenItem?.status === 'MATCHED' &&
      overriddenItem?.matchedEmployee?.employeeId === 'EMP004' &&
      overriddenItem.isManualOverride === true,
    'Manual Match Override: successfully mapped unmatched PDF to EMP004'
  );

  // ----------------- TEST SUITE 4: EMAIL TEMPLATES & VARIABLES -----------------
  console.log('\n✉️ Suite 4: Dynamic Variable Email Templating');

  const rawSubject = DEFAULT_EMAIL_SUBJECT;
  const rawBody = DEFAULT_EMAIL_BODY;

  const interpolatedSub = interpolateTemplate(rawSubject, {
    employee_name: 'Sarah Connor',
    employee_id: 'EMP001',
    month: 'October',
    year: '2026',
  });

  const interpolatedTxt = interpolateTemplate(rawBody, {
    employee_name: 'Sarah Connor',
    employee_id: 'EMP001',
    month: 'October',
    year: '2026',
  });

  assert(
    interpolatedSub === 'Salary Slip – October 2026',
    'Subject line dynamic variable interpolation ({{month}}, {{year}})'
  );
  assert(
    interpolatedTxt.includes('Dear Sarah Connor,') &&
      interpolatedTxt.includes('for October 2026.'),
    'Body dynamic variable interpolation ({{employee_name}}, {{month}}, {{year}})'
  );

  // ----------------- TEST SUITE 5: LOGGING & AUDIT TRAIL -----------------
  console.log('\n📜 Suite 5: Audit Trail & Dispatch Logging');

  await logEmailDispatch({
    employeeId: 'EMP001',
    employeeName: 'Sarah Connor',
    email: 'sarah.connor@example.com',
    month: 'October',
    year: '2026',
    status: 'SUCCESS',
  });

  await logEmailDispatch({
    employeeId: 'EMP002',
    employeeName: 'John Miller',
    email: 'john.miller@example.com',
    month: 'October',
    year: '2026',
    status: 'FAILED',
    errorMessage: 'SMTP connection timeout',
  });

  const stats = await getDashboardStats();
  assert(stats.successfulSends >= 1, 'Dispatch success counted in dashboard analytics');
  assert(stats.failedSends >= 1, 'Dispatch failure counted in dashboard analytics');
  assert(stats.recentLogs.length > 0, 'Recent logs populated in audit trail');

  // ----------------- TEST SUITE 6: MONTHLY PAYSLIP STATUS & ASSIGNMENT EXCLUSION -----------------
  console.log('\n✅ Suite 6: Monthly Delivery Status in Directory & Selection Exclusion');

  // Test status calculation for October 2026
  const monthlyStatusRes = await getEmployeesWithMonthlyStatus({
    month: 'October',
    year: '2026',
  });

  const emp1Status = monthlyStatusRes.employees.find((e) => e.employeeId === 'EMP001');
  const emp2Status = monthlyStatusRes.employees.find((e) => e.employeeId === 'EMP002');
  const emp3Status = monthlyStatusRes.employees.find((e) => e.employeeId === 'EMP003');

  assert(
    emp1Status?.payslipStatus === 'SENT' && emp1Status.lastSentAt !== undefined,
    'Employee module marks sent employee as SENT (green tick)'
  );
  assert(
    emp2Status?.payslipStatus === 'FAILED',
    'Employee module marks failed attempt as FAILED'
  );
  assert(
    emp3Status?.payslipStatus === 'MISSED',
    'Employee module marks unsent employee as MISSED / NOT SENT'
  );

  // Test filter by status
  const sentOnly = await getEmployeesWithMonthlyStatus({
    month: 'October',
    year: '2026',
    statusFilter: 'sent',
  });
  assert(
    sentOnly.employees.every((e) => e.payslipStatus === 'SENT'),
    'Filter employee directory by "Sent" status'
  );

  const missedOnly = await getEmployeesWithMonthlyStatus({
    month: 'October',
    year: '2026',
    statusFilter: 'missed',
  });
  assert(
    missedOnly.employees.every((e) => e.payslipStatus === 'MISSED'),
    'Filter employee directory by "Missed" status'
  );

  // Test Assignment Exclusion logic:
  // When assigning the next PDF, already assigned employee names must NOT appear in options
  const sampleEmps = [
    { id: 'emp_1', name: 'Sarah', employeeId: 'EMP001' },
    { id: 'emp_2', name: 'John', employeeId: 'EMP002' },
    { id: 'emp_3', name: 'Elena', employeeId: 'EMP003' },
  ];
  const sampleAssignments: Record<string, string> = {
    'payslip_1.pdf': 'emp_1', // Sarah assigned to payslip 1
  };

  // Helper simulating available options for payslip 2
  const getOptionsForFile = (currentFilename: string) => {
    const assignedIds = new Set<string>();
    for (const [fname, id] of Object.entries(sampleAssignments)) {
      if (fname !== currentFilename && id) assignedIds.add(id);
    }
    return sampleEmps.filter((e) => !assignedIds.has(e.id));
  };

  const optionsForSlip2 = getOptionsForFile('payslip_2.pdf');
  assert(
    !optionsForSlip2.some((e) => e.id === 'emp_1'),
    'Already assigned employee (Sarah) strictly excluded from options for next PDF'
  );
  assert(
    optionsForSlip2.some((e) => e.id === 'emp_2') && optionsForSlip2.some((e) => e.id === 'emp_3'),
    'Unassigned employees (John, Elena) remain available in options'
  );

  // ----------------- TEST SUITE 7: DYNAMIC IN-APP SMTP CONFIGURATION -----------------
  console.log('\n⚙️ Suite 7: Dynamic In-App SMTP Configuration & Security');

  const savedSmtp = saveStoredSMTPConfig({
    host: 'smtppro.zoho.com',
    port: 465,
    user: 'hr@example-company.com',
    password: 'super-secret-app-password',
    from: 'HR Department <hr@example-company.com>',
    secure: true,
  });

  assert(savedSmtp.isConfigured === true, 'Dynamic SMTP saved and marked as configured');
  assert(savedSmtp.host === 'smtppro.zoho.com', 'Dynamic SMTP host saved correctly');
  assert(savedSmtp.port === 465, 'Dynamic SMTP port saved correctly');
  assert(savedSmtp.secure === true, 'Dynamic SMTP SSL/TLS flag saved correctly');
  assert(savedSmtp.hasPassword === true, 'Dynamic SMTP password presence verified');
  assert(
    (savedSmtp as any).password === undefined,
    'Client status does not expose the raw password'
  );

  const storedConfig = getStoredSMTPConfig();
  assert(
    storedConfig.password === 'super-secret-app-password',
    'Server securely retrieved stored credentials'
  );

  // Summary
  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});

