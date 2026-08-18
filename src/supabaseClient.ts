import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from '../utils/supabase/info'

const WIN = window as typeof window & { __sb?: SupabaseClient }
if (!WIN.__sb) {
  WIN.__sb = createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
    auth: { storageKey: 'anderside-auth' },
  })
}
export const supabase = WIN.__sb

if (import.meta.hot) import.meta.hot.accept(() => {})
