import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCreatePolicySession, useAddPolicyMessage } from '../../hooks/useData'
import { answerPolicyQuestion } from '../../lib/ai'

// ── Company policy (edit to match your real policies) ─────────
const POLICY_CONTEXT = `
LEAVE POLICY:
- Annual Leave: 21 days per calendar year (accrues 1.75 days/month)
- Sick Leave: 10 days per year (medical certificate required after 2 consecutive days)
- Maternity Leave: 90 days paid
- Paternity Leave: 5 days paid
- Emergency Leave: 3 days per year
- Annual leave requires manager approval at least 2 weeks in advance

REMOTE WORK POLICY:
- Eligible roles may work remotely up to 2 days per week
- Core hours: 10 AM - 4 PM local timezone (must be online and reachable)
- Requires manager approval
- Remote work is NOT available during probation (first 3 months)

TRAVEL AND EXPENSES POLICY:
- International travel requires department head pre-approval
- Expense claims must be submitted within 30 days of travel
- Receipts required for any expense above AED 50
- Flights under 5 hours: economy class
- Flights over 5 hours: business class permitted

IT AND EQUIPMENT POLICY:
- Company laptop issued on Day 1
- Personal devices need IT registration for VPN access
- Software requests via IT helpdesk: it@company.com
- No company data on personal cloud services

PROBATION POLICY:
- 3-month probation period for all new hires
- Performance review at end of probation
- Notice period during probation: 1 week
- Notice period after probation: 1 month (staff), 3 months (management)

SALARY AND PAYROLL:
- Salary paid on the last working day of each month
- Overtime requires pre-approval from manager
- Annual increment review: January each year
- Performance bonus review: December each year
`

const SUGGESTIONS = [
  'How many annual leaves do I get?',
  'What is the remote work policy?',
  'How do I claim travel expenses?',
  'What is the notice period?',
  'When is salary paid?',
  'Can I work from home during probation?',
]

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
          🤖
        </div>
      )}
      <div className={`max-w-[80%] flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-[#131929] border border-white/[0.06] text-slate-200 rounded-tl-sm'}`}>
          {msg.content}
        </div>

        {/* Source badge — shown for bot messages that came from policy */}
        {!isUser && msg.source && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <span className="text-[10px]">📎</span>
            <span className="text-[10px] text-slate-500">{msg.source}</span>
            {msg.isLocal && (
              <span className="text-[10px] text-amber-500/70 ml-1">· local search</span>
            )}
            {!msg.isLocal && msg.confidence > 0 && (
              <span className="text-[10px] text-emerald-500/70 ml-1">· AI · {msg.confidence}%</span>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
          👤
        </div>
      )}
    </div>
  )
}

export default function PolicyBot() {
  const { user }        = useAuth()
  const createSession   = useCreatePolicySession()
  const addMessage      = useAddPolicyMessage()
  const sessionRef      = useRef(null)   // holds current session id
  const endRef          = useRef(null)
  const inputRef   = useRef(null)

  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([{
    id:      'init',
    role:    'bot',
    content: "Hi! I'm your HR Policy Assistant. Ask me anything about leaves, expenses, remote work, payroll, or any company policy.",
  }])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const question = (text || input).trim()
    if (!question || loading) return
    setInput('')
    setLoading(true)

    // Add user message immediately
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: question }])

    // answerPolicyQuestion never throws — always returns a safe object
    // Falls back to local keyword search if AI is unavailable
    const result = await answerPolicyQuestion(question, POLICY_CONTEXT)

    setMessages(prev => [...prev, {
      id:         Date.now() + 1,
      role:       'bot',
      content:    result.answer,
      source:     result.source_section || null,
      confidence: result.confidence     || 0,
      isLocal:    result.is_local       ?? true,
    }])

    setLoading(false)
    inputRef.current?.focus()

    // Log to Supabase using new policy_sessions + policy_messages schema (best-effort)
    try {
      const candidateId = user?.candidate_id || null
      const employeeId  = user?.employee_id  || null

      // Create session on first message of this conversation
      if (!sessionRef.current && (candidateId || employeeId)) {
        const session = await createSession.mutateAsync({ candidateId, employeeId })
        sessionRef.current = session.id
      }

      if (sessionRef.current) {
        // Save user question
        await addMessage.mutateAsync({
          sessionId: sessionRef.current,
          role:      'user',
          content:   question,
        })
        // Save bot answer
        await addMessage.mutateAsync({
          sessionId:     sessionRef.current,
          role:          'bot',
          content:       result.answer,
          sourceSection: result.source_section || null,
          confidence:    result.confidence     || null,
          isLocal:       result.is_local       ?? true,
        })
      }
    } catch (err) {
      console.warn('[PolicyBot] Logging non-fatal:', err.message)
    }
  }

  return (
    <div className="flex flex-col h-screen p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-display font-bold text-white">HR Policy Bot</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-slate-500 text-sm">Powered by OpenRouter AI · Falls back to local search</p>
        </div>
      </div>

      {/* Quick suggestions — hide after first message */}
      {messages.length <= 1 && (
        <div className="mb-5 flex-shrink-0">
          <p className="text-[10px] text-slate-600 mb-2 font-bold uppercase tracking-widest">Quick questions</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-slate-400 hover:text-slate-200 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0 pr-1">
        {messages.map(msg => <Message key={msg.id} msg={msg} />)}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 text-sm">🤖</div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#131929] border border-white/[0.06]">
              <div className="flex gap-1 items-center h-5">
                {[0, 1, 2].map(i => (
                  <div key={i}
                    className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input row */}
      <div className="flex gap-3 flex-shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask any HR policy question…"
          disabled={loading}
          className="flex-1 bg-[#0D1120] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white w-12 h-12 rounded-xl font-semibold transition-all flex items-center justify-center disabled:cursor-not-allowed flex-shrink-0"
          style={{ boxShadow: '0 0 16px rgba(99,102,241,0.25)' }}>
          {loading
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>}
        </button>
      </div>
    </div>
  )
}