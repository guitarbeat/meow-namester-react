/**
 * Image compression utilities (client-side)
 * Compresses images to WebP with max dimensions to reduce file size before upload.
 */

/**
 * Load a File/Blob into an HTMLImageElement
 */
async function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * Compress an image file to WebP using a canvas
 * @param {File} file - Original image file
 * @param {Object} options - { maxWidth, maxHeight, quality }
 * @returns {Promise<File>} Compressed image as a File (webp) or original on failure
 */
export async function compressImageFile(
  file,
  { maxWidth = 1600, maxHeight = 1600, quality = 0.8 } = {}
) {
  try {
    const img = await loadImageFromFile(file);
    const { width, height } = img;
    let targetW = width;
    let targetH = height;

    // Fit within max dimensions preserving aspect ratio
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    targetW = Math.round(width * scale);
    targetH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(
        resolve,
        'image/webp',
        Math.min(Math.max(quality, 0.1), 0.95)
      )
    );

    if (!blob) return file; // fallback

    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    const compressed = new File([blob], `${base}.webp`, { type: 'image/webp' });
    return compressed;
  } catch {
    return file; // fallback to original if anything fails
  }
}

export default { compressImageFile };
