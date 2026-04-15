import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { deleteUser } from "firebase/auth";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { createOrUpdateUser } from "@/services/userService";
import { linkAnonymousAccountWithGoogle } from "@/services/accountService";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PageHeader } from "@/components/ui/PageHeader";
import { logger } from "@/utils/logger";
import {
  ArrowRightStartOnRectangleIcon,
  TrashIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { Check as CheckIcon } from "lucide-react";

export function EditProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const showToast = useUIStore((s) => s.showToast);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user?.avatarUrl ?? null,
  );
  const [autoSaveState, setAutoSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [binding, setBinding] = useState(false);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const isAnonymous = user?.isAnonymous ?? firebaseUser?.isAnonymous ?? false;

  // Sync initial values when user loads
  useEffect(() => {
    if (user && !displayName && !avatarUrl) {
      setDisplayName(user.displayName ?? "");
      setAvatarUrl(user.avatarUrl ?? null);
    }
  }, [user]);

  // Auto-save displayName with debounce
  useEffect(() => {
    if (!firebaseUser || !displayName.trim()) return;
    if (displayName === (user?.displayName ?? "")) return;

    setAutoSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const updated = await createOrUpdateUser(firebaseUser.uid, {
          displayName: displayName.trim(),
          avatarUrl,
          isAnonymous: firebaseUser.isAnonymous,
        });
        setUser(updated);
        setAutoSaveState("saved");
        logger.info("editProfile", "暱稱自動儲存完成");
      } catch (err) {
        logger.error("editProfile", "自動儲存失敗", err);
        setAutoSaveState("error");
        showToast(t("common.error"), "error");
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [displayName]);

  // Auto-save avatarUrl when changed
  const handleAvatarChange = async (url: string | null) => {
    setAvatarUrl(url);
    if (!firebaseUser || !displayName.trim()) return;
    setAutoSaveState("saving");
    try {
      const updated = await createOrUpdateUser(firebaseUser.uid, {
        displayName: displayName.trim(),
        avatarUrl: url,
        isAnonymous: firebaseUser.isAnonymous,
      });
      setUser(updated);
      setAutoSaveState("saved");
    } catch (err) {
      logger.error("editProfile", "大頭貼儲存失敗", err);
      setAutoSaveState("error");
      showToast(t("common.error"), "error");
    }
  };

  const autoSaveText =
    autoSaveState === "saving"
      ? t("group.settings.autoSave.saving")
      : autoSaveState === "saved"
        ? t("group.settings.autoSave.saved")
        : autoSaveState === "error"
          ? t("group.settings.autoSave.error")
          : "";

  const handleBindGoogle = async () => {
    if (!firebaseUser) return;
    setBinding(true);
    try {
      const linkedUser = await linkAnonymousAccountWithGoogle(firebaseUser);
      setUser(linkedUser);
      showToast(t("settings.bindSuccess"), "success");
      logger.info("editProfile", "Google 帳號綁定成功");
    } catch (err) {
      logger.error("editProfile.bindGoogle", "Google 綁定失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setBinding(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleDeleteAccount = async () => {
    if (!firebaseUser) return;
    try {
      await deleteUser(firebaseUser);
      showToast(t("settings.deleteAccountSuccess"), "success");
      logger.info("editProfile", "帳號已刪除");
    } catch (err) {
      logger.error("editProfile.deleteAccount", "帳號刪除失敗", err);
      showToast(t("common.error"), "error");
    }
  };

  return (
    <div className="flex min-h-[100dvh] md:min-h-[inherit] flex-col">
      <PageHeader
        title={t("settings.profile")}
        onBack={() => navigate(-1)}
      />

      <div className="flex-1 px-4 pt-6 pb-8 flex flex-col gap-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-2">
          <ImageUpload
            currentUrl={avatarUrl}
            onUpload={handleAvatarChange}
            onRemove={() => handleAvatarChange(null)}
            shape="circle"
          />
          <p className="text-xs text-base-content/40">
            {t("settings.changeAvatar")}
          </p>
        </div>

        {/* Nickname with auto-save */}
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
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-base-content/40">
              {displayName.length}/20
            </span>
            {autoSaveText && (
              <span className="inline-flex items-center gap-1 text-xs text-base-content/50">
                {autoSaveState === "saved" && (
                  <CheckIcon className="h-3.5 w-3.5" />
                )}
                {autoSaveText}
              </span>
            )}
          </div>
        </fieldset>

        {/* Account Actions */}
        <div className="flex flex-col gap-3 mt-2">
          {/* Connect Google (anonymous only) */}
          {isAnonymous && (
            <button
              className="btn-muted btn-block"
              onClick={handleBindGoogle}
              disabled={binding}
            >
              {binding ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <LinkIcon className="h-5 w-5 shrink-0" />
              )}
              {t("settings.bindGoogle")}
            </button>
          )}

          <button
            className="btn-muted btn-block"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <ArrowRightStartOnRectangleIcon className="h-5 w-5 shrink-0" />
            {t("settings.logout")}
          </button>

          <button
            className="btn-danger-soft btn-block"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <TrashIcon className="h-5 w-5 shrink-0" />
            {t("settings.deleteAccount")}
          </button>
        </div>
      </div>

      {/* Logout Confirm Dialog */}
      {showLogoutConfirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">{t("settings.logout")}</h3>
            {isAnonymous ? (
              <p className="mt-2 text-sm text-base-content/70">
                {t("settings.anonymousLogoutWarning")}
              </p>
            ) : (
              <p className="mt-2 text-sm text-base-content/70">
                {t("settings.logoutConfirm")}
              </p>
            )}
            <div className="modal-action flex-wrap gap-2">
              <button
                className="btn-white-soft"
                onClick={() => setShowLogoutConfirm(false)}
              >
                {t("common.button.cancel")}
              </button>
              {isAnonymous && (
                <button
                  className="btn-muted"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleBindGoogle();
                  }}
                  disabled={binding}
                >
                  <LinkIcon className="h-4 w-4 shrink-0" />
                  {t("settings.bindGoogleCta")}
                </button>
              )}
              <button className="btn-danger-soft" onClick={handleLogout}>
                {t("settings.logout")}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setShowLogoutConfirm(false)}
          />
        </div>
      )}

      {/* Delete Account Confirm Dialog */}
      {showDeleteConfirm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-error">
              {t("settings.deleteAccount")}
            </h3>
            <p className="mt-2 text-sm">{t("settings.deleteAccountWarning")}</p>
            <div className="mt-4">
              <p className="text-sm text-base-content/60 mb-2">
                {t("settings.deleteAccountConfirm")}
              </p>
              <input
                type="text"
                className="input w-full"
                placeholder={t("settings.deleteAccountPlaceholder")}
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
              />
            </div>
            <div className="modal-action">
              <button
                className="btn-white-soft"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteText("");
                }}
              >
                {t("common.button.cancel")}
              </button>
              <button
                className="btn-danger-soft"
                disabled={deleteText !== "刪除" && deleteText !== "DELETE"}
                onClick={handleDeleteAccount}
              >
                {t("settings.deleteAccount")}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => {
              setShowDeleteConfirm(false);
              setDeleteText("");
            }}
          />
        </div>
      )}
    </div>
  );
}
