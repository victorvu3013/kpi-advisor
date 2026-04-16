# CLAUDE.md — KPI Advisor by Citek'

Hướng dẫn này dành cho Claude Code khi làm việc với project **KPI Advisor**. Đọc toàn bộ file trước khi thực hiện bất kỳ thay đổi nào.

---

## Tổng quan project

**KPI Advisor** là ứng dụng web tư vấn KPI thông minh dành cho nội bộ Citek', tích hợp Claude AI để đề xuất bộ KPI phù hợp cho khách hàng SAP, sau đó đề xuất dashboard layout theo 4 cấp quản lý.

**Stack:** Vanilla HTML/CSS/JS (single-page) + Vercel Serverless Function (Node.js proxy)  
**Ngôn ngữ UI:** Tiếng Việt  
**AI Model:** `claude-sonnet-4-20250514` qua `/api/claude` proxy  
**Branding:** CITEK (Peacock Blue `#005870`, Lime Green `#C5D500`, Cyan `#00D4FF`)

---

## Cấu trúc file

```
kpi-advisor/
├── api/
│   └── claude.js          # Vercel Serverless Function — proxy Anthropic API
├── public/
│   └── index.html         # Toàn bộ app (HTML + CSS + JS trong 1 file)
├── package.json           # engines: node >= 18
├── vercel.json            # rewrites: /api/claude và SPA fallback
└── README.md
```

### `api/claude.js`
Proxy đơn giản: nhận POST từ frontend → gắn `x-api-key` từ `process.env.ANTHROPIC_API_KEY` → forward sang `https://api.anthropic.com/v1/messages` → trả về response.  
Không log, không cache, không transform body. Chỉ thêm header auth.

### `public/index.html`
Single-page app gồm 3 phần:
1. **CSS** — design system CITEK với CSS variables
2. **HTML** — 4 trang wizard (`#page-1` → `#page-4`) + sidebar AI
3. **JS** — toàn bộ logic, không dùng framework/thư viện ngoài

---

## Luồng ứng dụng (4 bước wizard)

```
Bước 1 (page-1)          Bước 2 (page-2)              Bước 3 (page-3)      Bước 4 (page-4)
─────────────────    ─────────────────────────────    ─────────────────    ─────────────────
Nhập thông tin KH    AI loading → KPI table           Dashboard levels     Chọn output
- Tên, quy mô        + AI Suggest Panel (sidebar)     - C-Level            - KPI Document
- Ngành (8 loại)     + Chat Box AI (sidebar)          - D-Level            - Dashboard Spec
- ERP + SAP mods     Filter, checkbox, stats          - M-Level            - Excel
- Mục tiêu           Chọn KPI từ thư viện + AI        - Department         - Presentation
```

**Chuyển bước:** `goStep(n)` — cập nhật `.page.active`, breadcrumb dots, và trigger `buildDashes()` / `buildSummary()` khi vào bước 3/4.

---

## State toàn cục

```js
let selKPIs    = new Set()      // Set<number> — no KPI đã được check
let aiAddedNos = new Set()      // Set<number> — no KPI do AI suggest thêm (1000+idx)
let aiKPIs     = []             // KPI objects được AI tạo ra (không có trong KPI_LIB)
let selOuts    = new Set([...]) // output formats đã chọn
let curIndustry = ''            // industry slug đã chọn ở bước 1
let chatHistory = []            // mảng {role, content} gửi lên API mỗi lần chat
let aiScores   = {}             // map no → score (0-98) tính sau khi chọn SAP modules
let suggestItems = []           // items hiện đang hiển thị trong AI Suggest Panel
```

**Quy ước số KPI:** KPI từ thư viện dùng `no` gốc (1–91). KPI do AI thêm dùng `no = 1000 + idx` để tránh xung đột.

---

## Dữ liệu tĩnh

### `KPI_LIB` (48 items)
Mảng object, mỗi item:
```js
{
  no: number,          // ID duy nhất
  nhom: string,        // nhóm chính (10 nhóm)
  sub: string,         // nhóm chỉ tiêu con
  chi: string,         // tên chỉ tiêu hiển thị
  freq: "Ngày"|"Tuần"|"Tháng",
  pri: "Cao"|"Trung bình"|"Thấp",
  mods: string[]       // SAP modules liên quan, dùng để tính AI score
}
```

**10 nhóm KPI:** Tài chính - Quản trị, Dòng tiền, Công nợ, Giá thành, Kinh doanh, Chất lượng, Bảo trì, Tồn kho, Mua hàng, Sản xuất.

### `DASH_TMPL`
Object với 4 keys (`c`, `d`, `m`, `dept`), mỗi key là mảng dashboard cards:
```js
{ name, type, desc, kpis: string[] }
```

---

## AI Score Logic

```js
function buildScores() {
  // Chạy 1 lần khi AI analysis hoàn thành
  // Base score: Cao=82, Trung bình=62, Thấp=42
  // +5 điểm mỗi SAP module overlap với kpi.mods
  // +random(0-9) để tránh điểm bằng nhau
  // Cap tại 98
}
```

---

## Hai tính năng AI chính (Bước 2)

### 1. AI Suggest Panel (`#asp-body`)

**Trigger:** Tự động gọi `loadSuggestPanel()` khi vào bước 2.

**API call:** `POST /api/claude` với prompt yêu cầu trả về JSON array:
```json
[{"nhom":"...", "chi":"...", "freq":"...", "pri":"...", "why":"..."}]
```

**Fallback:** `fallbackSuggest(ind)` trả về 6 KPI cứng khi API lỗi, có thêm KPI đặc thù cho `manufacturing`/`pharma`.

**Toggle suggest item:**
- Click item → `toggleSuggest(idx)` → nếu chưa add: gọi `addKPIFromSuggest(idx, item)`
- `addKPIFromSuggest` tạo KPI object với `no = 1000 + idx`, thêm vào `aiKPIs`, render row mới vào `#ktbody` với class `kai-added ai-new-row` (border cyan trái)
- Bỏ add: xóa row khỏi DOM, xóa khỏi `selKPIs` và `aiAddedNos`

**"Thêm tất cả":** `addAllSuggested()` loop qua tất cả items chưa add.

**Làm mới:** `refreshSuggest()` reset `#asp-body` về loading spinner → gọi lại `loadSuggestPanel()`.

### 2. Chat Box AI (`#chat-msgs`)

**Init:** `initChat()` reset `chatHistory = []`, render tin nhắn chào mừng.

**Gửi tin:** `sendChat()` —
1. Hiển thị typing indicator
2. Build `sysPrompt` chứa: ngành, SAP modules, danh sách KPI đã chọn (tối đa 20), số KPI AI đã thêm
3. Gọi `POST /api/claude` với `system` + `messages` (full `chatHistory`)
4. Append reply vào `chatHistory` và render vào DOM
5. `tryExtractKPIFromReply()` — nếu reply có dạng danh sách KPI kèm tần suất → hiện bubble gợi ý mở AI Suggest Panel

**Quick buttons:** 4 gợi ý cứng trong `#quick-btns`, click → điền vào input → gọi `sendChat()`.

---

## CSS Design System

Tất cả màu và spacing dùng CSS variables trong `:root`:

| Variable | Giá trị | Dùng cho |
|---|---|---|
| `--teal` | `#005870` | Header, button primary, badge, border-top cards |
| `--lime` | `#C5D500` | CTA button, accent bar, AI dot, progress bar |
| `--lime-dark` | `#a0ac00` | Hover state lime, AI suggest panel border-top |
| `--cyan` | `#00D4FF` | Chat box border-top, AI-added row indicator |
| `--r` | `8px` | border-radius mặc định |
| `--rl` | `12px` | border-radius card/panel lớn |
| `--s1/s2/s3` | shadows | box-shadow theo cấp độ elevation |
| `--font` | `'Montserrat'` | Toàn bộ typography |

**Quy tắc thêm component mới:**
- Dùng `--teal` cho interactive states (focus, border, selected)
- Dùng `--lime` CHỈ cho primary CTA và accents quan trọng
- Không dùng màu hardcode ngoài CSS variables
- Cards luôn có `border-top: 4px solid var(--teal)` hoặc màu tương ứng

---

## Vercel Configuration

### `vercel.json`
```json
{
  "rewrites": [
    { "source": "/api/claude", "destination": "/api/claude" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
Rewrite thứ 2 là SPA fallback — mọi route về `index.html`.

### Environment Variables (bắt buộc)
| Key | Mô tả |
|---|---|
| `ANTHROPIC_API_KEY` | API key từ console.anthropic.com |

Thiếu key này → `api/claude.js` trả `500: API key not configured`.

---

## Hướng dẫn mở rộng

### Thêm KPI vào thư viện
Append vào mảng `KPI_LIB` trong `index.html` với đúng schema. Nhóm `nhom` phải khớp với một trong 10 nhóm hiện có, hoặc thêm option mới vào `<select id="fg">`.

### Thêm ngành mới
1. Thêm `.ic` card vào `#industry-grid` trong HTML
2. Thêm case vào `fallbackSuggest(ind)` nếu ngành có KPI đặc thù

### Thêm dashboard level mới
1. Thêm tab `<div class="ltab">` và content `<div class="lc" id="lc-xxx">`
2. Thêm key tương ứng vào `DASH_TMPL`
3. Thêm case vào `swLv()`

### Thêm output format mới
1. Thêm `.oc` card vào `#page-4`
2. Thêm key vào `selOuts` default set
3. Xử lý trong `genOutputs()`

### Thay đổi AI model
Tìm `model:'claude-sonnet-4-20250514'` trong `index.html` — xuất hiện 2 lần (suggest panel và chat). Đổi cả 2.

### Cải thiện suggest prompt
Sửa `loadSuggestPanel()` — prompt hiện tại yêu cầu JSON array thuần. Nếu thêm field mới vào JSON schema, nhớ cập nhật `renderSuggestPanel()` và `addKPIFromSuggest()` để xử lý field đó.

---

## Lưu ý quan trọng

- **Không dùng framework.** App là vanilla JS thuần — không import React, Vue, hay bất kỳ thư viện JS nào. Giữ nguyên pattern này để tránh phải thêm build step.
- **Không tách file CSS/JS.** Toàn bộ trong `index.html` là có chủ đích — đơn giản hóa deploy và tránh CORS issue khi dev local.
- **API key tuyệt đối không được ở frontend.** Mọi call Anthropic phải đi qua `/api/claude`. Nếu thêm API call mới, thêm vào `api/claude.js`, không gọi thẳng từ HTML.
- **`chatHistory` không persist.** Reload trang → mất history. Nếu cần persist, dùng `sessionStorage` nhưng cẩn thận kích thước context.
- **AI-generated KPI IDs bắt đầu từ 1000.** Không dùng no >= 1000 cho KPI trong thư viện tĩnh.
