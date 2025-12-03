import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Compress a data URL (image) by drawing it into a canvas and exporting as JPEG
export async function compressDataUrl(
  dataUrl: string,
  maxDim = 1200,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      let targetW = width;
      let targetH = height;
      if (Math.max(width, height) > maxDim) {
        if (width > height) {
          targetW = maxDim;
          targetH = Math.round((height * maxDim) / width);
        } else {
          targetH = maxDim;
          targetW = Math.round((width * maxDim) / height);
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, targetW, targetH);
      try {
        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => reject(new Error("Failed to load image for compression"));
    img.src = dataUrl;
  });
}
