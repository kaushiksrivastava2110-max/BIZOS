# BIZOS Setup Guide

## 1. Create Supabase Project

1. Go to https://supabase.com → New Project
2. Name it `bizos`, choose a region, set a strong database password
3. Wait for project to provision (~2 min)

## 2. Configure Environment Variables

Edit `.env.local` with your real values:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RESEND_API_KEY=re_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Find these in: Supabase Dashboard → Settings → API

## 3. Run Database Schema

In Supabase Dashboard → SQL Editor, run in order:

1. Contents of `supabase/migrations/001_initial_schema.sql`
2. (Optional) `supabase/migrations/002_seed.sql`

## 4. Create Demo Users

In Supabase Dashboard → Authentication → Users → Add User:

| Name | Email | Password | Role |
|------|-------|----------|------|
| Admin User | admin@bizquad.com | admin123! | admin |
| Recruiter A | recruiter.a@bizquad.com | pass123! | recruiter |
| Recruiter B | recruiter.b@bizquad.com | pass123! | recruiter |

After creating each user, go to SQL Editor and run:
```sql
UPDATE public.users SET name = 'Admin User', role = 'admin'
  WHERE email = 'admin@bizquad.com';
UPDATE public.users SET name = 'Recruiter A', role = 'recruiter'
  WHERE email = 'recruiter.a@bizquad.com';
UPDATE public.users SET name = 'Recruiter B', role = 'recruiter'
  WHERE email = 'recruiter.b@bizquad.com';
```

## 5. Configure Resend (Optional, for email notifications)

1. Sign up at https://resend.com
2. Add your domain or use their test address
3. Get API key → paste into `.env.local`
4. Update the `FROM` address in `src/app/api/notify/route.ts`

## 6. Run Locally

```bash
npm run dev
```

Open http://localhost:3000 → redirects to `/login`

## 7. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add the same env vars in Vercel Dashboard → Project Settings → Environment Variables.

---

## Architecture Notes

- **Auth**: Supabase Auth (email/password). User profiles auto-created via DB trigger on signup.
- **RLS**: Row Level Security enforced at DB level — Recruiters only see their own data.
- **Activity Logging**: Every meaningful action writes to `activity_logs`. This drives Dashboard, Productivity charts, and Report generation.
- **Kanban**: Drag-and-drop via `@dnd-kit`. Stage changes automatically log to `activity_logs`.
- **PDF Reports**: Browser print (`window.print()`). The report view has `@media print` CSS that hides the sidebar/topbar.
- **Email**: Resend via `/api/notify` endpoint. Call it from any server action to trigger notifications.

## Key Files

| Path | Purpose |
|------|---------|
| `src/types/index.ts` | All TypeScript types |
| `src/lib/supabase/` | Supabase client (browser + server + admin) |
| `src/lib/utils.ts` | Brand colors, formatters, helpers |
| `src/components/layout/Sidebar.tsx` | Main nav |
| `src/components/openings/OpeningKanban.tsx` | Drag-and-drop pipeline board |
| `src/components/daily-log/DailyLogView.tsx` | Recruiter daily input form |
| `supabase/migrations/001_initial_schema.sql` | Full DB schema + RLS |
