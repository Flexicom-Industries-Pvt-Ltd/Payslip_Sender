import fs from 'fs';
import path from 'path';
import { prisma } from './prisma';

export interface EmployeeRecord {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailDispatchRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  email: string;
  month: string;
  year: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string | null;
  sentAt: Date;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const LOCAL_EMPLOYEES_FILE = path.join(DATA_DIR, 'employees.json');
const LOCAL_LOGS_FILE = path.join(DATA_DIR, 'email-logs.json');

// Ensure local fallback data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getInitialEmployees(): EmployeeRecord[] {
  return [
    {
      id: 'emp_init_001',
      employeeId: 'EMP001',
      name: 'Sarah Connor',
      email: 'sarah.connor@example.com',
      department: 'Operations',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'emp_init_002',
      employeeId: 'EMP002',
      name: 'John Miller',
      email: 'john.miller@example.com',
      department: 'Engineering',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'emp_init_003',
      employeeId: 'EMP003',
      name: 'Elena Rostova',
      email: 'elena.rostova@example.com',
      department: 'Finance',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'emp_init_004',
      employeeId: 'EMP004',
      name: 'Michael Davis',
      email: 'michael.davis@example.com',
      department: 'Human Resources',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'emp_init_005',
      employeeId: 'EMP005',
      name: 'Aisha Patel',
      email: 'aisha.patel@example.com',
      department: 'Product & Design',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

function readLocalEmployees(): EmployeeRecord[] {
  ensureDataDir();
  if (!fs.existsSync(LOCAL_EMPLOYEES_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(LOCAL_EMPLOYEES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((e: any) => ({
      ...e,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
    }));
  } catch {
    return [];
  }
}

function writeLocalEmployees(records: EmployeeRecord[]) {
  ensureDataDir();
  fs.writeFileSync(LOCAL_EMPLOYEES_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

function readLocalLogs(): EmailDispatchRecord[] {
  ensureDataDir();
  if (!fs.existsSync(LOCAL_LOGS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(LOCAL_LOGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.map((log: any) => ({
      ...log,
      sentAt: new Date(log.sentAt),
    }));
  } catch {
    return [];
  }
}

function writeLocalLogs(records: EmailDispatchRecord[]) {
  ensureDataDir();
  fs.writeFileSync(LOCAL_LOGS_FILE, JSON.stringify(records, null, 2), 'utf-8');
}

let neonConnectedCache: boolean | null = null;
let lastCheckTime = 0;

/**
 * Checks whether Neon PostgreSQL is configured and responsive.
 */
export async function isNeonPostgresActive(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('ep-sample-pooler') || !dbUrl.startsWith('postgres')) {
    return false;
  }

  const now = Date.now();
  if (neonConnectedCache !== null && now - lastCheckTime < 15000) {
    return neonConnectedCache;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    neonConnectedCache = true;
    lastCheckTime = now;
    return true;
  } catch (err) {
    neonConnectedCache = false;
    lastCheckTime = now;
    return false;
  }
}

export async function getDatabaseStatus() {
  const isNeon = await isNeonPostgresActive();
  const dbUrl = process.env.DATABASE_URL || '';
  const maskedUrl = dbUrl
    ? dbUrl.replace(/:([^:@]+)@/, ':****@')
    : 'Not configured';

  return {
    provider: isNeon ? 'Neon PostgreSQL' : 'Local Resilient Store',
    isNeon,
    connectionStringMasked: maskedUrl,
    message: isNeon
      ? 'Connected to Neon PostgreSQL cloud database.'
      : 'Local persistent store active. To connect to Neon PostgreSQL, set a valid DATABASE_URL in .env.',
  };
}

// ----------------- Employee CRUD Operations -----------------

export async function getEmployees(filters?: { search?: string; department?: string }) {
  const isNeon = await isNeonPostgresActive();

  if (isNeon) {
    try {
      const where: any = {};
      if (filters?.department && filters.department !== 'all') {
        where.department = filters.department;
      }
      if (filters?.search) {
        const query = filters.search.toLowerCase();
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { employeeId: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ];
      }
      return await prisma.employee.findMany({
        where,
        orderBy: { employeeId: 'asc' },
      });
    } catch {
      // Fallback if query fails
    }
  }

  let list = readLocalEmployees();
  if (filters?.department && filters.department !== 'all') {
    list = list.filter((e) => e.department?.toLowerCase() === filters.department?.toLowerCase());
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeId.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
    );
  }
  return list.sort((a, b) => a.employeeId.localeCompare(b.employeeId));
}

export async function getEmployeeById(id: string) {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.employee.findUnique({ where: { id } });
    } catch {
      // fallback
    }
  }
  const list = readLocalEmployees();
  return list.find((e) => e.id === id) || null;
}

export async function getEmployeeByEmployeeId(employeeId: string) {
  const isNeon = await isNeonPostgresActive();
  const trimmed = employeeId.trim();
  if (isNeon) {
    try {
      return await prisma.employee.findUnique({
        where: { employeeId: trimmed },
      });
    } catch {
      // fallback
    }
  }
  const list = readLocalEmployees();
  return list.find((e) => e.employeeId.toLowerCase() === trimmed.toLowerCase()) || null;
}

export async function createEmployee(data: {
  employeeId: string;
  name: string;
  email: string;
  department?: string | null;
}) {
  const employeeId = data.employeeId.trim();
  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const department = data.department?.trim() || null;

  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.employee.create({
        data: {
          employeeId,
          name,
          email,
          department,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new Error(`An employee with ID "${employeeId}" already exists.`);
      }
      throw err;
    }
  }

  const list = readLocalEmployees();
  const existing = list.find((e) => e.employeeId.toLowerCase() === employeeId.toLowerCase());
  if (existing) {
    throw new Error(`An employee with ID "${employeeId}" already exists.`);
  }

  const newRecord: EmployeeRecord = {
    id: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    employeeId,
    name,
    email,
    department,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  list.push(newRecord);
  writeLocalEmployees(list);
  return newRecord;
}

export async function updateEmployee(
  id: string,
  data: {
    employeeId?: string;
    name?: string;
    email?: string;
    department?: string | null;
  }
) {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.employee.update({
        where: { id },
        data: {
          ...(data.employeeId ? { employeeId: data.employeeId.trim() } : {}),
          ...(data.name ? { name: data.name.trim() } : {}),
          ...(data.email ? { email: data.email.trim().toLowerCase() } : {}),
          ...(data.department !== undefined ? { department: data.department?.trim() || null } : {}),
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new Error(`An employee with this Employee ID already exists.`);
      }
      throw err;
    }
  }

  const list = readLocalEmployees();
  const index = list.findIndex((e) => e.id === id);
  if (index === -1) {
    throw new Error('Employee not found');
  }

  if (data.employeeId) {
    const targetId = data.employeeId.trim();
    const duplicate = list.find(
      (e) => e.id !== id && e.employeeId.toLowerCase() === targetId.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Employee ID "${targetId}" is already used by another employee.`);
    }
    list[index].employeeId = targetId;
  }

  if (data.name) list[index].name = data.name.trim();
  if (data.email) list[index].email = data.email.trim().toLowerCase();
  if (data.department !== undefined) list[index].department = data.department?.trim() || null;
  list[index].updatedAt = new Date();

  writeLocalEmployees(list);
  return list[index];
}

export async function deleteEmployee(id: string) {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.employee.delete({ where: { id } });
    } catch {
      // fallback
    }
  }

  const list = readLocalEmployees();
  const index = list.findIndex((e) => e.id === id);
  if (index === -1) {
    throw new Error('Employee not found');
  }
  const [deleted] = list.splice(index, 1);
  writeLocalEmployees(list);
  return deleted;
}

export async function bulkUpsertEmployees(
  rows: Array<{
    employeeId: string;
    name: string;
    email: string;
    department?: string | null;
  }>
) {
  let createdCount = 0;
  let updatedCount = 0;
  const errors: Array<{ row: number; employeeId: string; error: string }> = [];

  const isNeon = await isNeonPostgresActive();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const empId = row.employeeId?.trim();
    const name = row.name?.trim();
    const email = row.email?.trim().toLowerCase();
    const department = row.department?.trim() || null;

    if (!empId) {
      errors.push({ row: rowNum, employeeId: '', error: 'Missing Employee ID' });
      continue;
    }
    if (!name) {
      errors.push({ row: rowNum, employeeId: empId, error: 'Missing Employee Name' });
      continue;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNum, employeeId: empId, error: `Invalid email address: ${email || 'empty'}` });
      continue;
    }

    if (isNeon) {
      try {
        const existing = await prisma.employee.findUnique({ where: { employeeId: empId } });
        if (existing) {
          await prisma.employee.update({
            where: { employeeId: empId },
            data: { name, email, department },
          });
          updatedCount++;
        } else {
          await prisma.employee.create({
            data: { employeeId: empId, name, email, department },
          });
          createdCount++;
        }
      } catch (err: any) {
        errors.push({ row: rowNum, employeeId: empId, error: err.message || 'Database error' });
      }
    } else {
      const list = readLocalEmployees();
      const existingIndex = list.findIndex((e) => e.employeeId.toLowerCase() === empId.toLowerCase());
      if (existingIndex >= 0) {
        list[existingIndex] = {
          ...list[existingIndex],
          name,
          email,
          department,
          updatedAt: new Date(),
        };
        updatedCount++;
      } else {
        list.push({
          id: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          employeeId: empId,
          name,
          email,
          department,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        createdCount++;
      }
      writeLocalEmployees(list);
    }
  }

  return { createdCount, updatedCount, errors };
}

// ----------------- Dispatch Logs Operations -----------------

export async function logEmailDispatch(data: {
  employeeId: string;
  employeeName: string;
  email: string;
  month: string;
  year: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string | null;
}) {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.emailDispatchLog.create({
        data: {
          employeeId: data.employeeId,
          employeeName: data.employeeName,
          email: data.email,
          month: data.month,
          year: data.year,
          status: data.status,
          errorMessage: data.errorMessage || null,
        },
      });
    } catch {
      // fallback to local log
    }
  }

  const logs = readLocalLogs();
  const newLog: EmailDispatchRecord = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    email: data.email,
    month: data.month,
    year: data.year,
    status: data.status,
    errorMessage: data.errorMessage || null,
    sentAt: new Date(),
  };
  logs.unshift(newLog); // latest first
  // Keep last 500 logs
  if (logs.length > 500) logs.length = 500;
  writeLocalLogs(logs);
  return newLog;
}

export async function getEmailLogs(limit = 100) {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.emailDispatchLog.findMany({
        take: limit,
        orderBy: { sentAt: 'desc' },
      });
    } catch {
      // fallback
    }
  }
  const logs = readLocalLogs();
  return logs.slice(0, limit);
}

export async function getDashboardStats() {
  const employees = await getEmployees();
  const logs = await getEmailLogs(200);

  const totalEmployees = employees.length;
  const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmailEmployees = employees.filter((e) => validEmailRegex.test(e.email)).length;

  const successfulSends = logs.filter((l) => l.status === 'SUCCESS').length;
  const failedSends = logs.filter((l) => l.status === 'FAILED').length;

  // Unique departments
  const departments = Array.from(
    new Set(employees.map((e) => e.department).filter(Boolean) as string[])
  );

  return {
    totalEmployees,
    validEmailEmployees,
    invalidEmailEmployees: totalEmployees - validEmailEmployees,
    departments,
    successfulSends,
    failedSends,
    recentLogs: logs.slice(0, 10),
  };
}

export interface EmployeeWithStatus extends EmployeeRecord {
  payslipStatus: 'SENT' | 'MISSED' | 'FAILED';
  lastSentAt?: Date | null;
  lastError?: string | null;
}

export async function getEmployeesWithMonthlyStatus(options?: {
  search?: string;
  department?: string;
  month?: string;
  year?: string;
  statusFilter?: 'all' | 'sent' | 'missed' | 'failed';
}) {
  const month = options?.month || 'October';
  const year = options?.year || '2026';

  const employees = await getEmployees({
    search: options?.search,
    department: options?.department,
  });

  const isNeon = await isNeonPostgresActive();
  let logsForPeriod: EmailDispatchRecord[] = [];

  if (isNeon) {
    try {
      logsForPeriod = (await prisma.emailDispatchLog.findMany({
        where: { month, year },
        orderBy: { sentAt: 'desc' },
      })) as EmailDispatchRecord[];
    } catch {
      // fallback
    }
  }

  if (logsForPeriod.length === 0) {
    const localLogs = readLocalLogs();
    logsForPeriod = localLogs.filter(
      (l) => l.month.toLowerCase() === month.toLowerCase() && l.year === year
    );
  }

  // Create lookup maps
  const successMap = new Map<string, EmailDispatchRecord>();
  const failedMap = new Map<string, EmailDispatchRecord>();

  for (const log of logsForPeriod) {
    const key = log.employeeId.toLowerCase();
    if (log.status === 'SUCCESS' && !successMap.has(key)) {
      successMap.set(key, log);
    } else if (log.status === 'FAILED' && !failedMap.has(key)) {
      failedMap.set(key, log);
    }
  }

  let enriched: EmployeeWithStatus[] = employees.map((emp) => {
    const key = emp.employeeId.toLowerCase();
    const successLog = successMap.get(key);
    const failLog = failedMap.get(key);

    if (successLog) {
      return {
        ...emp,
        payslipStatus: 'SENT',
        lastSentAt: successLog.sentAt,
      };
    } else if (failLog) {
      return {
        ...emp,
        payslipStatus: 'FAILED',
        lastError: failLog.errorMessage,
      };
    } else {
      return {
        ...emp,
        payslipStatus: 'MISSED',
      };
    }
  });

  const total = enriched.length;
  const sentCount = enriched.filter((e) => e.payslipStatus === 'SENT').length;
  const missedCount = enriched.filter((e) => e.payslipStatus === 'MISSED').length;
  const failedCount = enriched.filter((e) => e.payslipStatus === 'FAILED').length;

  if (options?.statusFilter && options.statusFilter !== 'all') {
    const target = options.statusFilter.toUpperCase();
    enriched = enriched.filter((e) => e.payslipStatus === target);
  }

  return {
    employees: enriched,
    counts: {
      total,
      sentCount,
      missedCount,
      failedCount,
    },
    month,
    year,
  };
}

