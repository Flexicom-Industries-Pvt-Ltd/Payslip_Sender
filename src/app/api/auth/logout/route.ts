import { NextResponse } from 'next/server';
import { COOKIE_NAME, clearAuthSession, getAuthSession } from '@/lib/auth';

export async function POST() {
  await clearAuthSession();
  const response = NextResponse.json(
    { success: true, message: 'Logged out' },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  });
  return response;
}

export async function GET() {
  const session = await getAuthSession();
  return NextResponse.json(
    {
      authenticated: session !== null,
      role: session?.role || null,
      workspaceId: session?.workspaceId || null,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
