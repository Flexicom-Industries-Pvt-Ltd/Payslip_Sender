import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getWorkspaceBySlug, ensureDefaultWorkspace } from '@/lib/db-store';
import { generateSolidRoundedPng } from '@/lib/png-generator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug')?.trim();
    const sizeParam = Number(searchParams.get('size')) || 192;
    const size = Math.min(512, Math.max(64, sizeParam));
    const requirePng = searchParams.get('png') === 'true';

    let ws = slug ? await getWorkspaceBySlug(slug) : null;
    if (!ws && (!slug || slug === 'sterling-distillers')) {
      ws = await ensureDefaultWorkspace();
    }

    const iconSource = ws?.iconUrl || ws?.logoUrl || '';
    const primaryColor = ws?.primaryColor || '#2563EB';

    // 1. Handle Base64 data URI stored in Neon DB
    if (iconSource.startsWith('data:image/')) {
      const match = iconSource.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const b64 = match[2];
        // Chrome PWA manifest requires PNG; if non-PNG and png=true, return crisp generated PNG fallback
        if (!requirePng || mime === 'image/png') {
          const buf = Buffer.from(b64, 'base64');
          return new NextResponse(new Uint8Array(buf), {
            status: 200,
            headers: {
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
      }
    }

    // 2. Handle local static path inside public/ (e.g. /sterling-favicon.png)
    if (iconSource.startsWith('/')) {
      const publicDir = path.resolve(process.cwd(), 'public');
      const relative = iconSource.replace(/^\/+/, '');
      const resolved = path.resolve(publicDir, relative);
      if (resolved.startsWith(publicDir + path.sep) && fs.existsSync(resolved)) {
        const ext = path.extname(resolved).toLowerCase();
        const mime =
          ext === '.png'
            ? 'image/png'
            : ext === '.webp'
            ? 'image/webp'
            : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : 'image/png';

        if (!requirePng || mime === 'image/png') {
          const fileBuf = fs.readFileSync(resolved);
          return new NextResponse(new Uint8Array(fileBuf), {
            status: 200,
            headers: {
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
      }
    }

    // 3. Fallback: crisp programmatic rounded-square PNG in the company's primaryColor
    const generated = generateSolidRoundedPng(size, primaryColor);
    return new NextResponse(new Uint8Array(generated), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    const fallback = generateSolidRoundedPng(192, '#2563EB');
    return new NextResponse(new Uint8Array(fallback), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
      },
    });
  }
}
