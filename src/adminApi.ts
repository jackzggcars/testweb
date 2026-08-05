import { supabase } from './supabaseClient'

const INITIAL_ADMIN = { discord_id: '1441903590162563212', username: '0gnj' }

export type AdminEntry = {
  discord_id: string
  username: string | null
  avatar_url: string | null
}

// Push the current session user's Discord info into the DB row
async function syncCurrentUser() {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return
  const discord_id = user.user_metadata?.provider_id as string | undefined
  if (!discord_id) return
  const username =
    (user.user_metadata?.global_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name) as string | undefined
  const avatar_url = user.user_metadata?.avatar_url as string | undefined
  await supabase
    .from('anderside_admins')
    .update({ username: username ?? null, avatar_url: avatar_url ?? null })
    .eq('discord_id', discord_id)
}

export async function checkAdmin(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  const discord_id = data.session?.user?.user_metadata?.provider_id as string | undefined
  if (!discord_id) return false

  // Ensure initial admin is always in the table
  if (discord_id === INITIAL_ADMIN.discord_id) {
    await supabase
      .from('anderside_admins')
      .upsert({ discord_id: INITIAL_ADMIN.discord_id, username: INITIAL_ADMIN.username }, { onConflict: 'discord_id' })
  }

  const { data: row } = await supabase
    .from('anderside_admins')
    .select('discord_id')
    .eq('discord_id', discord_id)
    .maybeSingle()

  if (row) await syncCurrentUser()

  return !!row
}

export async function getAdmins(): Promise<AdminEntry[]> {
  // Always sync the current user's latest Discord info before returning the list
  await syncCurrentUser()

  const { data, error } = await supabase
    .from('anderside_admins')
    .select('discord_id, username, avatar_url')
    .order('username', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function addAdmin(discordId: string): Promise<AdminEntry[]> {
  const { error } = await supabase
    .from('anderside_admins')
    .upsert({ discord_id: discordId, username: null, avatar_url: null }, { onConflict: 'discord_id' })
  if (error) throw new Error(error.message)
  return getAdmins()
}

export async function removeAdmin(discordId: string): Promise<AdminEntry[]> {
  const { data } = await supabase.auth.getSession()
  const myId = data.session?.user?.user_metadata?.provider_id as string | undefined
  if (discordId === myId) throw new Error('Cannot remove yourself')
  const { error, count } = await supabase
    .from('anderside_admins')
    .delete({ count: 'exact' })
    .eq('discord_id', discordId)
  if (error) throw new Error(error.message)
  if (count === 0) throw new Error(`No admin found with ID ${discordId}`)
  return getAdmins()
}
