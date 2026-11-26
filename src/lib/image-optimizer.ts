export interface OptimizedImageResult {
  dataUrl: string;
  byteSize: number;
  width: number;
  height: number;
}

const TARGET_MAX_BYTES = {
  logo: 8 * 1024, // 8 KB max target for full sidebar/login logo
  icon: 3 * 1024, // 3 KB max target for collapsed emblem/favicon
};

/**
 * Compresses an uploaded image aggressively into a tiny WebP (or low-quality JPEG fallback)
 * base64 data URI so Neon PostgreSQL storage stays minimal across thousands of tenants.
 */
export async function compressLogoToTinyBase64(
  file: File,
  kind: 'logo' | 'icon' = 'logo'
): Promise<OptimizedImageResult> {
  const maxBytes = TARGET_MAX_BYTES[kind];

  // Allow tiny SVGs as-is; oversized SVGs get rasterized below to save DB space
  if (file.type === 'image/svg+xml' && file.size <= maxBytes) {
    const rawSvg = await readFileAsDataUrl(file);
    if (rawSvg.length <= maxBytes * 1.4) {
      return {
        dataUrl: rawSvg,
        byteSize: rawSvg.length,
        width: kind === 'icon' ? 48 : 180,
        height: kind === 'icon' ? 48 : 56,
      };
    }
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const initialMaxW = kind === 'icon' ? 48 : 180;
  const initialMaxH = kind === 'icon' ? 48 : 56;

  // Try progressive quality and dimension steps until compact enough for Neon DB
  const attempts: Array<{ scaleFactor: number; quality: number }> = [
    { scaleFactor: 1.0, quality: 0.42 },
    { scaleFactor: 1.0, quality: 0.28 },
    { scaleFactor: 0.8, quality: 0.22 },
    { scaleFactor: 0.65, quality: 0.16 },
  ];

  let bestUrl = '';
  let bestW = initialMaxW;
  let bestH = initialMaxH;

  for (const step of attempts) {
    const maxW = Math.max(24, Math.round(initialMaxW * step.scaleFactor));
    const maxH = Math.max(24, Math.round(initialMaxH * step.scaleFactor));
    const ratio = Math.min(1, maxW / img.width, maxH / img.height);
    const width = Math.max(16, Math.round(img.width * ratio));
    const height = Math.max(16, Math.round(img.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bestUrl = rawDataUrl;
      bestW = width;
      bestH = height;
      break;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let candidate = canvas.toDataURL('image/webp', step.quality);
    // Fallback to white-backed JPEG if browser doesn't support WebP encoding
    if (!candidate.startsWith('data:image/webp')) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      candidate = canvas.toDataURL('image/jpeg', step.quality);
    }

    bestUrl = candidate;
    bestW = width;
    bestH = height;

    if (candidate.length <= maxBytes) {
      break;
    }
  }

  return {
    dataUrl: bestUrl,
    byteSize: bestUrl.length,
    width: bestW,
    height: bestH,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Invalid or unsupported image file'));
    img.src = src;
  });
}
