export type PayslipPresetStyle =
  | 'CLASSIC_CORPORATE'
  | 'MODERN_EXECUTIVE'
  | 'COMPACT_FACTORY'
  | 'MINIMAL_LEDGER';

export interface PayHeadDefinition {
  key: string;
  label: string;
  formula?: string; // e.g. "BASIC * 0.4", "MIN(BASIC * 0.12, 1800)", "GROSS <= 21000 ? GROSS * 0.0075 : 0"
  defaultValue?: number;
}

export type EmployeeFieldKey =
  | 'employeeId'
  | 'name'
  | 'designation'
  | 'department'
  | 'location'
  | 'dateOfJoining'
  | 'pan'
  | 'uan'
  | 'esicNo'
  | 'bankName'
  | 'bankAccount'
  | 'ifscCode'
  | 'paidDays'
  | 'lopDays';

export interface PayslipTemplateConfig {
  header: {
    logoPosition: 'left' | 'center' | 'hidden';
    showLegalName: boolean;
    showTagline: boolean;
    companyAddress: string;
    registrationLine: string;
    slipTitle: string;
    watermarkText: string;
  };
  currency: {
    symbol: string;
    code: 'INR' | 'USD' | 'EUR' | 'GBP';
    numberFormat: 'en-IN' | 'en-US';
    showAmountInWords: boolean;
  };
  employeeFields: EmployeeFieldKey[];
  earningsHeads: PayHeadDefinition[];
  deductionsHeads: PayHeadDefinition[];
  enableProRata: boolean;
  footer: {
    showAttendanceSummary: boolean;
    showSignatory: boolean;
    signatoryLabel: string;
    signatoryImageUrl?: string | null;
    declarationNote: string;
  };
}

export interface PayslipTemplateRecord {
  id: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  presetStyle: PayslipPresetStyle;
  config: PayslipTemplateConfig;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const EMPLOYEE_FIELD_LABELS: Record<EmployeeFieldKey, string> = {
  employeeId: 'Employee ID',
  name: 'Employee Name',
  designation: 'Designation',
  department: 'Department',
  location: 'Work Location / Plant',
  dateOfJoining: 'Date of Joining',
  pan: 'PAN Number',
  uan: 'UAN / PF No.',
  esicNo: 'ESIC Number',
  bankName: 'Bank Name',
  bankAccount: 'Bank Account No.',
  ifscCode: 'IFSC Code',
  paidDays: 'Paid Days',
  lopDays: 'LOP / Absent Days',
};

export const PRESET_STYLE_META: Array<{
  id: PayslipPresetStyle;
  name: string;
  subtitle: string;
}> = [
  {
    id: 'CLASSIC_CORPORATE',
    name: 'Classic Corporate Grid',
    subtitle: 'Traditional boxed Indian salary slip with side-by-side Earnings & Deductions',
  },
  {
    id: 'MODERN_EXECUTIVE',
    name: 'Modern Executive',
    subtitle: 'Crisp accent banner, clean spacing, and modern summary cards',
  },
  {
    id: 'COMPACT_FACTORY',
    name: 'Plant & Factory Wages',
    subtitle: 'Attendance, overtime, shift allowance, and canteen/advance focus',
  },
  {
    id: 'MINIMAL_LEDGER',
    name: 'Minimal Audit Ledger',
    subtitle: 'Print-friendly high-contrast rules with minimal color ink',
  },
];

export const DEFAULT_CONFIG_BASE: PayslipTemplateConfig = {
  header: {
    logoPosition: 'left',
    showLegalName: true,
    showTagline: true,
    companyAddress: '',
    registrationLine: '',
    slipTitle: 'PAYSLIP FOR THE MONTH OF {{MONTH}} {{YEAR}}',
    watermarkText: '',
  },
  currency: {
    symbol: 'Rs.',
    code: 'INR',
    numberFormat: 'en-IN',
    showAmountInWords: true,
  },
  employeeFields: [
    'employeeId',
    'name',
    'designation',
    'department',
    'location',
    'dateOfJoining',
    'pan',
    'uan',
    'bankName',
    'bankAccount',
    'paidDays',
    'lopDays',
  ],
  earningsHeads: [
    { key: 'basic', label: 'Basic Salary', defaultValue: 0 },
    { key: 'hra', label: 'House Rent Allowance (HRA)', formula: 'ROUND(BASIC * 0.4)', defaultValue: 0 },
    { key: 'conveyance', label: 'Conveyance Allowance', defaultValue: 1600 },
    { key: 'specialAllowance', label: 'Special Allowance', defaultValue: 0 },
    { key: 'bonus', label: 'Bonus / Incentive', defaultValue: 0 },
  ],
  deductionsHeads: [
    { key: 'pfEmployee', label: 'Provident Fund (PF)', formula: 'MIN(ROUND(BASIC * 0.12), 1800)', defaultValue: 0 },
    { key: 'esic', label: 'ESIC Contribution', formula: 'GROSS <= 21000 ? CEIL(GROSS * 0.0075) : 0', defaultValue: 0 },
    { key: 'pt', label: 'Professional Tax (PT)', defaultValue: 200 },
    { key: 'tds', label: 'Income Tax (TDS)', defaultValue: 0 },
    { key: 'otherDeductions', label: 'Advance / Other Deductions', defaultValue: 0 },
  ],
  enableProRata: true,
  footer: {
    showAttendanceSummary: true,
    showSignatory: false,
    signatoryLabel: 'Authorized Signatory',
    signatoryImageUrl: null,
    declarationNote: 'This is a system-generated payslip and does not require a physical signature.',
  },
};

export function parsePayslipTemplateConfig(
  raw: string | Partial<PayslipTemplateConfig> | null | undefined
): PayslipTemplateConfig {
  let parsed: Partial<PayslipTemplateConfig> = {};
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as Partial<PayslipTemplateConfig>;
    } catch {
      parsed = {};
    }
  } else if (raw && typeof raw === 'object') {
    parsed = raw;
  }

  return {
    header: {
      ...DEFAULT_CONFIG_BASE.header,
      ...(parsed.header || {}),
    },
    currency: {
      ...DEFAULT_CONFIG_BASE.currency,
      ...(parsed.currency || {}),
    },
    employeeFields:
      Array.isArray(parsed.employeeFields) && parsed.employeeFields.length > 0
        ? parsed.employeeFields
        : [...DEFAULT_CONFIG_BASE.employeeFields],
    earningsHeads:
      Array.isArray(parsed.earningsHeads) && parsed.earningsHeads.length > 0
        ? parsed.earningsHeads
        : [...DEFAULT_CONFIG_BASE.earningsHeads],
    deductionsHeads:
      Array.isArray(parsed.deductionsHeads) && parsed.deductionsHeads.length > 0
        ? parsed.deductionsHeads
        : [...DEFAULT_CONFIG_BASE.deductionsHeads],
    enableProRata: parsed.enableProRata ?? DEFAULT_CONFIG_BASE.enableProRata,
    footer: {
      ...DEFAULT_CONFIG_BASE.footer,
      ...(parsed.footer || {}),
    },
  };
}

export function buildDefaultMasterTemplates(): PayslipTemplateRecord[] {
  const now = new Date('2026-01-01T00:00:00Z');
  return [
    {
      id: 'tpl_classic_corporate',
      workspaceId: null,
      name: 'Top Group Classic Corporate',
      description: 'Formal two-column bordered salary slip with statutory PF, ESIC, PT, PAN & UAN',
      presetStyle: 'CLASSIC_CORPORATE',
      config: parsePayslipTemplateConfig(DEFAULT_CONFIG_BASE),
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl_modern_executive',
      workspaceId: null,
      name: 'Modern Executive Slip',
      description: 'Clean executive layout with brand-accent header strip and highlighted net pay banner',
      presetStyle: 'MODERN_EXECUTIVE',
      config: parsePayslipTemplateConfig({
        ...DEFAULT_CONFIG_BASE,
        header: {
          ...DEFAULT_CONFIG_BASE.header,
          logoPosition: 'left',
          slipTitle: 'MONTHLY SALARY STATEMENT — {{MONTH}} {{YEAR}}',
        },
      }),
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl_compact_factory',
      workspaceId: null,
      name: 'Plant & Factory Wages Slip',
      description: 'Plant floor & contractor slip featuring DA, Overtime, Shift Allowance & Canteen deductions',
      presetStyle: 'COMPACT_FACTORY',
      config: parsePayslipTemplateConfig({
        ...DEFAULT_CONFIG_BASE,
        header: {
          ...DEFAULT_CONFIG_BASE.header,
          slipTitle: 'WAGES & SALARY SLIP — {{MONTH}} {{YEAR}}',
        },
        employeeFields: [
          'employeeId',
          'name',
          'designation',
          'department',
          'location',
          'uan',
          'esicNo',
          'bankAccount',
          'paidDays',
          'lopDays',
        ],
        earningsHeads: [
          { key: 'basic', label: 'Basic Wages', defaultValue: 0 },
          { key: 'da', label: 'Dearness Allowance (DA)', defaultValue: 0 },
          { key: 'hra', label: 'HRA', formula: 'ROUND(BASIC * 0.25)', defaultValue: 0 },
          { key: 'overtime', label: 'Overtime / Shift Allowance', defaultValue: 0 },
          { key: 'attendanceBonus', label: 'Attendance Incentive', defaultValue: 0 },
        ],
        deductionsHeads: [
          { key: 'pfEmployee', label: 'PF (12%)', formula: 'MIN(ROUND(BASIC * 0.12), 1800)', defaultValue: 0 },
          { key: 'esic', label: 'ESIC (0.75%)', formula: 'GROSS <= 21000 ? CEIL(GROSS * 0.0075) : 0', defaultValue: 0 },
          { key: 'canteen', label: 'Canteen / Welfare', defaultValue: 0 },
          { key: 'advance', label: 'Salary Advance Recovery', defaultValue: 0 },
        ],
      }),
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tpl_minimal_ledger',
      workspaceId: null,
      name: 'Minimal Audit Ledger',
      description: 'Compact ink-saving format tailored for clean printing and archive filing',
      presetStyle: 'MINIMAL_LEDGER',
      config: parsePayslipTemplateConfig({
        ...DEFAULT_CONFIG_BASE,
        header: {
          ...DEFAULT_CONFIG_BASE.header,
          logoPosition: 'center',
          slipTitle: 'PAY ADVICE — {{MONTH}} {{YEAR}}',
        },
        footer: {
          ...DEFAULT_CONFIG_BASE.footer,
          showSignatory: true,
          signatoryLabel: 'HR / Accounts Signatory',
        },
      }),
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
}
