import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { logEmailDispatch } from './db-store';

export interface SMTPStoredConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  from: string;
  secure: boolean;
  updatedAt?: string;
}

export interface SMTPConfigStatus {
  isConfigured: boolean;
  host: string | null;
  port: number | null;
  user: string | null;
  from: string | null;
  secure: boolean;
  hasPassword: boolean;
  missingFields: string[];
  updatedAt?: string | null;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const CONFIG_FILE = path.join(DATA_DIR, 'smtp-config.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Loads dynamic SMTP settings saved via the web dashboard.
 * Falls back to process.env if no web configuration file exists yet.
 */
export function getStoredSMTPConfig(): SMTPStoredConfig {
  ensureDataDir();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          host: parsed.host || '',
          port: Number(parsed.port) || 587,
          user: parsed.user || '',
          password: parsed.password || '',
          from: parsed.from || '',
          secure: Boolean(parsed.secure),
          updatedAt: parsed.updatedAt || undefined,
        };
      }
    } catch {
      // fallback
    }
  }

  // Fallback to process.env
  const host = process.env.SMTP_HOST || '';
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER || '';
  const password = process.env.SMTP_PASSWORD || '';
  const from = process.env.SMTP_FROM || user || '';
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return {
    host,
    port,
    user,
    password,
    from,
    secure,
  };
}

/**
 * Saves dynamic SMTP settings submitted from the web dashboard.
 */
export function saveStoredSMTPConfig(data: {
  host: string;
  port: number;
  user: string;
  password?: string;
  from: string;
  secure?: boolean;
}): SMTPConfigStatus {
  ensureDataDir();

  const current = getStoredSMTPConfig();
  const host = data.host.trim();
  const port = Number(data.port) || (data.secure ? 465 : 587);
  const user = data.user.trim();
  // If no password provided, keep existing password
  const password = data.password !== undefined && data.password !== ''
    ? data.password.trim()
    : (current.password || '');
  const from = data.from.trim() || user;
  const secure = data.secure !== undefined ? Boolean(data.secure) : port === 465;

  const toSave: SMTPStoredConfig = {
    host,
    port,
    user,
    password,
    from,
    secure,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2), 'utf-8');

  // Also update process.env in memory for consistency
  process.env.SMTP_HOST = host;
  process.env.SMTP_PORT = String(port);
  process.env.SMTP_USER = user;
  process.env.SMTP_PASSWORD = password;
  process.env.SMTP_FROM = from;
  process.env.SMTP_SECURE = String(secure);

  return getSMTPConfigStatus();
}

/**
 * Inspects status without exposing the raw password to the client.
 */
export function getSMTPConfigStatus(): SMTPConfigStatus {
  const config = getStoredSMTPConfig();

  const missingFields: string[] = [];
  if (!config.host) missingFields.push('SMTP Host');
  if (!config.port) missingFields.push('SMTP Port');
  if (!config.user) missingFields.push('SMTP Username / Email');
  if (!config.password) missingFields.push('SMTP Password');
  if (!config.from) missingFields.push('Sender "From" Header');

  return {
    isConfigured: missingFields.length === 0,
    host: config.host || null,
    port: config.port || null,
    user: config.user || null,
    from: config.from || null,
    secure: config.secure,
    hasPassword: Boolean(config.password && config.password.length > 0),
    missingFields,
    updatedAt: config.updatedAt || null,
  };
}

export function createTransporter(overrideConfig?: Partial<SMTPStoredConfig>) {
  const baseConfig = getStoredSMTPConfig();
  const config = {
    ...baseConfig,
    ...overrideConfig,
  };

  if (!config.host || !config.user || !config.password) {
    throw new Error('SMTP host, username, and password are required.');
  }

  return nodemailer.createTransport({
    host: config.host,
    port: Number(config.port) || 587,
    secure: Boolean(config.secure),
    auth: {
      user: config.user,
      pass: config.password,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

export async function verifySMTPConnection(
  customConfig?: Partial<SMTPStoredConfig>
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const current = getStoredSMTPConfig();
    const configToTest = {
      ...current,
      ...(customConfig || {}),
      // If password not passed in test payload, use stored password
      password: customConfig?.password || current.password,
    };

    if (!configToTest.host) {
      return { success: false, message: 'Please enter the SMTP Host server address.' };
    }
    if (!configToTest.user) {
      return { success: false, message: 'Please enter the SMTP Username / Email address.' };
    }
    if (!configToTest.password) {
      return { success: false, message: 'Please enter the SMTP password or application password.' };
    }

    const transporter = createTransporter(configToTest);
    await transporter.verify();

    return {
      success: true,
      message: `SMTP connection established successfully with ${configToTest.host}:${configToTest.port}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to connect to SMTP server',
    };
  }
}

export interface SendPayslipOptions {
  to: string;
  employeeName: string;
  employeeId: string;
  month: string;
  year: string;
  subject: string;
  body: string;
  pdfBuffer: Buffer;
  filename: string;
}

export interface SendPayslipResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends a single payslip email to an individual employee with their attached PDF.
 * NEVER uses CC/BCC.
 * Verifies SMTP acceptance before reporting success.
 * In-memory buffer is discarded immediately.
 */
export async function sendPayslipEmail(options: SendPayslipOptions): Promise<SendPayslipResult> {
  const { to, employeeName, employeeId, month, year, subject, body, pdfBuffer, filename } = options;

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    const errorMsg = `Invalid recipient email address: "${to}"`;
    await logEmailDispatch({
      employeeId,
      employeeName,
      email: to || 'missing',
      month,
      year,
      status: 'FAILED',
      errorMessage: errorMsg,
    });
    return { success: false, error: errorMsg };
  }

  if (!pdfBuffer || pdfBuffer.length === 0) {
    const errorMsg = `PDF attachment is missing or empty for ${employeeName} (${employeeId})`;
    await logEmailDispatch({
      employeeId,
      employeeName,
      email: to,
      month,
      year,
      status: 'FAILED',
      errorMessage: errorMsg,
    });
    return { success: false, error: errorMsg };
  }

  try {
    const config = getStoredSMTPConfig();
    const transporter = createTransporter();
    const fromAddress = config.from || config.user;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
          <h2 style="color: #0f172a; margin: 0 0 6px 0; font-size: 18px; font-weight: 600;">Salary Slip Notification</h2>
          <span style="font-size: 13px; color: #64748b;">Period: ${month} ${year}</span>
        </div>
        <div style="white-space: pre-wrap; margin-bottom: 24px; color: #334155;">
${escapeHtml(body)}
        </div>
        <div style="padding: 12px 16px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px; color: #475569;">
          <strong>Attachment:</strong> ${escapeHtml(filename)} (Confidential Salary Slip)
        </div>
        <div style="margin-top: 24px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 12px;">
          This is an automated confidential payroll notification intended solely for ${escapeHtml(
            employeeName
          )} (${escapeHtml(employeeId)}).
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: fromAddress,
      to, // strictly individual address
      subject,
      text: body,
      html: htmlBody,
      attachments: [
        {
          filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    const accepted = Array.isArray(info.accepted) && info.accepted.length > 0;
    if (!accepted) {
      const rejectedMsg = info.rejected?.length
        ? `Recipient rejected by SMTP server: ${info.rejected.join(', ')}`
        : 'SMTP server did not confirm delivery acceptance.';
      await logEmailDispatch({
        employeeId,
        employeeName,
        email: to,
        month,
        year,
        status: 'FAILED',
        errorMessage: rejectedMsg,
      });
      return { success: false, error: rejectedMsg };
    }

    await logEmailDispatch({
      employeeId,
      employeeName,
      email: to,
      month,
      year,
      status: 'SUCCESS',
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    const errorMsg = err.message || 'SMTP delivery failed';
    await logEmailDispatch({
      employeeId,
      employeeName,
      email: to,
      month,
      year,
      status: 'FAILED',
      errorMessage: errorMsg,
    });
    return { success: false, error: errorMsg };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
