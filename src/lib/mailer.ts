import fs from 'fs';
import path from 'path';
import os from 'os';
import nodemailer from 'nodemailer';
import { prisma } from './prisma';
import { logEmailDispatch, isNeonPostgresActive } from './db-store';

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

function getSafeDataDir(): string {
  // On Vercel / AWS Lambda, process.cwd() is read-only /var/task. Use os.tmpdir()
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), '.data');
  }
  return path.join(process.cwd(), '.data');
}

function ensureDataDir() {
  try {
    const dir = getSafeDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // Ignore read-only filesystem errors gracefully
  }
}

function getConfigFile(): string {
  return path.join(getSafeDataDir(), 'smtp-config.json');
}

/**
 * Loads dynamic SMTP settings:
 * 1. Checks Neon PostgreSQL (persistent across all serverless invocations)
 * 2. Fallbacks to safe local file (if exists in /tmp or .data)
 * 3. Fallbacks to process.env
 */
export async function getStoredSMTPConfig(): Promise<SMTPStoredConfig> {
  // 1. Check Neon PostgreSQL
  try {
    const isNeon = await isNeonPostgresActive();
    if (isNeon) {
      const dbConfig = await prisma.smtpConfig.findUnique({
        where: { id: 'default' },
      });
      if (dbConfig && dbConfig.host) {
        return {
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.user,
          password: dbConfig.password,
          from: dbConfig.from,
          secure: dbConfig.secure,
          updatedAt: dbConfig.updatedAt.toISOString(),
        };
      }
    }
  } catch {
    // Neon query fallback
  }

  // 2. Check local file store
  try {
    ensureDataDir();
    const configFile = getConfigFile();
    if (fs.existsSync(configFile)) {
      const raw = fs.readFileSync(configFile, 'utf-8');
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
    }
  } catch {
    // ignore
  }

  // 3. Fallback to process.env
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
 * Saves dynamic SMTP settings:
 * 1. Persists to Neon PostgreSQL database
 * 2. Writes to safe local fallback file without crashing on read-only environments
 * 3. Updates in-memory process.env
 */
export async function saveStoredSMTPConfig(data: {
  host: string;
  port: number;
  user: string;
  password?: string;
  from: string;
  secure?: boolean;
}): Promise<SMTPConfigStatus> {
  const current = await getStoredSMTPConfig();
  const host = data.host.trim();
  const port = Number(data.port) || (data.secure ? 465 : 587);
  const user = data.user.trim();
  // If no password provided, retain existing password
  const password = data.password !== undefined && data.password !== ''
    ? data.password.trim()
    : (current.password || '');
  const from = data.from.trim() || user;
  const secure = data.secure !== undefined ? Boolean(data.secure) : port === 465;

  // 1. Persist to Neon PostgreSQL
  try {
    const isNeon = await isNeonPostgresActive();
    if (isNeon) {
      await prisma.smtpConfig.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          host,
          port,
          user,
          password,
          from,
          secure,
        },
        update: {
          host,
          port,
          user,
          password,
          from,
          secure,
        },
      });
    }
  } catch (err) {
    console.warn('Neon SMTP persistence notice:', err);
  }

  // 2. Persist to safe directory if possible
  try {
    ensureDataDir();
    const configFile = getConfigFile();
    const toSave: SMTPStoredConfig = {
      host,
      port,
      user,
      password,
      from,
      secure,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(configFile, JSON.stringify(toSave, null, 2), 'utf-8');
  } catch {
    // Gracefully ignore filesystem write restrictions on Vercel
  }

  // 3. Update process.env in memory
  process.env.SMTP_HOST = host;
  process.env.SMTP_PORT = String(port);
  process.env.SMTP_USER = user;
  process.env.SMTP_PASSWORD = password;
  process.env.SMTP_FROM = from;
  process.env.SMTP_SECURE = String(secure);

  return await getSMTPConfigStatus();
}

/**
 * Inspects status without exposing the raw password to the client.
 */
export async function getSMTPConfigStatus(): Promise<SMTPConfigStatus> {
  const config = await getStoredSMTPConfig();

  const missingFields: string[] = [];
  if (!config.host) missingFields.push('SMTP Host');
  if (!config.user) missingFields.push('SMTP Username');
  if (!config.password) missingFields.push('SMTP Password');
  if (!config.from) missingFields.push('Sender From');

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

export function createTransporter(config: SMTPStoredConfig) {
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
    const current = await getStoredSMTPConfig();
    const configToTest: SMTPStoredConfig = {
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
    const config = await getStoredSMTPConfig();
    const transporter = createTransporter(config);
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

    await logEmailDispatch({
      employeeId,
      employeeName,
      email: to,
      month,
      year,
      status: 'SUCCESS',
      errorMessage: null,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'SMTP transmission failure';
    await logEmailDispatch({
      employeeId,
      employeeName,
      email: to,
      month,
      year,
      status: 'FAILED',
      errorMessage: errorMsg,
    });

    return {
      success: false,
      error: errorMsg,
    };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
