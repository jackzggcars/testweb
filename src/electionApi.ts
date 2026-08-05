import { supabase } from './supabaseClient'

export type Election = {
  id: string
  name: string
  status: 'active' | 'closed' | 'called'
  started_at: string
  ends_at: string
}

export type VoteResult = {
  party_id: string
  party_name: string
  party_abbr: string
  party_color: string
  votes: number
  percentage: number
}

export async function getActiveElection(): Promise<Election | null> {
  // Return active election first; if none, return the most recent closed/called one for results display
  const { data: active } = await supabase
    .from('anderside_elections')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (active) return active
  const { data: recent } = await supabase
    .from('anderside_elections')
    .select('*')
    .in('status', ['called', 'closed'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return recent ?? null
}

export async function getAllElections(): Promise<Election[]> {
  const { data, error } = await supabase
    .from('anderside_elections')
    .select('*')
    .order('started_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function startElection(name: string, hours: number = 24): Promise<Election> {
  const ends_at = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('anderside_elections')
    .insert({ name, ends_at, status: 'active' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function closeElection(id: string, called = false): Promise<void> {
  const { error } = await supabase
    .from('anderside_elections')
    .update({ status: called ? 'called' : 'closed' })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function castVote(electionId: string, partyId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user?.id
  if (!userId) throw new Error('Not signed in')
  const { error } = await supabase
    .from('anderside_votes')
    .insert({ election_id: electionId, party_id: partyId, user_id: userId })
  if (error) {
    if (error.code === '23505') throw new Error('already_voted')
    throw new Error(error.message)
  }
}

export async function getUserVote(electionId: string): Promise<string | null> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user?.id
  if (!userId) return null
  const { data } = await supabase
    .from('anderside_votes')
    .select('party_id')
    .eq('election_id', electionId)
    .eq('user_id', userId)
    .maybeSingle()
  return data?.party_id ?? null
}

export async function removeVote(electionId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session.session?.user?.id
  if (!userId) throw new Error('Not signed in')
  const { error } = await supabase
    .from('anderside_votes')
    .delete()
    .eq('election_id', electionId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function getResults(electionId: string): Promise<VoteResult[]> {
  // Get all votes with party info
  const { data: votes, error } = await supabase
    .from('anderside_votes')
    .select('party_id, anderside_parties(name, abbr, color)')
    .eq('election_id', electionId)
  if (error) throw new Error(error.message)

  const counts: Record<string, { name: string; abbr: string; color: string; votes: number }> = {}
  for (const v of votes ?? []) {
    const p = v.anderside_parties as any
    if (!p) continue
    if (!counts[v.party_id]) {
      counts[v.party_id] = { name: p.name, abbr: p.abbr, color: p.color, votes: 0 }
    }
    counts[v.party_id].votes++
  }

  const total = Object.values(counts).reduce((s, c) => s + c.votes, 0)
  return Object.entries(counts)
    .map(([party_id, c]) => ({
      party_id,
      party_name: c.name,
      party_abbr: c.abbr,
      party_color: c.color,
      votes: c.votes,
      percentage: total > 0 ? Math.round((c.votes / total) * 100) : 0,
    }))
    .sort((a, b) => b.votes - a.votes)
}
