# AI 代理人指令與行為約束（AGENTS）

## 角色定義
- 產品/需求整理
- 系統設計
- 實作與重構
- 測試與除錯
- 文件維護

## UI / 視覺設計最高優先規則（非常重要）

### 1) 優先使用 DaisyUI「原始設定＋原生樣式」
- **主軸**：所有 UI 優先用 DaisyUI v5 元件與其預設樣式（class/語彙/互動狀態），避免一開始就用大量 Tailwind 細節 class 重新造輪子。
- **允許的調整**：僅做 DaisyUI 已提供的「安全調整」，例如元件變體（`btn-primary`/`btn-ghost`）、尺寸（`btn-sm`）、佈局（`flex`/`grid`）、間距（`gap`/`p`/`m`）等；避免自行定義一整套色票、陰影、邊框規則。
- **主題（Theme）**：主題策略以 `specs/requirements.md` 為準（淺色 `lemonade`、深色 `dim`）。
- **開發前置**：任何 UI 元件開發前，先讀 `https://daisyui.com/llm.txt`，確保元件 API 與 class 名稱正確。

### 2) 只有在 DaisyUI 無法涵蓋時，才啟用「補充設計準則」
以下準則是 **fallback**：當 DaisyUI 的原生元件樣式不足以達成產品需求（或需要做少量品牌化/精修）時，才可參考並套用。

#### 核心設計準則（Ref: Steve Schoger / Tailwind CSS）

##### 2.1 陰影與邊框處理（Shadows & Borders）
- **Outer Ring 取代 Solid Border**：對於有陰影的元素（按鈕、卡片、導覽列），避免實色邊框造成混濁；改用 `gray-950` 且 `opacity 10%` 的 outer ring。
- **Inset Ring 邊緣定義**：在淡色背景容器上，使用 `5% opacity` 的 inset ring 取代傳統 border。
- **Concentric Radius（同心圓角）**：內層圓角半徑應等於外層半徑減去 padding（\(inner\_radius = outer\_radius - padding\)）。

##### 2.2 字體排版（Typography）
- **Inter Variable Font**：優先使用 Inter variable；可用中間字重（如 550）。關閉 `ss02`（帶尾巴的小寫 l）特性。
- **大字體 Tracking**：24px 以上字體需收緊字距（如 `tracking-tight`）。
- **Eyebrow 文字**：使用 `Geist Mono`、`uppercase`、`tracking-wider`、`text-xs`、`gray-600`。
- **文字排版優化**：依情境切換 `text-pretty`（避免孤字）與 `text-balance`（均勻分布）。
- **小字體行高**：`text-sm`（14px）可嘗試雙倍行高（28px）以增加呼吸感。

##### 2.3 版面佈局（Layout）
- **左對齊優先**：避免過度置中。Hero 建議 Split Headline（標題 3/5 寬居左，描述 2/5 寬居右）。
- **Inline Section Heading**：標題與副標同一行，用 `neutral-950`（深色粗體）與 `neutral-600`（灰色中等字重）區分。
- **ch 單位控制寬度**：使用 `max-w-[40ch]` 等限制文字最大寬度，提升閱讀舒適度。

##### 2.4 元素細節（Elements）
- **按鈕規範**：高度 36–38px、`rounded-full`、`text-sm`；移除不必要的 icon。
- **視覺對齊魔法**：有 ring 與無 ring 按鈕並排時，用 `span` 包裹並以 `inline-flex + p-px` 補償 2px 高度差。
- **Well-styled Container**：截圖容器用極淡背景（`gray-950` at 2.5–5% opacity），移除邊框，底部零 padding 營造「坐落感」，並加 inset ring。
- **高解析截圖**：視覺元素優先使用 3x 高解析度 App 截圖。

##### 2.5 裝飾與收尾（Finishing Touches）
- **Canvas Grid**：section 間加入裝飾線條（水平線全寬、垂直線限制在容器內）。
- **Testimonial Card**：人像照片背景＋底部暗色漸層（gradient shim）＋白字。
- **Logo Cloud**：使用真實 SVG；移除透明度（直接用 `gray-950`），不需標題。

## 溝通策略（設計導向）
- 使用設計語言而非單純程式碼指令
- 優先問「這個是怎麼做的？」來檢查實作邏輯
- 要求全站同步樣式（同一套 DaisyUI 語彙與元件變體）
- 必要時建立臨時視覺化工具進行微調

## 工作流程（建議）
1. 先讀 `specs/requirements.md` 與 `specs/SPEC.md`，再動手改碼
2. 提出改動前先列出影響範圍與風險
3. 小步提交：每次改動可回溯、可驗證
4. 同步更新相關規格與任務

## 行為約束
- 不猜測需求：不足處以「假設」區塊記錄
- 不引入無關依賴：需要新增依賴時先說明理由
- 不提交密鑰/憑證：避免把敏感資訊寫入 repo
- 以可維護為優先：保持一致命名、結構、錯誤處理風格

## 產出物
- 規格：`specs/requirements.md`、`specs/SPEC.md`
- 任務：`specs/tasks.md`
- 設計：`designs/DESIGN.md`

