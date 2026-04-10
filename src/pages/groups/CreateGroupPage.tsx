import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { createGroup, addPlaceholderMember } from "@/services/groupService";
import { logger } from "@/utils/logger";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PageHeader, HeaderIconButton } from "@/components/ui/PageHeader";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  X as XMarkIcon,
  Check as CheckIcon,
  Star as StarIcon,
  Plus as PlusIcon,
} from "lucide-react";

interface PreAddMember {
  id: string;
  name: string;
  isCreator: boolean;
}

export function CreateGroupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [name, setName] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [preMembers, setPreMembers] = useState<PreAddMember[]>([
    {
      id: user?.uid ?? "creator",
      name: user?.displayName ?? "",
      isCreator: true,
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const handleAddMember = () => {
    const trimmed = memberSearch.trim();
    if (!trimmed) return;
    if (preMembers.some((m) => m.name === trimmed)) return;

    setPreMembers((prev) => [
      ...prev,
      { id: `pre_${Date.now()}`, name: trimmed, isCreator: false },
    ]);
    setMemberSearch("");
  };

  const handleRemoveMember = (id: string) => {
    setPreMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleBack = () => {
    if (name.trim() || coverUrl || preMembers.length > 1) {
      setShowDiscardModal(true);
      return;
    }
    navigate(-1);
  };

  const submitGroup = async () => {
    if (!user || !name.trim()) return;

    setSaving(true);
    try {
      const group = await createGroup(
        name.trim(),
        user.uid,
        user.displayName,
        user.avatarUrl,
        coverUrl,
      );

      // Add pre-added members as placeholders
      const newMembers = preMembers.filter((m) => !m.isCreator);
      for (const m of newMembers) {
        await addPlaceholderMember(group.groupId, m.name);
      }

      logger.info("group.create", "群組建立成功", { groupId: group.groupId });
      showToast(t("common.toast.groupCreated"), "success");
      navigate(`/groups/${group.groupId}`, { replace: true });
    } catch (err) {
      logger.error("group.create", "群組建立失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitGroup();
  };

  return (
    <div className="flex min-h-[100dvh] md:min-h-[inherit] flex-col">
      <PageHeader
        title={t("group.create.title")}
        onBack={handleBack}
        rightAction={
          <HeaderIconButton
            onClick={submitGroup}
            disabled={!name.trim() || saving}
            loading={saving}
            tone="primary"
          >
            <CheckIcon className="h-5 w-5" />
          </HeaderIconButton>
        }
      />

      <form
        onSubmit={handleSubmit}
        className="flex-1 px-4 pb-8 flex flex-col gap-5"
      >
        {/* Cover Image Upload */}
        <div>
          <label className="text-sm font-medium text-base-content/60">
            {t("group.create.cover")}
          </label>
          <p className="text-xs text-base-content/40 mb-2">
            {t("group.create.coverHint")}
          </p>
          <ImageUpload
            currentUrl={coverUrl}
            onUpload={setCoverUrl}
            onRemove={() => setCoverUrl(null)}
            shape="rect"
            label={t("group.create.coverUpload")}
            className="w-full"
          />
        </div>

        {/* Group Name */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("group.create.name")}</legend>
          <input
            type="text"
            className="input w-full"
            placeholder={t("group.create.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            required
            autoFocus
          />
        </fieldset>

        {/* Members Section */}
        <div>
          <label className="text-sm font-medium text-base-content/60">
            {t("group.create.membersSection")}
          </label>

          {/* Member list (horizontal) */}
          <div className="mt-2 flex flex-wrap gap-2">
            {preMembers.map((m) => (
              <div key={m.id} className="badge badge-lg gap-1 pr-1">
                <UserAvatar
                  src={null}
                  name={m.name}
                  size="w-5"
                  textSize="text-[10px]"
                  bgClass="bg-base-300 text-base-content"
                />
                <span className="text-sm">{m.name}</span>
                {m.isCreator ? (
                  <StarIcon className="h-3.5 w-3.5 text-warning" />
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-circle"
                    onClick={() => handleRemoveMember(m.id)}
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Search / Add */}
          <div className="mt-3">
            <input
              type="text"
              className="input w-full"
              placeholder={t("group.create.searchMembers")}
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddMember();
                }
              }}
            />
            {memberSearch.trim() && (
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2 text-primary w-full justify-start"
                onClick={handleAddMember}
              >
                <PlusIcon className="h-4 w-4" />
                {t("group.create.addAsMember", { name: memberSearch.trim() })}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Discard confirmation modal */}
      {showDiscardModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold">{t("common.discard.title")}</h3>
            <p className="mt-2 text-sm text-base-content/70">
              {t("common.discard.message")}
            </p>
            <div className="modal-action">
              <button
                className="btn-white-soft"
                onClick={() => setShowDiscardModal(false)}
              >
                {t("common.discard.cancel")}
              </button>
              <button className="btn-danger-soft" onClick={() => navigate(-1)}>
                {t("common.discard.confirm")}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setShowDiscardModal(false)}
          />
        </div>
      )}
    </div>
  );
}
