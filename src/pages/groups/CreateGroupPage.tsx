import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import {
  createGroup,
  addPlaceholderMember,
  getUserGroups,
} from "@/services/groupService";
import {
  getContacts,
  type PersonalContact,
} from "@/services/personalLedgerService";
import { logger } from "@/utils/logger";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { PageHeader, HeaderIconButton } from "@/components/ui/PageHeader";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  Check as CheckIcon,
  Plus as PlusIcon,
  X as XIcon,
} from "lucide-react";

interface PreAddMember {
  id: string;
  name: string;
  isCreator: boolean;
}

interface MemberSuggestion {
  key: string;
  displayName: string;
  avatarUrl: string | null;
}

export function CreateGroupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [name, setName] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [contacts, setContacts] = useState<PersonalContact[]>([]);
  const [groupMemberSuggestions, setGroupMemberSuggestions] = useState<
    MemberSuggestion[]
  >([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [preMembers, setPreMembers] = useState<PreAddMember[]>([
    {
      id: user?.uid ?? "creator",
      name: user?.displayName ?? "",
      isCreator: true,
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const memberSearchInputRef = useRef<HTMLInputElement | null>(null);

  const centerMemberInputInViewport = useCallback(() => {
    const inputEl = memberSearchInputRef.current;
    if (!inputEl) return;

    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const rect = inputEl.getBoundingClientRect();
    const targetTop =
      rect.top + window.scrollY - viewportHeight / 2 + rect.height / 2;

    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, []);

  const handleMemberInputFocus = useCallback(() => {
    setShowMemberDropdown(true);
    // Retry once after virtual keyboard animation to keep the field centered.
    requestAnimationFrame(centerMemberInputInViewport);
    window.setTimeout(centerMemberInputInViewport, 260);
  }, [centerMemberInputInViewport]);

  const loadContacts = useCallback(async () => {
    if (!user) return;
    setLoadingContacts(true);
    try {
      const [contactList, groups] = await Promise.all([
        getContacts(user.uid),
        getUserGroups(user.uid),
      ]);
      setContacts(contactList);

      const memberMap = new Map<string, MemberSuggestion>();
      for (const group of groups) {
        for (const member of group.members) {
          if (!member.displayName?.trim() || member.userId === user.uid) {
            continue;
          }
          const normalized = member.displayName.trim();
          const key = normalized.toLowerCase();
          if (!memberMap.has(key)) {
            memberMap.set(key, {
              key: `group:${key}`,
              displayName: normalized,
              avatarUrl: member.avatarUrl,
            });
          }
        }
      }
      setGroupMemberSuggestions(Array.from(memberMap.values()));
    } catch (err) {
      logger.error("group.create", "載入聯絡人失敗", err);
    } finally {
      setLoadingContacts(false);
    }
  }, [user]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const addPreMember = (rawName: string) => {
    const normalizedName = rawName.trim();
    if (!normalizedName) return;

    setPreMembers((prev) => {
      const alreadyExists = prev.some(
        (m) => m.name.trim().toLowerCase() === normalizedName.toLowerCase(),
      );
      if (alreadyExists) return prev;
      return [
        ...prev,
        { id: `pre_${Date.now()}`, name: normalizedName, isCreator: false },
      ];
    });
  };

  const trimmedSearch = memberSearch.trim();
  const allSuggestions = useMemo(() => {
    const existingContactNames = new Set(
      contacts.map((c) => c.displayName.trim().toLowerCase()),
    );

    const contactSuggestions: MemberSuggestion[] = contacts.map((c) => ({
      key: `contact:${c.contactId}`,
      displayName: c.displayName,
      avatarUrl: c.avatarUrl,
    }));

    const groupOnlySuggestions = groupMemberSuggestions.filter(
      (s) => !existingContactNames.has(s.displayName.trim().toLowerCase()),
    );

    return [...contactSuggestions, ...groupOnlySuggestions];
  }, [contacts, groupMemberSuggestions]);

  const filteredSuggestions = useMemo(
    () =>
      (trimmedSearch
        ? allSuggestions.filter((s) =>
            s.displayName.toLowerCase().includes(trimmedSearch.toLowerCase()),
          )
        : allSuggestions
      ).filter(
        (s) =>
          !preMembers.some(
            (m) =>
              m.name.trim().toLowerCase() === s.displayName.trim().toLowerCase(),
          ),
      ),
    [allSuggestions, preMembers, trimmedSearch],
  );

  const canAddTypedMember =
    !!trimmedSearch &&
    !preMembers.some(
      (m) => m.name.trim().toLowerCase() === trimmedSearch.toLowerCase(),
    );

  const handleAddMember = useCallback(() => {
    addPreMember(memberSearch);
    setMemberSearch("");
    setShowMemberDropdown(false);
  }, [memberSearch]);

  const keepMemberInputFocused = useCallback(() => {
    requestAnimationFrame(() => {
      memberSearchInputRef.current?.focus();
      centerMemberInputInViewport();
    });
  }, [centerMemberInputInViewport]);

  const handleAddMemberAndKeepFocus = useCallback(() => {
    handleAddMember();
    keepMemberInputFocused();
  }, [handleAddMember, keepMemberInputFocused]);

  const handleSelectSuggestion = (suggestion: MemberSuggestion) => {
    addPreMember(suggestion.displayName);
    setMemberSearch("");
    setShowMemberDropdown(false);
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
        await addPlaceholderMember(group.groupId, m.name, user.uid);
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
        autoComplete="off"
        className="flex-1 px-4 pb-8 flex flex-col gap-5"
      >
        {/* Cover Image Upload */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("group.create.cover")}</legend>
          <p className="label pt-0 text-base-content/45">
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
        </fieldset>

        {/* Group Name */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("group.create.name")}</legend>
          <input
            type="text"
            className="input w-full"
            name="group-name"
            placeholder={t("group.create.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="organization"
            maxLength={50}
            required
            autoFocus
          />
        </fieldset>

        {/* Members Section */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">
            {t("group.create.membersSection")}
          </legend>

          {/* Member list (split-target style) */}
          <div className="filter mt-2 flex w-full flex-wrap gap-2">
            {preMembers.map((m) => (
              <label
                key={m.id}
                className={`btn h-auto min-h-11 gap-2 bg-base-100 px-3 text-base-content ${m.isCreator ? "border-base-300 cursor-default" : "border-success cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  name={`create-group-member-${m.id}`}
                  className="sr-only"
                  checked
                  disabled={m.isCreator}
                  onChange={() => {
                    if (!m.isCreator) {
                      handleRemoveMember(m.id);
                    }
                  }}
                />
                <input
                  type="checkbox"
                  checked
                  readOnly
                  className="checkbox checkbox-primary checkbox-sm pointer-events-none"
                  aria-label={m.name}
                />
                <span className="max-w-28 truncate text-sm font-medium">
                  {m.name}
                </span>
              </label>
            ))}
          </div>

          {/* Search / Add */}
          <div className="mt-3">
            <div className="relative">
              <input
                ref={memberSearchInputRef}
                type="text"
                className="input w-full"
                name="member-search"
                placeholder={t("group.create.searchMembers")}
                value={memberSearch}
                onChange={(e) => {
                  setMemberSearch(e.target.value);
                  setShowMemberDropdown(true);
                }}
                onFocus={handleMemberInputFocus}
                onClick={() => setShowMemberDropdown(true)}
                onBlur={() => setTimeout(() => setShowMemberDropdown(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="search"
                enterKeyHint="search"
              />
              {memberSearch.trim() && !loadingContacts && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-circle absolute right-2 top-1/2 -translate-y-1/2"
                  aria-label={t("common.clear")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setMemberSearch("");
                    setShowMemberDropdown(true);
                    keepMemberInputFocused();
                  }}
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
              {loadingContacts && (
                <span className="loading loading-spinner loading-xs absolute right-3 top-1/2 -translate-y-1/2" />
              )}

              {showMemberDropdown &&
                filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl bg-base-100 shadow-lg border border-base-200 overflow-hidden">
                    {filteredSuggestions.slice(0, 6).map((suggestion) => (
                      <button
                        key={suggestion.key}
                        type="button"
                        className="flex w-full items-center gap-2 rounded-none px-4 py-3 text-left transition-colors hover:bg-base-200 active:bg-base-300"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(suggestion);
                        }}
                      >
                        <UserAvatar
                          src={suggestion.avatarUrl}
                          name={suggestion.displayName}
                          size="w-7"
                          textSize="text-[10px]"
                        />
                        <span className="text-sm font-medium truncate">
                          {suggestion.displayName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
            </div>

            {canAddTypedMember && (
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2 text-primary w-full justify-start"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleAddMemberAndKeepFocus}
              >
                <PlusIcon className="h-4 w-4" />
                {t("group.create.addAsMember", { name: trimmedSearch })}
              </button>
            )}
          </div>
        </fieldset>
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
