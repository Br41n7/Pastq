/** Shrinks a phone photo in the browser so it fits the request-size limit and reads fine for OCR. */
export async function compressImage(file: File, maxSide = 1800, maxBytes = 2_500_000): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not open that image. Use a JPG, PNG or WebP photo.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not process the image.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let quality = 0.85;
    for (;;) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      if (base64.length * 0.75 <= maxBytes || quality <= 0.4) return { base64, mimeType: 'image/jpeg' };
      quality -= 0.1;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
