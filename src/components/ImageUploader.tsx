'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { stripExifAndCompress, ProcessedImage } from '@/lib/image/exif';
import { APP_CONFIG } from '@/lib/domain/config';

interface ImageUploaderProps {
  images: ProcessedImage[];
  onChange: (images: ProcessedImage[]) => void;
  maxCount?: number;
}

export default function ImageUploader({
  images,
  onChange,
  maxCount = APP_CONFIG.images.maxCount,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    const remainingSlots = maxCount - images.length;
    if (remainingSlots <= 0) {
      setError(`Bạn chỉ có thể chọn tối đa ${maxCount} ảnh`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    setProcessing(true);

    try {
      const processedList: ProcessedImage[] = [];
      for (const file of filesToProcess) {
        const processed = await stripExifAndCompress(file);
        processedList.push(processed);
      }
      onChange([...images, ...processedList]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi khi xử lý ảnh');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (index: number) => {
    const target = images[index];
    if (target?.previewUrl) {
      URL.revokeObjectURL(target.previewUrl);
    }
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-3" aria-busy={processing}>
      {error && (
        <div
          className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid ảnh đã chọn */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {images.map((img, idx) => (
          <div
            key={idx}
            className="group relative aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-100 shadow-sm"
          >
            <img
              src={img.previewUrl}
              alt={`Xem trước ảnh ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 transition-colors shadow-md"
                title="Xóa ảnh này"
                aria-label={`Xóa ảnh ${idx + 1}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 text-[10px] text-white rounded font-mono">
              {(img.sizeBytes / 1024).toFixed(0)} KB
            </span>
          </div>
        ))}

        {/* Nút thêm ảnh */}
        {images.length < maxCount && (
          <label
            htmlFor="spot-images-input"
            className={`aspect-square rounded-xl border-2 border-dashed border-stone-300 hover:border-orange-500 bg-stone-50 hover:bg-orange-50/40 flex flex-col items-center justify-center text-center p-3 cursor-pointer transition-colors ${
              processing ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <input
              id="spot-images-input"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
              disabled={processing}
            />
            {processing ? (
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-1.5">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-stone-700">Chọn ảnh</span>
                <span className="text-[10px] text-stone-600 mt-0.5">
                  {images.length}/{maxCount} ảnh (≤5MB)
                </span>
              </>
            )}
          </label>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-stone-600">
        <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
        <span>Ảnh tự động được loại bỏ tọa độ GPS và thông tin thiết bị (EXIF) trước khi tải lên.</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {processing ? 'Đang xử lý ảnh...' : `${images.length} trên ${maxCount} ảnh đã chọn`}
      </p>
    </div>
  );
}
