import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { uploadImage } from "@/services/uploadService";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { Camera as CameraIcon, X as XMarkIcon } from "lucide-react";

interface ImageUploadProps {
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  onRemove?: () => void;
  shape?: "circle" | "rect";
  rectHeightClass?: string;
  label?: string;
  className?: string;
}

export function ImageUpload({
  currentUrl,
  onUpload,
  onRemove,
  shape = "rect",
  rectHeightClass = "h-32",
  label,
  className = "",
}: ImageUploadProps) {
  const { t } = useTranslation();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const showToast = useUIStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const localPreviewUrlRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);

  useEffect(() => {
    // Keep preview in sync with async-loaded data (e.g. edit pages).
    if (!uploading) {
      setPreview(currentUrl ?? null);
    }
  }, [currentUrl, uploading]);

  useEffect(() => {
    return () => {
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
      }
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;

    // Preview
    if (localPreviewUrlRef.current) {
      URL.revokeObjectURL(localPreviewUrlRef.current);
      localPreviewUrlRef.current = null;
    }
    const objectUrl = URL.createObjectURL(file);
    localPreviewUrlRef.current = objectUrl;
    setPreview(objectUrl);

    setUploading(true);
    try {
      const url = await uploadImage(file);
      setPreview(url);
      onUpload(url);
    } catch {
      setPreview(currentUrl ?? null);
      showToast(t("common.error"), "error");
    } finally {
      if (localPreviewUrlRef.current) {
        URL.revokeObjectURL(localPreviewUrlRef.current);
        localPreviewUrlRef.current = null;
      }
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onRemove?.();
  };

  const isCircle = shape === "circle";

  return (
    <div
      className={`relative ${isCircle ? "inline-flex" : "flex w-full"} ${className}`}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {preview ? (
        <div
          className={`relative group ${
            isCircle
              ? "h-24 w-24 rounded-full border border-base-content/20"
              : `${rectHeightClass} w-full rounded-xl border border-base-content/20`
          }`}
        >
          <div
            className={`h-full w-full overflow-hidden ${isCircle ? "rounded-full" : "rounded-xl"}`}
          >
            <img
              src={preview}
              alt=""
              className="h-full w-full object-cover cursor-pointer"
              onClick={() => fileRef.current?.click()}
            />
          </div>
          {uploading && (
            <div
              className={`absolute inset-0 flex items-center justify-center bg-base-100/65 ${isCircle ? "rounded-full" : "rounded-xl"}`}
            >
              <span className="loading loading-spinner loading-lg text-base-content/70" />
            </div>
          )}
          {onRemove && !uploading && (
            <button
              type="button"
              className="absolute -top-1 -right-1 z-20 btn btn-circle btn-xs btn-error"
              onClick={handleRemove}
            >
              <XMarkIcon className="h-3.5 w-3.5" strokeWidth={5} strokeLinecap="square" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={`flex items-center justify-center border border-dashed border-base-content/20 bg-base-100 cursor-pointer transition-colors hover:border-primary/40 ${
            isCircle
              ? "h-24 w-24 rounded-full flex-col gap-1"
              : `${rectHeightClass} w-full rounded-xl flex-col gap-2`
          }`}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <span className="loading loading-spinner loading-md text-base-content/60" />
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
