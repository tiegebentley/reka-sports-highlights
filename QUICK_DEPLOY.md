# 🚀 Quick Deployment Checklist

## 1️⃣ Apply Migrations (5 minutes)

1. Open: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/sql/new

2. Run migration 1:
```bash
cat /root/reka-sports-highlights/supabase/migrations/20260418012914_initial_schema.sql
```
Copy output → Paste in SQL Editor → Click "Run"

3. Run migration 2:
```bash
cat /root/reka-sports-highlights/supabase/migrations/20260418013000_storage_bucket.sql
```
Copy output → Paste in SQL Editor → Click "Run"

---

## 2️⃣ Deploy Edge Functions (10 minutes)

```bash
cd /root/reka-sports-highlights

# Set PATH
export PATH="/root/.deno/bin:$PATH"

# Option A: Using supabase CLI (if you have auth)
supabase functions deploy generate-clips --project-ref nxllstmdmqcaiodoensd
supabase functions deploy upload-video --project-ref nxllstmdmqcaiodoensd

# Option B: Manual via Dashboard
# Go to: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/functions
# Create new functions and copy code from supabase/functions/
```

---

## 3️⃣ Set Environment Variables (2 minutes)

Go to: https://supabase.com/dashboard/project/nxllstmdmqcaiodoensd/settings/functions

Add:
```
DB_URL=https://nxllstmdmqcaiodoensd.supabase.co
DB_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDc5NzYsImV4cCI6MjA5MjEyMzk3Nn0.Xpktu3tuFSqSmH991tXOmyFJiQpBAEivZrlYYbwOeQA
DB_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0Nzk3NiwiZXhwIjoyMDkyMTIzOTc2fQ.1_EAnxl5tP7V9kYsANypZArC-Fnd0FwemwzxWvmvkAA
REKA_API_KEY=<YOUR_API_KEY>
```

---

## 4️⃣ Get Reka API Key

1. Go to: https://reka.ai
2. Sign up / Login
3. Navigate to API section
4. Copy your API key
5. Add to function environment variables above

---

## 5️⃣ Test Deployment

```bash
curl -X POST 'https://nxllstmdmqcaiodoensd.supabase.co/functions/v1/generate-clips' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDc5NzYsImV4cCI6MjA5MjEyMzk3Nn0.Xpktu3tuFSqSmH991tXOmyFJiQpBAEivZrlYYbwOeQA' \
  -H 'Content-Type: application/json' \
  -d '{"videoId": "test", "settings": {"template": "moments"}}'
```

---

## 6️⃣ Start Development

```bash
cd /root/reka-sports-highlights/frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## 📋 Status Checklist

- [ ] Migrations applied
- [ ] Edge Functions deployed
- [ ] Environment variables set
- [ ] Reka API key obtained
- [ ] Deployment tested
- [ ] Frontend running

---

## 🆘 Need Help?

See `SETUP_COMPLETE.md` for detailed instructions
See `DEPLOYMENT_GUIDE.md` for troubleshooting
