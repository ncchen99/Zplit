import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { Check as CheckIcon, Trash2 as TrashIcon } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { usePersonalStore } from "@/store/personalStore";
import { useUIStore } from "@/store/uiStore";
import { PageHeader, HeaderIconButton } from "@/components/ui/PageHeader";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  getContact,
  getPersonalExpenses,
  updatePersonalExpense,
  deletePersonalExpense,
  type PersonalExpense,
} from "@/services/personalLedgerService";
import { logger } from "@/utils/logger";
import {
  getTaipeiDateTimeLocalString,
  parseTaipeiDateTimeLocalString,
} from "@/utils/datetime";

export function EditPersonalExpensePage() {
  const { t } = useTranslation();
  const { contactId, expenseId } = useParams<{
    contactId: string;
    expenseId: string;
  }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const storeContact = usePersonalStore((s) => s.currentContact);
  const storeExpenses = usePersonalStore((s) => s.currentExpenses);

  const [contactName, setContactName] = useState(
    storeContact?.displayName ?? "",
  );
  const [expense, setExpense] = useState<PersonalExpense | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState<"self" | "contact">("self");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const loadData = useCallback(async () => {
    if (!user || !contactId || !expenseId) return;
    setLoading(true);
    try {
      let resolvedContact = storeContact;
      let resolvedExpenses = storeExpenses;

      if (!resolvedContact || resolvedContact.contactId !== contactId) {
        resolvedContact = await getContact(user.uid, contactId);
      }
      if (!resolvedExpenses.length) {
        resolvedExpenses = await getPersonalExpenses(user.uid, contactId);
      }

      if (resolvedContact) setContactName(resolvedContact.displayName);
      const found =
        resolvedExpenses.find((e) => e.expenseId === expenseId) ?? null;
      setExpense(found);
    } catch (err) {
      logger.error("editPersonalExpense.load", "Failed to load", err);
      showToast(t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [user, contactId, expenseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize form when expense loads
  useEffect(() => {
    if (initialized || !expense) return;
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setPaidBy(expense.paidBy);
    setDescription(expense.description ?? "");
    if (expense.date) {
      const ts = (expense.date as { seconds: number })?.seconds ?? 0;
      setDate(getTaipeiDateTimeLocalString(new Date(ts * 1000)));
    }
    setInitialized(true);
  }, [expense, initialized]);

  const isValid = title.trim() && amount && Number(amount) > 0;

  const handleSave = async () => {
    if (!user || !contactId || !expenseId || !isValid) return;
    const amountNum = Math.round(Number(amount));
    if (amountNum <= 0 || isNaN(amountNum)) return;

    setSaving(true);
    try {
      await updatePersonalExpense(user.uid, contactId, expenseId, {
        title: title.trim(),
        amount: amountNum,
        paidBy,
        description: description.trim() || null,
        date: parseTaipeiDateTimeLocalString(date),
      });
      showToast(t("common.toast.saved"), "success");
      navigate(`/personal/${contactId}`, { replace: true });
    } catch (err) {
      logger.error("personal.editExpense", "Failed to update", err);
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !contactId || !expenseId) return;
    setSaving(true);
    try {
      await deletePersonalExpense(user.uid, contactId, expenseId);
      showToast(t("common.button.done"), "success");
      navigate(`/personal/${contactId}`, { replace: true });
    } catch (err) {
      logger.error("personal.deleteExpense", "Failed to delete", err);
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setShowDiscardModal(true);
  };

  if (loading || !expense) {
    return (
      <div className="flex min-h-[100dvh] md:min-h-[inherit] flex-col">
        <PageHeader title={t("expense.edit")} onBack={() => navigate(-1)} />
        <div className="px-4 pt-4 space-y-4">
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] md:min-h-[inherit] flex-col">
      <PageHeader
        title={t("expense.edit")}
        onBack={handleBack}
        rightAction={
          <HeaderIconButton
            onClick={handleSave}
            disabled={!isValid || saving}
            loading={saving}
            tone="primary"
          >
            <CheckIcon className="h-5 w-5" />
          </HeaderIconButton>
        }
      />

      <div className="flex-1 px-4 mt-4 pb-8 flex flex-col gap-4">
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
              className={`join-item btn btn-sm flex-1 h-auto min-h-11 py-2 whitespace-normal leading-tight ${paidBy === "self" ? "btn-active" : ""}`}
              onClick={() => setPaidBy("self")}
            >
              {t("personal.paidFor", { name: contactName })}
            </button>
            <button
              type="button"
              className={`join-item btn btn-sm flex-1 h-auto min-h-11 py-2 whitespace-normal leading-tight ${paidBy === "contact" ? "btn-active" : ""}`}
              onClick={() => setPaidBy("contact")}
            >
              {t("personal.contactPaidByName", { name: contactName })}
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

        <div>
          <div className="divider mt-1 mb-1" />
          {/* <h3 className="font-semibold text-sm text-error/70 uppercase tracking-wider mb-3">
            {t('group.settings.dangerZone')}
          </h3> */}
          <button
            type="button"
            className="btn-danger-soft w-full mt-4 mb-4"
            onClick={() => setShowDeleteModal(true)}
          >
            <TrashIcon className="h-4 w-4" />
            {t("common.button.delete")}
          </button>
        </div>
      </div>

      {/* Discard modal */}
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

      {/* Delete modal */}
      <ConfirmModal
        open={showDeleteModal}
        title={t("common.button.delete")}
        message={t("expense.deleteConfirm")}
        confirmLabel={t("common.button.delete")}
        confirmVariant="btn-error"
        cancelLabel={t("common.button.cancel")}
        onConfirm={() => {
          setShowDeleteModal(false);
          handleDelete();
        }}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
