#!/bin/bash

SUPABASE_URL="https://nxllstmdmqcaiodoensd.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0Nzk3NiwiZXhwIjoyMDkyMTIzOTc2fQ.1_EAnxl5tP7V9kYsANypZArC-Fnd0FwemwzxWvmvkAA"

echo "🔄 Applying migration: initial_schema.sql"

# Read the SQL file and execute it
SQL=$(cat supabase/migrations/20260418012914_initial_schema.sql)

curl -X POST "$SUPABASE_URL/rest/v1/rpc/exec" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL" | jq -Rs .)}" \
  -v

echo ""
echo "✅ Migration attempted"
