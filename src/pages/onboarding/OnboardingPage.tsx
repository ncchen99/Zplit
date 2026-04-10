import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { createOrUpdateUser } from "@/services/userService";
import { logger } from "@/utils/logger";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);
  const showToast = useUIStore((s) => s.showToast);

  const [displayName, setDisplayName] = useState(
    firebaseUser?.displayName ?? "",
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    firebaseUser?.photoURL ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);

  const handleBack = () => {
    if (displayName.trim() || avatarUrl) {
      setShowBackConfirm(true);
      return;
    }
    navigate(-1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !displayName.trim()) return;

    setSaving(true);
    try {
      const user = await createOrUpdateUser(firebaseUser.uid, {
        displayName: displayName.trim(),
        avatarUrl,
        isAnonymous: firebaseUser.isAnonymous,
      });
      setUser(user);
      setStatus("ready");
      logger.info("onboarding", "個人資料設定完成", { uid: firebaseUser.uid });
      navigate("/home", { replace: true });
    } catch (err) {
      logger.error("onboarding", "個人資料儲存失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] md:min-h-full flex-col px-6 pt-4 pb-8">
      {/* Back button */}
      <button
        className="btn btn-ghost btn-sm btn-circle self-start"
        onClick={handleBack}
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>

      <div className="mx-auto w-full max-w-sm flex-1 flex flex-col items-center justify-center">
        {/* Welcome */}
        <h1 className="text-2xl font-bold">{t("auth.onboarding.welcome")}</h1>
        <p className="mt-1 text-base-content/60">
          {t("auth.onboarding.welcomeSubtitle")}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 flex w-full flex-col gap-6"
        >
          {/* Avatar upload */}
          <div className="flex flex-col items-center gap-2">
            {avatarUrl ? (
              <ImageUpload
                currentUrl={avatarUrl}
                onUpload={setAvatarUrl}
                onRemove={() => setAvatarUrl(null)}
                shape="circle"
              />
            ) : (
              <div className="relative">
                <ImageUpload
                  currentUrl={null}
                  onUpload={setAvatarUrl}
                  shape="circle"
                />
                {/* Fallback initial */}
                {!avatarUrl && displayName.trim() && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-base-content/20">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-base-content/40">
              {t("auth.onboarding.avatarUpload")}
            </p>
          </div>

          {/* Nickname */}
          <fieldset className="fieldset w-full">
            <legend className="fieldset-legend">
              {t("auth.onboarding.nickname")}
            </legend>
            <input
              type="text"
              className="input w-full"
              placeholder={t("auth.onboarding.nicknamePlaceholder")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={20}
              required
              autoFocus
            />
            <p className="mt-1 text-xs text-base-content/40 text-right">
              {displayName.length}/20
            </p>
          </fieldset>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={!displayName.trim() || saving}
          >
            {saving && <span className="loading loading-spinner loading-sm" />}
            {t("auth.onboarding.continue")}
          </button>
        </form>
      </div>
      <ConfirmModal
        open={showBackConfirm}
        title={t("common.discard.title")}
        message={t("auth.onboarding.backConfirm")}
        confirmLabel={t("common.button.confirm")}
        cancelLabel={t("common.button.cancel")}
        onConfirm={() => {
          setShowBackConfirm(false);
          navigate(-1);
        }}
        onCancel={() => setShowBackConfirm(false)}
      />
    </div>
  );
}
