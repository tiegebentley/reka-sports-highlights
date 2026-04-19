#!/usr/bin/env python3
import os
import requests
from pathlib import Path

SUPABASE_URL = "https://nxllstmdmqcaiodoensd.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bGxzdG1kbXFjYWlvZG9lbnNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjU0Nzk3NiwiZXhwIjoyMDkyMTIzOTc2fQ.1_EAnxl5tP7V9kYsANypZArC-Fnd0FwemwzxWvmvkAA"

def execute_sql(sql):
    """Execute SQL using Supabase REST API"""
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

    # Try the query endpoint
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/query",
        headers=headers,
        json={"query": sql}
    )

    return response

def main():
    migrations_dir = Path("supabase/migrations")
    migration_files = sorted([f for f in migrations_dir.glob("*.sql") if "validate" not in f.name])

    print(f"📦 Found {len(migration_files)} migrations")

    for migration_file in migration_files:
        print(f"\n🔄 Applying: {migration_file.name}")

        sql = migration_file.read_text()

        # Split into individual statements
        statements = [s.strip() for s in sql.split(';') if s.strip()]

        print(f"   Found {len(statements)} statements")

        for i, statement in enumerate(statements, 1):
            print(f"   [{i}/{len(statements)}] Executing...")

            response = execute_sql(statement)

            if response.status_code == 200:
                print(f"   ✅ Success")
            else:
                print(f"   ⚠️  Status {response.status_code}: {response.text[:200]}")

        print(f"✅ {migration_file.name} completed")

    print("\n✅ All migrations processed!")

if __name__ == "__main__":
    main()
