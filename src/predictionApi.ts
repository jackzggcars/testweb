import { supabase } from './supabaseClient'

const PROJECT_ID = 'djmtutqsmdkyulfygmmc'
const EDGE = `https://${PROJECT_ID}.supabase.co/functions/v1/server/make-server-daae60d2`

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

// ── Balance ───────────────────────────────────────────────────────────────────

export async function getBalance(discordId: string): Promise<number> {
  const res = await fetch(`${EDGE}/ub/balance/${discordId}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.cash
}

// ── Polls ─────────────────────────────────────────────────────────────────────

export async function getPolls(): Promise<PollWithOptions[]> {
  const { data: polls, error } = await supabase
    .from('anderside_polls')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const { data: options } = await supabase.from('anderside_poll_options').select('*')
  const { data: bets } = await supabase.from('anderside_bets').select('*')

  return (polls ?? []).map(p => ({
    ...p,
    options: (options ?? []).filter(o => o.poll_id === p.id),
    bets: (bets ?? []).filter(b => b.poll_id === p.id),
  }))
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
  const { error } = await supabase
    .from('anderside_polls')
    .update({ status: 'closed' })
    .eq('id', pollId)
  if (error) throw new Error(error.message)
}

export async function resolvePoll(pollId: string, winnerOptionId: string): Promise<void> {
  // Mark resolved
  const { error } = await supabase
    .from('anderside_polls')
    .update({ status: 'resolved', winner_option_id: winnerOptionId })
    .eq('id', pollId)
  if (error) throw new Error(error.message)

  // Calculate payouts
  const { data: bets } = await supabase.from('anderside_bets').select('*').eq('poll_id', pollId)
  if (!bets || bets.length === 0) return

  const totalPool = bets.reduce((s: number, b: Bet) => s + b.amount, 0)
  const winningBets = bets.filter((b: Bet) => b.option_id === winnerOptionId)
  const winningPool = winningBets.reduce((s: number, b: Bet) => s + b.amount, 0)

  if (winningPool === 0) return

  // Payout each winner proportionally from total pool
  for (const bet of winningBets) {
    const payout = Math.floor((bet.amount / winningPool) * totalPool)
    await fetch(`${EDGE}/ub/payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId: bet.discord_id, amount: payout }),
    })
    await supabase.from('anderside_bets').update({ payout }).eq('id', bet.id)
  }
}

// ── Bets ──────────────────────────────────────────────────────────────────────

export async function placeBet(pollId: string, optionId: string, amount: number, userId: string, discordId: string): Promise<void> {
  // Check for existing bet on this poll
  const { data: existing } = await supabase
    .from('anderside_bets')
    .select('id')
    .eq('poll_id', pollId)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) throw new Error('already_bet')

  // Deduct from UnbelievaBoat
  const res = await fetch(`${EDGE}/ub/deduct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discordId, amount }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)

  // Record bet
  const { error } = await supabase
    .from('anderside_bets')
    .insert({ poll_id: pollId, option_id: optionId, user_id: userId, discord_id: discordId, amount, payout: null })
  if (error) throw new Error(error.message)
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
