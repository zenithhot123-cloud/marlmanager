# MarlineTodo

A modern white-palette project orchestration and daily team intelligence platform built with **React 19**, **Vite**, **Tailwind CSS v4**, **Supabase (PostgreSQL)**, and **Google Gemini 3.1 Flash Lite**.

---

## 🚀 Key Features

### 1. Dual User Modes & Authentication

- **Admin (Project Manager)**:
  - **Secure Manager Portal**: Dedicated login screen verifying credentials against `public.admin_users` (`admin@marline.com` / `admin123`) with 1-click Auto-fill and persistent session management.
  - **Create Projects with Timeline Scheduling**: Select explicit **Start Date** and **Target End Date** calendars with real-time auto-calculated scheduled days ($X$ days = $X \times 8\text{h}$) and auto-generated **4-digit join codes** (e.g. `3309`).
  - **Total Finish Time Countdown**: Live countdown widgets, progress velocity, and overdue tracking.
  - **3-Column Kanban Board**: Track tasks across `To Do`, `In Progress`, and `Completed`. Assign tasks to joined developers with custom durations, priority badges, and due dates.
  - **Today's 1-Line Team Digest**: One-click summary synthesizing the entire team's daily accomplishments into a single concise sentence.
  - **Extended Time & Delay Monitoring**: View total delay days and hours added to tasks, extension frequency, and developer justifications.
  - **Download Reports**: Export full completion reports directly as Markdown (`.md`) files.
  - **Delete Project**: Permanently delete finished or archived projects with full database cascade deletion.

- **Developer**:
  - **Personal 2-Digit PIN Code**: Each developer is assigned a unique 2-digit code upon joining (e.g. `10`, `42`).
  - **Returning Developer Sign In**: Re-enter the project anytime with the 4-digit Project PIN + personal 2-digit PIN without needing passwords.
  - **Task Scheduling & Status**: Cycle task status (`To Do` → `In Progress` → `Completed`) with celebration effects.
  - **Extend Assigned Time (Days or Hours)**: Request/log time extensions multiple times with unit selector (**Days** or **Hours**), dynamic deadline recalculations, and mandatory reasons. Tasks clearly display `+Xd Delay` or `+Xh Delay` badges.
  - **End-of-Day Work Logs**: Record daily accomplishments, hours spent, and blockers.
  - **Gemini Polish**: Clean up rough developer notes into professional standup updates with a single click.

---

### 2. Google Gemini 3.1 Flash Lite AI Integration

- **Project Completion & Retrospective Report**:
  - Details of extended time, delay days and hours, and specific justifications.
  - Daily basis work of each person (tasks completed, logged hours, accomplishments, blockers).
  - Whole project details (target hours vs planned vs delay variance).
  - Clean, easy-to-read, non-complex layout with direct Markdown download.
- **1-Line Daily Executive Digest**:
  - Condenses all daily logs for today into a single concise sentence under 25 words for the Project Manager.
- **Task Breakdown Suggestions**:
  - Automatically suggests realistic task breakdowns and duration estimates when creating projects.

---

### 3. 🛠️ Tech Stack & Database Schema

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Canvas Confetti, React Markdown.
- **Backend / Database**: Supabase PostgreSQL with Realtime enabled.
  - `projects`: `id`, `code` (4-digit), `title`, `description`, `start_date`, `end_date`, `duration_days`, `target_hours`, `status`, `manager_name`, `daily_one_liner`, `daily_one_liner_date`, `ai_report`, `ai_report_generated_at`.
  - `admin_users`: `id`, `email`, `password_hash`, `name`, `role`, `created_at`.
  - `team_members`: `id`, `project_id`, `dev_code` (unique 2-digit PIN), `name`, `role`, `avatar_color`, `joined_at`.
  - `tasks`: `id`, `project_id`, `assignee_id`, `title`, `description`, `duration_hours`, `total_delay_hours`, `total_delay_days`, `delay_count`, `priority`, `status`, `due_date`, `created_at`, `updated_at`, `completed_at`.
  - `task_extensions`: `id`, `task_id`, `project_id`, `member_id`, `unit` (`hours` | `days`), `extended_hours`, `extended_days`, `reason`, `created_at`.
  - `daily_logs`: `id`, `project_id`, `member_id`, `log_date`, `content`, `blockers`, `hours_spent`, `tasks_completed_summary`, `created_at`.
  - `project_reports`: `id`, `project_id`, `report_type`, `content`, `model_used`, `generated_at`.

---

### 4. 💻 Running the Application

```bash
# 1. Install dependencies
npm install

# 2. Start the development server (runs on port 5173)
npm run dev

# 3. Build for production
npm run build
```

Open `http://localhost:5173/` in your browser.

- **Admin Login Credentials:**
  - Email: `admin@marline.com`
  - Password: `admin123`
---

### 5. 🚢 Deployment to GitHub & Vercel

#### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: MarlineTodo production-ready app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

#### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Import your GitHub repository.
3. Framework Preset: **Vite** (auto-detected).
4. (Optional) Set Environment Variables in Vercel project settings:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Publishable Anon Key
   - `VITE_GEMINI_API_KEY`: Your Google Gemini API Key
   *(If not set, default production fallbacks from `.env.example` are used automatically)*.
5. Click **Deploy**. Vercel will build and launch the site with single-page app routing handled via `vercel.json`.
