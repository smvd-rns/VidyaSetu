/**
 * Compresses an image in the browser (client-side) to ensure it is under targetSizeKb (default 100KB)
 * and optimizes upload time.
 */
export async function compressImage(
  file: File,
  targetSizeKb: number = 100,
  maxWidth: number = 1200,
  maxHeight: number = 1200
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Calculate new dimensions if image exceeds bounds
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to get 2d context for canvas compression'));
        }

        // Draw image to canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Iterative compression to get below target size
        let quality = 0.85;
        const targetBytes = targetSizeKb * 1024;

        const attemptCompression = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                return reject(new Error('Canvas compression resulted in null blob'));
              }

              // If it's under the limit or quality is too low, return it
              if (blob.size < targetBytes || quality <= 0.1) {
                resolve(blob);
              } else {
                // Otherwise reduce quality or scale down dimensions and retry
                quality -= 0.15;
                if (quality < 0.2) {
                  // Scale down dimensions by 0.8x if quality reduction isn't enough
                  width = Math.round(width * 0.8);
                  height = Math.round(height * 0.8);
                  canvas.width = width;
                  canvas.height = height;
                  ctx.drawImage(img, 0, 0, width, height);
                  quality = 0.7; // reset quality slightly for smaller dimensions
                }
                attemptCompression();
              }
            },
            'image/jpeg',
            quality
          );
        };

        attemptCompression();
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
