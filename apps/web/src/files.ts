import { dataUrl } from '@quantum/art';

/** Browser file helpers: saving downloads, and drawing SVG documents to bitmaps. */

/** Saves a blob as a download. */
export function download(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** Draws an SVG document to a `w` × `h` px canvas, over `background` when given (else transparent). */
export async function drawSvg(svg: string, w: number, h: number, background?: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = dataUrl(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/** A canvas encoded as `type` (browsers that can't encode it give PNG). */
export const encode = (canvas: HTMLCanvasElement, type = 'image/png', quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('drawing the SVG failed'))), type, quality),
  );

/** Draws an SVG document to a `w` × `h` px bitmap, encoded as `type`. */
export async function rasterise(svg: string, w: number, h: number, type = 'image/png', quality?: number): Promise<Blob> {
  return encode(await drawSvg(svg, w, h), type, quality);
}
