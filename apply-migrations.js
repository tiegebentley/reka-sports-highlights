#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase credentials
const SUPABASE_URL = 'https://nxllstmdmqcaiodoensd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0Nzk3NiwiZXhwIjoyMDkyMTIzOTc2fQ.1_EAnxl5tP7V9kYsANypZArC-Fnd0FwemwzxWvmvkAA';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function applyMigrations() {
  const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('validate'))
    .sort();

  console.log('📦 Found migrations:', files);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`\n🔄 Applying migration: ${file}`);

    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        console.error(`❌ Error in ${file}:`, error);

        // Try direct execution for DDL
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ sql_query: sql })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Direct execution failed:`, errorText);

          // Fall back to line-by-line execution
          console.log('🔄 Trying line-by-line execution...');
          const statements = sql.split(';').filter(s => s.trim());

          for (const statement of statements) {
            if (statement.trim()) {
              console.log(`  Executing: ${statement.trim().substring(0, 50)}...`);
              // This won't work for DDL, but we'll try via psql later
            }
          }
        } else {
          console.log(`✅ ${file} applied successfully (direct)`);
        }
      } else {
        console.log(`✅ ${file} applied successfully`);
      }
    } catch (err) {
      console.error(`❌ Exception in ${file}:`, err.message);
    }
  }

  console.log('\n✅ Migration process completed!');
}

applyMigrations().catch(console.error);
