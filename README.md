# Sterling Distillers - Employee Payslip Distribution System

A lightweight, production-ready web application for Sterling Distillers Private Limited HR to distribute monthly salary slips to employees through email.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Neon PostgreSQL**, **Prisma ORM**, **Tailwind CSS**, **Nodemailer (SMTP)**, and **XLSX**.

---

## 🔒 Core Privacy & Security Architecture

- **Zero PDF Storage Policy**: Salary slip PDFs and employee remuneration figures are **NEVER** saved to Neon PostgreSQL, disk storage, S3, Cloudinary, or any permanent cloud storage.
- **In-Memory Buffer Processing**: Uploaded PDF files are buffered ephemerally in RAM, streamed directly to Nodemailer as standard RFC 2822 email attachments, and immediately garbage-collected upon delivery.
- **Strict Isolation**: Each email is dispatched individually to the employee's single address. Other employee email addresses and confidential attachments are never exposed via CC or BCC.
- **Dynamic In-App SMTP Management**: Outgoing mail credentials can be configured and tested dynamically directly inside the Settings UI.
- **HR Authentication**: HR operations are protected by authentication passcode middleware (`/login`). Default passcode: `admin123` (configured via `HR_PASSCODE`).

---

## 🛠️ Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **Next.js 16 (App Router)** | Full-stack React framework with server components and route handlers |
| **TypeScript** | Strict type safety across database models, APIs, and client views |
| **Neon PostgreSQL** | Serverless PostgreSQL cloud database for employee master data |
| **Prisma ORM** | Object-relational mapping and schema management |
| **Tailwind CSS 4** | Modern responsive styling with clean SaaS dashboard design |
| **Nodemailer** | Direct individual SMTP email dispatch with delivery verification |
| **XLSX (SheetJS)** | Excel (.xlsx, .xls) and CSV parsing and styled template generation |

---

## 🚀 Key Modules & Capabilities

### 1. Employee Directory (`/employees`)
- **Add Employee**: Create new employee records with Employee ID, Full Name, Email, and Department.
- **Edit & Delete**: Full CRUD capabilities with confirmation dialogs.
- **Excel & CSV Ingestion**: Drag-and-drop `.xlsx` or `.csv` files. Automatically recognizes variations of column headers (`Employee ID`, `Name`, `Email Address`, `Department`), creates new employees, updates existing records, and flags invalid emails.
- **Download Excel Template**: Download a styled template (`Employee_Import_Template.xlsx`) with guidance and sample data.
- **Export Directory**: Export current employee list to an Excel spreadsheet.
- **Monthly Delivery Status Tracking**: Select any month and year to track each employee's payslip status (`✅ Sent` with timestamp vs `⚠️ Missed / Not Sent`) with quick filter tabs.

### 2. Payslip Distribution (`/payslips`)
- **Period Selection**: Select salary month and year.
- **Multi-File PDF Upload**: Drop as many salary slip PDFs as needed with no artificial upload limits.
- **Smart Assignment Selection**: Once an employee is assigned to a PDF, their name is automatically excluded from subsequent dropdowns to prevent accidental duplicates.
- **In-Memory PDF Preview & Download**: View attachments safely in an in-memory browser viewer with zero file persistence.
- **Review & Bulk Dispatch**:
  - Review personalized email subject and body per employee before sending.
  - Confirmation dialog with recipient count and isolation summary.
  - Real-time animated progress bar with Sent, Failed, and Pending counters.
  - SMTP rate-limiting throttling (350ms buffer) to comply with email provider throughput limits.
  - **Retry Failed**: Allows retrying only failed deliveries without resending to successful ones.

### 3. Email Composer (`/composer`)
- Customize email subject line and body with dynamic placeholders:
  - `{{employee_name}}`
  - `{{employee_id}}`
  - `{{month}}`
  - `{{year}}`
- One-click variable inserter tags.
- Live real-time email client simulation showing interpolated content.
- Reset to default template and save custom templates to browser storage.

### 4. Settings (`/settings`)
- **Dynamic SMTP Configuration**: Enter Host, Port, Username, Password, and "From" header directly in the web UI.
- **One-Click Presets**: Quick-fill settings for Zoho Workspace, Gmail, and Microsoft 365.
- **Connection Test**: Run a live SMTP handshake test without dispatching payslips.

---

## ⚙️ Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```env
# Neon PostgreSQL Database Connection URL
DATABASE_URL="postgresql://neondb_owner:npg_1ztxhRyE8MnX@ep-misty-flower-b3ilz2nl-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# HR Administrator Passcode for portal login (Default: admin123)
HR_PASSCODE="admin123"

# Optional fallback SMTP Configuration (Can be configured dynamically via the web Settings UI)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM=""
SMTP_SECURE="false"
```

---

## 🧪 Testing

Run the automated integration test suite:

```bash
npm test
```

This validates:
- Employee CRUD operations and ID uniqueness
- Excel & CSV ingestion with column header normalization
- Pattern matching logic and manual assignment
- Dynamic email template variable interpolation
- Audit logging and dispatch records
- Monthly delivery status calculation and selection dropdown exclusion
- Dynamic in-app SMTP configuration and password masking

---

## 🖥️ Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Push Prisma schema to Neon PostgreSQL
npx prisma db push

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Log in using passcode: `admin123`.
