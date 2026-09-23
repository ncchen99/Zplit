import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check as CheckIcon } from "lucide-react";
import { ActionSheetSelect } from "@/components/ui/ActionSheetSelect";
import { TW_BANKS } from "@/lib/banks";
import {
  getMyPaymentAccount,
  hasBankAccount,
  isValidPaymentAccount,
  sameAccount,
  saveMyPaymentAccount,
  type PaymentAccount,
} from "@/services/paymentService";
import { useUIStore } from "@/store/uiStore";
import { logger } from "@/utils/logger";

const OTHER_BANK = "other";

/**
 * 收款方式：銀行帳號和／或 LINE Pay。跟暱稱一樣自動儲存；
 * 銀行填到一半（沒選銀行、帳號位數不對）不存，帳號清空就是不收銀行轉帳。
 * 存的時候會同步到自己所有群組。
 */
export function PaymentAccountSection({ uid }: { uid: string }) {
  const { t } = useTranslation();
  const showToast = useUIStore((s) => s.showToast);

  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<PaymentAccount | null>(null);
  const [bankChoice, setBankChoice] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [linePay, setLinePay] = useState(false);
  // 最後一次儲存的結果；「儲存中」由 pending 推得，不另外存
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">(
    "idle",
  );

  useEffect(() => {
    let cancelled = false;
    getMyPaymentAccount(uid)
      .then((account) => {
        if (cancelled) return;
        setSaved(account);
        if (account && hasBankAccount(account)) {
          const known = TW_BANKS.some((b) => b.code === account.bankCode);
          setBankChoice(known ? account.bankCode : OTHER_BANK);
          setCustomCode(known ? "" : account.bankCode);
          setAccountNumber(account.accountNumber);
        }
        setLinePay(!!account?.linePay);
      })
      .catch((err) => {
        logger.error("paymentAccount.load", "讀取收款帳號失敗", err);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const bankCode = bankChoice === OTHER_BANK ? customCode : bankChoice;
  // 兩種都沒有就是移除
  const draft = useMemo<PaymentAccount | null>(
    () =>
      accountNumber || linePay
        ? {
            ...(accountNumber && { bankCode, accountNumber }),
            ...(linePay && { linePay: true }),
          }
        : null,
    [accountNumber, bankCode, linePay],
  );
  const draftValid = draft === null || isValidPaymentAccount(draft);
  const changed = !sameAccount(draft, saved);
  // 有一筆可以存、但還沒存進去的變更
  const pending = loaded && changed && draftValid;

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(async () => {
      setSaveState("idle");
      try {
        await saveMyPaymentAccount(uid, draft);
        setSaved(draft);
        setSaveState("saved");
      } catch (err) {
        logger.error("paymentAccount.save", "儲存收款帳號失敗", err);
        setSaveState("error");
        showToast(t("common.error"), "error");
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draft, pending, showToast, t, uid]);

  // 選了銀行或打了帳號，但銀行那一組還沒填完
  const incomplete =
    (!!bankCode || !!accountNumber) &&
    !isValidPaymentAccount({ bankCode, accountNumber });

  const statusText = incomplete
    ? t("settings.payment.incomplete")
    : pending
      ? saveState === "error"
        ? t("group.settings.autoSave.error")
        : t("group.settings.autoSave.saving")
      : saveState === "saved"
        ? t("group.settings.autoSave.saved")
        : "";

  // 跟暱稱同一層：legend + 欄位 + 下方靠右的儲存狀態
  return (
    <fieldset className="fieldset w-full">
      <legend className="fieldset-legend">{t("settings.payment.title")}</legend>
      <ActionSheetSelect
        value={bankChoice}
        options={[
          ...TW_BANKS.map((b) => ({
            value: b.code,
            label: `${b.code} ${b.name}`,
          })),
          { value: OTHER_BANK, label: t("settings.payment.otherBank") },
        ]}
        onChange={setBankChoice}
        placeholder={t("settings.payment.bankPlaceholder")}
        ariaLabel={t("settings.payment.bankPlaceholder")}
        showAvatar={false}
        disabled={!loaded}
      />
      {bankChoice === OTHER_BANK && (
        <input
          type="text"
          inputMode="numeric"
          className="input w-full tabular-nums"
          placeholder={t("settings.payment.bankCodePlaceholder")}
          aria-label={t("settings.payment.bankCodePlaceholder")}
          value={customCode}
          onChange={(e) =>
            setCustomCode(e.target.value.replace(/\D/g, "").slice(0, 3))
          }
        />
      )}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className="input w-full tabular-nums"
        placeholder={t("settings.payment.accountPlaceholder")}
        aria-label={t("settings.payment.accountPlaceholder")}
        value={accountNumber}
        disabled={!loaded}
        onChange={(e) =>
          // 從網銀複製來的常帶 - 或空格，只留數字
          setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 16))
        }
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        {/* LINE Pay 在 LINE 裡選好友就能轉，不需要帳號，打勾就好 */}
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="checkbox checkbox-primary checkbox-sm"
            checked={linePay}
            disabled={!loaded}
            onChange={(e) => setLinePay(e.target.checked)}
          />
          {t("settings.payment.linePay")}
        </label>
        {statusText && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-base-content/50">
            {!incomplete && !pending && saveState === "saved" && (
              <CheckIcon className="h-3.5 w-3.5" />
            )}
            {statusText}
          </span>
        )}
      </div>
    </fieldset>
  );
}
