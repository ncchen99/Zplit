import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadImage } from '@/services/uploadService';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { CameraIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ImageUploadProps {
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  onRemove?: () => void;
  shape?: 'circle' | 'rect';
  label?: string;
  className?: string;
}

export function ImageUpload({
  currentUrl,
  onUpload,
  onRemove,
  shape = 'rect',
  label,
  className = '',
}: ImageUploadProps) {
  const { t } = useTranslation();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const showToast = useUIStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;

    // Preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    try {
      const url = await uploadImage(file, firebaseUser);
      setPreview(url);
      onUpload(url);
    } catch {
      setPreview(currentUrl ?? null);
      showToast(t('common.error'), 'error');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onRemove?.();
  };

  const isCircle = shape === 'circle';

  return (
    <div className={`relative inline-flex ${className}`}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {preview ? (
        <div className="relative group">
          <img
            src={preview}
            alt=""
            className={`object-cover cursor-pointer ${
              isCircle
                ? 'h-24 w-24 rounded-full'
                : 'h-32 w-full rounded-xl aspect-video'
            }`}
            onClick={() => fileRef.current?.click()}
          />
          {uploading && (
            <div className={`absolute inset-0 flex items-center justify-center bg-black/40 ${isCircle ? 'rounded-full' : 'rounded-xl'}`}>
              <span className="loading loading-spinner loading-sm text-white" />
            </div>
          )}
          {onRemove && !uploading && (
            <button
              type="button"
              className="absolute -top-1 -right-1 btn btn-circle btn-xs btn-error"
              onClick={handleRemove}
            >
              <XMarkIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={`flex items-center justify-center border-2 border-dashed border-base-300 bg-base-200 cursor-pointer transition-colors hover:border-primary/50 ${
            isCircle
              ? 'h-24 w-24 rounded-full flex-col gap-1'
              : 'h-32 w-full rounded-xl flex-col gap-2'
          }`}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <>
              <CameraIcon className="h-6 w-6 text-base-content/40" />
              {label && (
                <span className="text-xs text-base-content/40">{label}</span>
              )}
            </>
          )}
        </button>
      )}
    </div>
  );
}
