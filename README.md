# 🎓 College Fee Portal

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/swayampakulasurya88/college-fee-portal)

A full-stack web app for tracking college fees. Each student's fee is split into three
heads — **tuition fee**, **hostel fee** and a **monthly mess fee**. The fixed heads are
billed **term-wise**: tuition across **4 terms** and hostel across **2 terms**, at a rate
that depends on the student's **quota** (ACAT / BCAT / Spot). The **admin** assigns the
fixed fees in bulk by term + quota, imports the mess fee every month for chosen students,
and manages payments. **Students** log in with just their roll number to see their fee
report — head-wise and term-wise totals, paid and outstanding due — record a payment (with
a transaction ID and term) and message the admin.

- **Frontend:** React 18 + Vite (single-page app, responsive, print-friendly reports)
- **Backend:** Node.js + Express (REST API, JWT auth, role-based access)
- **Database:** MongoDB 8 (persistent, running locally from `.mongodb/`)

---

## ✨ Features

### Admin
- Dashboard with **college-wide grand total**, total collected, total outstanding, a
  fee-head breakdown (tuition / hostel / mess) and a collection-rate progress bar.
- **Students:** add, edit, delete, search (roll number, name, college, branch, phone),
  filter by status, paginated list, and **bulk import** many roll numbers at once — either
  from the UI (paste straight from Excel/CSV) or from the command line.
- Track each student's **college** (e.g. KIET / KIEK) alongside branch, year, section and
  admission **quota** (ACAT / BCAT / SPOT).
- **Fee Structure:** assign fixed fees **term-wise** in bulk. Pick a fee head, the term(s),
  a target (a quota group — ACAT / BCAT / SPOT — or hand-picked students) and the amount,
  then apply. Tuition runs over 4 terms and hostel over 2; one-click presets cover
  **ACAT tuition ₹18,750 ×4**, **BCAT/Spot tuition ₹31,250 ×4** and **hostel ₹25,000 ×2**.
  Every term fee can also be edited or cleared per student.
- **Mess fees:** import the **monthly mess fee** in bulk for chosen students (or one
  student at a time), edit or delete any month, and see month-by-month totals.
- **Fee payments:** record a payment under a fee head (**tuition / hostel / mess**) and, for
  tuition/hostel, the **term** it settles, with a transaction ID; edit or delete it. The
  student's **due recalculates instantly** and drops the matching term.
- **Messages inbox:** read student queries, reply, mark seen/resolved, delete.
- **Daily report:** day-by-day collection for any date range, with a printable view.

### Student
- Log in with **roll number only** (no password).
- See the **grand total**, **total paid**, **total due** and a per-head break-up for
  **tuition, hostel and mess**, plus a **term-by-term break-up** (fee / paid / due per
  term) and the monthly mess bills.
- **Pay a fee:** choose the head, the **term** (for tuition/hostel), enter the amount and
  **transaction / UTR ID**, and it is recorded immediately against their account (visible
  to the admin).
- Send messages/updates to the admin and read replies.

---

## 🚀 Quick start

> Everything runs locally — **no root access and no system database install required**.

### 1. One-command setup

```bash
bash scripts/setup.sh
```

This downloads the portable MongoDB binary into `.mongodb/` and installs all Node
dependencies (root, API and web). You can run the steps manually instead if you prefer:

```bash
# download MongoDB (only if .mongodb/server/bin/mongod is missing)
mkdir -p .mongodb && cd .mongodb
curl -L -o mongo.tgz https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2404-8.0.4.tgz
tar -xzf mongo.tgz && mv mongodb-linux-x86_64-ubuntu2404-8.0.4 server && rm mongo.tgz
cd .. && npm run install:all
```

### 2. Start the local MongoDB

A portable MongoDB binary lives in `.mongodb/` and stores data in `.mongodb/data`.

```bash
npm run db:start     # start
npm run db:stop      # stop
```

### 3. Load student data

The repository ships with the real roster (90 students, KIET + KIEK) in
`server/data/students.json`. The file lists each student's roll number, name, college and
(optionally) **quota** — the fixed fees themselves are assigned term-wise from the
**Fee Structure** page after import.

```bash
npm run import                 # loads data/students.json (default)
npm run import -- path/to/file.csv
npm run import -- file.csv --fresh   # wipe students/payments/messages first
```

Recognises these columns (case-insensitive, header row auto-detected in CSV):
`roll number, name, college, branch, year, section, email, phone, quota`. Existing roll
numbers are updated; new ones are created. Safe to re-run. `quota` accepts `ACAT`, `BCAT`
or `SPOT` (defaults to `ACAT`). The monthly mess fee is imported from the admin
**Mess Fees** page, not from this file. Charges that come from a "total fee" column are
**not** applied to the term-wise structure — set tuition/hostel from the **Fee Structure**
page.

> Want sample data instead? `npm run seed` creates 6 demo students with payments.

### 4. Run the app

Run the API and the web app together (needs the first `npm install` to have added
`concurrently`):

```bash
npm run dev
```

Or in two terminals:

```bash
npm run server   # API on http://localhost:4000
npm run client   # Web on http://localhost:5173
```

Open **http://localhost:5173**.

---

## 🔑 Logins

| Role    | How to sign in                            |
| ------- | ----------------------------------------- |
| Admin   | `admin` / `admin888ss` (from `.env`)      |
| Student | Enter a roll number, e.g. `25B21A4510`    |

> Change the admin password and the JWT secret in `server/.env` before real use.

---

## 🗂 Project structure

```
collegeweb/
├── .mongodb/                 # Portable MongoDB server + data (git-ignored)
├── scripts/
│   ├── db-start.sh           # starts the local MongoDB
│   └── db-stop.sh            # stops it
├── server/                   # Express + Mongoose API
│   ├── .env                  # config (ports, secrets, admin login)
│   ├── data/
│   │   └── students.json     # real roster imported by `npm run import`
│   └── src/
│       ├── index.js          # app entry / route wiring
│       ├── db.js             # Mongo connection
│       ├── models/           # Student, TermFee, Payment, MessBill, Message
│       ├── middleware/auth.js
│       ├── routes/           # auth, students, fees, payments, mess, messages, reports
│       ├── utils/            # finance math, serializers, helpers
│       ├── import.js         # CLI importer (JSON/CSV -> MongoDB)
│       └── seed.js           # demo data
└── client/                   # React (Vite) front end
    └── src/
        ├── api.js            # fetch wrapper + token handling
        ├── auth.jsx          # auth context
        ├── format.js         # ₹ / date formatting
        ├── styles.css        # design system
        ├── components/       # UI kit, layout, modals
        └── pages/            # Login, student + admin pages
```

---

## 🧮 How the money works

Each student's fee is made of three heads:

```
Tuition Fee = sum of the 4 tuition terms  (₹18,750/term for ACAT, ₹31,250/term for BCAT/Spot)
Hostel Fee  = sum of the 2 hostel terms   (₹25,000/term)
Mess Fee    = sum of the monthly mess bills imported by the admin

Grand Total = Tuition + Hostel + Mess
Total Paid  = sum of all payments (per head: tuition / hostel / mess)
Total Due   = Grand Total − Total Paid
```

The fixed fees are stored **term-wise** in the `TermFee` collection (one row per student,
head and term); `Student.tuitionFee` / `Student.hostelFee` are kept in sync as their totals
so lists and reports stay fast. Assign or change them from **Fee Structure** — by term and
by quota — and every affected student updates at once.

Payments carry a **term** for tuition and hostel, so the term-wise break-up knows exactly
which installment was settled; mess payments are monthly and carry no term. Every add /
edit / delete of a payment, a term-fee change, or a monthly mess import immediately
recomputes the student's report and the admin dashboard.

A student is **Paid** when due ≤ 0, **Unpaid** with no payments, otherwise **Partial**.

---

## 🧪 API reference (all under `/api`)

| Method & path | Access | Purpose |
| --- | --- | --- |
| `POST /auth/student-login` | public | Roll-number login |
| `POST /auth/admin-login` | public | Admin login |
| `GET /auth/me` | any | Current identity + fresh finance |
| `GET /students` | admin | List with search, status + quota filter, pagination |
| `POST /students` | admin | Create student |
| `POST /students/bulk` | admin | Import many students |
| `GET /students/:id` | admin | Student + term fees + payments + mess bills |
| `PATCH /students/:id` | admin | Update details / quota |
| `DELETE /students/:id` | admin | Delete student + term fees + payments + mess bills + messages |
| `GET /students/me` | student | Own profile + finance |
| `GET /students/me/payments` | student | Own payments |
| `GET /payments` | admin | List payments (search, fee head + date range) |
| `GET /payments/mine` | student | Own payments |
| `POST /payments` | admin + student | Add payment (head + term for tuition/hostel, with a transaction ID) |
| `PATCH /payments/:id` | admin | Edit payment (amount / head / term) |
| `DELETE /payments/:id` | admin | Delete payment |
| `GET /fees` | admin | List term fees (filter by head / term / quota / student) |
| `GET /fees/summary` | admin | Billed totals per head and per term + quota mix |
| `GET /fees/mine` | student | Own term-wise fixed fees |
| `POST /fees` | admin | Set one student's fee for a head + term |
| `POST /fees/bulk` | admin | Assign a term amount to many students (by quota / selection / all) |
| `PATCH /fees/:id` | admin | Edit a term fee |
| `DELETE /fees/:id` | admin | Delete a term fee |
| `GET /mess` | admin | List monthly mess bills (filter by month) |
| `GET /mess/months` | admin | Month-by-month mess totals |
| `GET /mess/mine` | student | Own monthly mess bills |
| `POST /mess` | admin | Add/update one student's mess bill for a month |
| `POST /mess/bulk` | admin | Set a month's mess fee for many students |
| `PATCH /mess/:id` | admin | Edit a mess bill |
| `DELETE /mess/:id` | admin | Delete a mess bill |
| `POST /messages` | student | Send message to admin |
| `GET /messages/mine` | student | Own messages + replies |
| `GET /messages` | admin | Inbox (status filter + search) |
| `PATCH /messages/:id` | admin | Set status (unread/read/resolved) |
| `POST /messages/:id/reply` | admin | Reply and resolve |
| `DELETE /messages/:id` | admin | Delete message |
| `GET /reports/summary` | admin | College-wide totals + defaulters |
| `GET /reports/daily` | admin | Day-by-day collection |
| `GET /reports/student/me` | student | Own fee report |

---

## 🔒 Security notes

- Passwords/secrets live in `server/.env` (git-ignored).
- JWTs protect every data route; admin-only routes are separated from student routes.
- Input is validated server-side (amounts, dates, duplicates, ownership).

For production you would: switch `MONGODB_URI` to a managed MongoDB, set a strong
`JWT_SECRET`, change the admin password, and build the client (`npm --prefix client run build`).
