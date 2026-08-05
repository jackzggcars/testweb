import { useState, useEffect, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import symbol from '@/imports/symbool.png'
import flag from '@/imports/Andersideflag.png'
import electionMapSrc from '@/imports/electionmap-1.png'
import { supabase } from './supabaseClient'
import { checkAdmin, getAdmins, addAdmin, removeAdmin, type AdminEntry } from './adminApi'
import { getParties, createParty, updateParty, deleteParty, type Party } from './partyApi'
import { getActiveElection, getAllElections, startElection, closeElection, castVote, removeVote, getUserVote, getResults, type Election, type VoteResult } from './electionApi'

// Handles the OAuth redirect callback on page load
async function handleAuthCallback() {
  const hash = window.location.hash
  if (hash && hash.includes('access_token')) {
    await supabase.auth.getSession()
    window.history.replaceState(null, '', window.location.pathname)
  }
}

function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    handleAuthCallback().then(async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setLoading(false)
      if (data.session) {
        try { setIsAdmin(await checkAdmin()) } catch { setIsAdmin(false) }
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        try { setIsAdmin(await checkAdmin()) } catch { setIsAdmin(false) }
      } else {
        setIsAdmin(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const signInWithDiscord = () =>
    supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: 'https://nationofanderside.xyz' },
    })

  const signOut = () => supabase.auth.signOut()

  return { session, loading, isAdmin, signInWithDiscord, signOut }
}

const BLANK_PARTY: Omit<Party, 'id'> = {
  abbr: '', name: '', leader: '', leader_handle: '', size: 'minor', color: '#1a3eb0', description: '',
}

function inputStyle(focused: boolean) {
  return {
    background: 'rgba(255,255,255,0.04)',
    border: `1.5px solid ${focused ? '#c9a227' : 'rgba(201,162,39,0.2)'}`,
    color: '#f0f4ff',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    width: '100%',
    padding: '6px 10px',
    fontSize: '13px',
  } as React.CSSProperties
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase mb-1.5" style={{ color: '#6a80b0', fontFamily: 'var(--font-body)', letterSpacing: '0.15em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function AdminPanelAdmins() {
  const [admins, setAdmins] = useState<AdminEntry[]>([])
  const [newId, setNewId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    getAdmins().then((list) => { setAdmins(list); setLoading(false) })
  }, [])

  const handleAdd = async () => {
    if (!newId.trim()) return
    setSaving(true); setError('')
    try { setAdmins(await addAdmin(newId.trim())); setNewId('') }
    catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleRemove = async (id: string) => {
    setSaving(true); setError('')
    try { setAdmins(await removeAdmin(id)) }
    catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <label className="block text-xs font-semibold uppercase mb-2" style={{ color: '#c9a227', fontFamily: 'var(--font-body)', letterSpacing: '0.2em' }}>
          Add Admin by Discord User ID
        </label>
        <div className="flex gap-2">
          <input
            type="text" value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            placeholder="e.g. 1441903590162563212"
            style={inputStyle(focused)}
          />
          <button onClick={handleAdd} disabled={saving || !newId.trim()}
            className="px-4 py-2 text-xs font-bold uppercase transition-all duration-200 disabled:opacity-40 flex-shrink-0"
            style={{ background: '#c9a227', color: '#0a1a50', fontFamily: 'var(--font-body)' }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#e8c96a' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#c9a227' }}
          >
            {saving ? '…' : 'Add'}
          </button>
        </div>
        <p className="text-xs mt-1.5" style={{ color: '#3d4f70', fontFamily: 'var(--font-body)' }}>
          Username & avatar appear automatically once they sign in.
        </p>
        {error && <p className="text-xs mt-2" style={{ color: '#c41230', fontFamily: 'var(--font-body)' }}>{error}</p>}
      </div>

      <div>
        <div className="text-xs font-semibold uppercase mb-3" style={{ color: '#6a80b0', fontFamily: 'var(--font-body)', letterSpacing: '0.2em' }}>
          Current Admins
        </div>
        {loading ? (
          <p className="text-sm" style={{ color: '#6a80b0', fontFamily: 'var(--font-body)' }}>Loading…</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {admins.map((admin) => (
              <div key={admin.discord_id} className="flex items-center justify-between px-4 py-3 gap-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(201,162,39,0.1)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {admin.avatar_url ? (
                    <img src={admin.avatar_url} alt={admin.username ?? ''} className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                      style={{ border: '1.5px solid rgba(201,162,39,0.35)' }} />
                  ) : (
                    <div className="w-9 h-9 flex items-center justify-center text-sm font-bold flex-shrink-0 rounded-full"
                      style={{ background: '#1a3460', border: '1.5px solid rgba(201,162,39,0.3)', color: '#c9a227' }}>
                      {(admin.username ?? admin.discord_id)[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: '#f0f4ff', fontFamily: 'var(--font-body)' }}>
                      {admin.username ?? <span style={{ color: '#3d4f70', fontStyle: 'italic', fontWeight: 400 }}>Pending sign-in</span>}
                    </div>
                    <div className="text-xs mt-0.5 font-mono truncate" style={{ color: '#3d4f70', fontFamily: 'var(--font-body)' }}>
                      ID: {admin.discord_id}
                    </div>
                  </div>
                </div>
                <button onClick={() => handleRemove(admin.discord_id)} disabled={saving}
                  className="text-xs px-2 py-1 flex-shrink-0 transition-colors duration-200 disabled:opacity-40"
                  style={{ color: '#6a80b0', border: '1px solid rgba(196,18,48,0.2)', fontFamily: 'var(--font-body)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#c41230'; e.currentTarget.style.borderColor = '#c41230' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#6a80b0'; e.currentTarget.style.borderColor = 'rgba(196,18,48,0.2)' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AdminPanelParties({ onPartiesChanged }: { onPartiesChanged: () => void }) {
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Party | null>(null)
  const [form, setForm] = useState<Omit<Party, 'id'>>(BLANK_PARTY)
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setParties(await getParties()) } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(BLANK_PARTY); setShowForm(true); setError('') }
  const openEdit = (p: Party) => { setEditing(p); setForm({ abbr: p.abbr, name: p.name, leader: p.leader, leader_handle: p.leader_handle, size: p.size, color: p.color, description: p.description }); setShowForm(true); setError('') }
  const cancelForm = () => { setShowForm(false); setEditing(null) }

  const handleSave = async () => {
    if (!form.abbr.trim() || !form.name.trim() || !form.leader.trim() || !form.description.trim()) {
      setError('Please fill in all fields.'); return
    }
    setSaving(true); setError('')
    try {
      const updated = editing
        ? await updateParty(editing.id, form)
        : await createParty(form)
      setParties(updated)
      setShowForm(false)
      setEditing(null)
      onPartiesChanged()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    setSaving(true)
    try { setParties(await deleteParty(id)); onPartiesChanged() }
    catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const field = (key: keyof Omit<Party, 'id'>) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  if (showForm) return (
    <div className="p-6 flex flex-col gap-4">
      <div className="text-sm font-bold mb-1" style={{ color: '#c9a227', fontFamily: 'var(--font-display)' }}>
        {editing ? 'Edit Party' : 'New Party'}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Abbreviation">
          <input {...field('abbr')} placeholder="e.g. NPA" style={inputStyle(false)}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#c9a227')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(201,162,39,0.2)')} />
        </FormField>
        <FormField label="Size">
          <select {...field('size')} style={{ ...inputStyle(false), cursor: 'pointer' }}>
            <option value="major">Major Party</option>
            <option value="minor">Minor Party</option>
          </select>
        </FormField>
      </div>

      <FormField label="Full Party Name">
        <input {...field('name')} placeholder="e.g. Nationalist Party of Anderside" style={inputStyle(false)}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#c9a227')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(201,162,39,0.2)')} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Party Leader">
          <input {...field('leader')} placeholder="e.g. A. Willis" style={inputStyle(false)}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#c9a227')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(201,162,39,0.2)')} />
        </FormField>
        <FormField label="Leader Handle">
          <input {...field('leader_handle')} placeholder="e.g. @A. Willis (NPA)" style={inputStyle(false)}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#c9a227')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(201,162,39,0.2)')} />
        </FormField>
      </div>

      <FormField label="Party Colour">
        <div className="flex items-center gap-3">
          <input type="color" {...field('color')}
            style={{ width: 40, height: 32, border: '1.5px solid rgba(201,162,39,0.2)', background: 'none', cursor: 'pointer', padding: 2 }} />
          <span className="text-sm font-mono" style={{ color: '#8fa0cc', fontFamily: 'var(--font-body)' }}>{form.color}</span>
        </div>
      </FormField>

      <FormField label="Description">
        <textarea {...field('description')} rows={3} placeholder="Party description…"
          style={{ ...inputStyle(false), resize: 'vertical', lineHeight: 1.6 }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#c9a227')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(201,162,39,0.2)')} />
      </FormField>

      {error && <p className="text-xs" style={{ color: '#c41230', fontFamily: 'var(--font-body)' }}>{error}</p>}

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-200 disabled:opacity-40"
          style={{ background: '#c9a227', color: '#0a1a50', fontFamily: 'var(--font-body)' }}
          onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#e8c96a' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#c9a227' }}
        >
          {saving ? '…' : editing ? 'Save Changes' : 'Create Party'}
        </button>
        <button onClick={cancelForm}
          className="px-4 py-2 text-xs font-semibold uppercase transition-all duration-200"
          style={{ border: '1.5px solid rgba(201,162,39,0.2)', color: '#6a80b0', fontFamily: 'var(--font-body)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f0f4ff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6a80b0')}
        >
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold uppercase" style={{ color: '#6a80b0', fontFamily: 'var(--font-body)', letterSpacing: '0.2em' }}>
          {parties.length} {parties.length === 1 ? 'Party' : 'Parties'}
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase transition-all duration-200"
          style={{ background: '#c9a227', color: '#0a1a50', fontFamily: 'var(--font-body)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#e8c96a')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#c9a227')}
        >
          + New Party
        </button>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: '#6a80b0', fontFamily: 'var(--font-body)' }}>Loading…</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
          {parties.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2.5"
              style={{ border: '1px solid rgba(201,162,39,0.1)', background: 'rgba(255,255,255,0.02)' }}
            >
              <div style={{ width: 4, alignSelf: 'stretch', background: p.color, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-1.5 py-0.5" style={{ background: p.color, color: '#fff', fontFamily: 'var(--font-body)' }}>
                    {p.abbr}
                  </span>
                  <span className="text-xs" style={{ color: p.size === 'major' ? '#c9a227' : '#6a80b0', fontFamily: 'var(--font-body)' }}>
                    {p.size === 'major' ? 'Major' : 'Minor'}
                  </span>
                </div>
                <div className="text-sm font-medium truncate mt-0.5" style={{ color: '#f0f4ff', fontFamily: 'var(--font-body)' }}>{p.name}</div>
                <div className="text-xs truncate" style={{ color: '#3d4f70', fontFamily: 'var(--font-body)' }}>Leader: {p.leader}</div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => openEdit(p)}
                  className="text-xs px-2 py-1 transition-colors duration-200"
                  style={{ color: '#c9a227', border: '1px solid rgba(201,162,39,0.25)', fontFamily: 'var(--font-body)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#c9a227')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(201,162,39,0.25)')}
                >
                  Edit
                </button>
                <button onClick={() => handleDelete(p.id)} disabled={saving}
                  className="text-xs px-2 py-1 transition-colors duration-200 disabled:opacity-40"
                  style={{ color: '#6a80b0', border: '1px solid rgba(196,18,48,0.2)', fontFamily: 'var(--font-body)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#c41230'; e.currentTarget.style.borderColor = '#c41230' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#6a80b0'; e.currentTarget.style.borderColor = 'rgba(196,18,48,0.2)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-xs mt-2" style={{ color: '#c41230', fontFamily: 'var(--font-body)' }}>{error}</p>}
    </div>
  )
}

function AdminPanelElections({ onElectionChanged }: { onElectionChanged: () => void }) {
  const [elections, setElections] = useState<Election[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [hours, setHours] = useState(24)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nameFocused, setNameFocused] = useState(false)

  const load = () => getAllElections().then((e) => { setElections(e); setLoading(false) })
  useEffect(() => { load() }, [])

  const active = elections.find((e) => e.status === 'active')

  const handleStart = async () => {
    if (!name.trim()) { setError('Please enter an election name.'); return }
    if (active) { setError('An election is already running. Close it first.'); return }
    setSaving(true); setError('')
    try {
      await startElection(name.trim(), hours)
      setName('')
      await load()
      onElectionChanged()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleClose = async (id: string, called: boolean) => {
    setSaving(true); setError('')
    try { await closeElection(id, called); await load(); onElectionChanged() }
    catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  function timeLeft(endsAt: string) {
    const diff = new Date(endsAt).getTime() - Date.now()
    if (diff <= 0) return 'Ended'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m remaining`
  }

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Start election */}
      <div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: '#c9a227', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600, marginBottom: 10 }}>
          Start New Election
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            onFocus={() => setNameFocused(true)} onBlur={() => setNameFocused(false)}
            placeholder="e.g. August 2026 General Election"
            style={{ background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${nameFocused ? '#c9a227' : 'rgba(201,162,39,0.2)'}`, color: '#f0f4ff', fontFamily: 'var(--font-body)', outline: 'none', padding: '8px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 12, color: '#6a80b0', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>Duration:</label>
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))}
              style={{ background: '#081440', border: '1.5px solid rgba(201,162,39,0.2)', color: '#f0f4ff', fontFamily: 'var(--font-body)', padding: '6px 10px', fontSize: 13, flex: 1 }}>
              <option value={1}>1 hour</option>
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
            </select>
            <button onClick={handleStart} disabled={saving || !name.trim()}
              style={{ background: '#c9a227', color: '#0a1a50', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 16px', border: 'none', cursor: 'pointer', opacity: saving || !name.trim() ? 0.4 : 1, whiteSpace: 'nowrap' }}>
              {saving ? '…' : 'Start Election'}
            </button>
          </div>
        </div>
        {error && <p style={{ color: '#c41230', fontFamily: 'var(--font-body)', fontSize: 12, marginTop: 6 }}>{error}</p>}
      </div>

      {/* Election list */}
      <div>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: '#6a80b0', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600, marginBottom: 10 }}>
          All Elections
        </div>
        {loading ? (
          <p style={{ color: '#6a80b0', fontFamily: 'var(--font-body)', fontSize: 13 }}>Loading…</p>
        ) : elections.length === 0 ? (
          <p style={{ color: '#6a80b0', fontFamily: 'var(--font-body)', fontSize: 13 }}>No elections yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
            {elections.map((el) => (
              <div key={el.id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${el.status === 'active' ? 'rgba(201,162,39,0.35)' : 'rgba(255,255,255,0.06)'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f4ff', fontFamily: 'var(--font-body)', marginBottom: 3 }}>{el.name}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', padding: '2px 8px', fontFamily: 'var(--font-body)',
                        background: el.status === 'active' ? 'rgba(201,162,39,0.15)' : el.status === 'called' ? 'rgba(196,18,48,0.15)' : 'rgba(106,128,176,0.15)',
                        color: el.status === 'active' ? '#c9a227' : el.status === 'called' ? '#c41230' : '#6a80b0',
                        border: `1px solid ${el.status === 'active' ? 'rgba(201,162,39,0.3)' : el.status === 'called' ? 'rgba(196,18,48,0.3)' : 'rgba(106,128,176,0.2)'}`,
                      }}>
                        {el.status === 'active' ? '● Active' : el.status === 'called' ? 'Called' : 'Closed'}
                      </span>
                      {el.status === 'active' && (
                        <span style={{ fontSize: 11, color: '#6a80b0', fontFamily: 'var(--font-body)' }}>{timeLeft(el.ends_at)}</span>
                      )}
                    </div>
                  </div>
                  {el.status === 'active' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => handleClose(el.id, true)} disabled={saving}
                        style={{ fontSize: 11, padding: '5px 10px', background: '#c41230', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 600, opacity: saving ? 0.4 : 1 }}>
                        Call It
                      </button>
                      <button onClick={() => handleClose(el.id, false)} disabled={saving}
                        style={{ fontSize: 11, padding: '5px 10px', background: 'transparent', color: '#6a80b0', border: '1px solid rgba(106,128,176,0.3)', cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: saving ? 0.4 : 1 }}>
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type ConstitutionSection = { id: number; order_index: number; title: string; body: string; is_article: boolean }

async function loadConstitutionSections(): Promise<ConstitutionSection[]> {
  const { data } = await supabase.from('anderside_constitution_sections').select('*').order('order_index')
  return (data ?? []) as ConstitutionSection[]
}

function AdminPanelConstitution() {
  const [sections, setSections] = useState<ConstitutionSection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | 'new' | null>(null)
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState({ title: '', body: '', is_article: false })

  const reload = () => loadConstitutionSections().then(s => { setSections(s); setLoading(false) })
  useEffect(() => { reload() }, [])

  const startEdit = (s: ConstitutionSection) => { setEditingId(s.id); setDraft({ title: s.title, body: s.body, is_article: s.is_article }) }
  const startNew = () => { setEditingId('new'); setDraft({ title: '', body: '', is_article: false }) }
  const cancelEdit = () => { setEditingId(null); setDraft({ title: '', body: '', is_article: false }) }

  const handleSave = async () => {
    setSaving(editingId)
    if (editingId === 'new') {
      const maxOrder = sections.length ? Math.max(...sections.map(s => s.order_index)) + 1 : 0
      await supabase.from('anderside_constitution_sections').insert({ title: draft.title, body: draft.body, is_article: draft.is_article, order_index: maxOrder })
    } else {
      await supabase.from('anderside_constitution_sections').update({ title: draft.title, body: draft.body, is_article: draft.is_article }).eq('id', editingId)
    }
    setSaving(null); setEditingId(null); reload()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this section?')) return
    await supabase.from('anderside_constitution_sections').delete().eq('id', id)
    reload()
  }

  const handleMove = async (id: number, dir: -1 | 1) => {
    const idx = sections.findIndex(s => s.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sections.length) return
    const a = sections[idx], b = sections[swapIdx]
    await supabase.from('anderside_constitution_sections').update({ order_index: b.order_index }).eq('id', a.id)
    await supabase.from('anderside_constitution_sections').update({ order_index: a.order_index }).eq('id', b.id)
    reload()
  }

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: '#3d4f70', fontFamily: 'var(--font-body)', fontSize: 13 }}>Loading…</div>

  const inputStyle: React.CSSProperties = { width: '100%', background: '#060f30', border: '1px solid rgba(201,162,39,0.25)', color: '#c8d4f0', fontFamily: 'var(--font-body)', fontSize: 12, padding: '8px 10px', outline: 'none', boxSizing: 'border-box' }
  const btnStyle = (primary?: boolean): React.CSSProperties => ({
    padding: '6px 14px', fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
    background: primary ? '#c9a227' : 'transparent', color: primary ? '#050d28' : '#6a80b0',
    border: `1px solid ${primary ? '#c9a227' : 'rgba(201,162,39,0.2)'}`,
  })

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sections.map((s, idx) => (
        <div key={s.id} style={{ border: '1px solid rgba(201,162,39,0.15)', background: '#060f30' }}>
          {editingId === s.id ? (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={draft.is_article} onChange={e => setDraft(d => ({ ...d, is_article: e.target.checked }))} />
                <span style={{ fontSize: 11, color: '#c9a227', fontFamily: 'var(--font-body)' }}>Article heading (not a section)</span>
              </label>
              <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder={draft.is_article ? 'Article title (e.g. ARTICLE 1 - THE FOUNDERS)' : 'Section title…'} style={inputStyle} />
              <textarea value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} rows={draft.is_article ? 2 : 7} placeholder={draft.is_article ? 'Optional subtitle…' : 'Section body text…'} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button style={btnStyle()} onClick={cancelEdit}>Cancel</button>
                <button style={btnStyle(true)} onClick={handleSave} disabled={saving === s.id}>{saving === s.id ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c9a227', fontFamily: 'var(--font-display)', marginBottom: 2 }}>{s.title || <span style={{ color: '#3d4f70', fontStyle: 'italic' }}>Untitled</span>}</div>
                <div style={{ fontSize: 11, color: '#6a80b0', fontFamily: 'var(--font-body)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 60, overflow: 'hidden' }}>{s.body}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => handleMove(s.id, -1)} disabled={idx === 0} style={{ ...btnStyle(), padding: '4px 8px', opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                <button onClick={() => handleMove(s.id, 1)} disabled={idx === sections.length - 1} style={{ ...btnStyle(), padding: '4px 8px', opacity: idx === sections.length - 1 ? 0.3 : 1 }}>↓</button>
                <button onClick={() => startEdit(s)} style={btnStyle()}>Edit</button>
                <button onClick={() => handleDelete(s.id)} style={{ ...btnStyle(), color: '#c41230', borderColor: 'rgba(196,18,48,0.3)' }}>✕</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {editingId === 'new' ? (
        <div style={{ border: '1px solid rgba(201,162,39,0.3)', background: '#060f30', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.is_article} onChange={e => setDraft(d => ({ ...d, is_article: e.target.checked }))} />
            <span style={{ fontSize: 11, color: '#c9a227', fontFamily: 'var(--font-body)' }}>Article heading (not a section)</span>
          </label>
          <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder={draft.is_article ? 'Article title (e.g. ARTICLE 1 - THE FOUNDERS)' : 'Section title…'} style={inputStyle} />
          <textarea value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} rows={draft.is_article ? 2 : 7} placeholder={draft.is_article ? 'Optional subtitle…' : 'Section body text…'} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button style={btnStyle()} onClick={cancelEdit}>Cancel</button>
            <button style={btnStyle(true)} onClick={handleSave} disabled={saving === 'new'}>{saving === 'new' ? 'Saving…' : 'Add Section'}</button>
          </div>
        </div>
      ) : (
        <button onClick={startNew} style={{ ...btnStyle(true), alignSelf: 'flex-start', padding: '8px 18px' }}>+ Add Section</button>
      )}
    </div>
  )
}

function AdminPanel({ onClose, onPartiesChanged, onElectionChanged }: { onClose: () => void; onPartiesChanged: () => void; onElectionChanged: () => void }) {
  const [tab, setTab] = useState<'admins' | 'parties' | 'elections' | 'constitution'>('admins')

  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(4,10,32,0.85)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 520,
        maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        background: '#0a1a50',
        border: '1.5px solid rgba(201,162,39,0.35)',
        position: 'relative',
      }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', flexShrink: 0, borderBottom: '1px solid rgba(201,162,39,0.15)' }}
        >
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="2">
              <path d="M12 1l3 6 7 1-5 5 1 7-6-3-6 3 1-7L2 8l7-1z" />
            </svg>
            <span className="font-bold text-base" style={{ fontFamily: 'var(--font-display)', color: '#f0f4ff' }}>
              Admin Panel
            </span>
          </div>
          <button onClick={onClose} style={{ color: '#6a80b0' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f0f4ff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6a80b0')}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1px solid rgba(201,162,39,0.15)', overflowX: 'auto' }}>
          {(['admins', 'parties', 'elections', 'constitution'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all duration-200 whitespace-nowrap"
              style={{
                fontFamily: 'var(--font-body)',
                letterSpacing: '0.15em',
                color: tab === t ? '#c9a227' : '#3d4f70',
                borderBottom: tab === t ? '2px solid #c9a227' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t === 'admins' ? '★ Admins' : t === 'parties' ? '🏛 Parties' : t === 'elections' ? '🗳 Elections' : '📜 Constitution'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {tab === 'admins' ? <AdminPanelAdmins />
            : tab === 'parties' ? <AdminPanelParties onPartiesChanged={onPartiesChanged} />
            : tab === 'elections' ? <AdminPanelElections onElectionChanged={onElectionChanged} />
            : <AdminPanelConstitution />}
        </div>
      </div>
    </div>
  )
}

function UserMenu({ session, signOut, isAdmin, onPartiesChanged, onElectionChanged }: { session: Session; signOut: () => void; isAdmin: boolean; onPartiesChanged: () => void; onElectionChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [adminPanelOpen, setAdminPanelOpen] = useState(false)
  const user = session.user
  const avatar = user.user_metadata?.avatar_url as string | undefined
  const username = (user.user_metadata?.full_name || user.user_metadata?.name || user.email) as string

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 transition-all duration-200"
        style={{ border: '1.5px solid rgba(201,162,39,0.35)', background: 'rgba(201,162,39,0.06)' }}
      >
        {avatar ? (
          <img src={avatar} alt={username} className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: '#c41230', color: '#fff' }}
          >
            {username[0]?.toUpperCase()}
          </div>
        )}
        <span className="text-xs font-medium max-w-[100px] truncate" style={{ color: '#f0f4ff', fontFamily: 'var(--font-body)' }}>
          {username}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: '#c9a227' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1 w-52 py-1"
          style={{ background: '#0a1a50', border: '1.5px solid rgba(201,162,39,0.25)', zIndex: 100 }}
        >
          <div className="px-4 py-2" style={{ borderBottom: '1px solid rgba(201,162,39,0.1)' }}>
            <div className="text-xs font-semibold truncate" style={{ color: '#f0f4ff', fontFamily: 'var(--font-body)' }}>
              {username}
            </div>
            <div className="text-xs mt-0.5 truncate" style={{ color: isAdmin ? '#c9a227' : '#6a80b0', fontFamily: 'var(--font-body)' }}>
              {isAdmin ? '★ Administrator' : 'Citizen of Anderside'}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setOpen(false); setAdminPanelOpen(true) }}
              className="w-full text-left px-4 py-2 text-xs transition-colors duration-200 flex items-center gap-2"
              style={{ color: '#c9a227', fontFamily: 'var(--font-body)', borderBottom: '1px solid rgba(201,162,39,0.08)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(201,162,39,0.07)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1l3 6 7 1-5 5 1 7-6-3-6 3 1-7L2 8l7-1z" />
              </svg>
              Admin Panel
            </button>
          )}
          <button
            onClick={() => { setOpen(false); signOut() }}
            className="w-full text-left px-4 py-2 text-xs transition-colors duration-200"
            style={{ color: '#8fa0cc', fontFamily: 'var(--font-body)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#c41230')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#8fa0cc')}
          >
            Sign out
          </button>
        </div>
      )}
      {adminPanelOpen && <AdminPanel onClose={() => setAdminPanelOpen(false)} onPartiesChanged={onPartiesChanged} onElectionChanged={onElectionChanged} />}
    </div>
  )
}

function NavBar({
  scrolled,
  activeSection,
  session,
  loading,
  isAdmin,
  signInWithDiscord,
  signOut,
  onPartiesChanged,
  onElectionChanged,
  activeElection,
}: {
  scrolled: boolean
  activeSection: string
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signInWithDiscord: () => void
  signOut: () => void
  onPartiesChanged: () => void
  onElectionChanged: () => void
  activeElection: Election | null
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled
          ? 'rgba(10,26,80,0.97)'
          : 'linear-gradient(180deg, rgba(10,26,80,0.85) 0%, transparent 100%)',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(196,18,48,0.3)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <a href="#" className="flex items-center gap-3">
          <img src={symbol} alt="Anderside symbol" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <div>
            <div
              className="text-xs font-semibold tracking-widest uppercase leading-none"
              style={{ color: '#c9a227', fontFamily: 'var(--font-body)', letterSpacing: '0.2em' }}
            >
              The Nation of
            </div>
            <div
              className="text-lg font-bold leading-tight"
              style={{ color: '#f0f4ff', fontFamily: 'var(--font-display)' }}
            >
              Anderside
            </div>
          </div>
        </a>

        <ul className="hidden md:flex items-center gap-8">
          {[
            { label: 'Parliament', href: '#parliament', id: 'parliament' },
            { label: 'High Court', href: '#court', id: 'court' },
            { label: 'Parties', href: '#parties', id: 'parties' },
            { label: 'Approval', href: '#approval', id: 'approval' },
            { label: 'Constitution', href: '#constitution', id: 'constitution' },
            { label: 'About', href: '#about', id: 'about' },
          ].map((item) => {
            const isActive = activeSection === item.id
            return (
              <li key={item.label}>
                <a href={item.href}
                  className="text-sm font-medium tracking-wide transition-colors duration-200"
                  style={{ color: isActive ? '#c9a227' : '#b8c4e8', fontFamily: 'var(--font-body)', borderBottom: isActive ? '1px solid #c9a227' : '1px solid transparent', paddingBottom: 2 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#c9a227')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = isActive ? '#c9a227' : '#b8c4e8')}
                >
                  {item.label}
                </a>
              </li>
            )
          })}
          {activeElection && (
            <li>
              <a
                href="#"
                onClick={e => { e.preventDefault(); document.getElementById('election')?.scrollIntoView({ behavior: 'smooth' }) }}
                className="text-sm font-semibold tracking-wide transition-all duration-200 flex items-center gap-2 px-3 py-1"
                style={{ color: '#c41230', fontFamily: 'var(--font-body)', border: '1px solid rgba(196,18,48,0.5)', animation: 'pulse 2s infinite' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(196,18,48,0.1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c41230', display: 'inline-block' }} />
                Election Live
              </a>
            </li>
          )}
        </ul>

        <div className="hidden md:flex items-center gap-3">
          {!loading && (
            session
              ? <UserMenu session={session} signOut={signOut} isAdmin={isAdmin} onPartiesChanged={onPartiesChanged} onElectionChanged={onElectionChanged} />
              : (
                <button
                  onClick={signInWithDiscord}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold tracking-wide transition-all duration-200"
                  style={{ background: '#c41230', color: '#ffffff', fontFamily: 'var(--font-body)', letterSpacing: '0.1em' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#e01535')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#c41230')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.044.031.054a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                  Sign in with Discord
                </button>
              )
          )}
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ color: '#c9a227' }}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div
          className="md:hidden px-6 pb-4 pt-2 flex flex-col gap-4"
          style={{ background: 'rgba(10,26,80,0.98)', borderTop: '1px solid rgba(196,18,48,0.25)' }}
        >
          {[
            { label: 'Parliament', href: '#parliament' },
            { label: 'High Court', href: '#court' },
            { label: 'Parties', href: '#parties' },
            { label: 'About', href: '#about' },
            { label: 'Join Discord', href: '#join' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-medium py-1"
              style={{ color: '#b8c4e8', fontFamily: 'var(--font-body)' }}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}

function Hero() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#0a1a50' }}
    >
      {/* Flag as full background with overlay */}
      <div className="absolute inset-0">
        <img
          src={flag}
          alt="Flag of Anderside"
          className="w-full h-full object-cover"
          style={{ opacity: 0.18 }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(160deg, rgba(10,26,80,0.85) 0%, rgba(10,26,80,0.6) 40%, rgba(10,26,80,0.92) 100%)',
          }}
        />
      </div>

      {/* Subtle red stripe accent */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: '4px', background: 'linear-gradient(180deg, transparent, #c41230 30%, #c41230 70%, transparent)' }}
      />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        {/* Top label */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div style={{ height: '1px', width: '50px', background: 'linear-gradient(90deg, transparent, #c9a227)' }} />
          <span
            className="text-xs tracking-widest uppercase"
            style={{ color: '#c9a227', fontFamily: 'var(--font-body)', letterSpacing: '0.35em' }}
          >
            Discord Political Simulation
          </span>
          <div style={{ height: '1px', width: '50px', background: 'linear-gradient(90deg, #c9a227, transparent)' }} />
        </div>

        {/* Symbol */}
        <img
          src={symbol}
          alt="Anderside national symbol"
          style={{
            width: 120,
            height: 120,
            objectFit: 'contain',
            margin: '0 auto 2rem',
            filter: 'drop-shadow(0 4px 24px rgba(201,162,39,0.35))',
          }}
        />

        <h1
          className="text-5xl md:text-8xl font-bold leading-none mb-4"
          style={{
            fontFamily: 'var(--font-display)',
            color: '#f0f4ff',
            textShadow: '0 2px 30px rgba(10,26,80,0.8)',
          }}
        >
          The Nation of
          <br />
          <span style={{ color: '#c9a227' }}>Anderside</span>
        </h1>

        <p
          className="text-base md:text-lg mt-8 mb-12 max-w-2xl mx-auto leading-relaxed"
          style={{ fontFamily: 'var(--font-body)', color: '#8fa0cc', fontWeight: 300 }}
        >
          A fully-simulated parliamentary democracy on Discord. Citizens are elected
          to Parliament, serve in the High Court, and compete for the office of Prime Minister
          through free and fair elections.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#join"
            className="px-8 py-3.5 text-sm font-bold tracking-widest uppercase transition-all duration-200"
            style={{ background: '#c41230', color: '#ffffff', fontFamily: 'var(--font-body)', letterSpacing: '0.2em' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e01535')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#c41230')}
          >
            Become a Citizen
          </a>
          <a
            href="#about"
            className="px-8 py-3.5 text-sm font-semibold tracking-widest uppercase transition-all duration-200"
            style={{
              border: '1.5px solid rgba(201,162,39,0.45)',
              color: '#b8c4e8',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.2em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#c9a227'
              e.currentTarget.style.color = '#f0f4ff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(201,162,39,0.45)'
              e.currentTarget.style.color = '#b8c4e8'
            }}
          >
            Learn More
          </a>
        </div>
      </div>

      {/* Flag thumbnail bottom-right */}
      <div className="absolute bottom-8 right-8 hidden md:block">
        <img
          src={flag}
          alt="Flag of Anderside"
          style={{
            width: 140,
            height: 'auto',
            border: '2px solid rgba(255,255,255,0.15)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        />
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <span className="text-xs tracking-widest uppercase" style={{ color: '#c9a227', letterSpacing: '0.25em', fontFamily: 'var(--font-body)' }}>
          Scroll
        </span>
        <div style={{ width: '1px', height: '36px', background: 'linear-gradient(180deg, #c9a227, transparent)' }} />
      </div>
    </section>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block text-xs font-semibold tracking-widest uppercase mb-4"
      style={{ color: '#c9a227', fontFamily: 'var(--font-body)', letterSpacing: '0.3em' }}
    >
      {children}
    </span>
  )
}

function Institutions() {
  const institutions = [
    {
      id: 'parliament',
      icon: (
        <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
          <rect x="5" y="28" width="30" height="4" fill="currentColor" rx="1" />
          <rect x="8" y="10" width="4" height="18" fill="currentColor" rx="1" />
          <rect x="15" y="10" width="4" height="18" fill="currentColor" rx="1" />
          <rect x="21" y="10" width="4" height="18" fill="currentColor" rx="1" />
          <rect x="28" y="10" width="4" height="18" fill="currentColor" rx="1" />
          <rect x="4" y="7" width="32" height="4" fill="currentColor" rx="1" />
          <polygon points="20,2 28,7 12,7" fill="currentColor" />
        </svg>
      ),
      title: 'Parliament of Anderside',
      description:
        'The supreme legislative body of Anderside. Members of Parliament (MPs) are elected by citizens to debate, propose, and vote on legislation. Parliament holds the government to account, passes the national budget, and shapes the laws of the land. Any citizen can stand for election and seek a seat.',
    },
    {
      id: 'court',
      icon: (
        <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
          <line x1="20" y1="6" x2="20" y2="32" stroke="currentColor" strokeWidth="2.5" />
          <line x1="8" y1="16" x2="32" y2="16" stroke="currentColor" strokeWidth="2" />
          <path d="M8 16 L2 28 L14 28 Z" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M32 16 L26 28 L38 28" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="20" cy="6" r="3" fill="currentColor" />
          <rect x="6" y="32" width="28" height="3" fill="currentColor" rx="1" />
        </svg>
      ),
      title: 'The High Court',
      description:
        "Anderside's apex judicial institution. Justices are appointed to hear constitutional challenges, resolve disputes between institutions, and deliver binding verdicts on matters of law. The High Court operates independently of Parliament and the executive, ensuring no branch of government acts beyond its authority.",
    },
    {
      id: 'pm',
      icon: (
        <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="13" r="7" stroke="currentColor" strokeWidth="2.5" fill="none" />
          <path d="M8 34 C8 26 32 26 32 34" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M27 11 L35 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M27 15 L35 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="35" cy="7" r="2.5" fill="currentColor" />
          <circle cx="35" cy="19" r="2.5" fill="currentColor" />
        </svg>
      ),
      title: 'The Prime Minister',
      description:
        "The head of government and leader of the majority party or coalition in Parliament. The Prime Minister sets national policy, appoints cabinet ministers, and leads Anderside's executive. The PM is elected by Parliament following a general election and serves at the pleasure of the house.",
    },
  ]

  return (
    <section
      id="parliament"
      className="py-28 px-6"
      style={{ background: 'linear-gradient(180deg, #0a1a50 0%, #081440 100%)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 max-w-2xl">
          <SectionLabel>Institutions of State</SectionLabel>
          <h2
            className="text-4xl md:text-5xl font-bold leading-tight"
            style={{ fontFamily: 'var(--font-display)', color: '#f0f4ff' }}
          >
            The Three Pillars of
            <br />
            <em style={{ color: '#c9a227' }}>Anderside</em>
          </h2>
          <p className="mt-5 text-base leading-relaxed" style={{ color: '#6a80b0', fontFamily: 'var(--font-body)' }}>
            Anderside operates a full separation of powers — a democratically elected Parliament,
            an independent High Court, and a Prime Minister leading the executive.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: 'rgba(201,162,39,0.1)' }}>
          {institutions.map((inst) => (
            <div
              key={inst.id}
              id={inst.id}
              className="p-8 transition-all duration-300 group"
              style={{ background: '#081440' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#0c1c56')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#081440')}
            >
              <div className="mb-5 transition-colors duration-300" style={{ color: '#c41230' }}>
                {inst.icon}
              </div>
              <h3
                className="text-xl font-bold mb-4"
                style={{ fontFamily: 'var(--font-display)', color: '#f0f4ff' }}
              >
                {inst.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: '#6a80b0', fontFamily: 'var(--font-body)', lineHeight: 1.8 }}
              >
                {inst.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PartyCard({ party, large }: { party: Party; large: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="transition-all duration-300"
      style={{
        border: `1.5px solid ${hovered ? party.color : 'rgba(255,255,255,0.07)'}`,
        background: hovered ? `${party.color}18` : 'rgba(255,255,255,0.03)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      <div style={{ height: '4px', background: party.color }} />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="px-3 py-1 text-xs font-bold tracking-widest"
            style={{ background: party.color, color: '#fff', fontFamily: 'var(--font-body)', letterSpacing: '0.15em' }}>
            {party.abbr}
          </div>
          <span className="text-xs px-2 py-0.5"
            style={{ color: party.size === 'major' ? '#c9a227' : '#6a80b0', border: `1px solid ${party.size === 'major' ? 'rgba(201,162,39,0.3)' : 'rgba(106,128,176,0.2)'}`, fontFamily: 'var(--font-body)' }}>
            {party.size === 'major' ? 'Major Party' : 'Minor Party'}
          </span>
        </div>
        <h3 className={`font-bold mb-2 leading-tight ${large ? 'text-xl' : 'text-lg'}`}
          style={{ fontFamily: 'var(--font-display)', color: '#f0f4ff' }}>
          {party.name}
        </h3>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: party.color, color: '#fff' }}>
            {party.leader[0]}
          </div>
          <span className="text-sm" style={{ color: '#8fa0cc', fontFamily: 'var(--font-body)' }}>
            <span style={{ color: '#6a80b0' }}>Party Leader: </span>
            {party.leader_handle}
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: '#6a80b0', fontFamily: 'var(--font-body)', lineHeight: 1.75 }}>
          {party.description}
        </p>
      </div>
    </div>
  )
}

function Parties({ parties, loading }: { parties: Party[]; loading: boolean }) {
  const list = parties ?? []
  const major = list.filter((p) => p.size === 'major')
  const minor = list.filter((p) => p.size === 'minor')

  return (
    <section id="parties" className="py-28 px-6" style={{ background: '#060e30' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 max-w-2xl">
          <SectionLabel>Political Landscape</SectionLabel>
          <h2 className="text-4xl md:text-5xl font-bold leading-tight"
            style={{ fontFamily: 'var(--font-display)', color: '#f0f4ff' }}>
            Parties of <em style={{ color: '#c9a227' }}>Anderside</em>
          </h2>
          <p className="mt-5 text-base leading-relaxed" style={{ color: '#6a80b0', fontFamily: 'var(--font-body)' }}>
            Citizens may join or found political parties, elect their own leadership, and compete
            in general elections for seats in Parliament.
          </p>
        </div>

        {loading ? (
          <p style={{ color: '#6a80b0', fontFamily: 'var(--font-body)' }}>Loading parties…</p>
        ) : (
          <>
            {major.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {major.map((p) => <PartyCard key={p.id} party={p} large />)}
              </div>
            )}
            {minor.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {minor.map((p) => <PartyCard key={p.id} party={p} large={false} />)}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

// ── Election Map ─────────────────────────────────────────────────────────────

const CONSTITUENCIES = [
  { name: 'Northhaven',   px: 0.500, py: 0.086 },
  { name: 'Highridge',    px: 0.470, py: 0.148 },
  { name: 'Ashmore',      px: 0.311, py: 0.213 },
  { name: 'Starfall',     px: 0.434, py: 0.271 },
  { name: 'Eagles Reach', px: 0.639, py: 0.258 },
  { name: 'Fairmont',     px: 0.337, py: 0.360 },
  { name: 'Bluewater',    px: 0.587, py: 0.346 },
  { name: 'Blackwood',    px: 0.259, py: 0.445 },
  { name: 'Goldmere',     px: 0.430, py: 0.454 },
  { name: 'Eastmere',     px: 0.570, py: 0.450 },
  { name: 'Stonehaven',   px: 0.729, py: 0.472 },
  { name: 'Westbrook',    px: 0.286, py: 0.552 },
  { name: 'Oldanders',    px: 0.430, py: 0.546 },
  { name: 'Crown Point',  px: 0.517, py: 0.579 },
  { name: 'Foxden',       px: 0.286, py: 0.697 },
  { name: 'Kingsford',    px: 0.493, py: 0.641 },
  { name: 'Ironcrest',    px: 0.662, py: 0.660 },
  { name: 'Greendale',    px: 0.388, py: 0.753 },
  { name: 'Rosefield',    px: 0.497, py: 0.729 },
  { name: 'Windmere',     px: 0.641, py: 0.749 },
  { name: 'Redcliff',     px: 0.294, py: 0.853 },
  { name: 'Whitebridge',  px: 0.473, py: 0.832 },
  { name: 'Silverhill',   px: 0.637, py: 0.833 },
  { name: 'Southport',    px: 0.447, py: 0.926 },
  { name: 'New Ashton',   px: 0.570, py: 0.906 },
]

function seededRand(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0
  return () => { s = Math.imul(s ^ (s >>> 15), s | 1); s ^= s + Math.imul(s ^ (s >>> 7), s | 61); return ((s ^ (s >>> 14)) >>> 0) / 0xffffffff }
}

function strToSeed(str: string) {
  return str.split('').reduce((acc, c) => (Math.imul(acc, 31) + c.charCodeAt(0)) | 0, 0)
}

function assignConstituencies(results: VoteResult[], electionId: string): Record<number, string> {
  const n = CONSTITUENCIES.length
  const active = results.filter(r => r.votes > 0)
  if (!active.length) return {}
  const total = active.reduce((s, r) => s + r.votes, 0)

  // Largest remainder (Hamilton) method
  const quotas = active.map(r => { const raw = (r.votes / total) * n; return { id: r.party_id, seats: Math.floor(raw), rem: raw - Math.floor(raw) } })
  let rem = n - quotas.reduce((s, q) => s + q.seats, 0)
  quotas.sort((a, b) => b.rem - a.rem)
  for (let i = 0; i < rem; i++) quotas[i].seats++

  const rand = seededRand(strToSeed(electionId))
  const indices = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [indices[i], indices[j]] = [indices[j], indices[i]] }

  const out: Record<number, string> = {}
  let ptr = 0
  for (const q of quotas) for (let s = 0; s < q.seats; s++) out[indices[ptr++]] = q.id
  return out
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').padEnd(6, '0')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function isDark(data: Uint8ClampedArray, idx: number) {
  // Original black fill: high alpha, all channels near 0 (R<60, G<60, B<60).
  // Already-filled party pixels have at least one channel raised, so we reject
  // those to stop fills bleeding through dark-coloured constituencies.
  return data[idx+3] > 60
    && data[idx] < 60
    && data[idx+1] < 60
    && data[idx+2] < 60
}

function canvasFloodFillErase(data: Uint8ClampedArray, w: number, h: number, sx: number, sy: number) {
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return
  if (!isDark(data, (sy * w + sx) * 4)) return
  const visited = new Uint8Array(w * h)
  const stack: number[] = [sy * w + sx]
  visited[sy * w + sx] = 1
  while (stack.length) {
    const pos = stack.pop()!
    const idx = pos * 4
    data[idx] = 0; data[idx+1] = 0; data[idx+2] = 0; data[idx+3] = 0 // transparent
    const x = pos % w, y = (pos / w) | 0
    const check = (n: number) => { if (n < 0 || visited[n] || !isDark(data, n*4)) return; visited[n]=1; stack.push(n) }
    if (x > 0) check(pos-1); if (x < w-1) check(pos+1); if (y > 0) check(pos-w); if (y < h-1) check(pos+w)
  }
}

function canvasFloodFill(data: Uint8ClampedArray, w: number, h: number, sx: number, sy: number, r: number, g: number, b: number) {
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return
  if (!isDark(data, (sy * w + sx) * 4)) {
    const found = nearestDark(data, w, h, sx, sy)
    if (!found) return
    ;[sx, sy] = found
  }

  const visited = new Uint8Array(w * h)
  const stack: number[] = [sy * w + sx]
  visited[sy * w + sx] = 1

  while (stack.length) {
    const pos = stack.pop()!
    const idx = pos * 4
    data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255

    const x = pos % w, y = (pos / w) | 0
    const check = (n: number) => {
      if (n < 0 || visited[n]) return
      if (!isDark(data, n * 4)) return // stop at white borders and transparent outside
      visited[n] = 1
      stack.push(n)
    }
    if (x > 0) check(pos-1)
    if (x < w-1) check(pos+1)
    if (y > 0) check(pos-w)
    if (y < h-1) check(pos+w)
  }
}

// Hit-canvas fill using ORIGINAL (unmodified) image data + shared visited array.
// origData never changes, so dark detection is always against the raw map pixels.
// visited is shared across all constituency fills — first fill to claim a pixel wins.
// This is the only correct way to build the hover hit canvas.
// Spiral-search outward from (sx,sy) to find the nearest dark pixel.
// Returns [x, y] or null if nothing found within radius.
function nearestDark(data: Uint8ClampedArray, w: number, h: number, sx: number, sy: number, maxR = 20): [number, number] | null {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
        const nx = sx + dx, ny = sy + dy
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        if (isDark(data, (ny * w + nx) * 4)) return [nx, ny]
      }
    }
  }
  return null
}

function hitFloodFill(
  origData: Uint8ClampedArray, hitData: Uint8ClampedArray,
  visited: Uint8Array,
  w: number, h: number, sx: number, sy: number,
  hitR: number,
) {
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return
  // If the seed point is on a non-dark pixel (e.g. a white label/dot), search nearby.
  const found = nearestDark(origData, w, h, sx, sy)
  if (!found) return
  ;[sx, sy] = found
  const startPos = sy * w + sx
  if (visited[startPos]) return
  const stack: number[] = [startPos]
  visited[startPos] = 1
  while (stack.length) {
    const pos = stack.pop()!
    const idx = pos * 4
    hitData[idx] = hitR; hitData[idx+1] = 0; hitData[idx+2] = 0; hitData[idx+3] = 255
    const x = pos % w, y = (pos / w) | 0
    const check = (n: number) => {
      if (n < 0 || visited[n]) return
      if (!isDark(origData, n * 4)) return
      visited[n] = 1; stack.push(n)
    }
    if (x > 0) check(pos-1); if (x < w-1) check(pos+1); if (y > 0) check(pos-w); if (y < h-1) check(pos+w)
  }
}

// Base political lean per constituency (seeded by index, stable across days).
// Returns normalised weights (sum to 1) keyed by party id.
function getConstituencyBaseRatings(idx: number, parties: Party[]): Record<string, number> {
  if (!parties.length) return {}
  const rand = seededRand(strToSeed(`approval-base-v3-${idx}`))
  const npaParty = parties.find(p => p.abbr === 'NPA')
  const weights = parties.map(p => {
    // Major parties get ~3× base weight over minor parties
    const sizeMult = p.size === 'major' ? 1.0 : 0.32
    let w = sizeMult * (0.5 + rand() * 0.5)
    // Oldanders (12) and Crown Point (13) are NPA strongholds
    if (npaParty && p.id === npaParty.id) {
      if (idx === 12) w = 2.0 + rand() * 0.4
      else if (idx === 13) w = 1.4 + rand() * 0.3
    }
    return Math.max(0.02, w)
  })
  const total = weights.reduce((s, w) => s + w, 0)
  const result: Record<string, number> = {}
  parties.forEach((p, i) => { result[p.id] = weights[i] / total })
  return result
}

function getConstituencyDailyRatings(idx: number, parties: Party[]): Record<string, number> {
  if (!parties.length) return {}
  const base = getConstituencyBaseRatings(idx, parties)
  const today = new Date().toISOString().slice(0, 10)
  const rand = seededRand(strToSeed(`approval-daily-${today}-${idx}`))
  const fluctuated: Record<string, number> = {}
  parties.forEach(p => {
    const delta = (rand() - 0.5) * 0.12
    fluctuated[p.id] = Math.max(0.02, (base[p.id] ?? 0) + delta)
  })
  const total = Object.values(fluctuated).reduce((s, v) => s + v, 0)
  const result: Record<string, number> = {}
  let allocated = 0
  parties.forEach((p, i) => {
    if (i === parties.length - 1) {
      result[p.id] = Math.max(1, 100 - allocated)
    } else {
      const v = Math.max(1, Math.round((fluctuated[p.id] / total) * 100))
      result[p.id] = v; allocated += v
    }
  })
  return result
}

const APPROVAL_SEED_OFFSETS = [
  [0, 0],
  [-0.02, 0], [0.02, 0], [0, -0.02], [0, 0.02],
  [-0.03, -0.03], [0.03, -0.03], [-0.03, 0.03], [0.03, 0.03],
  [-0.04, 0], [0.04, 0], [0, -0.04], [0, 0.04],
]

type SeedMap = Record<string, { px: number; py: number }>

async function loadConstituencySeeds(): Promise<SeedMap> {
  const { data } = await supabase.from('anderside_constituency_seeds').select('name, px, py')
  if (!data?.length) return {}
  const out: SeedMap = {}
  for (const row of data) out[row.name] = { px: row.px, py: row.py }
  return out
}

async function saveConstituencySeed(name: string, px: number, py: number) {
  await supabase.from('anderside_constituency_seeds').upsert({ name, px, py })
}

function CalibrationOverlay({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dimsRef = useRef<{ w: number; h: number } | null>(null)
  const [idx, setIdx] = useState(0)
  const [placed, setPlaced] = useState<{ x: number; y: number }[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const img = new Image()
    img.src = electionMapSrc
    img.onload = () => {
      const scale = Math.min(1, 900 / img.naturalWidth)
      const W = Math.round(img.naturalWidth * scale)
      const H = Math.round(img.naturalHeight * scale)
      canvas.width = W; canvas.height = H
      dimsRef.current = { w: W, h: H }
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#050d28'; ctx.fillRect(0, 0, W, H)
      ctx.drawImage(img, 0, 0, W, H)
    }
  }, [])

  // Redraw dots whenever placed changes
  useEffect(() => {
    const canvas = canvasRef.current
    const dims = dimsRef.current
    if (!canvas || !dims) return
    const img = new Image()
    img.src = electionMapSrc
    img.onload = () => {
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#050d28'; ctx.fillRect(0, 0, dims.w, dims.h)
      ctx.drawImage(img, 0, 0, dims.w, dims.h)
      placed.forEach((p, i) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
        ctx.fillStyle = '#c9a227'
        ctx.fill()
        ctx.fillStyle = '#f0f4ff'
        ctx.font = 'bold 10px sans-serif'
        ctx.fillText(CONSTITUENCIES[i].name, p.x + 8, p.y + 4)
      })
    }
  }, [placed])

  const handleClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const dims = dimsRef.current
    if (!canvas || !dims || saving) return
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (dims.w / rect.width)
    const y = (e.clientY - rect.top) * (dims.h / rect.height)
    const px = x / dims.w
    const py = y / dims.h
    setSaving(true)
    await saveConstituencySeed(CONSTITUENCIES[idx].name, px, py)
    setSaving(false)
    setPlaced(prev => [...prev, { x, y }])
    if (idx + 1 >= CONSTITUENCIES.length) {
      onDone()
    } else {
      setIdx(idx + 1)
    }
  }

  const handleBack = () => {
    if (idx === 0) return
    setIdx(idx - 1)
    setPlaced(prev => prev.slice(0, -1))
  }

  const current = CONSTITUENCIES[idx]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(4,10,32,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.3em', color: '#c9a227', fontFamily: 'var(--font-body)', textTransform: 'uppercase', marginBottom: 6 }}>
          Map Calibration — {idx + 1} / {CONSTITUENCIES.length}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#f0f4ff', fontFamily: 'var(--font-display)' }}>
          Click the centre of <span style={{ color: '#c9a227' }}>{current.name}</span>
        </div>
        <div style={{ fontSize: 12, color: '#6a80b0', fontFamily: 'var(--font-body)', marginTop: 4 }}>
          {saving ? 'Saving…' : 'Click directly on the dot marker for this constituency'}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ maxWidth: '90vw', maxHeight: '65vh', display: 'block', cursor: saving ? 'wait' : 'crosshair', border: '1px solid rgba(201,162,39,0.3)' }}
        onClick={handleClick}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        {idx > 0 && (
          <button onClick={handleBack} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(201,162,39,0.4)', color: '#c9a227', fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer' }}>
            ← Back
          </button>
        )}
        <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(196,18,48,0.4)', color: '#c41230', fontFamily: 'var(--font-body)', fontSize: 12, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ApprovalMap({ parties, seeds }: { parties: Party[]; seeds: SeedMap }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hitDataRef = useRef<Uint8ClampedArray | null>(null)
  const canvasDimsRef = useRef<{ w: number; h: number } | null>(null)
  const seedPxRef = useRef<Array<{ x: number; y: number }>>([])
  const [tooltip, setTooltip] = useState<{ x: number; y: number; idx: number } | null>(null)

  const allRatings = parties.length
    ? CONSTITUENCIES.map((_, i) => getConstituencyDailyRatings(i, parties))
    : []

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !parties.length) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#050d28'
    ctx.fillRect(0, 0, canvas.width || 700, canvas.height || 700)

    const img = new Image()
    img.src = electionMapSrc
    img.onload = () => {
      const scale = Math.min(1, 900 / img.naturalWidth)
      const W = Math.round(img.naturalWidth * scale)
      const H = Math.round(img.naturalHeight * scale)
      canvas.width = W; canvas.height = H

      const off = document.createElement('canvas')
      off.width = W; off.height = H
      const offCtx = off.getContext('2d')!
      offCtx.drawImage(img, 0, 0, W, H)
      const imageData = offCtx.getImageData(0, 0, W, H)
      const dispData = imageData.data

      // origData: frozen snapshot used only for hit-canvas boundary detection.
      // dispData: modified in-place as constituencies are filled with party colors.
      const origData = new Uint8ClampedArray(dispData.length)
      origData.set(dispData)

      // Raw seed pixel coords — do NOT snap to dark pixels for Voronoi.
      // Snapping can cross a white border into the wrong constituency's dark region,
      // making that constituency "steal" Voronoi ownership of its neighbour.
      const seedPx: Array<{ x: number; y: number }> = CONSTITUENCIES.map(c => {
        const s = seeds[c.name] ?? c
        return { x: Math.round(s.px * W), y: Math.round(s.py * H) }
      })

      // Display fill: multi-seed spray per constituency (snapping is fine here).
      for (let i = 0; i < CONSTITUENCIES.length; i++) {
        const ratings = allRatings[i] ?? {}
        const dominant = parties.slice().sort((a, b) => (ratings[b.id] ?? 0) - (ratings[a.id] ?? 0))[0]
        if (!dominant) continue
        const [r, g, b] = hexToRgb(dominant.color)
        const seed = seeds[CONSTITUENCIES[i].name] ?? CONSTITUENCIES[i]
        for (const [dx, dy] of APPROVAL_SEED_OFFSETS) {
          const sx = Math.round((seed.px + dx) * W)
          const sy = Math.round((seed.py + dy) * H)
          canvasFloodFill(dispData, W, H, sx, sy, r, g, b)
        }
      }

      // Hit canvas: pure Voronoi nearest-seed.
      // Each dark pixel is assigned to whichever constituency's raw seed position
      // is geometrically closest. No snapping — snapping was corrupting ownership.
      const hitData = new Uint8ClampedArray(dispData.length)
      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const pos = py * W + px
          if (!isDark(origData, pos * 4)) continue
          let bestI = 0, bestDist = Infinity
          for (let i = 0; i < seedPx.length; i++) {
            const dx = px - seedPx[i].x, dy = py - seedPx[i].y
            const d = dx * dx + dy * dy
            if (d < bestDist) { bestDist = d; bestI = i }
          }
          const idx = pos * 4
          hitData[idx] = bestI + 1; hitData[idx+1] = 0; hitData[idx+2] = 0; hitData[idx+3] = 255
        }
      }

      for (let i = 0; i < dispData.length; i += 4) {
        if (dispData[i+3] < 128) {
          dispData[i] = 5; dispData[i+1] = 13; dispData[i+2] = 40; dispData[i+3] = 255
        }
      }

      offCtx.putImageData(imageData, 0, 0)
      ctx.fillStyle = '#050d28'; ctx.fillRect(0, 0, W, H)
      ctx.drawImage(off, 0, 0)

      // Draw seed markers so admin can verify positions.
      seedPxRef.current = seedPx

      hitDataRef.current = hitData
      canvasDimsRef.current = { w: W, h: H }
    }
  }, [JSON.stringify(allRatings.map(r => Object.keys(r).sort().map(k => r[k]).join(','))), JSON.stringify(seeds)])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const dims = canvasDimsRef.current
    const hitData = hitDataRef.current
    if (!canvas || !dims || !hitData) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) * (dims.w / rect.width))
    const y = Math.round((e.clientY - rect.top) * (dims.h / rect.height))
    if (x < 0 || y < 0 || x >= dims.w || y >= dims.h) { setTooltip(null); return }
    const constituencyIdx = hitData[(y * dims.w + x) * 4] - 1
    if (constituencyIdx >= 0 && constituencyIdx < CONSTITUENCIES.length) {
      setTooltip({ x: e.clientX, y: e.clientY, idx: constituencyIdx })
    } else {
      setTooltip(null)
    }
  }

  const tooltipData = tooltip !== null && allRatings[tooltip.idx]
    ? parties.slice().sort((a, b) => (allRatings[tooltip.idx][b.id] ?? 0) - (allRatings[tooltip.idx][a.id] ?? 0))
    : []

  const tooltipLeft = tooltip
    ? (tooltip.x + 224 + 20 > window.innerWidth ? tooltip.x - 224 - 12 : tooltip.x + 16)
    : 0
  const tooltipTop = tooltip
    ? (tooltip.y - 8)
    : 0

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ maxWidth: '100%', width: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip !== null && tooltipData.length > 0 && (
        <div style={{
          position: 'fixed',
          left: tooltipLeft,
          top: tooltipTop,
          background: '#0a1a50',
          border: '1px solid rgba(201,162,39,0.35)',
          padding: '12px 14px',
          zIndex: 1000,
          width: 216,
          pointerEvents: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff', fontFamily: 'var(--font-display)', marginBottom: 10, borderBottom: '1px solid rgba(201,162,39,0.2)', paddingBottom: 7 }}>
            {CONSTITUENCIES[tooltip.idx].name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {tooltipData.map(p => {
              const pct = allRatings[tooltip.idx][p.id] ?? 0
              return (
                <div key={p.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, background: p.color, borderRadius: 1, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: '#b8c4e8', fontFamily: 'var(--font-body)' }}>{p.abbr}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: p.color, fontFamily: 'var(--font-body)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: p.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ApprovalPage({ parties, isAdmin }: { parties: Party[]; isAdmin: boolean }) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const [seeds, setSeeds] = useState<SeedMap>({})

  useEffect(() => {
    loadConstituencySeeds().then(setSeeds)
  }, [])

  return (
    <section id="approval" style={{ background: '#050d28', paddingTop: 64, paddingBottom: 0 }}>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.3em', color: '#c9a227', fontFamily: 'var(--font-body)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
            Updated Daily · {today}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 800, color: '#f0f4ff', marginBottom: 10, lineHeight: 1.15 }}>
            Constituency Approval Ratings
          </h2>
          <p style={{ color: '#6a80b0', fontFamily: 'var(--font-body)', fontSize: 14, maxWidth: 480, margin: '0 auto' }}>
            Hover over any constituency to see party approval ratings. Map is coloured by the leading party in each area.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {parties.length === 0 ? (
              <div style={{ background: '#0a1a50', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: '#3d4f70', fontFamily: 'var(--font-body)', fontSize: 13 }}>
                Loading parties…
              </div>
            ) : (
              <ApprovalMap parties={parties} seeds={seeds} />
            )}
          </div>

          <div style={{ width: 170, flexShrink: 0, paddingTop: 4 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.25em', color: '#6a80b0', fontFamily: 'var(--font-body)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>
              Parties
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {parties.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{ width: 13, height: 13, background: p.color, borderRadius: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f4ff', fontFamily: 'var(--font-body)', lineHeight: 1.2 }}>{p.abbr}</div>
                    <div style={{ fontSize: 10, color: '#3d4f70', fontFamily: 'var(--font-body)' }}>{p.size === 'major' ? 'Major' : 'Minor'}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28, padding: '12px', background: 'rgba(201,162,39,0.06)', border: '1px solid rgba(201,162,39,0.2)' }}>
              <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#c9a227', fontFamily: 'var(--font-body)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Note</div>
              <div style={{ fontSize: 11, color: '#6a80b0', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
                Ratings fluctuate daily. Hover any constituency to view full breakdown.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ElectionMap({ results, seatAssignment }: { results: VoteResult[]; seatAssignment: Record<number, string> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const colorMap = Object.fromEntries(results.map(r => [r.party_id, r.party_color]))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Paint background immediately so the canvas never shows checkerboard
    ctx.fillStyle = '#050d28'
    ctx.fillRect(0, 0, canvas.width || 600, canvas.height || 600)

    const img = new Image()
    img.src = electionMapSrc
    img.onload = () => {
      const scale = Math.min(1, 900 / img.naturalWidth)
      const W = Math.round(img.naturalWidth * scale)
      const H = Math.round(img.naturalHeight * scale)
      canvas.width = W
      canvas.height = H

      // Re-fill after resizing (setting canvas.width resets content)
      ctx.fillStyle = '#050d28'
      ctx.fillRect(0, 0, W, H)

      // Use an offscreen canvas for pixel analysis so the background fill
      // doesn't pollute the dark-pixel detection used by the flood fill.
      const off = document.createElement('canvas')
      off.width = W; off.height = H
      const offCtx = off.getContext('2d')!
      offCtx.drawImage(img, 0, 0, W, H)
      const imageData = offCtx.getImageData(0, 0, W, H)
      const data = imageData.data

      // Flood-fill each assigned constituency.
      // White text labels split constituencies into disconnected dark regions,
      // so we spray a grid of seed points around each centre to reach all pieces.
      const SEED_OFFSETS = [
        [0, 0], [-0.04, 0], [0.04, 0], [0, -0.04], [0, 0.04],
        [-0.04, -0.04], [0.04, -0.04], [-0.04, 0.04], [0.04, 0.04],
        [-0.07, 0], [0.07, 0], [0, -0.07], [0, 0.07],
      ]
      for (let i = 0; i < CONSTITUENCIES.length; i++) {
        const partyId = seatAssignment[i]
        if (!partyId) continue
        const hex = colorMap[partyId]
        if (!hex) continue
        const [r, g, b] = hexToRgb(hex)
        for (const [dx, dy] of SEED_OFFSETS) {
          const sx = Math.round((CONSTITUENCIES[i].px + dx) * W)
          const sy = Math.round((CONSTITUENCIES[i].py + dy) * H)
          canvasFloodFill(data, W, H, sx, sy, r, g, b)
        }
      }

      // Replace every remaining transparent pixel with the page background colour.
      // This covers: outside the map, water, and any unfilled areas.
      // After this there are zero transparent pixels — no checkerboard possible.
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) {
          data[i] = 5; data[i + 1] = 13; data[i + 2] = 40; data[i + 3] = 255
        }
      }

      // Write fills back to offscreen canvas
      offCtx.putImageData(imageData, 0, 0)

      // Render to display canvas.
      // The modified 'off' canvas already has everything:
      //   - party colors in constituency areas
      //   - white border lines + labels (not touched — isDark is false for white)
      //   - transparent pixels everywhere else (outside map + water)
      // So just fill navy background then draw fills — no second image draw needed.
      ctx.fillStyle = '#050d28'
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(off, 0, 0)
    }
  }, [seatAssignment, colorMap])

  const hasVotes = results.some(r => r.votes > 0)

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#050d28' }}>
      <canvas ref={canvasRef} style={{ maxWidth: '100%', width: '100%', display: 'block', opacity: hasVotes ? 1 : 0.25, transition: 'opacity 0.6s' }} />
      {!hasVotes && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#6a80b0', fontFamily: 'var(--font-body)', fontSize: 13 }}>Awaiting first votes…</span>
        </div>
      )}
    </div>
  )
}

const TOTAL_SEATS = CONSTITUENCIES.length
const MAJORITY = Math.ceil(TOTAL_SEATS / 2)

function ElectionPage({ election, session, parties }: { election: Election; session: Session | null; parties: Party[] }) {
  const [userVote, setUserVote] = useState<string | null>(null)
  const [results, setResults] = useState<VoteResult[]>([])
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState('')
  const [timeLeft, setTimeLeft] = useState('')
  const isOver = election.status !== 'active'

  const loadData = async () => {
    const [vote, res] = await Promise.all([getUserVote(election.id), getResults(election.id)])
    setUserVote(vote)
    setResults(res)
  }

  useEffect(() => { loadData() }, [election.id])

  // Live polling every 5 seconds
  useEffect(() => {
    if (isOver) return
    const id = setInterval(loadData, 5000)
    return () => clearInterval(id)
  }, [election.id, isOver])

  // Countdown
  useEffect(() => {
    if (isOver) return
    const tick = () => {
      const diff = new Date(election.ends_at).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Ended'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [election.ends_at, isOver])

  const handleVote = async (partyId: string) => {
    if (!session) { setError('You must be signed in to vote.'); return }
    if (userVote) { setError('Click "Uncast" on your current vote first.'); return }
    setVoting(true); setError('')
    try { await castVote(election.id, partyId); await loadData() }
    catch (e: any) { setError(e.message === 'already_voted' ? 'You have already voted.' : e.message) }
    finally { setVoting(false) }
  }

  const handleUncast = async () => {
    setVoting(true); setError('')
    try { await removeVote(election.id); await loadData() }
    catch (e: any) { setError(e.message) }
    finally { setVoting(false) }
  }

  const totalVotes = results.reduce((s, r) => s + r.votes, 0)
  const hasVoted = !!userVote

  // Compute seats once, share with map + sidebar
  const seatAssignment = assignConstituencies(results, election.id)
  const seatCounts: Record<string, number> = {}
  for (const pid of Object.values(seatAssignment)) seatCounts[pid] = (seatCounts[pid] ?? 0) + 1

  const partyData = parties.map(p => {
    const r = results.find(r => r.party_id === p.id)
    return { ...p, votes: r?.votes ?? 0, percentage: r?.percentage ?? 0, seats: seatCounts[p.id] ?? 0 }
  }).sort((a, b) => b.seats - a.seats || b.votes - a.votes)

  const [p1, p2] = partyData
  const p1Seats = p1?.seats ?? 0
  const p2Seats = p2?.seats ?? 0

  const col: React.CSSProperties = { fontFamily: 'var(--font-body)' }

  return (
    <section id="election" style={{ background: '#050d28', minHeight: '100vh' }}>

      {/* ── Top header strip ── */}
      <div style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isOver && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c41230', boxShadow: '0 0 8px #c41230', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />}
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.3em', color: isOver ? '#6a80b0' : '#c41230', textTransform: 'uppercase', fontWeight: 700, ...col }}>
                {isOver ? (election.status === 'called' ? 'Election Called' : 'Election Closed') : 'Live Election'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f0f4ff', fontFamily: 'var(--font-display)' }}>{election.name}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {!isOver && <div style={{ fontSize: 22, fontWeight: 700, color: '#c9a227', fontFamily: 'monospace' }}>{timeLeft}</div>}
            <div style={{ fontSize: 11, color: '#6a80b0', ...col }}>{totalVotes} votes cast · updates every 5s</div>
          </div>
        </div>
      </div>

      {/* ── Seat battle bar ── */}
      <div style={{ background: 'rgba(0,0,0,0.35)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '18px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

            {/* P1 */}
            <div style={{ width: 160, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 48, fontWeight: 900, color: p1?.color ?? '#3d4f70', fontFamily: 'var(--font-display)', lineHeight: 1, transition: 'color 0.4s' }}>{p1Seats}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff', ...col }}>{p1?.abbr ?? '—'}</div>
              <div style={{ fontSize: 11, color: '#6a80b0', ...col, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p1?.name ?? ''}</div>
            </div>

            {/* Seat bar */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: '#c9a227', fontWeight: 700, letterSpacing: '0.15em', ...col }}>{MAJORITY} SEATS TO WIN</span>
              </div>
              <div style={{ position: 'relative', height: 24, background: 'rgba(255,255,255,0.04)', overflow: 'hidden', borderRadius: 2, display: 'flex' }}>
                {/* P1 grows from left */}
                <div style={{ width: `${(p1Seats / TOTAL_SEATS) * 100}%`, background: p1?.color ?? '#1a2a60', transition: 'width 0.7s ease', flexShrink: 0 }} />
                {/* other parties fill middle */}
                {partyData.slice(2).filter(p => p.seats > 0).map(p => (
                  <div key={p.id} style={{ width: `${(p.seats / TOTAL_SEATS) * 100}%`, background: p.color, transition: 'width 0.7s ease', flexShrink: 0 }} />
                ))}
                {/* P2 grows from right via margin-left auto */}
                <div style={{ marginLeft: 'auto', width: `${(p2Seats / TOTAL_SEATS) * 100}%`, background: p2?.color ?? '#1a2a60', transition: 'width 0.7s ease', flexShrink: 0 }} />
                {/* Majority marker */}
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: '#c9a227', zIndex: 3 }} />
              </div>
              {/* Other parties mini-legend under bar */}
              {partyData.slice(2).filter(p => p.seats > 0).length > 0 && (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                  {partyData.slice(2).filter(p => p.seats > 0).map(p => (
                    <span key={p.id} style={{ fontSize: 10, color: p.color, fontWeight: 700, ...col }}>{p.abbr} {p.seats}</span>
                  ))}
                </div>
              )}
            </div>

            {/* P2 */}
            <div style={{ width: 160, flexShrink: 0, textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 48, fontWeight: 900, color: p2?.color ?? '#3d4f70', fontFamily: 'var(--font-display)', lineHeight: 1, transition: 'color 0.4s' }}>{p2Seats}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff', ...col }}>{p2?.abbr ?? '—'}</div>
              <div style={{ fontSize: 11, color: '#6a80b0', ...col, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p2?.name ?? ''}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main 3-col ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '210px 1fr 210px', minHeight: 560 }}>

        {/* Left: parties + vote */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.05)', padding: '18px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#6a80b0', textTransform: 'uppercase', fontWeight: 700, ...col, marginBottom: 4 }}>Cast Your Vote</div>

          {!session && !isOver && (
            <div style={{ fontSize: 11, color: '#c9a227', border: '1px solid rgba(201,162,39,0.25)', padding: '8px 10px', marginBottom: 4, ...col }}>
              Sign in with Discord to vote
            </div>
          )}
          {error && <div style={{ fontSize: 11, color: '#c41230', marginBottom: 4, ...col }}>{error}</div>}

          {partyData.map(party => {
            const isMyVote = userVote === party.id
            const canVote = !!(session && !hasVoted && !isOver && !voting)
            return (
              <div key={party.id}
                onClick={() => canVote && handleVote(party.id)}
                style={{
                  padding: '10px 10px', border: `1px solid ${isMyVote ? party.color : 'rgba(255,255,255,0.06)'}`,
                  background: isMyVote ? `${party.color}18` : 'rgba(255,255,255,0.015)',
                  cursor: canVote ? 'pointer' : 'default', transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { if (canVote) e.currentTarget.style.borderColor = party.color }}
                onMouseLeave={e => { if (!isMyVote) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, background: party.color, borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f0f4ff', ...col }}>{party.abbr}</div>
                    <div style={{ fontSize: 10, color: '#6a80b0', ...col, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{party.name}</div>
                  </div>
                  {canVote && <div style={{ fontSize: 10, color: '#c9a227', border: '1px solid rgba(201,162,39,0.3)', padding: '2px 6px', flexShrink: 0, ...col }}>Vote</div>}
                  {!canVote && !isOver && hasVoted && !isMyVote && (
                    <div style={{ fontSize: 10, color: '#3d4f70', ...col }}>—</div>
                  )}
                </div>
                {isMyVote && (
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: party.color, ...col }}>✓ Your vote</span>
                    <button onClick={e => { e.stopPropagation(); handleUncast() }} disabled={voting}
                      style={{ fontSize: 10, color: '#c41230', background: 'none', border: 'none', cursor: 'pointer', ...col, padding: 0 }}>
                      Uncast
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Centre: map */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 12px' }}>
          <ElectionMap results={results} seatAssignment={seatAssignment} />
        </div>

        {/* Right: standings */}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', padding: '18px 14px' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#6a80b0', textTransform: 'uppercase', fontWeight: 700, ...col, marginBottom: 12 }}>Seat Standings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {partyData.map((party, i) => (
              <div key={party.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: '#3d4f70', ...col, width: 12 }}>{i + 1}</span>
                    <div style={{ width: 10, height: 10, background: party.color, borderRadius: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#c8d4f0', ...col, fontWeight: 600 }}>{party.abbr}</span>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 800, color: party.seats > 0 ? party.color : '#3d4f70', fontFamily: 'var(--font-display)', transition: 'color 0.4s' }}>{party.seats}</span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(party.seats / TOTAL_SEATS) * 100}%`, background: party.color, transition: 'width 0.7s ease' }} />
                </div>
                <div style={{ fontSize: 10, color: '#6a80b0', ...col, marginTop: 3 }}>{party.votes} votes · {party.percentage}%</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#3d4f70', ...col }}>
              Majority: <span style={{ color: '#c9a227' }}>{MAJORITY}</span> · Total: {TOTAL_SEATS} seats
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ConstitutionPage() {
  const [sections, setSections] = useState<ConstitutionSection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadConstitutionSections().then(s => { setSections(s); setLoading(false) }) }, [])

  return (
    <section id="constitution" style={{ background: 'linear-gradient(180deg, #050d28 0%, #060f30 100%)', paddingTop: 80, paddingBottom: 80 }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 24px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.4em', color: '#c9a227', fontFamily: 'var(--font-body)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>
            Founding Document
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 400, color: '#6a80b0', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16 }}>
            The Constitution of the Parliamentary Democracy of
          </h2>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, fontWeight: 900, color: '#f0f4ff', lineHeight: 1, marginBottom: 20, letterSpacing: '-0.02em' }}>
            ANDERSIDE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <div style={{ height: 1, width: 60, background: 'rgba(201,162,39,0.3)' }} />
            <div style={{ width: 6, height: 6, background: '#c9a227', transform: 'rotate(45deg)' }} />
            <div style={{ height: 1, width: 60, background: 'rgba(201,162,39,0.3)' }} />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#3d4f70', fontFamily: 'var(--font-body)', fontSize: 13, padding: 48 }}>Loading…</div>
        ) : sections.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#3d4f70', fontFamily: 'var(--font-body)', fontSize: 13, padding: 48 }}>
            The constitution has not yet been published.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sections.map((s) => s.is_article ? (
              /* Article heading row */
              <div key={s.id} style={{ marginTop: 52, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                  <div style={{ height: 1, flex: 1, background: 'rgba(201,162,39,0.2)' }} />
                  <span style={{ fontSize: 10, letterSpacing: '0.35em', color: '#c9a227', fontFamily: 'var(--font-body)', textTransform: 'uppercase', fontWeight: 700, flexShrink: 0 }}>
                    {s.title}
                  </span>
                  <div style={{ height: 1, flex: 1, background: 'rgba(201,162,39,0.2)' }} />
                </div>
                {s.body ? (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#6a80b0', lineHeight: 1.7, textAlign: 'center', fontStyle: 'italic' }}>{s.body}</p>
                ) : null}
              </div>
            ) : (
              /* Section content row */
              <div key={s.id} style={{ display: 'flex', gap: 24, paddingTop: 20, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ width: 3, flexShrink: 0, background: 'rgba(201,162,39,0.2)', borderRadius: 2, alignSelf: 'stretch', minHeight: 20 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#c9a227', fontFamily: 'var(--font-body)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>
                    {s.title}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#8fa0cc', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                    {s.body}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 56, paddingTop: 24, borderTop: '1px solid rgba(201,162,39,0.15)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 6, height: 6, background: '#c9a227', transform: 'rotate(45deg)', margin: '0 auto' }} />
              <span style={{ fontSize: 10, letterSpacing: '0.35em', color: '#3d4f70', fontFamily: 'var(--font-body)', textTransform: 'uppercase' }}>
                End of Constitution
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function About() {
  return (
    <section
      id="about"
      className="py-28 px-6"
      style={{ background: 'linear-gradient(180deg, #060e30 0%, #0a1a50 100%)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <SectionLabel>What is Anderside?</SectionLabel>
            <h2
              className="text-4xl md:text-5xl font-bold mb-8 leading-tight"
              style={{ fontFamily: 'var(--font-display)', color: '#f0f4ff' }}
            >
              Political roleplay
              <br />
              at its most <em style={{ color: '#c9a227' }}>immersive</em>
            </h2>
            <div className="space-y-5">
              {[
                'Anderside is a political simulation (Polsim) running on Discord. Members take on the roles of politicians, party leaders, judges, and citizens — all within a fully-functioning parliamentary democracy.',
                'Stand for election to Parliament, form or join a political party, draft and debate legislation, and rise through the ranks to become Prime Minister. Or take your seat on the bench of the High Court and shape the constitutional landscape.',
                'Every institution is player-run. Elections are competitive. The courts are independent. Your only limits are your political strategy and your rhetoric.',
              ].map((para, i) => (
                <p key={i} className="text-base leading-relaxed" style={{ color: '#6a80b0', fontFamily: 'var(--font-body)', lineHeight: 1.8 }}>
                  {para}
                </p>
              ))}
            </div>
          </div>

          {/* Flag display */}
          <div className="relative">
            <div
              className="absolute -inset-4 opacity-20 blur-2xl"
              style={{ background: 'radial-gradient(ellipse, #c41230, transparent 70%)' }}
            />
            <img
              src={flag}
              alt="Flag of the Nation of Anderside"
              className="relative w-full"
              style={{
                border: '2px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              }}
            />
            <div
              className="mt-4 px-4 py-3 text-center"
              style={{ border: '1px solid rgba(201,162,39,0.2)', background: 'rgba(201,162,39,0.04)' }}
            >
              <span
                className="text-xs tracking-widest uppercase"
                style={{ color: '#c9a227', fontFamily: 'var(--font-body)', letterSpacing: '0.25em' }}
              >
                Flag of The Nation of Anderside
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function JoinSection({ session, signInWithDiscord }: { session: Session | null; signInWithDiscord: () => void }) {
  return (
    <section
      id="join"
      className="py-28 px-6 relative overflow-hidden"
      style={{ background: '#0a1a50' }}
    >
      {/* Background symbol watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src={symbol}
          alt=""
          aria-hidden="true"
          style={{ width: 500, height: 500, objectFit: 'contain', opacity: 0.04 }}
        />
      </div>

      {/* Red stripe accent */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: '4px', background: 'linear-gradient(90deg, #0a1a50, #c41230 30%, #c41230 70%, #0a1a50)' }}
      />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <SectionLabel>Join the Nation</SectionLabel>
        <h2
          className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
          style={{ fontFamily: 'var(--font-display)', color: '#f0f4ff' }}
        >
          Your seat in Parliament
          <br />
          <em style={{ color: '#c9a227' }}>awaits.</em>
        </h2>
        <p
          className="text-lg mb-10 leading-relaxed"
          style={{ color: '#6a80b0', fontFamily: 'var(--font-body)' }}
        >
          Join our Discord server to register as a citizen of Anderside. Declare your party
          affiliation, stand for election, and begin your path to political power.
        </p>

        {session ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="px-6 py-3 text-sm"
              style={{ border: '1.5px solid rgba(201,162,39,0.35)', color: '#c9a227', fontFamily: 'var(--font-body)', background: 'rgba(201,162,39,0.06)' }}
            >
              ✓ Signed in as a Citizen of Anderside
            </div>
            <a
              href="https://discord.gg/C9bedQtYDG"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-10 py-4 text-sm font-bold tracking-widest uppercase transition-all duration-200"
              style={{ background: '#1a3eb0', color: '#ffffff', fontFamily: 'var(--font-body)', letterSpacing: '0.2em' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2348cc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#1a3eb0')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.044.031.054a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              Open the Discord Server
            </a>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={signInWithDiscord}
              className="inline-flex items-center gap-3 px-10 py-4 text-sm font-bold tracking-widest uppercase transition-all duration-200"
              style={{ background: '#c41230', color: '#ffffff', fontFamily: 'var(--font-body)', letterSpacing: '0.2em' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#e01535')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#c41230')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.044.031.054a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              Sign in with Discord
            </button>
            <a
              href="https://discord.gg/C9bedQtYDG"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 text-sm font-semibold tracking-widest uppercase transition-all duration-200"
              style={{ border: '1.5px solid rgba(201,162,39,0.4)', color: '#b8c4e8', fontFamily: 'var(--font-body)', letterSpacing: '0.2em' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c9a227'; e.currentTarget.style.color = '#f0f4ff' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(201,162,39,0.4)'; e.currentTarget.style.color = '#b8c4e8' }}
            >
              Browse First
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer
      className="py-10 px-6"
      style={{ background: '#040a20', borderTop: '1px solid rgba(196,18,48,0.2)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <img src={symbol} alt="Anderside symbol" style={{ width: 40, height: 40, objectFit: 'contain' }} />
            <div>
              <div className="text-xs tracking-widest uppercase" style={{ color: '#c9a227', fontFamily: 'var(--font-body)', letterSpacing: '0.25em' }}>
                The Nation of
              </div>
              <div className="text-lg font-bold" style={{ color: '#f0f4ff', fontFamily: 'var(--font-display)' }}>
                Anderside
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-2 justify-center">
            {['Parliament', 'High Court', 'Parties', 'About', 'Join'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-xs tracking-wide transition-colors duration-200"
                style={{ color: '#2e3e70', fontFamily: 'var(--font-body)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#c9a227')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#2e3e70')}
              >
                {item}
              </a>
            ))}
          </div>

          <div className="text-xs text-center" style={{ color: '#1e2a50', fontFamily: 'var(--font-body)' }}>
            © 2026 The Nation of Anderside
            <br />
            A Discord Political Simulation
          </div>
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  const [scrolled, setScrolled] = useState(false)
  const { session, loading, isAdmin, signInWithDiscord, signOut } = useAuth()
  const [parties, setParties] = useState<Party[]>([])
  const [partiesLoading, setPartiesLoading] = useState(true)
  const [activeElection, setActiveElection] = useState<Election | null>(null)

  const loadParties = () => {
    setPartiesLoading(true)
    getParties().then((p) => { setParties(p); setPartiesLoading(false) }).catch(() => setPartiesLoading(false))
  }

  const loadActiveElection = () => {
    getActiveElection().then((e) => setActiveElection(e)).catch(() => setActiveElection(null))
  }

  useEffect(() => { loadParties(); loadActiveElection() }, [])

  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const ids = ['parliament', 'court', 'parties', 'approval', 'constitution', 'about', 'join']
    const onScroll = () => {
      const mid = window.innerHeight * 0.4
      let current = ''
      for (const id of ids) {
        const el = document.getElementById(id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= mid) current = id
      }
      setActiveSection(current)
      history.replaceState(null, '', current ? `#${current}` : window.location.pathname)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ background: '#0a1a50' }}>
      <NavBar scrolled={scrolled} activeSection={activeSection} session={session} loading={loading} isAdmin={isAdmin} signInWithDiscord={signInWithDiscord} signOut={signOut} onPartiesChanged={loadParties} activeElection={activeElection} onElectionChanged={loadActiveElection} />
      <Hero />
      <Institutions />
      <Parties parties={parties} loading={partiesLoading} />
      {activeElection && <ElectionPage election={activeElection} session={session} parties={parties} />}
      <ApprovalPage parties={parties} isAdmin={isAdmin} />
      <ConstitutionPage />
      <About />
      <JoinSection session={session} signInWithDiscord={signInWithDiscord} />
      <Footer />
    </div>
  )
}

