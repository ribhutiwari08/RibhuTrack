# RibhuTrack

A private teacher management dashboard for batches, students, attendance, class history, topics, homework and reports.

## Stack
- Frontend: React + Vite + Tailwind-style CSS
- Backend: Node.js + Express
- Database: PostgreSQL
- Authentication: JWT + bcrypt
- Hosting: GitHub Pages/Vercel for frontend, Render/Railway for backend

## Features
- Teacher login
- Dashboard with class and attendance summary
- Batch CRUD
- Student CRUD with join date and status
- Class records with date, time, topic, teaching notes and homework
- Attendance per class
- Student attendance history
- Search and filters
- Responsive teacher-first UI

## Local setup

### Backend
```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

### Frontend
```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Set `VITE_API_URL` to the backend URL.

## Database
Create a PostgreSQL database and set `DATABASE_URL` in `backend/.env`. The API initializes its tables on startup.

## Deployment
Keep secrets only in the hosting provider's environment variables. Never commit `.env` files or database credentials.
