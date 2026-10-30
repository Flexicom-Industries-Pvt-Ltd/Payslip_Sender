import { cookies } from 'next/headers';

const COOKIE_NAME = 'hr_auth_session';
const PASSCODE = process.env.HR_PASSCODE || 'admin123';

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  return session?.value === 'authenticated_hr_admin';
}

export async function setAuthSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, 'authenticated_hr_admin', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function verifyPasscode(input: string): boolean {
  if (!input) return false;
  return input.trim() === PASSCODE;
}

