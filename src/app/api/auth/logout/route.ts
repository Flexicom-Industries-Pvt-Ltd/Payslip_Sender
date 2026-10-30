import { NextResponse } from 'next/server';
import { clearAuthSession, isAuthenticated } from '@/lib/auth';

export async function POST() {
  await clearAuthSession();
  return NextResponse.json({ success: true, message: 'Logged out' });
}

export async function GET() {
  const auth = await isAuthenticated();
  return NextResponse.json({ authenticated: auth });
}

