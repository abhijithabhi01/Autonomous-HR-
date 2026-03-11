# PeopleOS — HR Onboarding Agent

A production-ready autonomous HR onboarding platform built with React, Supabase, and Gemini AI.

## Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Supabase (DB, Auth, Storage, Edge Functions)
- **AI**: Google Gemini 1.5 Flash

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy env file:
```bash
cp .env.example .env.local
```

3. Add your keys to `.env.local`:
- `VITE_SUPABASE_URL` — from supabase.com project settings
- `VITE_SUPABASE_ANON_KEY` — from supabase.com project settings
- `VITE_GEMINI_API_KEY` — from aistudio.google.com

4. Run development server:
```bash
npm run dev
```

## Demo Login

| Role | Email | Password |
|------|-------|----------|
| HR Manager | hr@company.com | any |
| Employee | employee@company.com | any |

Or click the **HR Demo** / **Employee Demo** buttons on the login page.

## Features

### HR Portal
- Dashboard with live stats and employee pipeline
- Employee list with onboarding progress tracking
- Individual employee detail with document status
- Alerts for expiring documents and stalled onboarding

### Employee Portal  
- Personalized welcome page with onboarding progress
- Document upload with Gemini AI verification
- Interactive onboarding checklist
- 24/7 Policy Q&A bot powered by Gemini

## Project Structure
```
src/
├── lib/          # Supabase, Gemini, mock data
├── hooks/        # Auth and data hooks
├── pages/        # HR and Employee page routes
└── components/   # Reusable UI components
```
