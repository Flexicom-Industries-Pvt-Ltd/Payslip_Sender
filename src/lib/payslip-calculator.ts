import type { PayslipTemplateConfig, PayHeadDefinition } from './payslip-template-presets';
import type { PdfPasswordRule } from './workspace-permissions';

export interface PayrollSlipEntry {
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
  totalDays: number;
  paidDays: number;
  lopDays: number;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  /** Explicit extra custom heads parsed from Excel when not in base template */
  extraEarningLabels?: Record<string, string>;
  extraDeductionLabels?: Record<string, string>;
}

export interface ComputedPayslipTotals {
  earningsRows: Array<{ key: string; label: string; amount: number }>;
  deductionsRows: Array<{ key: string; label: string; amount: number }>;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  amountInWords: string;
}

/**
 * Safe, zero-eval expression evaluator for payroll formulas.
 * Supports: + - * / ( ) comparisons (<= >= < > == !=) ternary (? :) and helpers ROUND, CEIL, FLOOR, MIN, MAX.
 */
export function evaluatePayrollFormula(
  formula: string,
  variables: Record<string, number>
): number {
  const expr = formula.trim();
  if (!expr) return 0;

  type Token =
    | { type: 'num'; val: number }
    | { type: 'id'; val: string }
    | { type: 'op'; val: string };

  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i++];
      }
      const parsed = Number(numStr);
      if (Number.isFinite(parsed)) {
        tokens.push({ type: 'num', val: parsed });
      }
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i++];
      }
      tokens.push({ type: 'id', val: id.toUpperCase() });
      continue;
    }
    const two = expr.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '==' || two === '!=') {
      tokens.push({ type: 'op', val: two });
      i += 2;
      continue;
    }
    if ('+-*/()?:,<>=!'.includes(ch)) {
      tokens.push({ type: 'op', val: ch });
      i++;
      continue;
    }
    i++;
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseTernary(): number {
    const cond = parseComparison();
    if (peek()?.type === 'op' && peek()?.val === '?') {
      consume();
      const truthy = parseTernary();
      if (peek()?.type === 'op' && peek()?.val === ':') {
        consume();
      }
      const falsy = parseTernary();
      return cond !== 0 ? truthy : falsy;
    }
    return cond;
  }

  function parseComparison(): number {
    let left = parseAdditive();
    while (peek()?.type === 'op' && ['<=', '>=', '<', '>', '==', '!='].includes(peek()!.val as string)) {
      const op = consume().val as string;
      const right = parseAdditive();
      if (op === '<=') left = left <= right ? 1 : 0;
      else if (op === '>=') left = left >= right ? 1 : 0;
      else if (op === '<') left = left < right ? 1 : 0;
      else if (op === '>') left = left > right ? 1 : 0;
      else if (op === '==') left = Math.abs(left - right) < 1e-9 ? 1 : 0;
      else if (op === '!=') left = Math.abs(left - right) >= 1e-9 ? 1 : 0;
    }
    return left;
  }

  function parseAdditive(): number {
    let left = parseMultiplicative();
    while (peek()?.type === 'op' && (peek()?.val === '+' || peek()?.val === '-')) {
      const op = consume().val;
      const right = parseMultiplicative();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseMultiplicative(): number {
    let left = parseUnary();
    while (peek()?.type === 'op' && (peek()?.val === '*' || peek()?.val === '/')) {
      const op = consume().val;
      const right = parseUnary();
      left = op === '*' ? left * right : right === 0 ? 0 : left / right;
    }
    return left;
  }

  function parseUnary(): number {
    if (peek()?.type === 'op' && peek()?.val === '-') {
      consume();
      return -parsePrimary();
    }
    if (peek()?.type === 'op' && peek()?.val === '+') {
      consume();
      return parsePrimary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const tok = peek();
    if (!tok) return 0;

    if (tok.type === 'num') {
      consume();
      return tok.val;
    }

    if (tok.type === 'op' && tok.val === '(') {
      consume();
      const val = parseTernary();
      if (peek()?.type === 'op' && peek()?.val === ')') consume();
      return val;
    }

    if (tok.type === 'id') {
      consume();
      const fnName = tok.val;
      if (peek()?.type === 'op' && peek()?.val === '(') {
        consume();
        const args: number[] = [];
        if (!(peek()?.type === 'op' && peek()?.val === ')')) {
          args.push(parseTernary());
          while (peek()?.type === 'op' && peek()?.val === ',') {
            consume();
            args.push(parseTernary());
          }
        }
        if (peek()?.type === 'op' && peek()?.val === ')') consume();

        if (fnName === 'ROUND') return Math.round(args[0] ?? 0);
        if (fnName === 'CEIL') return Math.ceil(args[0] ?? 0);
        if (fnName === 'FLOOR') return Math.floor(args[0] ?? 0);
        if (fnName === 'MIN') return args.length ? Math.min(...args) : 0;
        if (fnName === 'MAX') return args.length ? Math.max(...args) : 0;
        return 0;
      }
      return variables[fnName] ?? 0;
    }

    consume();
    return 0;
  }

  try {
    const result = parseTernary();
    return Number.isFinite(result) ? Math.max(0, Math.round(result * 100) / 100) : 0;
  } catch {
    return 0;
  }
}

export function formatCurrencyAmount(
  amount: number,
  symbol = 'Rs.',
  locale: 'en-IN' | 'en-US' = 'en-IN'
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return `${symbol} ${formatted}`;
}

export function numberToIndianWords(amount: number, currencyCode = 'INR'): string {
  const rounded = Math.round(Math.max(0, amount));
  const unitName =
    currencyCode === 'INR'
      ? 'Rupees'
      : currencyCode === 'USD'
      ? 'Dollars'
      : currencyCode === 'EUR'
      ? 'Euros'
      : 'Pounds';

  if (rounded === 0) return `Zero ${unitName} Only`;

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (n: number): string => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ' ' + ones[n % 10] : ''}`.trim();
  };

  const parts: string[] = [];
  let n = rounded;

  const crore = Math.floor(n / 10000000);
  if (crore > 0) {
    parts.push(`${twoDigits(crore)} Crore`);
    n %= 10000000;
  }
  const lakh = Math.floor(n / 100000);
  if (lakh > 0) {
    parts.push(`${twoDigits(lakh)} Lakh`);
    n %= 100000;
  }
  const thousand = Math.floor(n / 1000);
  if (thousand > 0) {
    parts.push(`${twoDigits(thousand)} Thousand`);
    n %= 1000;
  }
  const hundred = Math.floor(n / 100);
  if (hundred > 0) {
    parts.push(`${ones[hundred]} Hundred`);
    n %= 100;
  }
  if (n > 0) {
    parts.push(twoDigits(n));
  }

  return `${unitName} ${parts.join(' ').trim()} Only`;
}

export function computePayslipTotals(
  entry: PayrollSlipEntry,
  config: PayslipTemplateConfig,
  allowFormulas = true
): ComputedPayslipTotals {
  const totalDays = Math.max(1, Number(entry.totalDays) || 30);
  const paidDays = Math.min(totalDays, Math.max(0, Number(entry.paidDays) || totalDays));
  const proRataFactor = config.enableProRata ? paidDays / totalDays : 1;

  const basicRaw = Number(entry.earnings?.basic ?? 0);
  const effectiveBasic = Math.round(basicRaw * proRataFactor * 100) / 100;

  const vars: Record<string, number> = {
    TOTAL_DAYS: totalDays,
    PAID_DAYS: paidDays,
    LOP_DAYS: Math.max(0, totalDays - paidDays),
    BASIC: effectiveBasic,
  };

  for (const [k, v] of Object.entries(entry.earnings || {})) {
    vars[k.toUpperCase()] = Number(v) || 0;
  }

  const earningsRows: Array<{ key: string; label: string; amount: number }> = [];
  const seenEarnKeys = new Set<string>();

  const processEarningHead = (head: PayHeadDefinition) => {
    seenEarnKeys.add(head.key);
    const hasExplicit = entry.earnings && entry.earnings[head.key] !== undefined;
    let amount = hasExplicit ? Number(entry.earnings[head.key]) || 0 : head.defaultValue || 0;

    if (!hasExplicit && allowFormulas && head.formula) {
      amount = evaluatePayrollFormula(head.formula, vars);
    } else if (hasExplicit && config.enableProRata && paidDays < totalDays && head.key !== 'bonus' && head.key !== 'overtime') {
      // Pro-rata fixed salary heads when explicit values are base salary
      amount = Math.round(amount * proRataFactor * 100) / 100;
    }

    vars[head.key.toUpperCase()] = amount;
    earningsRows.push({ key: head.key, label: head.label, amount });
  };

  for (const head of config.earningsHeads) {
    processEarningHead(head);
  }

  // Include any extra dynamic heads imported from Excel
  for (const [key, val] of Object.entries(entry.earnings || {})) {
    if (!seenEarnKeys.has(key)) {
      const amt = Number(val) || 0;
      vars[key.toUpperCase()] = amt;
      earningsRows.push({
        key,
        label: entry.extraEarningLabels?.[key] || key,
        amount: amt,
      });
    }
  }

  const grossEarnings = Math.round(
    earningsRows.reduce((sum, r) => sum + r.amount, 0) * 100
  ) / 100;
  vars.GROSS = grossEarnings;

  const deductionsRows: Array<{ key: string; label: string; amount: number }> = [];
  const seenDedKeys = new Set<string>();

  for (const head of config.deductionsHeads) {
    seenDedKeys.add(head.key);
    const hasExplicit = entry.deductions && entry.deductions[head.key] !== undefined;
    let amount = hasExplicit ? Number(entry.deductions[head.key]) || 0 : head.defaultValue || 0;

    if (!hasExplicit && allowFormulas && head.formula) {
      amount = evaluatePayrollFormula(head.formula, vars);
    }

    vars[head.key.toUpperCase()] = amount;
    deductionsRows.push({ key: head.key, label: head.label, amount });
  }

  for (const [key, val] of Object.entries(entry.deductions || {})) {
    if (!seenDedKeys.has(key)) {
      const amt = Number(val) || 0;
      deductionsRows.push({
        key,
        label: entry.extraDeductionLabels?.[key] || key,
        amount: amt,
      });
    }
  }

  const totalDeductions = Math.round(
    deductionsRows.reduce((sum, r) => sum + r.amount, 0) * 100
  ) / 100;

  const netPay = Math.max(0, Math.round((grossEarnings - totalDeductions) * 100) / 100);
  const amountInWords = numberToIndianWords(netPay, config.currency.code);

  return {
    earningsRows,
    deductionsRows,
    grossEarnings,
    totalDeductions,
    netPay,
    amountInWords,
  };
}

export function resolveEmployeePdfPassword(
  entry: Pick<PayrollSlipEntry, 'employeeId' | 'pan'>,
  rule: PdfPasswordRule
): string {
  const cleanId = (entry.employeeId || 'EMP').trim().toUpperCase();
  const cleanPan = (entry.pan || '').trim().toUpperCase();
  if (rule === 'PAN_OR_EMP_ID') {
    return cleanPan || cleanId;
  }
  if (rule === 'EMP_ID_LAST4') {
    const suffix = cleanId.length >= 4 ? cleanId.slice(-4) : cleanId;
    return `${suffix}@2026`;
  }
  return cleanId;
}
