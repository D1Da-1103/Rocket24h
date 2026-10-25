import { APP_CONFIG } from '../domain/config';

export interface ProcessedImage {
  file: File;
  previewUrl: string;
  originalName: string;
  sizeBytes: number;
}

/**
 * Xử lý ảnh ở client:
 * 1. Đọc ảnh vào HTML Canvas để loại bỏ hoàn toàn metadata EXIF (bao gồm GPS)
 * 2. Thu nhỏ kích thước tối đa (max 1920px) giữ nguyên tỉ lệ
 * 3. Nén sang định dạng chuẩn JPEG chất lượng cao (0.85)
 */
export async function stripExifAndCompress(
  file: File,
  maxDimension: number = APP_CONFIG.images.maxDimension
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    // Kiểm tra định dạng hợp lệ
    const accepted = (APP_CONFIG.images.acceptedMimeTypes as readonly string[]).includes(file.type);
    if (!accepted) {
      return reject(new Error('Chỉ chấp nhận ảnh định dạng JPEG, PNG hoặc WebP'));
    }

    // Kiểm tra dung lượng
    if (file.size > APP_CONFIG.images.maxSizeBytes) {
      return reject(new Error('Dung lượng mỗi ảnh không được vượt quá 5MB'));
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      // Tính toán kích thước mới nếu vượt quá maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Không thể khởi tạo Canvas context'));
      }

      // Vẽ lại ảnh lên canvas -> EXIF bị xóa sạch
      ctx.drawImage(img, 0, 0, width, height);

      // Xuất blob JPEG
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Không thể nén ảnh'));
          }

          const cleanFileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
          const cleanFile = new File([blob], cleanFileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          const previewUrl = URL.createObjectURL(blob);

          resolve({
            file: cleanFile,
            previewUrl,
            originalName: file.name,
            sizeBytes: cleanFile.size,
          });
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Lỗi khi đọc file ảnh'));
    };

    img.src = objectUrl;
  });
}
