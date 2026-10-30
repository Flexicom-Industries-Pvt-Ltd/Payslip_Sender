import { NextRequest, NextResponse } from 'next/server';
import { verifySMTPConnection } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  try {
    let customConfig = undefined;
    try {
      const body = await request.json();
      if (body && typeof body === 'object') {
        customConfig = {
          host: body.host?.trim(),
          port: body.port ? Number(body.port) : undefined,
          user: body.user?.trim(),
          password: body.password?.trim(),
          secure: body.secure !== undefined ? Boolean(body.secure) : undefined,
        };
      }
    } catch {
      // no body passed, test stored configuration
    }

    const result = await verifySMTPConnection(customConfig);
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err.message || 'Error occurred while testing SMTP connection',
      },
      { status: 500 }
    );
  }
}
