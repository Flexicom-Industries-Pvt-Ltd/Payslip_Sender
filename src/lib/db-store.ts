import fs from 'fs';
import path from 'path';
import os from 'os';
import { prisma } from './prisma';
import { DEFAULT_WORKSPACE_ID } from './auth';
import { deriveThemePalette, slugifyWorkspaceName } from './theme-utils';
import { buildDefaultEmailBody, DEFAULT_EMAIL_SUBJECT } from './email-templates';
import {
  DEFAULT_WORKSPACE_PERMISSIONS,
  parseWorkspacePermissions,
  serializeWorkspacePermissions,
  type WorkspacePermissions,
} from './workspace-permissions';
import {
  buildDefaultMasterTemplates,
  parsePayslipTemplateConfig,
  type PayslipPresetStyle,
  type PayslipTemplateConfig,
  type PayslipTemplateRecord,
} from './payslip-template-presets';
import type { PayrollSlipEntry } from './payslip-calculator';

export interface WorkspaceRecord {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  tagline: string | null;
  passcode: string;
  logoUrl: string | null;
  iconUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  hoverColor: string;
  lightColor: string;
  borderColor: string;
  textColor: string;
  defaultSubject: string | null;
  defaultBody: string | null;
  permissionsJson?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspacePublicBranding {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  hoverColor: string;
  lightColor: string;
  borderColor: string;
  textColor: string;
  defaultSubject: string | null;
  defaultBody: string | null;
  permissions: WorkspacePermissions;
  isActive: boolean;
}

export interface EmployeeRecord {
  id: string;
  workspaceId: string;
  employeeId: string;
  name: string;
  email: string;
  department: string | null;
  designation?: string | null;
  location?: string | null;
  dateOfJoining?: string | null;
  pan?: string | null;
  uan?: string | null;
  esicNo?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  ifscCode?: string | null;
  salaryStructureJson?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailDispatchRecord {
  id: string;
  workspaceId: string;
  employeeId: string;
  employeeName: string;
  email: string;
  month: string;
  year: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string | null;
  sentAt: Date;
  messageId?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  fromAddress?: string | null;
  subject?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  responseBody?: string | null;
  durationMs?: number | null;
  rawDetails?: string | null;
}

function getSafeDataDir(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), '.data');
  }
  return path.join(process.cwd(), '.data');
}

function ensureDataDir(): string {
  const dir = getSafeDataDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // Gracefully handle read-only environments
  }
  return dir;
}

function getLocalWorkspacesFile(): string {
  return path.join(ensureDataDir(), 'workspaces.json');
}

function getLocalEmployeesFile(): string {
  return path.join(ensureDataDir(), 'employees.json');
}

function getLocalLogsFile(): string {
  return path.join(ensureDataDir(), 'email-logs.json');
}

function getDefaultSterlingWorkspace(): WorkspaceRecord {
  const now = new Date();
  return {
    id: DEFAULT_WORKSPACE_ID,
    slug: 'sterling-distillers',
    name: 'Sterling Distillers',
    legalName: 'Sterling Distillers Private Limited',
    tagline: 'Purba Bardhaman Plant • West Bengal',
    passcode: process.env.HR_PASSCODE || 'admin123',
    logoUrl: '/sterling-logo.jpg',
    iconUrl: '/sterling-favicon.png',
    heroImageUrl: '/sterling-project-1.jpg',
    primaryColor: '#78B338',
    secondaryColor: '#221E1E',
    hoverColor: '#689F2E',
    lightColor: '#F2F8EA',
    borderColor: '#D6EDBC',
    textColor: '#3F6E15',
    defaultSubject: DEFAULT_EMAIL_SUBJECT,
    defaultBody: buildDefaultEmailBody('Sterling Distillers Private Limited'),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

function readLocalWorkspaces(): WorkspaceRecord[] {
  try {
    const file = getLocalWorkspacesFile();
    if (!fs.existsSync(file)) {
      const defaults = [getDefaultSterlingWorkspace()];
      writeLocalWorkspaces(defaults);
      return defaults;
    }
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const defaults = [getDefaultSterlingWorkspace()];
      writeLocalWorkspaces(defaults);
      return defaults;
    }
    return parsed.map((w: any) => ({
      ...w,
      createdAt: new Date(w.createdAt),
      updatedAt: new Date(w.updatedAt),
    }));
  } catch {
    return [getDefaultSterlingWorkspace()];
  }
}

function writeLocalWorkspaces(records: WorkspaceRecord[]) {
  try {
    const file = getLocalWorkspacesFile();
    fs.writeFileSync(file, JSON.stringify(records, null, 2), 'utf-8');
  } catch {
    // Gracefully ignore local file write restrictions
  }
}

function readLocalEmployees(): EmployeeRecord[] {
  try {
    const file = getLocalEmployeesFile();
    if (!fs.existsSync(file)) {
      return [];
    }
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((e: any) => ({
      ...e,
      workspaceId: e.workspaceId || DEFAULT_WORKSPACE_ID,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
    }));
  } catch {
    return [];
  }
}

function writeLocalEmployees(records: EmployeeRecord[]) {
  try {
    const file = getLocalEmployeesFile();
    fs.writeFileSync(file, JSON.stringify(records, null, 2), 'utf-8');
  } catch {
    // Gracefully ignore local file write restrictions
  }
}

function readLocalLogs(): EmailDispatchRecord[] {
  try {
    const file = getLocalLogsFile();
    if (!fs.existsSync(file)) {
      return [];
    }
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.map((log: any) => ({
      ...log,
      workspaceId: log.workspaceId || DEFAULT_WORKSPACE_ID,
      sentAt: new Date(log.sentAt),
    }));
  } catch {
    return [];
  }
}

function writeLocalLogs(records: EmailDispatchRecord[]) {
  try {
    const file = getLocalLogsFile();
    fs.writeFileSync(file, JSON.stringify(records, null, 2), 'utf-8');
  } catch {
    // Gracefully ignore local file write restrictions
  }
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
  } catch {
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

export function toPublicWorkspaceBranding(w: WorkspaceRecord): WorkspacePublicBranding {
  return {
    id: w.id,
    slug: w.slug,
    name: w.name,
    legalName: w.legalName,
    tagline: w.tagline,
    logoUrl: w.logoUrl,
    iconUrl: w.iconUrl,
    heroImageUrl: w.heroImageUrl,
    primaryColor: w.primaryColor,
    secondaryColor: w.secondaryColor || '#221E1E',
    hoverColor: w.hoverColor,
    lightColor: w.lightColor,
    borderColor: w.borderColor,
    textColor: w.textColor,
    defaultSubject: w.defaultSubject,
    defaultBody: w.defaultBody,
    permissions: parseWorkspacePermissions(w.permissionsJson),
    isActive: w.isActive,
  };
}

// ----------------- Workspace (Multi-Tenant) Operations -----------------

export async function ensureDefaultWorkspace(): Promise<WorkspaceRecord> {
  const isNeon = await isNeonPostgresActive();
  const def = getDefaultSterlingWorkspace();

  if (isNeon) {
    try {
      const existing = await prisma.workspace.findUnique({
        where: { id: DEFAULT_WORKSPACE_ID },
      });
      if (existing) return existing;

      return await prisma.workspace.create({
        data: {
          id: def.id,
          slug: def.slug,
          name: def.name,
          legalName: def.legalName,
          tagline: def.tagline,
          passcode: def.passcode,
          logoUrl: def.logoUrl,
          iconUrl: def.iconUrl,
          heroImageUrl: def.heroImageUrl,
          primaryColor: def.primaryColor,
          secondaryColor: def.secondaryColor,
          hoverColor: def.hoverColor,
          lightColor: def.lightColor,
          borderColor: def.borderColor,
          textColor: def.textColor,
          defaultSubject: def.defaultSubject,
          defaultBody: def.defaultBody,
          isActive: true,
        },
      });
    } catch {
      // fallback
    }
  }

  const list = readLocalWorkspaces();
  const found = list.find((w) => w.id === DEFAULT_WORKSPACE_ID);
  if (found) return found;
  list.unshift(def);
  writeLocalWorkspaces(list);
  return def;
}

export async function getWorkspacesWithStats() {
  await ensureDefaultWorkspace();
  const isNeon = await isNeonPostgresActive();

  if (isNeon) {
    try {
      const list = await prisma.workspace.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          _count: {
            select: {
              employees: true,
              dispatchLogs: true,
            },
          },
          smtpConfig: {
            select: {
              host: true,
              port: true,
              user: true,
            },
          },
        },
      });
      return list.map((w) => ({
        ...toPublicWorkspaceBranding(w),
        passcode: w.passcode,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        employeeCount: w._count.employees,
        dispatchCount: w._count.dispatchLogs,
        smtpConfigured: Boolean(w.smtpConfig?.host && w.smtpConfig?.user),
      }));
    } catch {
      // fallback
    }
  }

  const workspaces = readLocalWorkspaces();
  const employees = readLocalEmployees();
  const logs = readLocalLogs();
  return workspaces.map((w) => ({
    ...toPublicWorkspaceBranding(w),
    passcode: w.passcode,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    employeeCount: employees.filter((e) => e.workspaceId === w.id).length,
    dispatchCount: logs.filter((l) => l.workspaceId === w.id).length,
    smtpConfigured: false,
  }));
}

export async function getWorkspaceById(id: string): Promise<WorkspaceRecord | null> {
  if (!id) return null;
  if (id === DEFAULT_WORKSPACE_ID) {
    return await ensureDefaultWorkspace();
  }

  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.workspace.findUnique({ where: { id } });
    } catch {
      // fallback
    }
  }
  const list = readLocalWorkspaces();
  return list.find((w) => w.id === id) || null;
}

export async function getWorkspaceBySlug(slug: string): Promise<WorkspaceRecord | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  await ensureDefaultWorkspace();

  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.workspace.findUnique({ where: { slug: clean } });
    } catch {
      // fallback
    }
  }
  const list = readLocalWorkspaces();
  return list.find((w) => w.slug.toLowerCase() === clean) || null;
}

const MAX_LOGO_STRING_LENGTH = 40000;

function validateCompactImageField(value: string | null | undefined, label: string): string | null {
  const trimmed = value?.trim() || null;
  if (trimmed && trimmed.length > MAX_LOGO_STRING_LENGTH) {
    throw new Error(
      `${label} exceeds the compact database limit (${Math.round(MAX_LOGO_STRING_LENGTH / 1024)} KB). Please re-upload through the built-in optimizer.`
    );
  }
  return trimmed;
}

export async function createWorkspace(data: {
  name: string;
  slug?: string;
  legalName?: string | null;
  tagline?: string | null;
  passcode: string;
  logoUrl?: string | null;
  iconUrl?: string | null;
  heroImageUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  defaultSubject?: string | null;
  defaultBody?: string | null;
  permissions?: Partial<WorkspacePermissions>;
}): Promise<WorkspaceRecord> {
  const name = data.name.trim();
  if (!name) throw new Error('Company name is required.');

  const slug = slugifyWorkspaceName(data.slug || name);
  if (!slug) throw new Error('A valid workspace slug is required.');

  const passcode = (data.passcode || '').trim();
  if (!passcode || passcode.length < 4) {
    throw new Error('Workspace passcode must be at least 4 characters.');
  }

  const legalName = data.legalName?.trim() || name;
  const palette = deriveThemePalette(data.primaryColor || '#2563EB');
  const secondaryColor = (data.secondaryColor || '#221E1E').trim().toUpperCase();
  const defaultSubject = data.defaultSubject?.trim() || DEFAULT_EMAIL_SUBJECT;
  const defaultBody = data.defaultBody?.trim() || buildDefaultEmailBody(legalName);
  const permissionsJson = serializeWorkspacePermissions(
    data.permissions || DEFAULT_WORKSPACE_PERMISSIONS
  );
  const logoUrl = validateCompactImageField(data.logoUrl, 'Company Logo');
  const iconUrl = validateCompactImageField(data.iconUrl, 'Collapsed Icon') || logoUrl;
  const heroImageUrl = validateCompactImageField(data.heroImageUrl, 'Hero Image');

  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.workspace.create({
        data: {
          slug,
          name,
          legalName,
          tagline: data.tagline?.trim() || null,
          passcode,
          logoUrl,
          iconUrl,
          heroImageUrl,
          primaryColor: palette.primaryColor,
          secondaryColor,
          hoverColor: palette.hoverColor,
          lightColor: palette.lightColor,
          borderColor: palette.borderColor,
          textColor: palette.textColor,
          defaultSubject,
          defaultBody,
          permissionsJson,
          isActive: true,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new Error(`Workspace code "${slug}" is already in use. Please choose another slug.`);
      }
      throw err;
    }
  }

  const list = readLocalWorkspaces();
  if (list.some((w) => w.slug.toLowerCase() === slug.toLowerCase())) {
    throw new Error(`Workspace code "${slug}" is already in use.`);
  }

  const now = new Date();
  const created: WorkspaceRecord = {
    id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    slug,
    name,
    legalName,
    tagline: data.tagline?.trim() || null,
    passcode,
    logoUrl,
    iconUrl,
    heroImageUrl,
    primaryColor: palette.primaryColor,
    secondaryColor,
    hoverColor: palette.hoverColor,
    lightColor: palette.lightColor,
    borderColor: palette.borderColor,
    textColor: palette.textColor,
    defaultSubject,
    defaultBody,
    permissionsJson,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  list.push(created);
  writeLocalWorkspaces(list);
  return created;
}

export async function updateWorkspace(
  id: string,
  data: {
    name?: string;
    slug?: string;
    legalName?: string | null;
    tagline?: string | null;
    passcode?: string;
    logoUrl?: string | null;
    iconUrl?: string | null;
    heroImageUrl?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
    defaultSubject?: string | null;
    defaultBody?: string | null;
    permissions?: Partial<WorkspacePermissions>;
    isActive?: boolean;
  }
): Promise<WorkspaceRecord> {
  const existing = await getWorkspaceById(id);
  if (!existing) throw new Error('Workspace not found');

  const updatePayload: any = {};
  if (data.name !== undefined && data.name.trim()) {
    updatePayload.name = data.name.trim();
  }
  if (data.slug !== undefined && data.slug.trim()) {
    const cleanSlug = slugifyWorkspaceName(data.slug);
    if (!cleanSlug) throw new Error('Invalid workspace slug');
    updatePayload.slug = cleanSlug;
  }
  if (data.legalName !== undefined) {
    updatePayload.legalName = data.legalName?.trim() || null;
  }
  if (data.tagline !== undefined) {
    updatePayload.tagline = data.tagline?.trim() || null;
  }
  if (data.passcode !== undefined && data.passcode.trim()) {
    if (data.passcode.trim().length < 4) {
      throw new Error('Workspace passcode must be at least 4 characters.');
    }
    updatePayload.passcode = data.passcode.trim();
  }
  if (data.logoUrl !== undefined) {
    updatePayload.logoUrl = validateCompactImageField(data.logoUrl, 'Company Logo');
  }
  if (data.iconUrl !== undefined) {
    updatePayload.iconUrl = validateCompactImageField(data.iconUrl, 'Collapsed Icon');
  }
  if (data.heroImageUrl !== undefined) {
    updatePayload.heroImageUrl = validateCompactImageField(data.heroImageUrl, 'Hero Image');
  }
  if (data.defaultSubject !== undefined) updatePayload.defaultSubject = data.defaultSubject || null;
  if (data.defaultBody !== undefined) updatePayload.defaultBody = data.defaultBody || null;
  if (data.permissions !== undefined) {
    const merged = {
      ...parseWorkspacePermissions(existing.permissionsJson),
      ...data.permissions,
    };
    updatePayload.permissionsJson = serializeWorkspacePermissions(merged);
  }
  if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);

  if (data.primaryColor) {
    const palette = deriveThemePalette(data.primaryColor);
    updatePayload.primaryColor = palette.primaryColor;
    updatePayload.hoverColor = palette.hoverColor;
    updatePayload.lightColor = palette.lightColor;
    updatePayload.borderColor = palette.borderColor;
    updatePayload.textColor = palette.textColor;
  }
  if (data.secondaryColor) {
    updatePayload.secondaryColor = data.secondaryColor.trim().toUpperCase();
  }

  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.workspace.update({
        where: { id },
        data: updatePayload,
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new Error('Workspace slug is already in use by another company.');
      }
      throw err;
    }
  }

  const list = readLocalWorkspaces();
  const idx = list.findIndex((w) => w.id === id);
  if (idx === -1) throw new Error('Workspace not found');
  if (updatePayload.slug) {
    const dup = list.find((w) => w.id !== id && w.slug === updatePayload.slug);
    if (dup) throw new Error('Workspace slug is already in use by another company.');
  }
  list[idx] = {
    ...list[idx],
    ...updatePayload,
    updatedAt: new Date(),
  };
  writeLocalWorkspaces(list);
  return list[idx];
}

export async function deleteWorkspace(id: string) {
  if (id === DEFAULT_WORKSPACE_ID) {
    throw new Error('The primary default workspace cannot be deleted.');
  }

  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    return await prisma.workspace.delete({ where: { id } });
  }

  const list = readLocalWorkspaces();
  const idx = list.findIndex((w) => w.id === id);
  if (idx === -1) throw new Error('Workspace not found');
  const [deleted] = list.splice(idx, 1);
  writeLocalWorkspaces(list);

  // Clean up local employees and logs for deleted workspace
  writeLocalEmployees(readLocalEmployees().filter((e) => e.workspaceId !== id));
  writeLocalLogs(readLocalLogs().filter((l) => l.workspaceId !== id));
  return deleted;
}

// ----------------- Employee CRUD Operations (Workspace Scoped) -----------------

export async function getEmployees(
  filters?: { search?: string; department?: string },
  workspaceId: string = DEFAULT_WORKSPACE_ID
) {
  const isNeon = await isNeonPostgresActive();

  if (isNeon) {
    try {
      const where: any = { workspaceId };
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

  let list = readLocalEmployees().filter((e) => e.workspaceId === workspaceId);
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

export async function getEmployeeById(id: string, workspaceId: string = DEFAULT_WORKSPACE_ID) {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.employee.findFirst({ where: { id, workspaceId } });
    } catch {
      // fallback
    }
  }
  const list = readLocalEmployees();
  return list.find((e) => e.id === id && e.workspaceId === workspaceId) || null;
}

export async function getEmployeeByEmployeeId(
  employeeId: string,
  workspaceId: string = DEFAULT_WORKSPACE_ID
) {
  const isNeon = await isNeonPostgresActive();
  const trimmed = employeeId.trim();
  if (isNeon) {
    try {
      return await prisma.employee.findUnique({
        where: {
          workspaceId_employeeId: {
            workspaceId,
            employeeId: trimmed,
          },
        },
      });
    } catch {
      // fallback
    }
  }
  const list = readLocalEmployees();
  return (
    list.find(
      (e) =>
        e.workspaceId === workspaceId &&
        e.employeeId.toLowerCase() === trimmed.toLowerCase()
    ) || null
  );
}

export async function createEmployee(
  data: {
    employeeId: string;
    name: string;
    email: string;
    department?: string | null;
    designation?: string | null;
    location?: string | null;
    dateOfJoining?: string | null;
    pan?: string | null;
    uan?: string | null;
    esicNo?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    ifscCode?: string | null;
    salaryStructureJson?: string | null;
  },
  workspaceId: string = DEFAULT_WORKSPACE_ID
) {
  const employeeId = data.employeeId.trim();
  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const department = data.department?.trim() || null;
  const extraFields = {
    designation: data.designation?.trim() || null,
    location: data.location?.trim() || null,
    dateOfJoining: data.dateOfJoining?.trim() || null,
    pan: data.pan?.trim().toUpperCase() || null,
    uan: data.uan?.trim() || null,
    esicNo: data.esicNo?.trim() || null,
    bankName: data.bankName?.trim() || null,
    bankAccount: data.bankAccount?.trim() || null,
    ifscCode: data.ifscCode?.trim().toUpperCase() || null,
    salaryStructureJson: data.salaryStructureJson || null,
  };

  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.employee.create({
        data: {
          workspaceId,
          employeeId,
          name,
          email,
          department,
          ...extraFields,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new Error(`An employee with ID "${employeeId}" already exists in this workspace.`);
      }
      throw err;
    }
  }

  const list = readLocalEmployees();
  const existing = list.find(
    (e) =>
      e.workspaceId === workspaceId &&
      e.employeeId.toLowerCase() === employeeId.toLowerCase()
  );
  if (existing) {
    throw new Error(`An employee with ID "${employeeId}" already exists in this workspace.`);
  }

  const newRecord: EmployeeRecord = {
    id: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    workspaceId,
    employeeId,
    name,
    email,
    department,
    ...extraFields,
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
    designation?: string | null;
    location?: string | null;
    dateOfJoining?: string | null;
    pan?: string | null;
    uan?: string | null;
    esicNo?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    ifscCode?: string | null;
    salaryStructureJson?: string | null;
  },
  workspaceId: string = DEFAULT_WORKSPACE_ID
) {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      const existing = await prisma.employee.findFirst({ where: { id, workspaceId } });
      if (!existing) throw new Error('Employee not found in this workspace');

      return await prisma.employee.update({
        where: { id },
        data: {
          ...(data.employeeId ? { employeeId: data.employeeId.trim() } : {}),
          ...(data.name ? { name: data.name.trim() } : {}),
          ...(data.email ? { email: data.email.trim().toLowerCase() } : {}),
          ...(data.department !== undefined ? { department: data.department?.trim() || null } : {}),
          ...(data.designation !== undefined ? { designation: data.designation?.trim() || null } : {}),
          ...(data.location !== undefined ? { location: data.location?.trim() || null } : {}),
          ...(data.dateOfJoining !== undefined ? { dateOfJoining: data.dateOfJoining?.trim() || null } : {}),
          ...(data.pan !== undefined ? { pan: data.pan?.trim().toUpperCase() || null } : {}),
          ...(data.uan !== undefined ? { uan: data.uan?.trim() || null } : {}),
          ...(data.esicNo !== undefined ? { esicNo: data.esicNo?.trim() || null } : {}),
          ...(data.bankName !== undefined ? { bankName: data.bankName?.trim() || null } : {}),
          ...(data.bankAccount !== undefined ? { bankAccount: data.bankAccount?.trim() || null } : {}),
          ...(data.ifscCode !== undefined ? { ifscCode: data.ifscCode?.trim().toUpperCase() || null } : {}),
          ...(data.salaryStructureJson !== undefined ? { salaryStructureJson: data.salaryStructureJson || null } : {}),
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new Error(`An employee with this Employee ID already exists in this workspace.`);
      }
      throw err;
    }
  }

  const list = readLocalEmployees();
  const index = list.findIndex((e) => e.id === id && e.workspaceId === workspaceId);
  if (index === -1) {
    throw new Error('Employee not found');
  }

  if (data.employeeId) {
    const targetId = data.employeeId.trim();
    const duplicate = list.find(
      (e) =>
        e.workspaceId === workspaceId &&
        e.id !== id &&
        e.employeeId.toLowerCase() === targetId.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Employee ID "${targetId}" is already used by another employee.`);
    }
    list[index].employeeId = targetId;
  }

  if (data.name) list[index].name = data.name.trim();
  if (data.email) list[index].email = data.email.trim().toLowerCase();
  if (data.department !== undefined) list[index].department = data.department?.trim() || null;
  if (data.designation !== undefined) list[index].designation = data.designation?.trim() || null;
  if (data.location !== undefined) list[index].location = data.location?.trim() || null;
  if (data.dateOfJoining !== undefined) list[index].dateOfJoining = data.dateOfJoining?.trim() || null;
  if (data.pan !== undefined) list[index].pan = data.pan?.trim().toUpperCase() || null;
  if (data.uan !== undefined) list[index].uan = data.uan?.trim() || null;
  if (data.esicNo !== undefined) list[index].esicNo = data.esicNo?.trim() || null;
  if (data.bankName !== undefined) list[index].bankName = data.bankName?.trim() || null;
  if (data.bankAccount !== undefined) list[index].bankAccount = data.bankAccount?.trim() || null;
  if (data.ifscCode !== undefined) list[index].ifscCode = data.ifscCode?.trim().toUpperCase() || null;
  if (data.salaryStructureJson !== undefined) list[index].salaryStructureJson = data.salaryStructureJson || null;
  list[index].updatedAt = new Date();

  writeLocalEmployees(list);
  return list[index];
}

export async function deleteEmployee(
  id: string,
  workspaceId: string = DEFAULT_WORKSPACE_ID
) {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      const emp = await prisma.employee.findFirst({ where: { id, workspaceId } });
      if (!emp) throw new Error('Employee not found in this workspace');
      const deleted = await prisma.employee.delete({ where: { id } });

      await prisma.emailDispatchLog.deleteMany({
        where: {
          workspaceId,
          OR: [{ employeeId: emp.employeeId }, { email: emp.email }],
        },
      });

      return deleted;
    } catch {
      // fallback
    }
  }

  const list = readLocalEmployees();
  const index = list.findIndex((e) => e.id === id && e.workspaceId === workspaceId);
  if (index === -1) {
    throw new Error('Employee not found');
  }
  const [deleted] = list.splice(index, 1);
  writeLocalEmployees(list);

  try {
    const localLogs = readLocalLogs();
    const cleaned = localLogs.filter(
      (l) =>
        l.workspaceId !== workspaceId ||
        (l.employeeId.toLowerCase() !== deleted.employeeId.toLowerCase() &&
          l.email.toLowerCase() !== deleted.email.toLowerCase())
    );
    writeLocalLogs(cleaned);
  } catch {
    // ignore
  }

  return deleted;
}

export async function bulkUpsertEmployees(
  rows: Array<{
    employeeId: string;
    name: string;
    email: string;
    department?: string | null;
  }>,
  workspaceId: string = DEFAULT_WORKSPACE_ID
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
        const existing = await prisma.employee.findUnique({
          where: {
            workspaceId_employeeId: {
              workspaceId,
              employeeId: empId,
            },
          },
        });
        if (existing) {
          await prisma.employee.update({
            where: { id: existing.id },
            data: { name, email, department },
          });
          updatedCount++;
        } else {
          await prisma.employee.create({
            data: { workspaceId, employeeId: empId, name, email, department },
          });
          createdCount++;
        }
      } catch (err: any) {
        errors.push({ row: rowNum, employeeId: empId, error: err.message || 'Database error' });
      }
    } else {
      const list = readLocalEmployees();
      const existingIndex = list.findIndex(
        (e) =>
          e.workspaceId === workspaceId &&
          e.employeeId.toLowerCase() === empId.toLowerCase()
      );
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
          workspaceId,
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

// ----------------- Dispatch Logs Operations (Workspace Scoped) -----------------

export async function logEmailDispatch(data: {
  workspaceId?: string;
  employeeId: string;
  employeeName: string;
  email: string;
  month: string;
  year: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string | null;
  messageId?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  fromAddress?: string | null;
  subject?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  responseBody?: string | null;
  durationMs?: number | null;
  rawDetails?: string | null;
}) {
  const workspaceId = data.workspaceId || DEFAULT_WORKSPACE_ID;
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.emailDispatchLog.create({
        data: {
          workspaceId,
          employeeId: data.employeeId,
          employeeName: data.employeeName,
          email: data.email,
          month: data.month,
          year: data.year,
          status: data.status,
          errorMessage: data.errorMessage || null,
          messageId: data.messageId || null,
          smtpHost: data.smtpHost || null,
          smtpPort: data.smtpPort || null,
          fromAddress: data.fromAddress || null,
          subject: data.subject || null,
          attachmentName: data.attachmentName || null,
          attachmentSize: data.attachmentSize || null,
          responseBody: data.responseBody || null,
          durationMs: data.durationMs || null,
          rawDetails: data.rawDetails || null,
        },
      });
    } catch {
      // fallback to local log
    }
  }

  const logs = readLocalLogs();
  const newLog: EmailDispatchRecord = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    workspaceId,
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    email: data.email,
    month: data.month,
    year: data.year,
    status: data.status,
    errorMessage: data.errorMessage || null,
    sentAt: new Date(),
    messageId: data.messageId || null,
    smtpHost: data.smtpHost || null,
    smtpPort: data.smtpPort || null,
    fromAddress: data.fromAddress || null,
    subject: data.subject || null,
    attachmentName: data.attachmentName || null,
    attachmentSize: data.attachmentSize || null,
    responseBody: data.responseBody || null,
    durationMs: data.durationMs || null,
    rawDetails: data.rawDetails || null,
  };
  logs.unshift(newLog);
  if (logs.length > 1000) logs.length = 1000;
  writeLocalLogs(logs);
  return newLog;
}

export async function getEmailLogs(limit = 100, workspaceId: string = DEFAULT_WORKSPACE_ID) {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      return await prisma.emailDispatchLog.findMany({
        where: { workspaceId },
        take: limit,
        orderBy: { sentAt: 'desc' },
      });
    } catch {
      // fallback
    }
  }
  const logs = readLocalLogs().filter((l) => l.workspaceId === workspaceId);
  return logs.slice(0, limit);
}

export interface AuditLogFilterOptions {
  workspaceId?: string;
  search?: string;
  status?: 'ALL' | 'SUCCESS' | 'FAILED';
  month?: string;
  year?: string;
  limit?: number;
  offset?: number;
}

export interface EnterpriseLogMetrics {
  totalDispatches: number;
  successfulCount: number;
  failedCount: number;
  successRate: number;
  avgDurationMs: number;
  uniqueRecipients: number;
}

export async function getEnterpriseAuditLogs(options: AuditLogFilterOptions = {}) {
  const {
    workspaceId = DEFAULT_WORKSPACE_ID,
    search = '',
    status = 'ALL',
    month,
    year,
    limit = 200,
    offset = 0,
  } = options;
  const isNeon = await isNeonPostgresActive();

  if (isNeon) {
    try {
      const where: any = { workspaceId };
      if (status && status !== 'ALL') {
        where.status = status;
      }
      if (month) where.month = month;
      if (year) where.year = year;
      if (search.trim()) {
        const query = search.trim();
        where.OR = [
          { employeeName: { contains: query, mode: 'insensitive' } },
          { employeeId: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { messageId: { contains: query, mode: 'insensitive' } },
          { subject: { contains: query, mode: 'insensitive' } },
        ];
      }

      const [logs, totalCount, allLogsForMetrics] = await Promise.all([
        prisma.emailDispatchLog.findMany({
          where,
          orderBy: { sentAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.emailDispatchLog.count({ where }),
        prisma.emailDispatchLog.findMany({
          where: { workspaceId },
          select: {
            status: true,
            durationMs: true,
            email: true,
          },
        }),
      ]);

      const successfulCount = allLogsForMetrics.filter((l) => l.status === 'SUCCESS').length;
      const failedCount = allLogsForMetrics.filter((l) => l.status === 'FAILED').length;
      const totalDispatches = allLogsForMetrics.length;
      const durations = allLogsForMetrics
        .map((l) => l.durationMs)
        .filter((d): d is number => typeof d === 'number' && d > 0);
      const avgDurationMs =
        durations.length > 0
          ? Math.round(durations.reduce((acc, curr) => acc + curr, 0) / durations.length)
          : 0;
      const uniqueRecipients = new Set(allLogsForMetrics.map((l) => l.email)).size;

      return {
        logs,
        totalCount,
        metrics: {
          totalDispatches,
          successfulCount,
          failedCount,
          successRate: totalDispatches > 0 ? Math.round((successfulCount / totalDispatches) * 100) : 100,
          avgDurationMs,
          uniqueRecipients,
        },
      };
    } catch {
      // fallback
    }
  }

  let allLogs = readLocalLogs().filter((l) => l.workspaceId === workspaceId);
  if (status && status !== 'ALL') {
    allLogs = allLogs.filter((l) => l.status === status);
  }
  if (month) allLogs = allLogs.filter((l) => l.month === month);
  if (year) allLogs = allLogs.filter((l) => l.year === year);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    allLogs = allLogs.filter(
      (l) =>
        l.employeeName.toLowerCase().includes(q) ||
        l.employeeId.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.messageId && l.messageId.toLowerCase().includes(q)) ||
        (l.subject && l.subject.toLowerCase().includes(q))
    );
  }

  const totalCount = allLogs.length;
  const paginatedLogs = allLogs.slice(offset, offset + limit);

  const fullLogs = readLocalLogs().filter((l) => l.workspaceId === workspaceId);
  const successfulCount = fullLogs.filter((l) => l.status === 'SUCCESS').length;
  const failedCount = fullLogs.filter((l) => l.status === 'FAILED').length;
  const totalDispatches = fullLogs.length;
  const durations = fullLogs
    .map((l) => l.durationMs)
    .filter((d): d is number => typeof d === 'number' && d > 0);
  const avgDurationMs =
    durations.length > 0
      ? Math.round(durations.reduce((acc, curr) => acc + curr, 0) / durations.length)
      : 0;
  const uniqueRecipients = new Set(fullLogs.map((l) => l.email)).size;

  return {
    logs: paginatedLogs,
    totalCount,
    metrics: {
      totalDispatches,
      successfulCount,
      failedCount,
      successRate: totalDispatches > 0 ? Math.round((successfulCount / totalDispatches) * 100) : 100,
      avgDurationMs,
      uniqueRecipients,
    },
  };
}

export async function getDashboardStats(workspaceId: string = DEFAULT_WORKSPACE_ID) {
  const employees = await getEmployees(undefined, workspaceId);
  const logs = await getEmailLogs(200, workspaceId);

  const totalEmployees = employees.length;
  const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmailEmployees = employees.filter((e) => validEmailRegex.test(e.email)).length;

  const successfulSends = logs.filter((l) => l.status === 'SUCCESS').length;
  const failedSends = logs.filter((l) => l.status === 'FAILED').length;

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

export interface MonthStatusRecord {
  id?: string;
  month: string;
  year: string;
  status: 'SENT' | 'FAILED';
  sentAt: Date;
  errorMessage?: string | null;
}

export interface ActiveMonthSummary {
  month: string;
  year: string;
  sentCount: number;
  totalCount: number;
}

export interface EmployeeWithStatus extends EmployeeRecord {
  payslipStatus: 'SENT' | 'MISSED' | 'FAILED';
  lastSentAt?: Date | null;
  lastError?: string | null;
  yearlyStatusMap: Record<string, 'SENT' | 'FAILED'>;
  dispatchHistory: MonthStatusRecord[];
}

export async function getEmployeesWithMonthlyStatus(options?: {
  workspaceId?: string;
  search?: string;
  department?: string;
  month?: string;
  year?: string;
  statusFilter?: 'all' | 'sent' | 'missed' | 'failed';
}) {
  const workspaceId = options?.workspaceId || DEFAULT_WORKSPACE_ID;
  const month = options?.month || 'October';
  const year = options?.year || '2026';

  const employees = await getEmployees(
    {
      search: options?.search,
      department: options?.department,
    },
    workspaceId
  );

  const isNeon = await isNeonPostgresActive();
  let allLogsForYear: EmailDispatchRecord[] = [];

  if (isNeon) {
    try {
      allLogsForYear = (await prisma.emailDispatchLog.findMany({
        where: { workspaceId, year },
        orderBy: { sentAt: 'desc' },
      })) as EmailDispatchRecord[];
    } catch {
      // fallback
    }
  } else {
    const localLogs = readLocalLogs();
    allLogsForYear = localLogs.filter((l) => l.workspaceId === workspaceId && l.year === year);
  }

  const activeEmpIds = new Set(employees.map((e) => e.employeeId.toLowerCase()));
  const activeEmails = new Set(employees.map((e) => e.email.toLowerCase()));

  const activeLogsForYear = allLogsForYear.filter(
    (l) =>
      activeEmpIds.has(l.employeeId.toLowerCase()) ||
      activeEmails.has(l.email.toLowerCase())
  );

  const logsForPeriod = activeLogsForYear.filter(
    (l) => l.month.toLowerCase() === month.toLowerCase()
  );

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

  const employeeYearlyMaps = new Map<string, Record<string, 'SENT' | 'FAILED'>>();
  const employeeHistories = new Map<string, MonthStatusRecord[]>();

  for (const log of activeLogsForYear) {
    const key = log.employeeId.toLowerCase();

    if (!employeeYearlyMaps.has(key)) {
      employeeYearlyMaps.set(key, {});
    }
    const yMap = employeeYearlyMaps.get(key)!;
    if (log.status === 'SUCCESS' || !yMap[log.month]) {
      yMap[log.month] = log.status === 'SUCCESS' ? 'SENT' : 'FAILED';
    }

    if (!employeeHistories.has(key)) {
      employeeHistories.set(key, []);
    }
    employeeHistories.get(key)!.push({
      id: log.id,
      month: log.month,
      year: log.year,
      status: log.status === 'SUCCESS' ? 'SENT' : 'FAILED',
      sentAt: log.sentAt,
      errorMessage: log.errorMessage,
    });
  }

  const monthCounts = new Map<string, Set<string>>();
  if (employees.length > 0) {
    for (const log of activeLogsForYear) {
      if (log.status === 'SUCCESS') {
        if (!monthCounts.has(log.month)) {
          monthCounts.set(log.month, new Set());
        }
        monthCounts.get(log.month)!.add(log.employeeId.toLowerCase());
      }
    }
  }

  const activeMonths: ActiveMonthSummary[] =
    employees.length === 0
      ? []
      : Array.from(monthCounts.entries()).map(([m, empSet]) => ({
          month: m,
          year,
          sentCount: empSet.size,
          totalCount: employees.length,
        }));

  let enriched: EmployeeWithStatus[] = employees.map((emp) => {
    const key = emp.employeeId.toLowerCase();
    const successLog = successMap.get(key);
    const failLog = failedMap.get(key);

    const yearlyMap = employeeYearlyMaps.get(key) || {};
    const history = employeeHistories.get(key) || [];

    if (successLog) {
      return {
        ...emp,
        payslipStatus: 'SENT',
        lastSentAt: successLog.sentAt,
        yearlyStatusMap: yearlyMap,
        dispatchHistory: history,
      };
    } else if (failLog) {
      return {
        ...emp,
        payslipStatus: 'FAILED',
        lastError: failLog.errorMessage,
        yearlyStatusMap: yearlyMap,
        dispatchHistory: history,
      };
    } else {
      return {
        ...emp,
        payslipStatus: 'MISSED',
        yearlyStatusMap: yearlyMap,
        dispatchHistory: history,
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
    activeMonths,
    month,
    year,
  };
}

// ----------------- Payslip Templates (Master & Company Scoped) -----------------

export type PayrollRunStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'COMPLETED';

export interface PayrollRunRecord {
  id: string;
  workspaceId: string;
  month: string;
  year: string;
  templateId: string | null;
  sourceMode: 'EXCEL' | 'MANUAL';
  status: PayrollRunStatus;
  notes: string | null;
  entries: PayrollSlipEntry[];
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function getLocalTemplatesFile(): string {
  return path.join(ensureDataDir(), 'payslip-templates.json');
}

function getLocalPayrollRunsFile(): string {
  return path.join(ensureDataDir(), 'payroll-runs.json');
}

function readLocalTemplates(): PayslipTemplateRecord[] {
  try {
    const file = getLocalTemplatesFile();
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t: any) => ({
      ...t,
      workspaceId: t.workspaceId || null,
      presetStyle: (t.presetStyle || 'CLASSIC_CORPORATE') as PayslipPresetStyle,
      config: parsePayslipTemplateConfig(t.config || t.configJson),
      createdAt: new Date(t.createdAt),
      updatedAt: new Date(t.updatedAt),
    }));
  } catch {
    return [];
  }
}

function writeLocalTemplates(records: PayslipTemplateRecord[]) {
  try {
    fs.writeFileSync(getLocalTemplatesFile(), JSON.stringify(records, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

function readLocalPayrollRuns(): PayrollRunRecord[] {
  try {
    const file = getLocalPayrollRunsFile();
    if (!fs.existsSync(file)) return [];
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((r: any) => ({
      ...r,
      entries: Array.isArray(r.entries) ? r.entries : [],
      approvedAt: r.approvedAt ? new Date(r.approvedAt) : null,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    }));
  } catch {
    return [];
  }
}

function writeLocalPayrollRuns(records: PayrollRunRecord[]) {
  try {
    fs.writeFileSync(getLocalPayrollRunsFile(), JSON.stringify(records, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

function mapPrismaTemplate(row: any): PayslipTemplateRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId || null,
    name: row.name,
    description: row.description || null,
    presetStyle: (row.presetStyle || 'CLASSIC_CORPORATE') as PayslipPresetStyle,
    config: parsePayslipTemplateConfig(row.configJson),
    isDefault: Boolean(row.isDefault),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function ensureDefaultMasterTemplates(): Promise<PayslipTemplateRecord[]> {
  const defaults = buildDefaultMasterTemplates();
  const isNeon = await isNeonPostgresActive();

  if (isNeon) {
    try {
      const existingCount = await prisma.payslipTemplate.count({
        where: { workspaceId: null },
      });
      if (existingCount === 0) {
        for (const tpl of defaults) {
          await prisma.payslipTemplate.upsert({
            where: { id: tpl.id },
            update: {},
            create: {
              id: tpl.id,
              workspaceId: null,
              name: tpl.name,
              description: tpl.description,
              presetStyle: tpl.presetStyle,
              configJson: JSON.stringify(tpl.config),
              isDefault: tpl.isDefault,
            },
          });
        }
      }
      const rows = await prisma.payslipTemplate.findMany({
        where: { workspaceId: null },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      return rows.map(mapPrismaTemplate);
    } catch {
      // fallback
    }
  }

  let list = readLocalTemplates();
  if (!list.some((t) => t.workspaceId === null)) {
    list = [...defaults, ...list];
    writeLocalTemplates(list);
  }
  return list
    .filter((t) => t.workspaceId === null)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

export async function getAllPayslipTemplatesForAdmin(): Promise<PayslipTemplateRecord[]> {
  await ensureDefaultMasterTemplates();
  const isNeon = await isNeonPostgresActive();

  if (isNeon) {
    try {
      const rows = await prisma.payslipTemplate.findMany({
        orderBy: [{ workspaceId: 'asc' }, { isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      return rows.map(mapPrismaTemplate);
    } catch {
      // fallback
    }
  }

  return readLocalTemplates().sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

export async function getAccessibleTemplatesForWorkspace(
  workspaceId: string
): Promise<PayslipTemplateRecord[]> {
  await ensureDefaultMasterTemplates();
  const ws = await getWorkspaceById(workspaceId);
  const perms = parseWorkspacePermissions(ws?.permissionsJson);

  const isNeon = await isNeonPostgresActive();
  let allTemplates: PayslipTemplateRecord[] = [];
  if (isNeon) {
    try {
      const rows = await prisma.payslipTemplate.findMany({
        where: {
          OR: [{ workspaceId: null }, { workspaceId }],
        },
        orderBy: [{ workspaceId: 'desc' }, { isDefault: 'desc' }, { createdAt: 'asc' }],
      });
      allTemplates = rows.map(mapPrismaTemplate);
    } catch {
      allTemplates = readLocalTemplates();
    }
  } else {
    allTemplates = readLocalTemplates();
  }

  const companyOwned = allTemplates.filter((t) => t.workspaceId === workspaceId);
  const masters = allTemplates.filter((t) => t.workspaceId === null);

  let allowedMasters: PayslipTemplateRecord[];
  if (perms.allowAllMasterTemplates) {
    allowedMasters = masters;
  } else if (perms.assignedTemplateIds.length > 0) {
    const allowedSet = new Set(perms.assignedTemplateIds);
    allowedMasters = masters.filter((m) => allowedSet.has(m.id));
  } else {
    // At minimum keep the default master fallback if admin cleared everything without selecting one
    allowedMasters = masters.slice(0, 1);
  }

  const result = [...companyOwned, ...allowedMasters];
  return result.length > 0 ? result : buildDefaultMasterTemplates().slice(0, 1);
}

export async function getPayslipTemplateById(
  id: string
): Promise<PayslipTemplateRecord | null> {
  await ensureDefaultMasterTemplates();
  const isNeon = await isNeonPostgresActive();

  if (isNeon) {
    try {
      const row = await prisma.payslipTemplate.findUnique({ where: { id } });
      return row ? mapPrismaTemplate(row) : null;
    } catch {
      // fallback
    }
  }

  return readLocalTemplates().find((t) => t.id === id) || null;
}

export async function createPayslipTemplate(data: {
  workspaceId?: string | null;
  name: string;
  description?: string | null;
  presetStyle?: PayslipPresetStyle;
  config: Partial<PayslipTemplateConfig>;
  isDefault?: boolean;
}): Promise<PayslipTemplateRecord> {
  await ensureDefaultMasterTemplates();
  const cleanName = data.name.trim();
  if (!cleanName) throw new Error('Template name is required.');

  const config = parsePayslipTemplateConfig(data.config);
  const presetStyle: PayslipPresetStyle = data.presetStyle || 'CLASSIC_CORPORATE';
  const workspaceId = data.workspaceId || null;

  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    const created = await prisma.payslipTemplate.create({
      data: {
        workspaceId,
        name: cleanName,
        description: data.description?.trim() || null,
        presetStyle,
        configJson: JSON.stringify(config),
        isDefault: Boolean(data.isDefault),
      },
    });
    return mapPrismaTemplate(created);
  }

  const now = new Date();
  const record: PayslipTemplateRecord = {
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workspaceId,
    name: cleanName,
    description: data.description?.trim() || null,
    presetStyle,
    config,
    isDefault: Boolean(data.isDefault),
    createdAt: now,
    updatedAt: now,
  };
  const list = readLocalTemplates();
  list.push(record);
  writeLocalTemplates(list);
  return record;
}

export async function updatePayslipTemplate(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    presetStyle?: PayslipPresetStyle;
    config?: Partial<PayslipTemplateConfig>;
    isDefault?: boolean;
  }
): Promise<PayslipTemplateRecord> {
  const existing = await getPayslipTemplateById(id);
  if (!existing) throw new Error('Payslip template not found.');

  const nextConfig = data.config
    ? parsePayslipTemplateConfig({ ...existing.config, ...data.config })
    : existing.config;

  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    const updated = await prisma.payslipTemplate.update({
      where: { id },
      data: {
        ...(data.name?.trim() ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.presetStyle ? { presetStyle: data.presetStyle } : {}),
        ...(data.isDefault !== undefined ? { isDefault: Boolean(data.isDefault) } : {}),
        configJson: JSON.stringify(nextConfig),
      },
    });
    return mapPrismaTemplate(updated);
  }

  const list = readLocalTemplates();
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error('Payslip template not found.');
  list[idx] = {
    ...list[idx],
    ...(data.name?.trim() ? { name: data.name.trim() } : {}),
    ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
    ...(data.presetStyle ? { presetStyle: data.presetStyle } : {}),
    ...(data.isDefault !== undefined ? { isDefault: Boolean(data.isDefault) } : {}),
    config: nextConfig,
    updatedAt: new Date(),
  };
  writeLocalTemplates(list);
  return list[idx];
}

export async function deletePayslipTemplate(id: string) {
  if (id === 'tpl_classic_corporate') {
    throw new Error('Default Top Group Master Template cannot be deleted.');
  }
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    return await prisma.payslipTemplate.delete({ where: { id } });
  }
  const list = readLocalTemplates();
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error('Template not found');
  const [deleted] = list.splice(idx, 1);
  writeLocalTemplates(list);
  return deleted;
}

// ----------------- Payroll Runs & Maker-Checker Approvals -----------------

function mapPrismaPayrollRun(row: any): PayrollRunRecord {
  let entries: PayrollSlipEntry[] = [];
  try {
    const parsed = JSON.parse(row.entriesJson);
    if (Array.isArray(parsed)) entries = parsed;
  } catch {
    entries = [];
  }
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    month: row.month,
    year: row.year,
    templateId: row.templateId || null,
    sourceMode: row.sourceMode === 'EXCEL' ? 'EXCEL' : 'MANUAL',
    status: (row.status || 'DRAFT') as PayrollRunStatus,
    notes: row.notes || null,
    entries,
    approvedBy: row.approvedBy || null,
    approvedAt: row.approvedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getPayrollRuns(
  workspaceId: string,
  limit = 20
): Promise<PayrollRunRecord[]> {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      const rows = await prisma.payrollRun.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });
      return rows.map(mapPrismaPayrollRun);
    } catch {
      // fallback
    }
  }
  return readLocalPayrollRuns()
    .filter((r) => r.workspaceId === workspaceId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}

export async function getPayrollRunById(
  id: string,
  workspaceId?: string
): Promise<PayrollRunRecord | null> {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      const row = await prisma.payrollRun.findFirst({
        where: workspaceId ? { id, workspaceId } : { id },
      });
      return row ? mapPrismaPayrollRun(row) : null;
    } catch {
      // fallback
    }
  }
  return (
    readLocalPayrollRuns().find(
      (r) => r.id === id && (!workspaceId || r.workspaceId === workspaceId)
    ) || null
  );
}

export async function getPendingApprovalsForAdmin(): Promise<
  Array<PayrollRunRecord & { workspaceName: string }>
> {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    try {
      const rows = await prisma.payrollRun.findMany({
        where: { status: 'PENDING_APPROVAL' },
        include: { workspace: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
      });
      return rows.map((r) => ({
        ...mapPrismaPayrollRun(r),
        workspaceName: r.workspace?.name || r.workspaceId,
      }));
    } catch {
      // fallback
    }
  }
  const workspaces = readLocalWorkspaces();
  const wsMap = new Map(workspaces.map((w) => [w.id, w.name]));
  return readLocalPayrollRuns()
    .filter((r) => r.status === 'PENDING_APPROVAL')
    .map((r) => ({
      ...r,
      workspaceName: wsMap.get(r.workspaceId) || r.workspaceId,
    }));
}

export async function savePayrollRun(data: {
  id?: string;
  workspaceId: string;
  month: string;
  year: string;
  templateId?: string | null;
  sourceMode: 'EXCEL' | 'MANUAL';
  status?: PayrollRunStatus;
  notes?: string | null;
  entries: PayrollSlipEntry[];
}): Promise<PayrollRunRecord> {
  const isNeon = await isNeonPostgresActive();
  const entriesJson = JSON.stringify(data.entries || []);
  const nextStatus: PayrollRunStatus = data.status || 'DRAFT';

  if (isNeon) {
    if (data.id) {
      const existing = await prisma.payrollRun.findFirst({
        where: { id: data.id, workspaceId: data.workspaceId },
      });
      if (existing) {
        const updated = await prisma.payrollRun.update({
          where: { id: data.id },
          data: {
            month: data.month,
            year: data.year,
            templateId: data.templateId ?? existing.templateId,
            sourceMode: data.sourceMode,
            status: nextStatus,
            notes: data.notes ?? existing.notes,
            entriesJson,
            ...(nextStatus !== 'APPROVED' && nextStatus !== 'COMPLETED'
              ? { approvedBy: null, approvedAt: null }
              : {}),
          },
        });
        return mapPrismaPayrollRun(updated);
      }
    }

    const created = await prisma.payrollRun.create({
      data: {
        workspaceId: data.workspaceId,
        month: data.month,
        year: data.year,
        templateId: data.templateId || null,
        sourceMode: data.sourceMode,
        status: nextStatus,
        notes: data.notes || null,
        entriesJson,
      },
    });
    return mapPrismaPayrollRun(created);
  }

  const list = readLocalPayrollRuns();
  const now = new Date();
  if (data.id) {
    const idx = list.findIndex(
      (r) => r.id === data.id && r.workspaceId === data.workspaceId
    );
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        month: data.month,
        year: data.year,
        templateId: data.templateId ?? list[idx].templateId,
        sourceMode: data.sourceMode,
        status: nextStatus,
        notes: data.notes ?? list[idx].notes,
        entries: data.entries,
        updatedAt: now,
      };
      writeLocalPayrollRuns(list);
      return list[idx];
    }
  }

  const record: PayrollRunRecord = {
    id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: data.workspaceId,
    month: data.month,
    year: data.year,
    templateId: data.templateId || null,
    sourceMode: data.sourceMode,
    status: nextStatus,
    notes: data.notes || null,
    entries: data.entries,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  list.unshift(record);
  writeLocalPayrollRuns(list);
  return record;
}

export async function approvePayrollRun(
  id: string,
  approvedBy = 'Top Group Admin'
): Promise<PayrollRunRecord> {
  const isNeon = await isNeonPostgresActive();
  const now = new Date();
  if (isNeon) {
    const updated = await prisma.payrollRun.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: now,
      },
    });
    return mapPrismaPayrollRun(updated);
  }

  const list = readLocalPayrollRuns();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('Payroll run not found');
  list[idx] = {
    ...list[idx],
    status: 'APPROVED',
    approvedBy,
    approvedAt: now,
    updatedAt: now,
  };
  writeLocalPayrollRuns(list);
  return list[idx];
}

export async function deletePayrollRun(id: string, workspaceId: string) {
  const isNeon = await isNeonPostgresActive();
  if (isNeon) {
    const existing = await prisma.payrollRun.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new Error('Payroll run not found');
    return await prisma.payrollRun.delete({ where: { id } });
  }
  const list = readLocalPayrollRuns();
  const idx = list.findIndex((r) => r.id === id && r.workspaceId === workspaceId);
  if (idx === -1) throw new Error('Payroll run not found');
  const [deleted] = list.splice(idx, 1);
  writeLocalPayrollRuns(list);
  return deleted;
}

export async function getEffectiveWorkspacePermissions(
  workspaceId: string
): Promise<WorkspacePermissions> {
  const ws = await getWorkspaceById(workspaceId);
  return parseWorkspacePermissions(ws?.permissionsJson);
}

export async function checkWorkspacePermission(
  workspaceId: string,
  role: 'SUPER_ADMIN' | 'COMPANY_ADMIN',
  key: keyof WorkspacePermissions
): Promise<boolean> {
  if (role === 'SUPER_ADMIN') return true;
  const perms = await getEffectiveWorkspacePermissions(workspaceId);
  return Boolean(perms[key]);
}
