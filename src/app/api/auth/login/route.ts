import { NextRequest, NextResponse } from 'next/server';
import { verifyPasscode, setAuthSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { passcode } = await request.json();
    if (!verifyPasscode(passcode)) {
      return NextResponse.json(
        { success: false, error: 'Invalid HR administrator passcode' },
        { status: 401 }
      );
    }

    await setAuthSession();
    return NextResponse.json({ success: true, message: 'Authenticated successfully' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}

