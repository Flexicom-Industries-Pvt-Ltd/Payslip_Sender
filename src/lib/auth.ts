import { cookies } from 'next/headers';

export const COOKIE_NAME = 'hr_auth_session';
export const DEFAULT_WORKSPACE_ID = 'ws_sterling';

export type SessionRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN';

export interface AuthSession {
  role: SessionRole;
  workspaceId: string | null;
  exp: number;
}

function getSigningSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.HR_PASSCODE ||
    'sterling_multitenant_portal_secret_key_2026'
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importHmacKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSigningSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signSessionToken(payload: AuthSession): Promise<string> {
  const encoder = new TextEncoder();
  const data = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return `${data}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<AuthSession | null> {
  if (!token || !token.includes('.')) {
    return null;
  }

  try {
    const [data, sigB64] = token.split('.');
    if (!data || !sigB64) return null;

    const encoder = new TextEncoder();
    const key = await importHmacKey();
    const sigBytes = fromBase64Url(sigB64);
    const sigBuffer = new ArrayBuffer(sigBytes.length);
    new Uint8Array(sigBuffer).set(sigBytes);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuffer,
      encoder.encode(data)
    );
    if (!valid) return null;

    const decodedStr = new TextDecoder().decode(fromBase64Url(data));
    const parsed = JSON.parse(decodedStr) as AuthSession;
    if (!parsed || !parsed.role) return null;
    if (parsed.role !== 'SUPER_ADMIN' && !parsed.workspaceId) return null;
    if (parsed.exp && Date.now() > parsed.exp) return null;

    return {
      role: parsed.role,
      workspaceId: parsed.workspaceId || null,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  return verifySessionToken(sessionCookie?.value);
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getAuthSession();
  return session !== null;
}

export async function setAuthSession(params: {
  role: SessionRole;
  workspaceId: string | null;
}) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
  const token = await signSessionToken({
    role: params.role,
    workspaceId: params.workspaceId,
    exp,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function verifySuperAdminPasscode(input: string): boolean {
  if (!input) return false;
  const master = process.env.SUPER_ADMIN_PASSCODE || process.env.HR_PASSCODE || 'admin123';
  return input.trim() === master;
}
