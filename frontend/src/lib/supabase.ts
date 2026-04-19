import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_DB_URL
const supabaseAnonKey = import.meta.env.VITE_DB_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing database environment variables (VITE_DB_URL and VITE_DB_ANON_KEY)')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
