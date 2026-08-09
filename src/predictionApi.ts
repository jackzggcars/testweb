import { supabase } from './supabaseClient'

const UB_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHBfaWQiOiIxNTM1OTU0ODU3NjA3OTU0NzA4IiwiaWF0IjoxNzg2MjcwNzAyfQ.faaJbeUHgHzz5IwdMlBHiH4j5RdQx25S-WSTcP-ygSo'
const GUILD_ID = '1525592907719905280'
const UB_BASE = 'https://unbelievaboat.com/api/v1'

export type Poll = {
  id: string
  title: string
  description: string
  status: 'open' | 'closed' | 'resolved'
  winner_option_id: string | null
  created_at: string
  closes_at: string | null
}

export type PollOption = {
  id: string
  poll_id: string
  label: string
}

export type Bet = {
  id: string
  poll_id: string
  option_id: string
  user_id: string
  discord_id: string
  amount: number
  created_at: string
  payout: number | null
}

export type PollWithOptions = Poll & {
  options: PollOption[]
  bets: Bet[]
}

// ── UnbelievaBoat direct calls ────────────────────────────────────────────────

async function ubFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${UB_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: UB_TOKEN,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`UnbelievaBoat error ${res.status}: ${text}`)
  }
  return res.json()
}

export async function getBalance(discordId: string): Promise<number> {
  try {
    const data = await ubFetch(`/guilds/${GUILD_ID}/users/${discordId}`)
    return data.cash ?? 0
  } catch {
    return 0
  }
}

async function ubDeduct(discordId: string, amount: number): Promise<void> {
  const bal = await ubFetch(`/guilds/${GUILD_ID}/users/${discordId}`)
  if ((bal.cash ?? 0) < amount) throw new Error('insufficient_funds')
  await ubFetch(`/guilds/${GUILD_ID}/users/${discordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ cash: -Math.abs(amount) }),
  })
}

async function ubPayout(discordId: string, amount: number): Promise<void> {
  try {
    await ubFetch(`/guilds/${GUILD_ID}/users/${discordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ cash: Math.abs(amount) }),
    })
  } catch (e) {
    console.warn('Payout failed for', discordId, e)
  }
}

// ── Polls ─────────────────────────────────────────────────────────────────────

export async function getPolls(): Promise<PollWithOptions[]> {
  try {
    const { data: polls, error } = await supabase
      .from('anderside_polls')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return []
    const { data: options } = await supabase.from('anderside_poll_options').select('*')
    const { data: bets } = await supabase.from('anderside_bets').select('*')
    return (polls ?? []).map(p => ({
      ...p,
      options: (options ?? []).filter(o => o.poll_id === p.id),
      bets: (bets ?? []).filter(b => b.poll_id === p.id),
    }))
  } catch {
    return []
  }
}

export async function createPoll(title: string, description: string, options: string[], closesAt: string | null): Promise<Poll> {
  const { data: poll, error } = await supabase
    .from('anderside_polls')
    .insert({ title, description, closes_at: closesAt, status: 'open' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  const { error: optErr } = await supabase
    .from('anderside_poll_options')
    .insert(options.map(label => ({ poll_id: poll.id, label })))
  if (optErr) throw new Error(optErr.message)
  return poll
}

export async function closePoll(pollId: string): Promise<void> {
  const { error } = await supabase.from('anderside_polls').update({ status: 'closed' }).eq('id', pollId)
  if (error) throw new Error(error.message)
}

export async function resolvePoll(pollId: string, winnerOptionId: string): Promise<void> {
  const { error } = await supabase
    .from('anderside_polls')
    .update({ status: 'resolved', winner_option_id: winnerOptionId })
    .eq('id', pollId)
  if (error) throw new Error(error.message)

  const { data: bets } = await supabase.from('anderside_bets').select('*').eq('poll_id', pollId)
  if (!bets || bets.length === 0) return

  const totalPool = bets.reduce((s: number, b: Bet) => s + (b.amount ?? 0), 0)
  const winningBets = bets.filter((b: Bet) => b.option_id === winnerOptionId)
  const winningPool = winningBets.reduce((s: number, b: Bet) => s + (b.amount ?? 0), 0)
  if (winningPool === 0) return

  for (const bet of winningBets) {
    const payout = Math.floor(((bet.amount ?? 0) / winningPool) * totalPool)
    await ubPayout(bet.discord_id, payout)
    await supabase.from('anderside_bets').update({ payout }).eq('id', bet.id)
  }
}

// ── Bets ──────────────────────────────────────────────────────────────────────

export async function placeBet(pollId: string, optionId: string, amount: number, userId: string, discordId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('anderside_bets')
    .select('id')
    .eq('poll_id', pollId)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) throw new Error('already_bet')

  await ubDeduct(discordId, amount)

  const { error } = await supabase
    .from('anderside_bets')
    .insert({ poll_id: pollId, option_id: optionId, user_id: userId, discord_id: discordId, amount, payout: null })
  if (error) {
    // Bet failed to record — refund
    await ubPayout(discordId, amount)
    throw new Error(error.message)
  }
}

export async function withdrawBet(betId: string, discordId: string, amount: number): Promise<void> {
  const { error } = await supabase.from('anderside_bets').delete().eq('id', betId)
  if (error) throw new Error(error.message)
  await ubPayout(discordId, amount)
}

export async function dismissPoll(pollId: string): Promise<void> {
  await supabase.from('anderside_bets').delete().eq('poll_id', pollId)
  await supabase.from('anderside_poll_options').delete().eq('poll_id', pollId)
  await supabase.from('anderside_polls').delete().eq('id', pollId)
}

export async function getUserBet(pollId: string, userId: string): Promise<Bet | null> {
  const { data } = await supabase
    .from('anderside_bets')
    .select('*')
    .eq('poll_id', pollId)
    .eq('user_id', userId)
    .maybeSingle()
  return data ?? null
}
