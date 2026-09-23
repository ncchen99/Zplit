/**
 * 常用的台灣金融機構代號（總行代碼）。
 * 順序照代碼排，跟各家網銀「選擇轉入銀行」的清單一致，找起來比較直覺。
 * 不在清單上的（農會、信用合作社、電子支付等）在設定頁選「其他銀行」自己填代碼。
 *
 * 2026-09 對照維基百科「台灣金融機構代號列表」與發票小幫手的銀行代碼表。
 * 刻意不列：日盛 815（2023 併入台北富邦，代碼 2024-04 停用，改用 012）、
 * 花旗 021（個人金融 2023 轉給星展，個人帳戶改用 810）、中國輸出入銀行 015（不收個人存款）。
 */
export const TW_BANKS: { code: string; name: string }[] = [
  { code: "004", name: "臺灣銀行" },
  { code: "005", name: "土地銀行" },
  { code: "006", name: "合作金庫" },
  { code: "007", name: "第一銀行" },
  { code: "008", name: "華南銀行" },
  { code: "009", name: "彰化銀行" },
  { code: "011", name: "上海銀行" },
  { code: "012", name: "台北富邦" },
  { code: "013", name: "國泰世華" },
  { code: "016", name: "高雄銀行" },
  { code: "017", name: "兆豐銀行" },
  { code: "018", name: "農業金庫" },
  { code: "048", name: "王道銀行" },
  { code: "050", name: "臺灣企銀" },
  { code: "052", name: "渣打銀行" },
  { code: "053", name: "台中銀行" },
  { code: "054", name: "京城銀行" },
  { code: "081", name: "滙豐銀行" },
  { code: "101", name: "瑞興銀行" },
  { code: "102", name: "華泰銀行" },
  { code: "103", name: "新光銀行" },
  { code: "108", name: "陽信銀行" },
  { code: "118", name: "板信銀行" },
  { code: "147", name: "三信銀行" },
  { code: "700", name: "中華郵政" },
  { code: "803", name: "聯邦銀行" },
  { code: "805", name: "遠東銀行" },
  { code: "806", name: "元大銀行" },
  { code: "807", name: "永豐銀行" },
  { code: "808", name: "玉山銀行" },
  { code: "809", name: "凱基銀行" },
  { code: "810", name: "星展銀行" },
  { code: "812", name: "台新銀行" },
  { code: "816", name: "安泰銀行" },
  { code: "822", name: "中國信託" },
  { code: "823", name: "將來銀行" },
  { code: "824", name: "連線銀行 LINE Bank" },
  { code: "826", name: "樂天銀行" },
];

/** 「822 中國信託」；清單上沒有的代碼只顯示代碼 */
export function formatBank(code: string): string {
  const bank = TW_BANKS.find((b) => b.code === code);
  return bank ? `${bank.code} ${bank.name}` : code;
}

/** 顯示用：每 4 碼空一格比較好對。複製時要用原本的純數字，銀行 App 貼上帶空格會出錯 */
export function formatAccountNumber(accountNumber: string): string {
  return accountNumber.replace(/(\d{4})(?=\d)/g, "$1 ");
}
