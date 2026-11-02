import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const installerName = 'Sterling-Distillers-Payslip-Portal-Setup-1.0.0.exe';
    const localPath = path.join(process.cwd(), 'dist-electron', installerName);

    // If running in local environment where built installer file is present
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

    // Direct GitHub release binary URL (hosted on high-speed CDN)
    const releaseDownloadUrl =
      'https://github.com/Flexicom-Industries-Pvt-Ltd/Payslip_Sender/releases/download/v1.0.0/Sterling-Distillers-Payslip-Portal-Setup-1.0.0.exe';

    return NextResponse.redirect(releaseDownloadUrl, { status: 302 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unable to download installer' },
      { status: 500 }
    );
  }
}
