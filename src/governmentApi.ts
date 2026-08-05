import { supabase } from './supabaseClient'

export type GovernmentRole = {
  role: 'pm' | 'deputy_pm'
  discord_id: string | null
  username: string | null
  avatar_url: string | null
  updated_at: string | null
}

export async function getGovernment(): Promise<{ pm: GovernmentRole; deputy_pm: GovernmentRole }> {
  const { data, error } = await supabase
    .from('anderside_government')
    .select('*')
    .in('role', ['pm', 'deputy_pm'])
  if (error) throw new Error(error.message)
  const pm = data?.find(r => r.role === 'pm') ?? { role: 'pm', discord_id: null, username: null, avatar_url: null, updated_at: null }
  const deputy_pm = data?.find(r => r.role === 'deputy_pm') ?? { role: 'deputy_pm', discord_id: null, username: null, avatar_url: null, updated_at: null }
  return { pm, deputy_pm }
}

export async function setGovernmentRole(
  role: 'pm' | 'deputy_pm',
  discord_id: string | null,
  username: string | null,
  avatar_url: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('anderside_government')
    .update({ discord_id, username, avatar_url, updated_at: new Date().toISOString() })
    .eq('role', role)
  if (error) throw new Error(error.message)
}
