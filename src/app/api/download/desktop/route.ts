import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const installerName = 'Sterling-Distillers-Payslip-Portal-Setup-1.0.0.exe';
    const localPath = path.join(process.cwd(), 'dist-electron', installerName);

    if (fs.existsSync(/*turbopackIgnore: true*/ localPath)) {
      const fileBuffer = fs.readFileSync(/*turbopackIgnore: true*/ localPath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.microsoft.portable-executable',
          'Content-Disposition': `attachment; filename="${installerName}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    }

    const githubReleaseUrl =
      'https://github.com/Flexicom-Industries-Pvt-Ltd/Payslip_Sender/releases/latest/download/Sterling-Distillers-Payslip-Portal-Setup-1.0.0.exe';

    return NextResponse.redirect(githubReleaseUrl, { status: 307 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unable to download installer' },
      { status: 500 }
    );
  }
}
