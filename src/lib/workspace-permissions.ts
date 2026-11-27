export type PdfPasswordRule = 'EMP_ID' | 'PAN_OR_EMP_ID' | 'EMP_ID_LAST4';

export interface WorkspacePermissions {
  // 1. Payroll Input Modes
  allowExcelImport: boolean;
  allowManualSalary: boolean;
  allowDirectPdfUpload: boolean;

  // 2. Payslip Format & Designer Governance
  allowTemplateDesigner: boolean;
  allowAllMasterTemplates: boolean;
  assignedTemplateIds: string[];

  // 3. Operational & Portal Feature Locks
  allowEmployeeCrud: boolean;
  allowEmailComposer: boolean;
  allowSmtpSettings: boolean;
  allowResendSent: boolean;

  // 4. Security & Distribution Controls
  allowBulkDownload: boolean;
  requirePdfPassword: boolean;
  pdfPasswordRule: PdfPasswordRule;

  // 5. Compliance & Formulas
  requireMakerChecker: boolean;
  allowFormulaAutoCalc: boolean;

  // Saved Excel column mapping for seamless monthly re-imports
  savedExcelMapping?: Record<string, string> | null;
}

export const DEFAULT_WORKSPACE_PERMISSIONS: WorkspacePermissions = {
  allowExcelImport: true,
  allowManualSalary: true,
  allowDirectPdfUpload: true,
  allowTemplateDesigner: true,
  allowAllMasterTemplates: true,
  assignedTemplateIds: [],
  allowEmployeeCrud: true,
  allowEmailComposer: true,
  allowSmtpSettings: true,
  allowResendSent: true,
  allowBulkDownload: true,
  requirePdfPassword: false,
  pdfPasswordRule: 'EMP_ID',
  requireMakerChecker: false,
  allowFormulaAutoCalc: true,
  savedExcelMapping: null,
};

export function parseWorkspacePermissions(
  raw: string | Partial<WorkspacePermissions> | null | undefined
): WorkspacePermissions {
  if (!raw) {
    return { ...DEFAULT_WORKSPACE_PERMISSIONS };
  }

  let parsed: Partial<WorkspacePermissions> = {};
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as Partial<WorkspacePermissions>;
    } catch {
      parsed = {};
    }
  } else {
    parsed = raw;
  }

  const rule: PdfPasswordRule =
    parsed.pdfPasswordRule === 'PAN_OR_EMP_ID' || parsed.pdfPasswordRule === 'EMP_ID_LAST4'
      ? parsed.pdfPasswordRule
      : 'EMP_ID';

  return {
    allowExcelImport: parsed.allowExcelImport ?? DEFAULT_WORKSPACE_PERMISSIONS.allowExcelImport,
    allowManualSalary: parsed.allowManualSalary ?? DEFAULT_WORKSPACE_PERMISSIONS.allowManualSalary,
    allowDirectPdfUpload:
      parsed.allowDirectPdfUpload ?? DEFAULT_WORKSPACE_PERMISSIONS.allowDirectPdfUpload,
    allowTemplateDesigner:
      parsed.allowTemplateDesigner ?? DEFAULT_WORKSPACE_PERMISSIONS.allowTemplateDesigner,
    allowAllMasterTemplates:
      parsed.allowAllMasterTemplates ?? DEFAULT_WORKSPACE_PERMISSIONS.allowAllMasterTemplates,
    assignedTemplateIds: Array.isArray(parsed.assignedTemplateIds)
      ? parsed.assignedTemplateIds.filter((id): id is string => typeof id === 'string')
      : [],
    allowEmployeeCrud: parsed.allowEmployeeCrud ?? DEFAULT_WORKSPACE_PERMISSIONS.allowEmployeeCrud,
    allowEmailComposer:
      parsed.allowEmailComposer ?? DEFAULT_WORKSPACE_PERMISSIONS.allowEmailComposer,
    allowSmtpSettings: parsed.allowSmtpSettings ?? DEFAULT_WORKSPACE_PERMISSIONS.allowSmtpSettings,
    allowResendSent: parsed.allowResendSent ?? DEFAULT_WORKSPACE_PERMISSIONS.allowResendSent,
    allowBulkDownload: parsed.allowBulkDownload ?? DEFAULT_WORKSPACE_PERMISSIONS.allowBulkDownload,
    requirePdfPassword:
      parsed.requirePdfPassword ?? DEFAULT_WORKSPACE_PERMISSIONS.requirePdfPassword,
    pdfPasswordRule: rule,
    requireMakerChecker:
      parsed.requireMakerChecker ?? DEFAULT_WORKSPACE_PERMISSIONS.requireMakerChecker,
    allowFormulaAutoCalc:
      parsed.allowFormulaAutoCalc ?? DEFAULT_WORKSPACE_PERMISSIONS.allowFormulaAutoCalc,
    savedExcelMapping:
      parsed.savedExcelMapping && typeof parsed.savedExcelMapping === 'object'
        ? parsed.savedExcelMapping
        : null,
  };
}

export function serializeWorkspacePermissions(
  perms: Partial<WorkspacePermissions> | WorkspacePermissions
): string {
  return JSON.stringify(parseWorkspacePermissions(perms));
}
