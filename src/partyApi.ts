import { supabase } from './supabaseClient'

export type Party = {
  id: string
  abbr: string
  name: string
  leader: string
  leader_handle: string
  size: 'major' | 'minor'
  color: string
  description: string
}

export async function getParties(): Promise<Party[]> {
  const { data, error } = await supabase
    .from('anderside_parties')
    .select('*')
    .order('size', { ascending: true }) // major first
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createParty(party: Omit<Party, 'id'>): Promise<Party[]> {
  const { error } = await supabase.from('anderside_parties').insert(party)
  if (error) throw new Error(error.message)
  return getParties()
}

export async function updateParty(id: string, party: Omit<Party, 'id'>): Promise<Party[]> {
  const { error } = await supabase.from('anderside_parties').update(party).eq('id', id)
  if (error) throw new Error(error.message)
  return getParties()
}

export async function deleteParty(id: string): Promise<Party[]> {
  const { error: votesError } = await supabase.from('anderside_votes').delete().eq('party_id', id)
  if (votesError) throw new Error(votesError.message)
  const { error } = await supabase.from('anderside_parties').delete().eq('id', id)
  if (error) throw new Error(error.message)
  return getParties()
}
