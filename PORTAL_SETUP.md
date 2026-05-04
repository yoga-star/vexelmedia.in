# Vexel Media — Client Portal Setup

This guide gets your free client dashboard running in **~10 minutes**. You only do this **once**.

The portal lives at:
- `vexelmedia.in/login` — clients sign in (magic link, no password)
- `vexelmedia.in/portal` — dashboard (smart — shows different views for client vs you)

---

## Step 1 — Create a free Supabase project (3 min)

1. Go to **[supabase.com](https://supabase.com)** → **Start your project** → sign in with GitHub.
2. Click **New project**.
3. Fill in:
   - **Organization:** your default
   - **Project name:** `vexel-clients` (or anything)
   - **Database password:** click **Generate** and copy/save it somewhere safe — you'll rarely need it
   - **Region:** **Mumbai (ap-south-1)** ← lowest latency for Indian users
   - **Pricing plan:** **Free** (already selected)
4. Click **Create new project**. Wait ~2 minutes while it provisions.

---

## Step 2 — Copy your API keys (30 sec)

1. In your Supabase project sidebar, click **⚙️ Project Settings** → **API**.
2. You'll see two values:
   - **Project URL** — looks like `https://abcdefghijk.supabase.co`
   - **Project API keys → `anon` `public`** — a long string starting with `eyJ…`
3. Keep this tab open — you'll paste both into the next step.

---

## Step 3 — Paste credentials into the project (1 min)

1. Open the file **`portal/config.js`** in your code editor (or via GitHub → edit pencil icon).
2. Replace the two placeholder values:

```js
export const SUPABASE_URL = 'https://abcdefghijk.supabase.co';     // ← paste your URL
export const SUPABASE_ANON_KEY = 'eyJ…';                            // ← paste your anon key
```

3. Save & commit/push. Vercel auto-deploys in ~30 seconds.

> **Is the anon key safe to expose?** Yes — it's the *public* key, designed to be in browser code. Security is enforced by Supabase's Row-Level Security (already configured by the SQL below). The anon key alone can't bypass it.

---

## Step 4 — Run the database schema (2 min)

1. In Supabase → sidebar **🗄️ SQL Editor** → **+ New query**.
2. Open `portal/schema.sql` from this repo, **copy the whole file**, paste it into the SQL editor.
3. Click **Run** (bottom right). You'll see a green ✓.

This creates all the tables (profiles, projects, tasks, files, messages), security policies, and the storage bucket for files.

---

## Step 5 — Make your account an admin (2 min)

You need to log in once first, then promote yourself.

1. Open `https://vexelmedia.in/login` (or your live URL).
2. Type your own email → click **Send magic link**.
3. Check inbox → click the link. You land in `/portal`.
4. Go back to Supabase → **SQL Editor** → run this (replace `you@example.com` with the email you used):

```sql
update public.profiles
set role = 'admin', full_name = 'Yoga MN'
where email = 'you@example.com';
```

5. Reload `/portal` — you'll now see the **admin dashboard** with stats, all clients, all tasks.

---

## Step 6 — (Optional) Email branding

By default Supabase magic-link emails come from `noreply@mail.app.supabase.io` and look generic. You can customize:

1. Supabase → **Authentication** → **Email Templates** → edit "Magic Link".
2. Replace the subject and body. A clean version:

   - **Subject:** `Your Vexel Media login link`
   - **Body:**
     ```html
     <h2>Welcome to Vexel Media</h2>
     <p>Click below to sign in to your project portal — it expires in 1 hour.</p>
     <p><a href="{{ .ConfirmationURL }}">Sign in to my portal →</a></p>
     <p>— Vexel Media · vexelmedia.in</p>
     ```

3. (Advanced, later) For mail from `hello@vexelmedia.in`, hook up a custom SMTP provider in **Authentication → SMTP Settings** (Resend / Postmark / Sendinblue all have free tiers).

---

## How clients use the portal

### When you onboard a new client
1. In `/portal`, click **+ Invite client** → paste their email → **Send**.
2. They get a magic link, click it, land in their empty portal.
3. As admin, you can now see them in the client filter, fill in their name/company/package via Supabase **Table Editor → profiles** (or build a UI for that later).

### Clients can:
- Click **+ New project** to create a project (e.g. "Diwali campaign")
- Inside a project, click **+ New task** to submit a brief
- Open a task → upload **references** (their assets, moodboards) → comment → wait for delivery
- When you upload deliverables, they get a download button. Click → file downloads.

### You (admin) can:
- See all clients, all projects, all tasks
- Filter by client or status
- Open any task → change status (Submitted → In progress → Ready for review → Delivered)
- Upload **deliverables** (your final files) — clients see them instantly
- Comment in the thread (your messages show with a lime accent)

---

## File limits (free tier)

Supabase free tier gives you:
- **500 MB** database (≈ tens of thousands of tasks/messages)
- **1 GB** file storage (≈ 1,000 typical PNG/PDF deliverables)
- **2 GB** monthly bandwidth
- **50,000** monthly active users

For an agency with 10–50 clients, you'll be fine for years. If you hit limits, the **Pro plan is $25/mo** with 8 GB DB + 100 GB storage.

---

## Troubleshooting

**"Invalid API key" when logging in**
→ Double-check `portal/config.js` — make sure URL ends with `.supabase.co` (no trailing slash) and anon key is the full `eyJ…` string.

**Clicking magic link doesn't redirect to portal**
→ In Supabase → **Authentication → URL Configuration** → set **Site URL** to `https://vexelmedia.in` and add `https://vexelmedia.in/portal` to **Redirect URLs**.

**"Permission denied" when creating a project**
→ You probably skipped Step 5. Run the `update profiles set role = 'admin'` SQL.

**Files won't upload**
→ Check Supabase → **Storage** → confirm there's a bucket called `task-files`. If not, the SQL might have failed at the storage section — re-run just the `insert into storage.buckets` and policy lines.

---

## What's next (optional improvements)

- **Email notifications** when client submits a task / you deliver — needs a Supabase Edge Function. ~30 min build.
- **Drag-and-drop upload zones** instead of file pickers — UI-only, ~1 hr.
- **Task templates** (pre-fill common briefs like "single Instagram post") — DB + UI, ~2 hrs.
- **Invoicing** — integrate with Razorpay / Stripe when clients approve a deliverable.

Ping me when you're ready for any of these.
