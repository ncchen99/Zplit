import { useTranslation } from "react-i18next";
import { Share as ShareIcon, EllipsisVertical as MenuIcon, Compass as SafariIcon } from "lucide-react";

interface PWAInstallModalProps {
  open: boolean;
  onClose: () => void;
  /** "ios" = Safari steps; "ios-chrome" = redirect to Safari; "android" = Chrome menu steps */
  variant: "ios" | "ios-chrome" | "android";
}

export function PWAInstallModal({ open, onClose, variant }: PWAInstallModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const steps =
    variant === "ios"
      ? [
          {
            label: t("pwa.install.ios.step1"),
            hint: t("pwa.install.ios.step1Hint"),
            icon: <ShareIcon className="w-4 h-4 text-blue-500" />,
          },
          {
            label: t("pwa.install.ios.step2"),
            hint: t("pwa.install.ios.step2Hint"),
          },
          {
            label: t("pwa.install.ios.step3"),
            hint: t("pwa.install.ios.step3Hint"),
          },
        ]
      : variant === "ios-chrome"
        ? [
            {
              label: t("pwa.install.iosChrome.step1"),
              hint: t("pwa.install.iosChrome.step1Hint"),
              icon: <MenuIcon className="w-4 h-4 text-base-content/60" />,
            },
            {
              label: t("pwa.install.iosChrome.step2"),
              hint: t("pwa.install.iosChrome.step2Hint"),
              icon: <SafariIcon className="w-4 h-4 text-blue-500" />,
            },
            {
              label: t("pwa.install.iosChrome.step3"),
              hint: t("pwa.install.iosChrome.step3Hint"),
              icon: <ShareIcon className="w-4 h-4 text-blue-500" />,
            },
          ]
        : [
            {
              label: t("pwa.install.android.step1"),
              hint: t("pwa.install.android.step1Hint"),
              icon: <MenuIcon className="w-4 h-4 text-base-content/60" />,
            },
            {
              label: t("pwa.install.android.step2"),
              hint: t("pwa.install.android.step2Hint"),
            },
            {
              label: t("pwa.install.android.step3"),
              hint: t("pwa.install.android.step3Hint"),
            },
          ];

  const subtitle =
    variant === "ios"
      ? t("pwa.install.ios.subtitle")
      : variant === "ios-chrome"
        ? t("pwa.install.iosChrome.subtitle")
        : t("pwa.install.android.subtitle");

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        {/* Header */}
        <div className="mb-4">
          <h3 className="font-bold text-lg leading-tight">
            {t("pwa.install.title")}
          </h3>
          <p className="text-xs text-base-content/50 mt-0.5">{subtitle}</p>
        </div>

        {/* Steps */}
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{step.label}</p>
                {step.icon ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    {step.icon}
                    <span className="text-xs text-base-content/60">
                      {step.hint}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-base-content/60 mt-0.5">
                    {step.hint}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>

        <div className="modal-action mt-2">
          <button className="btn " onClick={onClose}>
            {t("pwa.install.understood")}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
