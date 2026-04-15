import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { PlusIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useAuthStore } from "@/store/authStore";
import { usePersonalStore } from "@/store/personalStore";
import { useUIStore } from "@/store/uiStore";
import { PageHeader, HeaderIconButton } from "@/components/ui/PageHeader";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  addPersonalExpense,
  getContacts,
  ensureContact,
  type PersonalContact,
} from "@/services/personalLedgerService";
import { getUserGroups } from "@/services/groupService";
import { logger } from "@/utils/logger";
import {
  getTaipeiDateTimeLocalString,
  parseTaipeiDateTimeLocalString,
} from "@/utils/datetime";

export function AddPersonalExpensePage() {
  const { t } = useTranslation();
  const { contactId } = useParams<{ contactId?: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const currentContact = usePersonalStore((s) => s.currentContact);
  const storeContacts = usePersonalStore((s) => s.contacts);
  const showToast = useUIStore((s) => s.showToast);

  // ── 聯絡人選取狀態（僅在無 contactId 時使用）──
  const [contacts, setContacts] = useState<PersonalContact[]>(storeContacts);
  const [groupOnlySuggestions, setGroupOnlySuggestions] = useState<
    Array<{
      key: string;
      displayName: string;
      avatarUrl: string | null;
      linkedUserId: string | null;
    }>
  >([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] =
    useState<PersonalContact | null>(null);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [resolvingContact, setResolvingContact] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  // 表單欄位
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState<"self" | "contact">("self");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => getTaipeiDateTimeLocalString());
  const [saving, setSaving] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // 若從個人頁 FAB 進入（無 contactId），需載入聯絡人清單
  const loadContacts = useCallback(async () => {
    if (!user || suggestionsLoaded) return;
    setLoadingContacts(true);
    try {
      const [list, groups] = await Promise.all([
        getContacts(user.uid),
        getUserGroups(user.uid),
      ]);
      setContacts(list);

      const existingContactNames = new Set(
        list.map((c) => c.displayName.trim().toLowerCase()),
      );
      const memberMap = new Map<
        string,
        {
          key: string;
          displayName: string;
          avatarUrl: string | null;
          linkedUserId: string | null;
        }
      >();

      for (const group of groups) {
        for (const member of group.members) {
          const normalized = member.displayName?.trim();
          if (!normalized || member.userId === user.uid) continue;
          const key = normalized.toLowerCase();
          if (existingContactNames.has(key) || memberMap.has(key)) continue;
          memberMap.set(key, {
            key: `group:${key}`,
            displayName: normalized,
            avatarUrl: member.avatarUrl,
            linkedUserId: member.userId ?? null,
          });
        }
      }

      setGroupOnlySuggestions(Array.from(memberMap.values()));
      setSuggestionsLoaded(true);
    } catch (err) {
      logger.error("addPersonalExpense.loadContacts", "載入聯絡人失敗", err);
    } finally {
      setLoadingContacts(false);
    }
  }, [suggestionsLoaded, user]);

  useEffect(() => {
    if (!contactId) {
      loadContacts();
    }
  }, [contactId, loadContacts]);

  // 有 contactId 時，優先用目前聯絡人名稱，否則退回清單中的名稱
  const selectedContactFromStore = contactId
    ? contacts.find((c) => c.contactId === contactId)
    : null;
  const resolvedContactName = contactId
    ? (currentContact?.displayName ??
      selectedContactFromStore?.displayName ??
      "")
    : (selectedContact?.displayName ?? "");

  const isContactSelected = !!contactId || !!selectedContact;
  const isValid =
    isContactSelected && title.trim() && amount && Number(amount) > 0;

  const trimmedSearch = contactSearch.trim();
  const allSuggestions = [
    ...contacts.map((c) => ({
      key: `contact:${c.contactId}`,
      displayName: c.displayName,
      avatarUrl: c.avatarUrl,
      linkedUserId: c.linkedUserId,
      contact: c,
    })),
    ...groupOnlySuggestions,
  ];
  const filteredSuggestions = trimmedSearch
    ? allSuggestions.filter((c) =>
        c.displayName.toLowerCase().includes(trimmedSearch.toLowerCase()),
      )
    : allSuggestions;
  const showNewContactOption =
    trimmedSearch &&
    !contacts.some(
      (c) => c.displayName.toLowerCase() === trimmedSearch.toLowerCase(),
    );

  const handleCreateAndSelect = async () => {
    if (!user || !trimmedSearch) return;
    setResolvingContact(true);
    try {
      const contact = await ensureContact(user.uid, trimmedSearch);
      setSelectedContact(contact);
      setContactSearch(contact.displayName);
      setContacts((prev) => {
        if (prev.some((c) => c.contactId === contact.contactId)) return prev;
        return [contact, ...prev];
      });
      setShowContactDropdown(false);
    } catch (err) {
      logger.error("addPersonalExpense.createContact", "新增聯絡人失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setResolvingContact(false);
    }
  };

  const handleSelectSuggestion = async (
    suggestion: {
      key: string;
      displayName: string;
      avatarUrl: string | null;
      linkedUserId: string | null;
      contact?: PersonalContact;
    },
  ) => {
    if (!user) return;

    if (suggestion.contact) {
      setSelectedContact(suggestion.contact);
      setContactSearch(suggestion.contact.displayName);
      setShowContactDropdown(false);
      return;
    }

    setResolvingContact(true);
    try {
      const ensured = await ensureContact(
        user.uid,
        suggestion.displayName,
        suggestion.linkedUserId,
        suggestion.avatarUrl,
      );
      setContacts((prev) => {
        if (prev.some((c) => c.contactId === ensured.contactId)) return prev;
        return [ensured, ...prev];
      });
      setSelectedContact(ensured);
      setContactSearch(ensured.displayName);
      setShowContactDropdown(false);
    } catch (err) {
      logger.error("addPersonalExpense.selectContact", "選取聯絡人失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setResolvingContact(false);
    }
  };

  const handleSave = async () => {
    if (!user || !title.trim() || !amount) return;

    const resolvedContactId = contactId ?? selectedContact?.contactId;
    if (!resolvedContactId) return;

    const amountNum = Math.round(Number(amount));
    if (amountNum <= 0 || isNaN(amountNum)) {
      showToast(t("expense.splitValidation.mismatch"), "error");
      return;
    }

    setSaving(true);
    try {
      await addPersonalExpense(user.uid, resolvedContactId, {
        title: title.trim(),
        amount: amountNum,
        paidBy,
        description: description.trim() || null,
        imageUrl: null,
        date: parseTaipeiDateTimeLocalString(date),
      });
      showToast(t("common.toast.recordAdded"), "success");
      navigate(`/personal/${resolvedContactId}`);
    } catch (err) {
      logger.error("personal.addExpense", "新增個人帳務失敗", err);
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    const hasInput = title.trim() || amount;
    if (hasInput) {
      setShowDiscardModal(true);
      return;
    }
    if (contactId) {
      navigate(`/personal/${contactId}`);
    } else {
      navigate("/personal");
    }
  };

  const handleConfirmDiscard = () => {
    if (contactId) {
      navigate(`/personal/${contactId}`);
    } else {
      navigate("/personal");
    }
  };

  return (
    <div className="flex min-h-[100dvh] md:min-h-[inherit] flex-col">
      <PageHeader
        title={t("personal.addExpense")}
        onBack={handleBack}
        rightAction={
          <HeaderIconButton
            onClick={handleSave}
            disabled={!isValid || saving}
            loading={saving}
            tone="primary"
          >
            <CheckIcon className="h-6 w-6" />
          </HeaderIconButton>
        }
      />

      <div className="flex-1 px-4 mt-4 flex flex-col gap-4">
        {/* 聯絡人選取（僅在無 contactId 時顯示）*/}
        {!contactId && (
          <fieldset className="fieldset w-full relative">
            <legend className="fieldset-legend">
              {t("personal.selectContact")}
            </legend>
            <div className="relative">
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder={t("personal.contactPlaceholder")}
                value={contactSearch}
                onChange={(e) => {
                  setContactSearch(e.target.value);
                  setSelectedContact(null);
                  setShowContactDropdown(true);
                }}
                onFocus={() => setShowContactDropdown(true)}
                onClick={() => setShowContactDropdown(true)}
                onBlur={() =>
                  setTimeout(() => setShowContactDropdown(false), 150)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
                autoComplete="off"
              />
              {(loadingContacts || resolvingContact) && (
                <span className="loading loading-spinner loading-xs absolute right-3 top-1/2 -translate-y-1/2" />
              )}
            </div>

            {/* 下拉選單 */}
            {showContactDropdown &&
              filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl bg-base-100 shadow-lg border border-base-200 overflow-hidden">
                  {filteredSuggestions.slice(0, 6).map((c) => (
                    <button
                      key={c.key}
                      className={`flex w-full items-center gap-2 rounded-none px-4 py-3 text-left transition-colors hover:bg-base-200 active:bg-base-300 ${
                        selectedContact?.displayName === c.displayName
                          ? "bg-base-200"
                          : ""
                      }`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        void handleSelectSuggestion(c);
                      }}
                    >
                      <UserAvatar
                        src={c.avatarUrl}
                        name={c.displayName}
                        size="w-7"
                        textSize="text-[10px]"
                      />
                      <span className="text-sm font-medium">
                        {c.displayName}
                      </span>
                    </button>
                  ))}
                </div>
              )}

            {showNewContactOption && (
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2 text-primary w-full justify-start"
                onClick={handleCreateAndSelect}
                disabled={resolvingContact}
              >
                <PlusIcon className="h-4 w-4" />
                {t("personal.addAsNewContact", { name: trimmedSearch })}
              </button>
            )}

            {selectedContact && (
              <p className="mt-1 text-xs text-success">
                {t("personal.contactSelected", {
                  name: selectedContact.displayName,
                })}
              </p>
            )}
          </fieldset>
        )}

        {/* Title */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("expense.title")}</legend>
          <input
            type="text"
            className="input w-full"
            placeholder={t("expense.titlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={50}
            autoFocus={!!contactId}
          />
        </fieldset>

        {/* Amount */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("expense.amount")}</legend>
          <div className="input flex items-center gap-2 w-full">
            <span className="text-base-content/50 font-semibold">NT$</span>
            <input
              type="number"
              className="grow"
              placeholder={t("expense.amountPlaceholder")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              inputMode="numeric"
            />
          </div>
        </fieldset>

        {/* Paid By */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("expense.paidBy")}</legend>
          <div className="join w-full">
            <button
              type="button"
              className={`join-item btn btn-sm btn-pagination-compact flex-1 ${paidBy === "self" ? "btn-active text-base-content/85" : "text-base-content/55 hover:text-base-content/65"}`}
              onClick={() => setPaidBy("self")}
            >
              {resolvedContactName
                ? t("personal.paidFor", { name: resolvedContactName })
                : t("personal.paidForPlaceholder")}
            </button>
            <button
              type="button"
              className={`join-item btn btn-sm btn-pagination-compact flex-1 ${paidBy === "contact" ? "btn-active text-base-content/85" : "text-base-content/55 hover:text-base-content/65"}`}
              onClick={() => setPaidBy("contact")}
            >
              {resolvedContactName
                ? t("personal.contactPaidByName", { name: resolvedContactName })
                : t("personal.contactPaidPlaceholder")}
            </button>
          </div>
        </fieldset>

        {/* Date */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">{t("expense.date")}</legend>
          <input
            type="datetime-local"
            className="input w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </fieldset>

        {/* Description */}
        <fieldset className="fieldset w-full">
          <legend className="fieldset-legend">
            {t("expense.description")}
          </legend>
          <textarea
            className="textarea w-full"
            placeholder={t("expense.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </fieldset>
      </div>

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
              <button className="btn-danger-soft" onClick={handleConfirmDiscard}>
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
