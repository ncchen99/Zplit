import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGroupStore } from "@/store/groupStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { deleteGroup, updateGroup } from "@/services/groupService";
import { logger } from "@/utils/logger";
import { LinkIcon, TrashIcon, CheckIcon } from "@heroicons/react/24/outline";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ImageUpload } from "@/components/ui/ImageUpload";

export function SettingsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [coverDraft, setCoverDraft] = useState("");
  const [autoSaveState, setAutoSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const isCreator = currentGroup?.createdBy === user?.uid;
  const currentName = currentGroup?.name ?? "";
  const currentCover = currentGroup?.coverUrl ?? "";

  const inviteUrl = `${window.location.origin}/join/${currentGroup?.inviteCode ?? ""}`;

  useEffect(() => {
    setNameDraft(currentName);
    setCoverDraft(currentCover);
    setAutoSaveState("idle");
  }, [currentGroup?.groupId, currentName, currentCover]);

  const normalizedName = nameDraft.trim();
  const normalizedCover = coverDraft.trim();
  const hasEditChanges = useMemo(
    () => normalizedName !== currentName || normalizedCover !== currentCover,
    [normalizedName, currentName, normalizedCover, currentCover],
  );

  useEffect(() => {
    if (!currentGroup || !normalizedName || !hasEditChanges) return;

    setAutoSaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        await updateGroup(currentGroup.groupId, {
          name: normalizedName,
          coverUrl: normalizedCover || null,
        });
        setAutoSaveState("saved");
      } catch (err) {
        logger.error("settings.autosave", "群組設定自動儲存失敗", err);
        setAutoSaveState("error");
        showToast(t("common.error"), "error");
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [currentGroup?.groupId, normalizedName, normalizedCover, hasEditChanges]);

  const autoSaveText =
    autoSaveState === "saving"
      ? t("group.settings.autoSave.saving")
      : autoSaveState === "saved"
        ? t("group.settings.autoSave.saved")
        : autoSaveState === "error"
          ? t("group.settings.autoSave.error")
          : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    showToast(t("group.members.linkCopied"), "success");
  };

  const handleDeleteGroup = async () => {
    if (!currentGroup) return;
    setDeleting(true);
    try {
      await deleteGroup(currentGroup.groupId);
      showToast(t("group.settings.groupDeleted"), "success");
      navigate("/home");
    } catch (err) {
      logger.error("settings.delete", "刪除群組失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Invite Link */}
      <div className="pb-4 border-b border-base-200">
        <h3 className="mb-2 block text-sm font-medium text-base-content/60">
          {t("group.settings.inviteLink")}
        </h3>
        <div className="join w-full">
          <label className="input input-sm join-item flex w-full items-center gap-2">
            <LinkIcon className="h-4 w-4 shrink-0 text-base-content/40" />
            <input
              type="text"
              className="grow text-sm text-base-content/60"
              value={inviteUrl}
              readOnly
            />
          </label>
          <button
            className="btn-muted btn-sm join-item shrink-0"
            onClick={handleCopyLink}
          >
            {t("group.members.copyLink")}
          </button>
        </div>
      </div>

      {/* Group Edit */}
      <div className="py-4 border-b border-base-200">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <label className="mb-2 block text-sm font-medium text-base-content/60">
              {t("group.edit.name")}
            </label>
            {autoSaveText && (
              <span className="pointer-events-none absolute right-0 top-0 inline-flex items-center gap-1 text-xs text-base-content/50">
                {autoSaveState === "saved" && (
                  <CheckIcon className="h-3.5 w-3.5" />
                )}
                {autoSaveText}
              </span>
            )}
            <input
              type="text"
              className="input w-full"
              placeholder={t("group.create.namePlaceholder")}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={50}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-base-content/60">
              {t("group.settings.coverPhoto")}
            </label>
            <ImageUpload
              currentUrl={coverDraft || null}
              onUpload={setCoverDraft}
              onRemove={() => setCoverDraft("")}
              shape="rect"
              label={t("group.settings.tapToEditCover")}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      {isCreator && (
        <div className="py-4">
          <h3 className="mb-2 block text-sm font-medium text-base-content/60">
            {t("group.settings.dangerZone")}
          </h3>
          <button
            className="btn-danger-soft btn-block gap-2"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
          >
            {deleting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <TrashIcon className="h-5 w-5" />
            )}
            {t("group.detail.deleteGroup")}
          </button>
        </div>
      )}
      <ConfirmModal
        open={showDeleteConfirm}
        title={t("group.detail.deleteGroup")}
        message={t("group.detail.deleteConfirm")}
        confirmLabel={t("common.button.delete")}
        cancelLabel={t("common.button.cancel")}
        confirmVariant="btn-error"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDeleteGroup();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
