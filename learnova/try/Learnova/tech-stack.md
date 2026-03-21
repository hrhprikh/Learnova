# 🚀 Technology Stack
# Learnova – Learning Management System (LMS)

---

## 🖥️ Frontend (Web)

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Query (TanStack Query)
- **UI Components:** shadcn/ui (optional)
- **HTTP Client:** Fetch / Axios

---

## ⚙️ Backend

- **Runtime:** Node.js
- **Framework:** Express
- **Language:** TypeScript
- **API Style:** REST (`/api/v1/...`)

---

## 🗄️ Database

- **Database:** PostgreSQL
- **Hosting:** Supabase
- **ORM:** Prisma ORM
- **Migrations:** Prisma Migrate

---

## 🔐 Authentication & Authorization

- **Auth Provider:** Supabase Auth
- **Method:** Email / Password (OAuth optional)
- **Token Handling:** Supabase JWT
- **Authorization:** Role-Based Access Control (RBAC)
- **Roles:** Admin / Instructor / Learner

---

## 📦 Storage & Media

- **Storage:** Supabase Storage
- **Usage:**
  - Documents (PDFs)
  - Images
  - Videos: **URL only** (YouTube / external embed)

---

## 📡 API & Communication

- **Protocol:** HTTP (REST)
- **Format:** JSON
- **Client:** Fetch / Axios

---

## 🚀 Deployment

| Platform  | Service                        |
|-----------|--------------------------------|
| Frontend  | Vercel                         |
| Backend   | Railway (recommended) / Render |
| Database  | Supabase                       |
| Storage   | Supabase Storage               |

---

## 📊 Monitoring & Logging

- **Error Tracking:** Sentry
- **Logs:** Winston / Pino

---

## 🧱 Final Architecture

```text
Next.js Web (All Users)
        │
        ▼
Node.js Backend (Express)
        │
        ▼
PostgreSQL (Supabase)
        │
        ├── Supabase Auth
        └── Supabase Storage
```
