import { supabase } from './supabaseClient'

export type SimplePoll = {
  id: string
  question: string
  description: string | null
  status: 'open' | 'closed'
  created_at: string
}

export type SimplePollOption = {
  id: string
  poll_id: string
  label: string
  sort_order: number
}

export type SimplePollVote = {
  id: string
  poll_id: string
  option_id: string
  user_id: string
  created_at: string
}

export type SimplePollWithData = SimplePoll & {
  options: SimplePollOption[]
  votes: SimplePollVote[]
}

export async function getSimplePolls(): Promise<SimplePollWithData[]> {
  try {
    const { data: polls } = await supabase
      .from('anderside_simple_polls')
      .select('*')
      .order('created_at', { ascending: false })
    const { data: options } = await supabase.from('anderside_simple_poll_options').select('*').order('sort_order')
    const { data: votes } = await supabase.from('anderside_simple_poll_votes').select('*')
    return (polls ?? []).map(p => ({
      ...p,
      options: (options ?? []).filter(o => o.poll_id === p.id),
      votes: (votes ?? []).filter(v => v.poll_id === p.id),
    }))
  } catch {
    return []
  }
}

export async function createSimplePoll(question: string, description: string, options: string[]): Promise<void> {
  const { data: poll, error } = await supabase
    .from('anderside_simple_polls')
    .insert({ question, description: description || null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  const { error: optErr } = await supabase
    .from('anderside_simple_poll_options')
    .insert(options.map((label, i) => ({ poll_id: poll.id, label, sort_order: i })))
  if (optErr) throw new Error(optErr.message)
}

export async function closeSimplePoll(pollId: string): Promise<void> {
  const { error } = await supabase.from('anderside_simple_polls').update({ status: 'closed' }).eq('id', pollId)
  if (error) throw new Error(error.message)
}

export async function reopenSimplePoll(pollId: string): Promise<void> {
  const { error } = await supabase.from('anderside_simple_polls').update({ status: 'open' }).eq('id', pollId)
  if (error) throw new Error(error.message)
}

export async function deleteSimplePoll(pollId: string): Promise<void> {
  await supabase.from('anderside_simple_polls').delete().eq('id', pollId)
}

export async function castVote(pollId: string, optionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('anderside_simple_poll_votes')
    .insert({ poll_id: pollId, option_id: optionId, user_id: userId })
  if (error) throw new Error(error.message)
}

export async function removeVote(pollId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('anderside_simple_poll_votes')
    .delete()
    .eq('poll_id', pollId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}
