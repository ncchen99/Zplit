/**
 * App 內建瀏覽器（in-app browser / webview）偵測。
 *
 * Google OAuth 會以 `disallowed_useragent` 拒絕來自這類 webview 的登入請求，
 * 使用者只會看到一頁白底黑字的錯誤，因此登入頁需要事先引導他們改用外部瀏覽器。
 * 匿名登入不經過 Google，在 webview 內仍可正常使用。
 */

export type InAppBrowser = "line" | "facebook" | "instagram" | "messenger";

interface InAppBrowserInfo {
  /** 偵測到的 App，null 代表是一般瀏覽器 */
  app: InAppBrowser | null;
  /** 該 App 是否支援用網址參數直接跳出到外部瀏覽器 */
  canOpenExternally: boolean;
}

// 依序比對。Messenger 的 UA 實際上是 FBAN/MessengerForiOS，多半會落到 facebook
// 那條；兩者都只是「非 LINE 的內建瀏覽器」，走一樣的引導流程，故不影響行為。
const PATTERNS: ReadonlyArray<{ app: InAppBrowser; re: RegExp }> = [
  { app: "line", re: /\bLine\//i },
  { app: "messenger", re: /\bMessenger\b/i },
  { app: "instagram", re: /\bInstagram\b/i },
  { app: "facebook", re: /\bFB(AN|AV)\b/i },
];

export function detectInAppBrowser(
  userAgent: string = navigator.userAgent,
): InAppBrowserInfo {
  const match = PATTERNS.find(({ re }) => re.test(userAgent));
  if (!match) return { app: null, canOpenExternally: false };

  // 目前只有 LINE 提供公開的跳出參數
  return { app: match.app, canOpenExternally: match.app === "line" };
}

/**
 * 產生可跳出 LINE 內建瀏覽器的網址。
 * LINE 讀到 `openExternalBrowser=1` 時會改用系統預設瀏覽器開啟。
 */
export function buildExternalBrowserUrl(href: string = window.location.href) {
  const url = new URL(href);
  url.searchParams.set("openExternalBrowser", "1");
  return url.toString();
}
