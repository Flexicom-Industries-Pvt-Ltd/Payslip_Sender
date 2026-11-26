import { NextResponse } from 'next/server';
import { clearAuthSession, getAuthSession } from '@/lib/auth';

export async function POST() {
  await clearAuthSession();
  return NextResponse.json({ success: true, message: 'Logged out' });
}

export async function GET() {
  const session = await getAuthSession();
  return NextResponse.json({
    authenticated: session !== null,
    role: session?.role || null,
    workspaceId: session?.workspaceId || null,
  });
}
