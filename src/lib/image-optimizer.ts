export interface OptimizedImageResult {
  dataUrl: string;
  byteSize: number;
  width: number;
  height: number;
}

const TARGET_MAX_BYTES = {
  logo: 8 * 1024, // <= 8 KB ultra-compact WebP for sidebar/login display
  icon: 26 * 1024, // <= 26 KB for crisp 192x192 PNG required by Windows/Chrome PWA shortcuts
};

/**
 * Compresses uploaded images for minimal Neon DB usage:
 * - 'logo': tiny WebP (<= 8 KB, max 180x56px) for sidebar/login display
 * - 'icon': crisp 192x192 PNG so Chrome/Edge native PWA Desktop App install always renders sharply
 */
export async function compressLogoToTinyBase64(
  file: File,
  kind: 'logo' | 'icon' = 'logo'
): Promise<OptimizedImageResult> {
  const maxBytes = TARGET_MAX_BYTES[kind];

  if (kind === 'logo' && file.type === 'image/svg+xml' && file.size <= maxBytes) {
    const rawSvg = await readFileAsDataUrl(file);
    if (rawSvg.length <= maxBytes * 1.4) {
      return {
        dataUrl: rawSvg,
        byteSize: rawSvg.length,
        width: 180,
        height: 56,
      };
    }
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  if (kind === 'icon') {
    // Windows / Chrome PWA install requires a crisp >= 192x192 PNG icon
    const sizes = [192, 144, 128];
    let bestUrl = '';
    let bestSize = 192;

    for (const dim of sizes) {
      const canvas = document.createElement('canvas');
      canvas.width = dim;
      canvas.height = dim;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bestUrl = rawDataUrl;
        break;
      }

      // Draw centered inside padded square preserving aspect ratio
      const padding = Math.round(dim * 0.08);
      const innerMax = dim - padding * 2;
      const ratio = Math.min(innerMax / img.width, innerMax / img.height);
      const drawW = Math.max(1, Math.round(img.width * ratio));
      const drawH = Math.max(1, Math.round(img.height * ratio));
      const offsetX = Math.round((dim - drawW) / 2);
      const offsetY = Math.round((dim - drawH) / 2);

      ctx.clearRect(0, 0, dim, dim);
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

      const candidate = canvas.toDataURL('image/png');
      bestUrl = candidate;
      bestSize = dim;
      if (candidate.length <= maxBytes) break;
    }

    return {
      dataUrl: bestUrl,
      byteSize: bestUrl.length,
      width: bestSize,
      height: bestSize,
    };
  }

  // Sidebar/Login Logo: aggressive WebP compression
  const initialMaxW = 180;
  const initialMaxH = 56;
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
