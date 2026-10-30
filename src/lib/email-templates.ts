export interface EmailTemplateVariables {
  employee_name: string;
  employee_id: string;
  month: string;
  year: string;
}

export const DEFAULT_EMAIL_SUBJECT = 'Salary Slip – {{month}} {{year}}';

export const DEFAULT_EMAIL_BODY = `Dear {{employee_name}},

Please find attached your salary slip for {{month}} {{year}}.

Should you have any queries regarding your salary, please contact the HR department.

Regards,
Human Resources Department
Sterling Distillers Private Limited`;

export const AVAILABLE_VARIABLES = [
  {
    tag: '{{employee_name}}',
    description: "Employee's full legal name (e.g. Sarah Connor)",
  },
  {
    tag: '{{employee_id}}',
    description: "Employee's unique payroll ID (e.g. EMP001)",
  },
  {
    tag: '{{month}}',
    description: 'Salary disbursement month (e.g. October)',
  },
  {
    tag: '{{year}}',
    description: 'Salary disbursement year (e.g. 2026)',
  },
];

/**
 * Replaces dynamic placeholders in subject or body with real values
 */
export function interpolateTemplate(
  template: string,
  variables: EmailTemplateVariables
): string {
  if (!template) return '';
  return template
    .replace(/\{\{\s*employee_name\s*\}\}/g, variables.employee_name || '')
    .replace(/\{\{\s*employee_id\s*\}\}/g, variables.employee_id || '')
    .replace(/\{\{\s*month\s*\}\}/g, variables.month || '')
    .replace(/\{\{\s*year\s*\}\}/g, variables.year || '');
}

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

