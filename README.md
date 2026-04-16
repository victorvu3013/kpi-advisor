# KPI Advisor — Citek'

Ứng dụng tư vấn KPI thông minh tích hợp Claude AI, xây dựng theo chuẩn CITEK branding.

## Tính năng
- Bước 1: Nhập thông tin khách hàng (ngành, ERP, SAP modules, mục tiêu)
- Bước 2: AI đề xuất KPI + Chat box hỗ trợ điều chỉnh real-time
- Bước 3: Thiết kế dashboard theo 4 cấp (C-Level, D-Level, M-Level, Department)
- Bước 4: Xuất tài liệu (Word, Dashboard Spec, Excel, PPTX)

## Cấu trúc project

```
kpi-advisor/
├── api/
│   └── claude.js        # Proxy endpoint → Anthropic API
├── public/
│   └── index.html       # Single-page app
├── package.json
├── vercel.json
└── README.md
```

## Deploy lên Vercel

### Cách 1: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel deploy --prod
```

### Cách 2: Vercel Dashboard

1. Push folder này lên GitHub repo
2. Vào [vercel.com](https://vercel.com) → **Add New Project** → Import repo
3. Framework Preset: **Other**
4. Root Directory: `.` (giữ nguyên)
5. Click **Deploy**

## Cấu hình Environment Variable

Sau khi deploy, vào **Project Settings → Environment Variables** và thêm:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (API key của bạn) |

Lấy API key tại: https://console.anthropic.com/

## Redeploy sau khi thêm API key

```bash
vercel --prod
```
hoặc click **Redeploy** trong Vercel Dashboard.
