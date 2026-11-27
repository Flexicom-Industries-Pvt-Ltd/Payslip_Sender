import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import type {
  EmployeeFieldKey,
  PayslipPresetStyle,
  PayslipTemplateConfig,
} from './payslip-template-presets';
import { EMPLOYEE_FIELD_LABELS } from './payslip-template-presets';
import {
  computePayslipTotals,
  formatCurrencyAmount,
  resolveEmployeePdfPassword,
  type PayrollSlipEntry,
} from './payslip-calculator';
import type { PdfPasswordRule } from './workspace-permissions';

export interface GeneratePayslipPdfOptions {
  companyName: string;
  legalName?: string | null;
  tagline?: string | null;
  primaryColor?: string;
  logoUrl?: string | null;
  iconUrl?: string | null;
  month: string;
  year: string;
  presetStyle: PayslipPresetStyle;
  config: PayslipTemplateConfig;
  entry: PayrollSlipEntry;
  allowFormulas?: boolean;
  passwordProtect?: boolean;
  passwordRule?: PdfPasswordRule;
}

function resolveSupportedImageBuffer(src: string | null | undefined): Buffer | null {
  if (!src || typeof src !== 'string') return null;

  try {
    if (src.startsWith('data:image/')) {
      const m = src.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
      if (!m) return null; // skip webp/svg unsupported by pdfkit
      return Buffer.from(m[2], 'base64');
    }

    if (src.startsWith('/')) {
      const publicDir = path.resolve(process.cwd(), 'public');
      const resolved = path.resolve(publicDir, src.replace(/^\/+/, ''));
      if (resolved.startsWith(publicDir + path.sep) && fs.existsSync(resolved)) {
        const ext = path.extname(resolved).toLowerCase();
        if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
          return fs.readFileSync(resolved);
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

function resolvePdfLogoBuffer(
  logoUrl?: string | null,
  iconUrl?: string | null
): Buffer | null {
  return resolveSupportedImageBuffer(logoUrl) || resolveSupportedImageBuffer(iconUrl);
}

function getEmployeeFieldValue(entry: PayrollSlipEntry, key: string): string {
  switch (key) {
    case 'employeeId':
      return entry.employeeId || '-';
    case 'name':
      return entry.name || '-';
    case 'designation':
      return entry.designation || '-';
    case 'department':
      return entry.department || '-';
    case 'location':
      return entry.location || '-';
    case 'dateOfJoining':
      return entry.dateOfJoining || '-';
    case 'pan':
      return entry.pan || '-';
    case 'uan':
      return entry.uan || '-';
    case 'esicNo':
      return entry.esicNo || '-';
    case 'bankName':
      return entry.bankName || '-';
    case 'bankAccount':
      return entry.bankAccount || '-';
    case 'ifscCode':
      return entry.ifscCode || '-';
    case 'paidDays':
      return `${entry.paidDays} / ${entry.totalDays}`;
    case 'lopDays':
      return `${entry.lopDays}`;
    default:
      return '-';
  }
}

export async function generateFormattedPayslipPdf(
  opts: GeneratePayslipPdfOptions
): Promise<Buffer> {
  const {
    companyName,
    legalName,
    tagline,
    primaryColor = '#0F172A',
    logoUrl,
    iconUrl,
    month,
    year,
    presetStyle,
    config,
    entry,
    allowFormulas = true,
    passwordProtect = false,
    passwordRule = 'EMP_ID',
  } = opts;

  const totals = computePayslipTotals(entry, config, allowFormulas);
  const symbol = config.currency.symbol || 'Rs.';
  const locale = config.currency.numberFormat || 'en-IN';
  const fmt = (val: number) => formatCurrencyAmount(val, symbol, locale);

  const isMinimal = presetStyle === 'MINIMAL_LEDGER';
  const isModern = presetStyle === 'MODERN_EXECUTIVE';
  const isCompact = presetStyle === 'COMPACT_FACTORY';
  const accent = isMinimal ? '#1E293B' : primaryColor;

  const userPassword = passwordProtect
    ? resolveEmployeePdfPassword(entry, passwordRule)
    : undefined;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      info: {
        Title: `Payslip - ${entry.name} (${month} ${year})`,
        Author: legalName || companyName,
      },
      ...(userPassword
        ? {
            userPassword,
            ownerPassword: `${userPassword}_HR_ADMIN`,
            permissions: {
              printing: 'highResolution',
              copying: false,
              modifying: false,
            },
          }
        : {}),
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const leftX = 36;
    const contentW = pageW - 72;

    // Optional diagonal watermark
    if (config.header.watermarkText?.trim()) {
      doc.save();
      doc.fillColor('#E2E8F0').opacity(0.35);
      doc.font('Helvetica-Bold').fontSize(54);
      doc.rotate(-35, { origin: [pageW / 2, 420] });
      doc.text(config.header.watermarkText.trim().toUpperCase(), 60, 400, {
        align: 'center',
        width: pageW - 120,
      });
      doc.restore();
    }

    // Top accent bar for Modern Executive
    if (isModern) {
      doc.rect(0, 0, pageW, 10).fill(accent);
    }

    // Outer frame for Classic Corporate / Compact Factory
    if (!isModern && !isMinimal) {
      doc.lineWidth(0.9).strokeColor('#CBD5E1').rect(leftX, 32, contentW, doc.page.height - 64).stroke();
    }

    let cursorY = 44;
    const padX = isModern || isMinimal ? leftX : leftX + 14;
    const innerW = isModern || isMinimal ? contentW : contentW - 28;

    // HEADER BLOCK
    const logoBuf =
      config.header.logoPosition !== 'hidden'
        ? resolvePdfLogoBuffer(logoUrl, iconUrl)
        : null;

    const displayCompany = (
      config.header.showLegalName && legalName ? legalName : companyName
    ).trim();

    if (config.header.logoPosition === 'center') {
      if (logoBuf) {
        try {
          doc.image(logoBuf, pageW / 2 - 48, cursorY, { fit: [96, 36], align: 'center' });
          cursorY += 42;
        } catch {
          // ignore invalid image
        }
      }
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(15).text(displayCompany, padX, cursorY, {
        width: innerW,
        align: 'center',
      });
      cursorY += 19;
      if (config.header.showTagline && tagline) {
        doc.fillColor('#64748B').font('Helvetica').fontSize(8.5).text(tagline, padX, cursorY, {
          width: innerW,
          align: 'center',
        });
        cursorY += 12;
      }
      if (config.header.companyAddress?.trim()) {
        doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(config.header.companyAddress.trim(), padX, cursorY, {
          width: innerW,
          align: 'center',
        });
        cursorY += 11;
      }
      if (config.header.registrationLine?.trim()) {
        doc.fillColor('#475569').font('Helvetica').fontSize(7.5).text(config.header.registrationLine.trim(), padX, cursorY, {
          width: innerW,
          align: 'center',
        });
        cursorY += 11;
      }
    } else {
      const textOffsetX = logoBuf ? padX + 92 : padX;
      const textW = logoBuf ? innerW - 92 : innerW;
      const startHeaderY = cursorY;

      if (logoBuf) {
        try {
          doc.image(logoBuf, padX, cursorY, { fit: [82, 40] });
        } catch {
          // ignore
        }
      }

      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(14).text(displayCompany, textOffsetX, cursorY, {
        width: textW,
      });
      cursorY += 18;

      if (config.header.showTagline && tagline) {
        doc.fillColor('#64748B').font('Helvetica').fontSize(8.5).text(tagline, textOffsetX, cursorY, {
          width: textW,
        });
        cursorY += 12;
      }
      if (config.header.companyAddress?.trim()) {
        doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(config.header.companyAddress.trim(), textOffsetX, cursorY, {
          width: textW,
        });
        cursorY += 11;
      }
      if (config.header.registrationLine?.trim()) {
        doc.fillColor('#475569').font('Helvetica').fontSize(7.5).text(config.header.registrationLine.trim(), textOffsetX, cursorY, {
          width: textW,
        });
        cursorY += 11;
      }

      cursorY = Math.max(cursorY, startHeaderY + 44);
    }

    cursorY += 6;

    // SLIP TITLE BAND
    const rawSlipTitle = config.header.slipTitle || 'PAYSLIP FOR THE MONTH OF {{MONTH}} {{YEAR}}';
    const resolvedSlipTitle = rawSlipTitle
      .replace(/\{\{\s*month\s*\}\}/gi, month.toUpperCase())
      .replace(/\{\{\s*year\s*\}\}/gi, year)
      .toUpperCase();

    if (isModern) {
      doc.roundedRect(padX, cursorY, innerW, 24, 4).fill(accent);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9.5).text(resolvedSlipTitle, padX, cursorY + 7, {
        width: innerW,
        align: 'center',
      });
    } else if (isMinimal) {
      doc.moveTo(padX, cursorY).lineTo(padX + innerW, cursorY).lineWidth(1).strokeColor('#0F172A').stroke();
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10).text(resolvedSlipTitle, padX, cursorY + 6, {
        width: innerW,
        align: 'center',
      });
      doc.moveTo(padX, cursorY + 22).lineTo(padX + innerW, cursorY + 22).lineWidth(0.5).strokeColor('#CBD5E1').stroke();
    } else {
      doc.rect(padX, cursorY, innerW, 22).fillAndStroke('#F1F5F9', '#CBD5E1');
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9.5).text(resolvedSlipTitle, padX, cursorY + 6.5, {
        width: innerW,
        align: 'center',
      });
    }
    cursorY += 32;

    // EMPLOYEE DETAILS GRID (2 columns)
    const fields: EmployeeFieldKey[] =
      config.employeeFields.length > 0 ? config.employeeFields : ['employeeId', 'name'];
    const rowH = isCompact ? 15 : 17;
    const numRows = Math.ceil(fields.length / 2);
    const boxH = numRows * rowH + 10;

    if (!isMinimal) {
      doc.lineWidth(0.6).strokeColor('#E2E8F0').fillColor(isModern ? '#F8FAFC' : '#FFFFFF');
      doc.rect(padX, cursorY, innerW, boxH).fillAndStroke();
    }

    const colW = innerW / 2;
    let fy = cursorY + 6;
    for (let idx = 0; idx < fields.length; idx += 2) {
      const leftKey = fields[idx];
      const rightKey = fields[idx + 1];

      if (leftKey) {
        doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(`${EMPLOYEE_FIELD_LABELS[leftKey] || leftKey}:`, padX + 8, fy, {
          width: 96,
        });
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.2).text(getEmployeeFieldValue(entry, leftKey), padX + 104, fy, {
          width: colW - 112,
        });
      }

      if (rightKey) {
        const rx = padX + colW + 4;
        doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(`${EMPLOYEE_FIELD_LABELS[rightKey] || rightKey}:`, rx, fy, {
          width: 96,
        });
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.2).text(getEmployeeFieldValue(entry, rightKey), rx + 96, fy, {
          width: colW - 104,
        });
      }

      fy += rowH;
    }

    cursorY += boxH + 12;

    // EARNINGS vs DEDUCTIONS TABLE
    const halfW = innerW / 2;
    const thH = 22;

    // Header row
    doc.rect(padX, cursorY, halfW, thH).fillAndStroke(isMinimal ? '#F8FAFC' : accent, '#CBD5E1');
    doc.rect(padX + halfW, cursorY, halfW, thH).fillAndStroke(isMinimal ? '#F8FAFC' : accent, '#CBD5E1');

    const thTextCol = isMinimal ? '#0F172A' : '#FFFFFF';
    doc.fillColor(thTextCol).font('Helvetica-Bold').fontSize(8.5);
    doc.text('EARNINGS', padX + 8, cursorY + 7, { width: halfW - 95 });
    doc.text('AMOUNT', padX + halfW - 88, cursorY + 7, { width: 80, align: 'right' });

    doc.text('DEDUCTIONS', padX + halfW + 8, cursorY + 7, { width: halfW - 95 });
    doc.text('AMOUNT', padX + innerW - 88, cursorY + 7, { width: 80, align: 'right' });

    cursorY += thH;

    const maxPayRows = Math.max(totals.earningsRows.length, totals.deductionsRows.length, 1);
    const payRowH = isCompact ? 18 : 20;
    const tableBodyH = maxPayRows * payRowH;

    // Outer borders for both columns
    doc.lineWidth(0.6).strokeColor('#CBD5E1');
    doc.rect(padX, cursorY, halfW, tableBodyH).stroke();
    doc.rect(padX + halfW, cursorY, halfW, tableBodyH).stroke();

    for (let r = 0; r < maxPayRows; r++) {
      const ry = cursorY + r * payRowH;
      if (r % 2 === 1 && !isMinimal) {
        doc.rect(padX + 0.5, ry, innerW - 1, payRowH).fill('#FAFAF9');
      }

      const earn = totals.earningsRows[r];
      if (earn) {
        doc.fillColor('#1E293B').font('Helvetica').fontSize(8.3).text(earn.label, padX + 8, ry + 5.5, {
          width: halfW - 96,
        });
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.3).text(fmt(earn.amount), padX + halfW - 88, ry + 5.5, {
          width: 80,
          align: 'right',
        });
      }

      const ded = totals.deductionsRows[r];
      if (ded) {
        doc.fillColor('#1E293B').font('Helvetica').fontSize(8.3).text(ded.label, padX + halfW + 8, ry + 5.5, {
          width: halfW - 96,
        });
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.3).text(fmt(ded.amount), padX + innerW - 88, ry + 5.5, {
          width: 80,
          align: 'right',
        });
      }
    }

    cursorY += tableBodyH;

    // TOTALS ROW
    doc.rect(padX, cursorY, halfW, 22).fillAndStroke('#F1F5F9', '#CBD5E1');
    doc.rect(padX + halfW, cursorY, halfW, 22).fillAndStroke('#F1F5F9', '#CBD5E1');
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(8.5);
    doc.text('GROSS EARNINGS', padX + 8, cursorY + 7, { width: halfW - 96 });
    doc.text(fmt(totals.grossEarnings), padX + halfW - 88, cursorY + 7, { width: 80, align: 'right' });

    doc.text('TOTAL DEDUCTIONS', padX + halfW + 8, cursorY + 7, { width: halfW - 96 });
    doc.text(fmt(totals.totalDeductions), padX + innerW - 88, cursorY + 7, { width: 80, align: 'right' });

    cursorY += 32;

    // NET PAY SUMMARY CARD
    const netBoxH = config.currency.showAmountInWords ? 46 : 30;
    if (isModern) {
      doc.roundedRect(padX, cursorY, innerW, netBoxH, 5).fillAndStroke('#F8FAFC', accent);
    } else {
      doc.rect(padX, cursorY, innerW, netBoxH).fillAndStroke('#F8FAFC', '#0F172A');
    }

    doc.fillColor('#475569').font('Helvetica-Bold').fontSize(9).text('NET PAYABLE AMOUNT', padX + 12, cursorY + 10);
    doc.fillColor(accent).font('Helvetica-Bold').fontSize(13).text(fmt(totals.netPay), padX + innerW - 212, cursorY + 8, {
      width: 200,
      align: 'right',
    });

    if (config.currency.showAmountInWords) {
      doc.fillColor('#334155').font('Helvetica-Oblique').fontSize(8).text(
        `In Words: ${totals.amountInWords}`,
        padX + 12,
        cursorY + 28,
        { width: innerW - 24 }
      );
    }

    cursorY += netBoxH + 14;

    // OPTIONAL ATTENDANCE FOOTER
    if (config.footer.showAttendanceSummary) {
      doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(
        `Attendance Summary:   Total Days: ${entry.totalDays}   |   Paid Days: ${entry.paidDays}   |   LOP / Unpaid Days: ${entry.lopDays}   |   Payment Mode: Direct Bank Transfer`,
        padX,
        cursorY,
        { width: innerW }
      );
      cursorY += 18;
    }

    // SIGNATORY & DECLARATION
    if (config.footer.showSignatory) {
      const sigBuf = resolveSupportedImageBuffer(config.footer.signatoryImageUrl);
      const sigX = padX + innerW - 150;
      if (sigBuf) {
        try {
          doc.image(sigBuf, sigX + 20, cursorY, { fit: [110, 36] });
        } catch {
          // ignore
        }
      }
      doc.moveTo(sigX, cursorY + 40).lineTo(padX + innerW, cursorY + 40).lineWidth(0.5).strokeColor('#94A3B8').stroke();
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8).text(
        config.footer.signatoryLabel || 'Authorized Signatory',
        sigX,
        cursorY + 44,
        { width: 150, align: 'center' }
      );
      cursorY += 62;
    }

    if (config.footer.declarationNote?.trim()) {
      doc.fillColor('#94A3B8').font('Helvetica').fontSize(7.5).text(
        config.footer.declarationNote.trim(),
        padX,
        Math.max(cursorY + 8, doc.page.height - 64),
        { width: innerW, align: 'center' }
      );
    }

    doc.end();
  });
}
