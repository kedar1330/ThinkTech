// Shrinks a photo in the browser before upload (D-129): smaller uploads, and the EXIF data (location,
// device) is dropped because the image is redrawn. Falls back to the original file when the browser
// can't decode it, as long as it is already a type the API accepts.

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

export async function resizePhoto(file: File, maxSide: number, quality = 0.9): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no canvas');
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('no blob');
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } catch {
    if (ACCEPTED.includes(file.type)) return file;
    throw new Error('unsupported');
  }
}
