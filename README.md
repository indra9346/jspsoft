# SwanSchoolERP

School Management ERP by **Swan Digital Solutions** — *Smarter Management · Better Learning · Brighter Future.*

Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL (target: **Amazon RDS, ap-south-1**) · pdf-lib · deployable on **Vercel**.

> Status honesty: the app builds, passes its test suites and is demo-ready locally. It is **not yet deployed** to AWS or Vercel —
> this repository contains everything needed and the exact steps are below.

---------------------------------------------------------------------------------------------------

## 1. Architecture

```
src/
  app/                    Next.js routes  (login/ · (app)/ authenticated pages · api/)
  actions/                Server Actions — all writes. Each one authorises + checks the plan itself
  components/             UI (server + a few client components: forms, charts, attendance sheet, marks grid)
  lib/
    features.ts           ★ the ONE feature registry (default + locked add-ons, copy, previews)
    features-server.ts    isFeatureEnabled() / assertFeature()  (reads school_features)
    tenant.ts             signed session cookie (uid, sid=school id, role)
    db.ts                 ★ school-scoped Prisma client `db` + unscoped `rawDb`
    auth.ts               getUser(), requireUser(roles, feature), requireActionUser(roles, feature)
    access.ts             canViewStudent(), visibleClasses(), announcement visibility
    results.ts / reports.ts / pdf.ts   computation, report builder, real PDF generation
prisma/                   schema.prisma · migrations/ · seed.ts (demo) · init-prod.ts (first school + admin)
scripts/                  test suites (smoke, action-tests, ui-tests, schema-check) and feature.ts (unlock CLI)
```

Roles: `ADMIN`, `TEACHER`, `STUDENT` (active) and `PARENT` (locked add-on — login refused, see §4).

## 2. Local setup

```bash
npm install
cp .env.example .env         # edit DATABASE_URL and AUTH_SECRET
npx prisma migrate deploy    # creates the schema (or `npx prisma db push` for a throw-away dev DB)
npm run db:seed              # demo data — WIPES every table in the target DB
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | **server only** | PostgreSQL / RDS connection string. Never prefix with `NEXT_PUBLIC_`. |
| `AUTH_SECRET` | **server only** | Signs session cookies (`openssl rand -hex 32`). Must be changed in production. |
| `DB_BACKUP_RETENTION_DAYS` | server | Shown on the *Database & Deployment* page. |
| `DEFAULT_SCHOOL_SLUG` | server | Which school's branding the login page shows (default: first school). |
| `NEXT_PUBLIC_SWAN_WEBSITE` | public (harmless) | Link to swandigitalsolutions.com. |
| `NEXT_PUBLIC_SHOW_DEMO` | public (harmless) | `false` hides the pre-filled demo credentials on the login page. |

`smoke.ts` scans the built client bundle for `postgresql://`, the secret value and AWS key patterns.

### Demo accounts (password `Swan@123`)

| Account | Role |
| --- | --- |
| `admin@swanschool.in` | Admin, **Swan School** |
| `teacher1@swanschool.in` | Anita Sharma — teaches Mathematics in 10-A, class teacher of 6-A |
| `student1@swanschool.in` | Student, class 6-A (attendance, marks, timetable) |
| `rahul.kumar@swanschool.in` | Student, class 10-A (Maths internal 18/20 + theory 72/80 = 90/100) |
| `admin@riverdale.in`, `teacher@riverdale.in`, `student1@riverdale.in` | **Riverdale Public School** — second tenant used to prove isolation |

## 3. Database

* PostgreSQL, Prisma. **Migrations** live in `prisma/migrations` (`0001_init`, `0002_school_id_indexes`) and are verified to
  build the exact schema from an empty database (no drift). Production: `npx prisma migrate deploy`.
* Multi-school: every school-owned table has `schoolId` (FK → `School`, indexed with `schoolId` leading). Unique constraints are
  per school (`@@unique([schoolId, admissionNo])`, etc.). `npm run test:schema` checks columns, FKs, indexes and cross-school integrity.
* Timestamps (`createdAt` / `updatedAt`), status enums (`AttendanceStatus`, `LeaveStatus`, `BusStatus`, `RequestStatus`…) and cascading FKs are used throughout.
* Photos, logos and signatures are stored as size-limited base64 in PostgreSQL (student photo ≤ 250 KB, logo/signature ≤ 400 KB) —
  no local disk needed on serverless hosting. For very large schools move them to S3 (not configured).
* **Databases on this machine:** `swanschoolerp` = the original demo database (left untouched); `swanschoolerp_v2` = the current
  multi-school database (`.env` points here). Nothing was dropped without approval.

## 4. Feature plans

**DEFAULT (always on):** students, staff (teaching), classes, subjects, allocation, attendance, teacher_attendance, marks, results,
timetable, announcements, leave, **transport (basic)**, reports, branding.

**LOCKED add-ons (14):** fees, payments, receipts, parent_portal, non_teaching_staff, advanced_transport, gps, notifications,
biometric, payroll, library, inventory, hostel, custom_integrations.

Every locked page (incl. sub-pages: Driver App, Real-Time Tracking, Parent Live Tracking, SMS, Email, WhatsApp) shows
*"… is not active under your current plan"*, a demo preview with disabled controls (no data read or written, no fake payments,
no fake live location) and **Request Unlock**. The receipt page is a template labelled **PREVIEW — NOT A VALID RECEIPT**.

Enforcement is on the server, never just in the UI:

* pages: `requireUser(roles, "feature")` · actions: `requireActionUser(roles, "feature")` → `assertFeature()`
* `/api/features/<key>` answers **403** to GET/POST/PUT/PATCH/DELETE while locked
* `src/actions/locked.ts` — add-on entry points (e.g. non-teaching staff create/delete) that refuse while locked

### Unlock request workflow

Admin → any locked page → **Request Unlock** → `/swan-digital` form (school, administrator, email, phone, feature, message) →
row in `feature_unlock_requests` with status `PENDING` → confirmation with https://swandigitalsolutions.com.
Swan staff then run (per school):

```bash
npm run feature -- list    swan-school
npm run feature -- request <request-id> CONTACTED
npm run feature -- unlock  swan-school parent_portal      # sets school_features, marks the request APPROVED
npm run feature -- lock    swan-school parent_portal
```

Unlocking removes the lock screen; the module itself is then implemented/configured for that school.

## 5. Security model

* Session = signed HttpOnly JWT cookie (`uid`, `sid` school, `role`; `Secure` in production). A token whose user does not belong to its `sid` is rejected.
* **Tenant isolation:** `db` (src/lib/db.ts) injects the session's `schoolId` into every read/write of every school-owned model, so ids from another
  school simply do not exist (404 / "not found"). `rawDb` is used only for login, tenant lookup, seeding and scripts. Request bodies cannot choose a school.
  *Not* implemented: Postgres row-level security (possible extra hardening).
* **Student privacy:** `canViewStudent()` — admin: own school; teacher: assigned sections only; student: only themself. Student pages read the id from the
  session, never from the URL. Report card / CSV / PDF endpoints call the same check.
* **Teachers** can mark attendance only for sections they teach / are class teacher of, and enter marks only for their allocated class + section + subject.
* Passwords: bcrypt. Uploads: type and size checked. All inputs validated with zod.

## 6. Reports & PDF

* **Real server-generated PDFs (pdf-lib):** report card (`/results/report-card/<id>/pdf`), any report (`/reports/export?type=…&format=pdf`), student attendance.
  Logo (Swan logo or the school's own PNG/JPG) and principal signature are embedded.
* **Printable browser pages:** report card page and `/reports` (print CSS hides navigation and adds a branded header).
* **CSV:** every report. Types: student, staff, attendance (student / class / section / month / school), marks, results, class, section, transport, leave.

## 7. Tests

```bash
npm run build && npx next start -p 3300      # production build in one terminal
npm run test:smoke   -- http://localhost:3300   # HTTP: pages per role, guards, cross-student/school attacks, locked API (5 methods × 14 features), CSV/PDF, secrets in bundle
npm run test:actions                            # real server actions as different users (allowed + forbidden)
npm run test:schema                             # DB review: school_id, FKs, indexes, integrity
npm run test:ui  -- http://localhost:3300       # REAL BROWSER (Edge via Playwright): clicks every admin/teacher/student form, uploads, 4 viewports
npm run typecheck && npm run lint
```

`test:ui` creates test records and `test:actions` edits demo data — run `npm run db:seed` afterwards to reset.

## 8. Deploy: AWS RDS + Vercel (not yet performed)

**RDS (ap-south-1 Mumbai)**
1. Aurora and RDS → Create database → *Full configuration* → PostgreSQL 16/17, Multi-AZ optional, storage encrypted, **automated backups on** (7+ days; set `DB_BACKUP_RETENTION_DAYS`).
2. Networking: Vercel functions have no fixed IPs. Either make the instance publicly accessible with a **strong password + `sslmode=require`**
   and a security group open on 5432, or use **RDS Proxy / Vercel Secure Compute** for a private path (recommended for production).
3. Connection string: `postgresql://USER:PASSWORD@<endpoint>.ap-south-1.rds.amazonaws.com:5432/swanschool?sslmode=require&connection_limit=1&pool_timeout=20`
   (`connection_limit=1` because each serverless function opens its own pool; use RDS Proxy for many concurrent users).
4. Apply the schema and create the first school + admin:
   ```bash
   export DATABASE_URL="postgresql://…"
   npx prisma migrate deploy
   SCHOOL_SLUG=my-school SCHOOL_NAME="My School" ADMIN_EMAIL=principal@school.in ADMIN_PASSWORD='strong-password' npm run db:init
   ```
   Run `db:init` again with another slug for another school. **Do not run `db:seed` in production** (it wipes data).

**Vercel**
1. Import the Git repo. Framework: Next.js. Build command is already `prisma generate && next build` (`postinstall` also runs `prisma generate`).
2. Environment variables (Production): `DATABASE_URL`, `AUTH_SECRET`, `DB_BACKUP_RETENTION_DAYS`, `NEXT_PUBLIC_SHOW_DEMO=false`, optional `DEFAULT_SCHOOL_SLUG`. **Never** add DATABASE_URL/AUTH_SECRET as `NEXT_PUBLIC_*`.
3. Deploy, open the site, sign in, change the password (*My Profile*), set up *Branding & Settings*, then academic year → classes → subjects → teachers → allocation → students.
4. Check *Database & Deployment* (admin): RDS host, TLS, HTTPS, backups, env checks.

## 9. Production checklist

- [ ] `AUTH_SECRET` is a fresh random value; `DATABASE_URL` uses `sslmode=require` and a non-default password
- [ ] `npx prisma migrate deploy` applied; `db:init` run; **no demo seed**
- [ ] `NEXT_PUBLIC_SHOW_DEMO=false`; demo accounts do not exist
- [ ] RDS automated backups + CloudWatch alarms enabled; deletion protection on
- [ ] Custom domain + HTTPS on Vercel; cookies are `Secure` in production
- [ ] Branding: logo, principal name, signature uploaded; report card PDF checked once
- [ ] `npm run test:smoke` / `test:actions` pass against the deployed build's staging DB
- [ ] Add-ons stay locked until Swan runs `npm run feature -- unlock …`

## 10. Known limits

* No live GPS, payments, fees, parent portal, non-teaching staff, biometric, payroll, library, inventory, hostel — locked by design.
* Tenant isolation is application-level (scoped Prisma client), not Postgres RLS.
* PDF text uses the standard Helvetica font (no ₹ glyph → printed as "Rs."); complex scripts (Tamil/Hindi) are not embedded.
* Images are stored in the database (size-limited); S3 storage is not configured.
* `next start` on Windows can hold Prisma's engine file — stop dev servers before `npm run build`.
