import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { createOrUpdateUser } from "@/services/userService";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PageHeader, HeaderIconButton } from "@/components/ui/PageHeader";
import { logger } from "@/utils/logger";
import { Check as CheckIcon } from "lucide-react";

export function EditProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const setUser = useAuthStore((s) => s.setUser);
  const showToast = useUIStore((s) => s.showToast);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.avatarUrl ?? null,
  );
  const [saving, setSaving] = useState(false);

  // 若 user 資料晚於頁面掛載才就緒，補同步一次初始值
  useEffect(() => {
    if (user && !displayName && !avatarUrl) {
      setDisplayName(user.displayName ?? "");
      setAvatarUrl(user.avatarUrl ?? null);
    }
  }, [user]);

  const hasChanges =
    displayName !== (user?.displayName ?? "") ||
    avatarUrl !== (user?.avatarUrl ?? null);

  const handleSave = async () => {
    if (!firebaseUser || !displayName.trim()) return;

    setSaving(true);
    try {
      const updated = await createOrUpdateUser(firebaseUser.uid, {
        displayName: displayName.trim(),
        avatarUrl,
        isAnonymous: firebaseUser.isAnonymous,
      });
      setUser(updated);
      showToast(t("common.toast.saved"), "success");
      logger.info("editProfile", "個人資料更新完成");
      navigate(-1);
    } catch (err) {
      logger.error("editProfile", "更新失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] md:min-h-[inherit] flex-col">
      <PageHeader
        title={t("settings.editProfileTitle")}
        onBack={() => navigate(-1)}
        rightAction={
          <HeaderIconButton
            onClick={handleSave}
            disabled={!displayName.trim() || !hasChanges || saving}
            loading={saving}
            tone="primary"
          >
            <CheckIcon className="h-5 w-5" />
          </HeaderIconButton>
        }
      />

      <div className="flex-1 px-4 pt-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <ImageUpload
            currentUrl={avatarUrl}
            onUpload={setAvatarUrl}
            onRemove={() => setAvatarUrl(null)}
            shape="circle"
          />
          <p className="text-xs text-base-content/40">
            {t("settings.changeAvatar")}
          </p>
        </div>

        {/* Nickname */}
        <fieldset className="fieldset w-full mt-8">
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
          />
          <p className="mt-1 text-xs text-base-content/40 text-right">
            {displayName.length}/20
          </p>
        </fieldset>
      </div>
    </div>
  );
}
