import { EmployeeRecord } from './db-store';

export type MatchStatus =
  | 'MATCHED'
  | 'UNMATCHED'
  | 'DUPLICATE'
  | 'INVALID';

export interface UploadedFileItem {
  id: string; // unique item id
  file: File;
  filename: string;
  fileSize: number;
  matchedEmployeeId: string | null; // matched employee.id (or employeeId)
  matchedEmployee: EmployeeRecord | null;
  status: MatchStatus;
  statusReason?: string;
  isManualOverride?: boolean;
}

export interface MatchingBatchResult {
  items: UploadedFileItem[];
  missingEmployees: EmployeeRecord[];
  matchedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  invalidCount: number;
  missingEmployeesCount: number;
}

/**
 * Normalizes a filename by stripping the extension and converting separators
 */
function cleanFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  return withoutExt.toLowerCase();
}

/**
 * Escapes string for RegExp
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if candidate text contains an exact employee ID token
 */
function matchesEmployeeId(cleanedName: string, rawFilename: string, employeeId: string): boolean {
  const normEmpId = employeeId.trim().toLowerCase();
  if (!normEmpId) return false;

  // Exact match without extension
  if (cleanedName === normEmpId) return true;

  // Word-boundary match in raw filename or cleaned name
  // Prevents "EMP1" from matching "EMP10" or "EMP101"
  const regex = new RegExp(`(^|[^a-zA-Z0-9])${escapeRegex(normEmpId)}([^a-zA-Z0-9]|$)`, 'i');
  if (regex.test(cleanedName) || regex.test(rawFilename)) {
    return true;
  }

  // Also try stripped hyphens/underscores (e.g., EMP001 matching EMP-001 or EMP_001)
  const strippedEmpId = normEmpId.replace(/[-_]/g, '');
  const strippedCleaned = cleanedName.replace(/[-_]/g, '');
  const strippedRegex = new RegExp(`(^|[^a-zA-Z0-9])${escapeRegex(strippedEmpId)}([^a-zA-Z0-9]|$)`, 'i');
  if (strippedRegex.test(strippedCleaned)) {
    return true;
  }

  return false;
}

/**
 * Checks if cleaned filename contains the full employee name
 */
function matchesEmployeeName(cleanedName: string, employeeName: string): boolean {
  const normName = employeeName.trim().toLowerCase();
  if (!normName || normName.length < 3) return false;

  // Clean both of non-alphanumeric separators into single spaces
  const nameParts = normName.split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return false;

  // Replace underscores, dashes, dots in cleaned name with spaces
  const spacedFilename = cleanedName.replace(/[-_.]+/g, ' ');

  // Full name match
  if (spacedFilename.includes(normName)) {
    return true;
  }

  // If first and last name are both present in filename
  if (nameParts.length >= 2) {
    const allPartsMatch = nameParts.every((part) => spacedFilename.includes(part));
    if (allPartsMatch) return true;
  }

  return false;
}

/**
 * Matches a list of uploaded File objects against registered employees.
 */
export function matchPayslipFiles(
  files: File[],
  employees: EmployeeRecord[],
  existingOverrides?: Record<string, string> // file.name -> employee.id
): MatchingBatchResult {
  const items: UploadedFileItem[] = [];
  const employeeUsageCount = new Map<string, number>();

  for (const file of files) {
    const itemId = `upload_${file.name}_${file.size}_${file.lastModified}`;
    const filename = file.name;
    const cleaned = cleanFilename(filename);

    // Validate PDF
    const isPdf =
      file.type === 'application/pdf' ||
      filename.toLowerCase().endsWith('.pdf');

    if (!isPdf || file.size === 0) {
      items.push({
        id: itemId,
        file,
        filename,
        fileSize: file.size,
        matchedEmployeeId: null,
        matchedEmployee: null,
        status: 'INVALID',
        statusReason: !isPdf ? 'File is not a valid PDF' : 'File is empty (0 bytes)',
      });
      continue;
    }

    // Check manual override first
    let matchedEmp: EmployeeRecord | null = null;
    let isManual = false;

    if (existingOverrides && existingOverrides[filename]) {
      const overrideEmpId = existingOverrides[filename];
      matchedEmp = employees.find((e) => e.id === overrideEmpId || e.employeeId === overrideEmpId) || null;
      if (matchedEmp) {
        isManual = true;
      }
    }

    // Auto-match by Employee ID
    if (!matchedEmp) {
      for (const emp of employees) {
        if (matchesEmployeeId(cleaned, filename, emp.employeeId)) {
          matchedEmp = emp;
          break;
        }
      }
    }

    // Auto-match by Employee Name if ID didn't match
    if (!matchedEmp) {
      for (const emp of employees) {
        if (matchesEmployeeName(cleaned, emp.name)) {
          matchedEmp = emp;
          break;
        }
      }
    }

    if (matchedEmp) {
      const currentCount = employeeUsageCount.get(matchedEmp.id) || 0;
      employeeUsageCount.set(matchedEmp.id, currentCount + 1);

      items.push({
        id: itemId,
        file,
        filename,
        fileSize: file.size,
        matchedEmployeeId: matchedEmp.id,
        matchedEmployee: matchedEmp,
        status: 'MATCHED',
        isManualOverride: isManual,
      });
    } else {
      items.push({
        id: itemId,
        file,
        filename,
        fileSize: file.size,
        matchedEmployeeId: null,
        matchedEmployee: null,
        status: 'UNMATCHED',
        statusReason: 'Could not automatically match to any registered employee',
      });
    }
  }

  // Secondary pass to detect duplicates (multiple PDFs assigned to the same employee)
  for (const item of items) {
    if (item.matchedEmployee && (employeeUsageCount.get(item.matchedEmployee.id) || 0) > 1) {
      item.status = 'DUPLICATE';
      item.statusReason = `Multiple files matched to ${item.matchedEmployee.name} (${item.matchedEmployee.employeeId})`;
    }
  }

  // Identify missing employees (registered employees with no valid matched payslip)
  const matchedEmployeeIds = new Set(
    items
      .filter((i) => i.status === 'MATCHED' && i.matchedEmployee)
      .map((i) => i.matchedEmployee!.id)
  );

  const missingEmployees = employees.filter((e) => !matchedEmployeeIds.has(e.id));

  const matchedCount = items.filter((i) => i.status === 'MATCHED').length;
  const unmatchedCount = items.filter((i) => i.status === 'UNMATCHED').length;
  const duplicateCount = items.filter((i) => i.status === 'DUPLICATE').length;
  const invalidCount = items.filter((i) => i.status === 'INVALID').length;

  return {
    items,
    missingEmployees,
    matchedCount,
    unmatchedCount,
    duplicateCount,
    invalidCount,
    missingEmployeesCount: missingEmployees.length,
  };
}

