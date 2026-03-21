# Software Design Document (SDD)
# Learnova – Learning Management System

**Version:** 2.0  
**Status:** Final  

---

## 1. System Architecture

### 1.1 Architecture Diagram
```text
Next.js Web App (Browser)
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

---

## 2. System Design Approach

- Client-Server Architecture
- RESTful APIs (`/api/v1/`)
- Stateless backend
- Supabase as unified BaaS (Auth + DB + Storage)

---

## 3. Module Design

### 3.1 Authentication Module
- Supabase Auth (email/password, OAuth optional)
- Supabase JWT session tokens
- RBAC via custom user roles in DB (Admin / Instructor / Learner)

### 3.2 Course Module
- CRUD operations
- Visibility rules (Public / Private / Unlisted)
- Publish/Unpublish logic

### 3.3 Lesson Module
- Content types: Video (URL — YouTube/external), Document (PDF), Image, Text
- File uploads (PDF, images) via Supabase Storage
- No direct video file uploads

### 3.4 Quiz Module

**Sequence Flow**
```text
User → GET Quiz →
User → Submit →
Backend → Evaluate →
Store Attempt →
Calculate Points (attempt-based) →
Update User Points →
Return Result
```

### 3.5 Progress Engine
```text
Lesson Complete →
Update Progress →
Check Course Completion →
Generate Certificate
```

### 3.6 Gamification Engine
```text
Quiz Result →
Calculate Points (attempt-based) →
Update User Total Points →
Check Badge Threshold →
Award Badge
```

### 3.7 Reporting Module
- Aggregate data from DB
- Display analytics (enrollments, completion rate, quiz scores)
- Export reports

---

## 4. Database Design

**Core Entities** *(managed via Prisma ORM on Supabase)*
- Users
- Courses
- Lessons
- Quizzes
- Attempts
- Progress
- Reviews
- Badges

---

## 5. API Design

**Base URL:** `/api/v1/`

| Method | Endpoint       | Role               | Description         |
|--------|----------------|--------------------|---------------------|
| POST   | /auth/login    | All                | Login via Supabase  |
| GET    | /courses       | All                | List courses        |
| POST   | /courses       | Instructor / Admin | Create course       |
| GET    | /courses/{id}  | All                | Course detail       |
| POST   | /lessons       | Instructor         | Add lesson          |
| POST   | /quiz/submit   | Learner            | Submit quiz         |
| GET    | /progress      | Learner            | Get progress        |
| GET    | /reports       | Instructor / Admin | Get reports         |

---

## 6. File Storage Design

**Provider:** Supabase Storage

| File Type | Strategy                                  |
|-----------|-------------------------------------------|
| PDF       | Upload to Supabase Storage                |
| Images    | Upload to Supabase Storage                |
| Videos    | External URL only (YouTube / Vimeo)       |

---

## 7. Security Design

- Supabase Auth (JWT-based sessions)
- HTTPS / TLS
- Input validation (Zod)
- RBAC at API middleware level
- CORS for trusted origins only

---

## 8. Error Handling

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Description"
  }
}
```

---

## 9. Deployment Architecture

```text
Next.js  →  Vercel
Express  →  Railway
DB + Auth + Storage  →  Supabase
```

---

## 10. Failure Handling

- Token expiry → Supabase auto-refresh
- Upload failure → client retry
- Network failure → graceful error message

---

## 11. Future Enhancements

- Real-time notifications (WebSockets)
- AI course recommendations
- Mobile app (Flutter)