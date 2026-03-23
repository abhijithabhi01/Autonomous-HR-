// src/pages/candidate/PolicyBot.jsx
// All Gemini calls go through /api/policy/chat on the backend,
// which uses Vertex AI with the service account credentials.
// No VITE_GEMINI_API_KEY needed in the frontend.

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useCreatePolicySession, useAddPolicyMessage } from '../../hooks/useData'

const BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
const api  = (path) => BASE ? `${BASE}${path}` : path

const SUGGESTIONS = [
  'How many annual leaves do I get?',
  'What is the remote work policy?',
  'How do I claim travel expenses?',
  'What is the notice period?',
  'When is salary paid?',
  'Can I work from home during probation?',
]

// ── Message component ─────────────────────────────────────────
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
        {!isUser && msg.model && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <span className="text-[10px]">✨</span>
            <span className="text-[10px] text-slate-500">Gemini 2.5 Flash · Vertex AI</span>
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

// ── Main component ────────────────────────────────────────────
export default function PolicyBot() {
  const { user }      = useAuth()
  const createSession = useCreatePolicySession()
  const addMessage    = useAddPolicyMessage()
  const sessionRef    = useRef(null)
  const endRef        = useRef(null)
  const inputRef      = useRef(null)

  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [messages, setMessages] = useState([{
    id: 'init', role: 'bot',
    content: "Hi! I'm your HR Policy Assistant powered by Gemini 2.5 Flash. Ask me anything about leaves, expenses, remote work, payroll, or any company policy.",
  }])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const question = (text || input).trim()
    if (!question || loading) return
    setInput('')
    setLoading(true)

    const userMsg = { id: Date.now(), role: 'user', content: question }
    setMessages(prev => [...prev, userMsg])

    let answer = ''
try {
      // All AI work happens on the backend
      const res  = await fetch(api('/api/policy/chat'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question, history: messages }),
      })
      
      // Safely parse the response to prevent the "Unexpected end of JSON" crash
      const text = await res.text()
      const data = text ? JSON.parse(text) : { error: 'Backend server is unreachable or crashed.' }
      
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
      answer = data.answer
    } catch (err) {
      console.warn('[PolicyBot] chat failed:', err.message)
      answer = "I'm having trouble connecting to the HR server right now. Please ensure the backend is running or contact IT."
    }

    setMessages(prev => [...prev, {
      id: Date.now() + 1, role: 'bot', content: answer, model: true,
    }])
    setLoading(false)
    inputRef.current?.focus()

    // Log to Firestore (best-effort)
    try {
      const candidateId = user?.candidate_id || null
      const employeeId  = user?.employee_id  || null
      if (!sessionRef.current && (candidateId || employeeId)) {
        const session = await createSession.mutateAsync({ candidateId, employeeId })
        sessionRef.current = session.id
      }
      if (sessionRef.current) {
        await addMessage.mutateAsync({ sessionId: sessionRef.current, role: 'user', content: question })
        await addMessage.mutateAsync({ sessionId: sessionRef.current, role: 'bot',  content: answer })
      }
    } catch (err) {
      console.warn('[PolicyBot] Logging non-fatal:', err.message)
    }
  }

  return (
    <div className="flex flex-col h-screen p-4 sm:p-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-2xl font-display font-bold text-white">HR Policy Bot</h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-slate-500 text-sm">Powered by Gemini 2.5 Flash · Vertex AI</p>
        </div>
      </div>

      {/* Quick suggestions */}
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0 pr-1">
        {messages.map(msg => <Message key={msg.id} msg={msg} />)}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 text-sm">🤖</div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#131929] border border-white/[0.06]">
              <div className="flex gap-1 items-center h-5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3 flex-shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Ask any HR policy question…"
          disabled={loading}
          className="flex-1 bg-[#0D1120] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200
                     placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 transition-all disabled:opacity-50"
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white w-12 h-12 rounded-xl
                     transition-all flex items-center justify-center disabled:cursor-not-allowed flex-shrink-0"
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