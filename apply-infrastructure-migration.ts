#!/usr/bin/env deno run --allow-net --allow-read --allow-env

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://nxllstmdmqcaiodoensd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0Nzk3NiwiZXhwIjoyMDkyMTIzOTc2fQ.1_EAnxl5tP7V9kYsANypZArC-Fnd0FwemwzxWvmvkAA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const migration = await Deno.readTextFile('./supabase/migrations/20260429000001_infrastructure_extension.sql');

console.log('🚀 Applying infrastructure extension migration...\n');

// Split into smaller chunks and execute
const statements = migration
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

let successCount = 0;
let errorCount = 0;

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i] + ';';
  const preview = statement.substring(0, 80).replace(/\n/g, ' ');

  console.log(`[${i+1}/${statements.length}] ${preview}...`);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ query: statement })
    });

    if (!response.ok) {
      const error = await response.text();
      // Ignore "already exists" errors
      if (error.includes('already exists') || error.includes('duplicate')) {
        console.log('  ⏭️  Already exists, skipping');
      } else {
        console.error('  ❌ Error:', error.substring(0, 100));
        errorCount++;
      }
    } else {
      console.log('  ✅ Success');
      successCount++;
    }
  } catch (err) {
    console.error(`  ❌ Exception:`, err.message);
    errorCount++;
  }
}

console.log(`\n📊 Results: ${successCount} succeeded, ${errorCount} failed`);
console.log('✅ Migration process completed!');
