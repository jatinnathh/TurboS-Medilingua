// app/consultation/[visitId]/ConsultationForm.tsx
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"

/* ── Types ── */
interface Message {
  id:          string
  role:        "patient" | "doctor"
  text:        string        // original transcribed text
  english:     string        // English version
  hindi:       string        // Hindi version
  kannada:     string        // Kannada version
  timestamp:   string
  language:    string        // original recording language
  hasTTS?:     boolean
  isLive?:     boolean       // true while still recording (live bubble)
}

interface MedicalReport {
  chiefComplaint:           string
  historyOfPresentIllness:  string
  symptoms:                 string[]
  examFindings:             string
  diagnosis:                string
  treatment:                string[]
  medications:              string[]
  investigations:           string[]
  followUp:                 string
  additionalNotes:          string
}

interface Props {
  visitId:      string
  department:   string
  patientName:  string
  patientAge:   number
  patientGender?: string
}

const LANGUAGES = [
  { code: "kn-IN", label: "ಕನ್ನಡ (Kannada)" },
  { code: "hi-IN", label: "हिन्दी (Hindi)"   },
  { code: "en-IN", label: "English"           },
]

const LANG_LABELS: Record<string, string> = {
  "en-IN": "English",
  "hi-IN": "हिन्दी",
  "kn-IN": "ಕನ್ನಡ",
}

const REPORT_FIELDS: { key: keyof MedicalReport; label: string; icon: string; isArray: boolean }[] = [
  { key: "chiefComplaint",          label: "Chief Complaint",      icon: "🤒", isArray: false },
  { key: "historyOfPresentIllness", label: "History of Illness",   icon: "📋", isArray: false },
  { key: "symptoms",                label: "Symptoms",             icon: "🔍", isArray: true  },
  { key: "examFindings",            label: "Examination Findings", icon: "🩺", isArray: false },
  { key: "diagnosis",               label: "Diagnosis",            icon: "🔬", isArray: false },
  { key: "treatment",               label: "Treatment Plan",       icon: "💊", isArray: true  },
  { key: "medications",             label: "Medications",          icon: "💉", isArray: true  },
  { key: "investigations",          label: "Investigations",       icon: "🧪", isArray: true  },
  { key: "followUp",                label: "Follow-up",            icon: "📅", isArray: false },
  { key: "additionalNotes",         label: "Additional Notes",     icon: "📝", isArray: false },
]

// Live session state per role
interface LiveState {
  on:             boolean
  stream:         MediaStream | null
  accText:        string          // accumulated transcript so far
  accTranslated:  string          // accumulated translation so far
  liveMsgId:      string | null   // id of the live bubble on own side
  otherLiveMsgId: string | null   // id of the live bubble on listener's side
  processing:     boolean         // currently sending a chunk to STT
}

function uid()    { return Math.random().toString(36).slice(2, 9) }
function nowTime(){ return new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }) }

const CHUNK_MS = 3000 // 3-second audio chunks

/* ════════════════════════════════════════════════════════ */
export function ConsultationForm({ visitId, department, patientName, patientAge, patientGender }: Props) {

  const [sessionActive,  setSessionActive]  = useState(false)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [messages,       setMessages]       = useState<Message[]>([])
  const [patientLang,    setPatientLang]    = useState("kn-IN")
  const [doctorLang,     setDoctorLang]     = useState("en-IN")
  const [transcriptLang, setTranscriptLang] = useState("en-IN")

  const [patientTyping,  setPatientTyping]  = useState("")
  const [doctorTyping,   setDoctorTyping]   = useState("")
  const [patientLoading, setPatientLoading] = useState(false)
  const [doctorLoading,  setDoctorLoading]  = useState(false)

  // Live recording UI state (just for button styling)
  const [patientLive, setPatientLive] = useState(false)
  const [doctorLive,  setDoctorLive]  = useState(false)

  const [tab,           setTab]           = useState<"transcript"|"report">("transcript")
  const [report,        setReport]        = useState<MedicalReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [editingReport, setEditingReport] = useState(false)
  const [reportEdits,   setReportEdits]   = useState<Record<string, string>>({})
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)

  // TTS state
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null)
  const [ttsLoading,   setTtsLoading]   = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)

  // Live state refs (mutable, not re-render triggers)
  const liveState = useRef<Record<"patient"|"doctor", LiveState>>({
    patient: { on:false, stream:null, accText:"", accTranslated:"", liveMsgId:null, otherLiveMsgId:null, processing:false },
    doctor:  { on:false, stream:null, accText:"", accTranslated:"", liveMsgId:null, otherLiveMsgId:null, processing:false },
  })

  // Chunk scheduling refs
  const scheduleRef = useRef<Record<"patient"|"doctor", ReturnType<typeof setTimeout>|null>>({ patient:null, doctor:null })

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }) }, [messages])

  useEffect(() => {
    if (sessionActive) {
      timerRef.current = setInterval(() => setSessionSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [sessionActive])

  const fmt = (s: number) =>
    `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`

  /* ── Language helpers ── */
  const getLang = useCallback((role: "patient"|"doctor") =>
    role === "patient" ? patientLang : doctorLang, [patientLang, doctorLang])

  const getOtherLang = useCallback((role: "patient"|"doctor") =>
    role === "patient" ? doctorLang : patientLang, [patientLang, doctorLang])

  const getMsgText = (msg: Message, lang: string) => {
    if (lang === "en-IN") return msg.english || msg.text
    if (lang === "hi-IN") return msg.hindi   || msg.text
    if (lang === "kn-IN") return msg.kannada || msg.text
    return msg.text
  }

  /* ── Translate a single text to all 3 languages via server route ── */
  const translateAll = useCallback(async (text: string, sourceLang: string) => {
    const targets = ["en-IN", "hi-IN", "kn-IN"].filter(t => t !== sourceLang)
    const results: Record<string, string> = { [sourceLang]: text }

    // First pass: translate to English
    if (sourceLang !== "en-IN") {
      try {
        const res = await fetch("/api/sarvam/translate", {
          method: "POST", headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ text, sourceLanguage: sourceLang }),
        })
        const data = await res.json()
        results["en-IN"] = data.translatedText ?? text
      } catch { results["en-IN"] = text }
    }

    // Translate en → hi and en → kn
    for (const target of targets.filter(t => t !== "en-IN")) {
      try {
        const res = await fetch("/api/sarvam/translate", {
          method: "POST", headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ text: results["en-IN"] ?? text, sourceLanguage: "en-IN", targetLanguage: target }),
        })
        const data = await res.json()
        results[target] = data.translatedText ?? results["en-IN"] ?? text
      } catch { results[target] = results["en-IN"] ?? text }
    }

    if (!results["en-IN"]) results["en-IN"] = text
    if (!results["hi-IN"]) results["hi-IN"] = text
    if (!results["kn-IN"]) results["kn-IN"] = text
    return results
  }, [])

  /* ── STT: send blob to /api/sarvam/transcribe and get all translations ── */
  const sttChunk = useCallback(async (blob: Blob, lang: string) => {
    const buf = await blob.arrayBuffer()
    const b64 = btoa(new Uint8Array(buf).reduce((d,b) => d + String.fromCharCode(b), ""))
    const res = await fetch("/api/sarvam/transcribe", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ audioBase64: b64, languageCode: lang }),
    })
    const data = await res.json()
    return {
      original: (data.original ?? "") as string,
      english:  (data.english  ?? "") as string,
      hindi:    (data.hindi    ?? "") as string,
      kannada:  (data.kannada  ?? "") as string,
    }
  }, [])

  /* ── Update a live bubble in-place ── */
  const updateLiveBubble = useCallback((id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
  }, [])

  /* ── Create a new live bubble ── */
  const createLiveBubble = useCallback((
    role: "patient"|"doctor", lang: string,
    text: string, english: string, hindi: string, kannada: string,
    isOtherSide = false
  ) => {
    const id = uid()
    const msg: Message = {
      id,
      role: isOtherSide ? (role === "patient" ? "doctor" : "patient") : role,
      text, english, hindi, kannada,
      timestamp: nowTime(),
      language: lang,
      hasTTS: false,
      isLive: true,
    }
    setMessages(prev => [...prev, msg])
    return id
  }, [])

  /* ── Commit live bubble (remove isLive flag, enable TTS for doctor) ── */
  const commitLiveBubble = useCallback((id: string, role: "patient"|"doctor") => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, isLive: false, hasTTS: role === "doctor" } : m
    ))
  }, [])

  /* ══════════════════════════════════════════════════════
     LIVE CHUNK RECORDING
     One persistent mic stream; every CHUNK_MS ms we take a
     snapshot, send to STT, update the single live bubble.
  ══════════════════════════════════════════════════════ */
  const startLive = useCallback(async (role: "patient"|"doctor") => {
    if (!sessionActive) return
    const state = liveState.current[role]
    if (state.on) return // already recording

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      alert("Microphone access denied.")
      return
    }

    state.on            = true
    state.stream        = stream
    state.accText       = ""
    state.accTranslated = ""
    state.liveMsgId     = null
    state.otherLiveMsgId = null
    state.processing    = false

    if (role === "patient") setPatientLive(true)
    else                    setDoctorLive(true)

    // Helper: determine supported mime
    const getSupportedMime = () => {
      const types = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4"]
      for (const t of types) { if (MediaRecorder.isTypeSupported(t)) return t }
      return ""
    }

    const scheduleSlice = () => {
      if (!state.on) return
      const chunks: Blob[] = []
      const mime = getSupportedMime()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data) }
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: mime || "audio/webm" })
        if (blob.size > 500 && state.on && !state.processing) {
          state.processing = true
          try {
            const fromLang = getLang(role)
            const result   = await sttChunk(blob, fromLang)
            if (result.original.trim()) {
              // Accumulate text
              state.accText       = state.accText ? state.accText + " " + result.original : result.original
              state.accTranslated = state.accTranslated
                ? state.accTranslated + " " + (result.english || result.original)
                : (result.english || result.original)

              // Merge translations for all languages
              const merged = {
                text:    state.accText,
                english: role === "en-IN" ? state.accText : state.accTranslated,
                hindi:   result.hindi   || state.accTranslated,
                kannada: result.kannada || state.accText,
              }

              // Create or update own-side live bubble
              if (!state.liveMsgId) {
                state.liveMsgId = createLiveBubble(role, fromLang, merged.text, merged.english, merged.hindi, merged.kannada)
              } else {
                updateLiveBubble(state.liveMsgId, { text: merged.text, english: merged.english, hindi: merged.hindi, kannada: merged.kannada })
              }

              // Create or update other-side live bubble
              if (!state.otherLiveMsgId) {
                state.otherLiveMsgId = createLiveBubble(role, fromLang, merged.text, merged.english, merged.hindi, merged.kannada, true)
              } else {
                updateLiveBubble(state.otherLiveMsgId, { text: merged.text, english: merged.english, hindi: merged.hindi, kannada: merged.kannada })
              }
            }
          } catch (e) { console.warn("[Live STT]", e) }
          finally { state.processing = false }
        }
        // Schedule next slice
        if (state.on) scheduleRef.current[role] = setTimeout(scheduleSlice, 0)
      }
      rec.onerror = () => { if (state.on) scheduleRef.current[role] = setTimeout(scheduleSlice, 0) }
      rec.start(250)
      setTimeout(() => { if (rec.state === "recording") rec.stop() }, CHUNK_MS)
    }

    scheduleSlice()
  }, [sessionActive, getLang, sttChunk, createLiveBubble, updateLiveBubble])

  const stopLive = useCallback((role: "patient"|"doctor") => {
    const state = liveState.current[role]
    if (!state.on) return

    state.on = false
    if (scheduleRef.current[role]) { clearTimeout(scheduleRef.current[role]!); scheduleRef.current[role] = null }
    try { state.stream?.getTracks().forEach(t => t.stop()) } catch {}
    state.stream = null

    // Commit both live bubbles
    if (state.liveMsgId)      commitLiveBubble(state.liveMsgId, role)
    if (state.otherLiveMsgId) commitLiveBubble(state.otherLiveMsgId, role)

    if (role === "patient") setPatientLive(false)
    else                    setDoctorLive(false)

    // Reset state
    state.liveMsgId      = null
    state.otherLiveMsgId = null
    state.accText        = ""
    state.accTranslated  = ""
  }, [commitLiveBubble])

  const toggleMic = useCallback((role: "patient"|"doctor") => {
    const state = liveState.current[role]
    if (state.on) stopLive(role)
    else          startLive(role)
  }, [startLive, stopLive])

  /* ══════════════════════════════════════════════════════
     FILE UPLOAD → STT → Translate
  ══════════════════════════════════════════════════════ */
  const fileInputRefs = {
    patient: useRef<HTMLInputElement>(null),
    doctor:  useRef<HTMLInputElement>(null),
  }

  const handleFileUpload = useCallback(async (role: "patient"|"doctor", file: File) => {
    if (!file) return
    const validAudio = file.type.startsWith("audio/") || /\.(mp3|wav|ogg|webm|m4a|aac|flac|opus)$/i.test(file.name)
    if (!validAudio) { alert("Please select an audio file (mp3, wav, ogg, m4a, etc.)"); return }
    if (file.size > 25 * 1024 * 1024) { alert("File too large (max 25MB)."); return }

    const setLoad = role === "patient" ? setPatientLoading : setDoctorLoading
    setLoad(true)

    try {
      const fromLang = getLang(role)
      const buf  = await file.arrayBuffer()
      const b64  = btoa(new Uint8Array(buf).reduce((d,b) => d + String.fromCharCode(b), ""))
      const res  = await fetch("/api/sarvam/transcribe", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ audioBase64: b64, languageCode: fromLang }),
      })
      const data = await res.json()
      const original = (data.original ?? "").trim()
      if (!original) { alert("No speech detected in the audio file."); return }

      const msg: Message = {
        id: uid(), role,
        text:    original,
        english: data.english  ?? original,
        hindi:   data.hindi    ?? original,
        kannada: data.kannada  ?? original,
        timestamp: nowTime(),
        language: fromLang,
        hasTTS:  role === "doctor",
        isLive:  false,
      }
      setMessages(prev => [...prev, msg])

      // Also show on listener's side
      const otherMsg: Message = {
        ...msg,
        id:   uid(),
        role: role === "patient" ? "doctor" : "patient",
        hasTTS: false,
      }
      setMessages(prev => [...prev, otherMsg])
    } catch (e) {
      console.error("[File upload]", e)
      alert("Could not transcribe file.")
    } finally { setLoad(false) }
  }, [getLang])

  /* ── Typed send ── */
  const sendTyped = useCallback(async (role: "patient"|"doctor") => {
    const text  = (role === "patient" ? patientTyping : doctorTyping).trim()
    const lang  = getLang(role)
    if (!text) return
    role === "patient" ? setPatientTyping("") : setDoctorTyping("")
    const setLoad = role === "patient" ? setPatientLoading : setDoctorLoading
    setLoad(true)
    try {
      const result = await translateAll(text, lang)
      const msg: Message = {
        id: uid(), role,
        text, english: result["en-IN"]??text, hindi: result["hi-IN"]??text, kannada: result["kn-IN"]??text,
        timestamp: nowTime(), language: lang, hasTTS: role === "doctor", isLive: false,
      }
      setMessages(prev => [...prev, msg])
      // listener side
      const otherMsg: Message = { ...msg, id: uid(), role: role==="patient"?"doctor":"patient", hasTTS: false }
      setMessages(prev => [...prev, otherMsg])
    } finally { setLoad(false) }
  }, [patientTyping, doctorTyping, getLang, translateAll])

  /* ── TTS ── */
  const playTTS = useCallback(async (msg: Message, lang: string) => {
    const key = `${msg.id}:${lang}`
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = "" }
    if (playingMsgId === key) { setPlayingMsgId(null); return }
    setTtsLoading(key)
    try {
      const textToSpeak = getMsgText(msg, lang)
      if (!textToSpeak?.trim()) throw new Error("No text for this language")
      const res = await fetch("/api/sarvam/tts", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ text: textToSpeak, targetLanguage: lang }),
      })
      if (!res.ok) { const e = await res.json().catch(()=>({})) as Record<string,string>; throw new Error(e.details??e.error??`HTTP ${res.status}`) }
      const data = await res.json() as { audioBase64?: string }
      if (!data.audioBase64) throw new Error("No audio returned")
      const binary = atob(data.audioBase64)
      const bytes  = new Uint8Array(binary.length)
      for (let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i)
      const blob = new Blob([bytes], { type:"audio/wav" })
      const url  = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      setPlayingMsgId(key)
      audio.onended = () => { setPlayingMsgId(null); URL.revokeObjectURL(url) }
      audio.onerror = () => { setPlayingMsgId(null); URL.revokeObjectURL(url) }
      await audio.play()
    } catch (err) { console.error("[TTS]", err); alert(`TTS failed: ${err instanceof Error ? err.message : String(err)}`) }
    finally { setTtsLoading(null) }
  }, [playingMsgId])

  const stopTTS = useCallback(() => { audioRef.current?.pause(); setPlayingMsgId(null) }, [])

  /* ── Generate report ── */
  const generateReport = useCallback(async () => {
    if (!messages.length) return
    setReportLoading(true); setTab("report")
    try {
      const res  = await fetch("/api/sarvam/report", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages, patientName, patientAge, patientGender, department }),
      })
      const data = await res.json()
      const r    = data.report as MedicalReport
      setReport(r)
      const edits: Record<string, string> = {}
      REPORT_FIELDS.forEach(f => {
        const val = r[f.key]
        edits[f.key] = Array.isArray(val) ? val.join("\n") : String(val ?? "")
      })
      setReportEdits(edits)
    } finally { setReportLoading(false) }
  }, [messages, patientName, patientAge, patientGender, department])

  /* ── Download PDF ── */
  const downloadPDF = useCallback(() => {
    const finalReport = editingReport
      ? Object.fromEntries(REPORT_FIELDS.map(f => [f.key, f.isArray ? (reportEdits[f.key]??"").split("\n").filter(Boolean) : (reportEdits[f.key]??"")]))
      : report
    if (!finalReport) return
    const now     = new Date().toLocaleString("en-IN")
    const deptLbl = department.replace(/_/g," ")
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Medical Report – ${patientName}</title>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a2e}h2{color:#0ea5e9}.tag{background:#dbeafe;color:#1d4ed8;border-radius:100px;padding:2px 10px;font-size:12px;margin:2px;display:inline-block}.footer{margin-top:32px;font-size:11px;color:#94a3b8}</style>
</head><body>
<h1>Consultation Report</h1><p>${now} | ${patientName}, ${patientAge}y | ${deptLbl}</p>
<h2>Chief Complaint</h2><p>${finalReport.chiefComplaint||"—"}</p>
<h2>Diagnosis</h2><p>${finalReport.diagnosis||"—"}</p>
<h2>Symptoms</h2><div>${(Array.isArray(finalReport.symptoms)?finalReport.symptoms:[finalReport.symptoms]).filter(Boolean).map((s:string)=>`<span class="tag">${s}</span>`).join("")||"—"}</div>
<h2>Medications</h2><div>${(Array.isArray(finalReport.medications)?finalReport.medications:[finalReport.medications]).filter(Boolean).map((s:string)=>`<span class="tag">${s}</span>`).join("")||"None"}</div>
<h2>Follow-up</h2><p>${finalReport.followUp||"As needed"}</p>
<div class="footer">Generated by MediLingua AI · CONFIDENTIAL</div>
</body></html>`
    const win = window.open("","_blank")
    if (win) { win.document.write(htmlContent); win.document.close(); setTimeout(()=>win.print(),500) }
  }, [report, reportEdits, editingReport, patientName, patientAge, department])

  /* ── Save to DB ── */
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const finalReport = editingReport
        ? Object.fromEntries(REPORT_FIELDS.map(f=>[f.key, f.isArray?(reportEdits[f.key]??"").split("\n").filter(Boolean):(reportEdits[f.key]??"")]))
        : report
      await fetch(`/api/consultation/${visitId}/save`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ messages, report: finalReport, language: patientLang }),
      })
      setSaved(true); setTimeout(()=>setSaved(false),3000)
    } finally { setSaving(false) }
  }, [messages, report, reportEdits, editingReport, visitId, patientLang])

  const endSession = useCallback(() => {
    stopLive("patient"); stopLive("doctor")
    setSessionActive(false)
    if (messages.length) generateReport()
  }, [messages.length, generateReport, stopLive])

  /* ─────────────────────────────────────────────────────────────
     RENDER PANEL
  ───────────────────────────────────────────────────────────── */
  const renderPanel = (role: "patient"|"doctor") => {
    const isPat    = role === "patient"
    const lang     = isPat ? patientLang    : doctorLang
    const setLang  = isPat ? setPatientLang : setDoctorLang
    const isLive   = isPat ? patientLive    : doctorLive
    const typing   = isPat ? patientTyping  : doctorTyping
    const setTyping= isPat ? setPatientTyping : setDoctorTyping
    const loading  = isPat ? patientLoading : doctorLoading
    const fileRef  = isPat ? fileInputRefs.patient : fileInputRefs.doctor
    const panelMsgs = messages.filter(m => m.role === role)

    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", borderRight: isPat?"1px solid rgba(56,189,248,0.08)":"none", background:"rgba(8,12,20,0.45)", minWidth:0 }}>

        {/* Header */}
        <div style={{ padding:"13px 18px", borderBottom:"1px solid rgba(56,189,248,0.08)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, background:"rgba(8,12,20,0.6)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:"50%", background: isPat?"rgba(56,189,248,0.1)":"linear-gradient(135deg,rgba(56,189,248,0.2),rgba(14,165,233,0.1))", border:"1px solid rgba(56,189,248,0.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
              {isPat ? "👤" : "👨‍⚕️"}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"#e8edf5" }}>{isPat ? "Patient" : "Doctor"}</div>
              <div style={{ fontSize:11, color:"#4a5568" }}>{isPat ? patientName : "Consultation Notes"}</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <span style={{ fontSize:10, color:"#4a5568", textTransform:"uppercase", letterSpacing:"0.08em" }}>Speaking:</span>
            <select value={lang} onChange={e => setLang(e.target.value)}
              style={{ background:"rgba(8,12,20,0.9)", border:"1px solid rgba(56,189,248,0.15)", borderRadius:7, padding:"4px 9px", fontSize:12, color:"#8b9ab5", fontFamily:"'DM Sans',sans-serif", outline:"none", cursor:"pointer" }}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 18px", display:"flex", flexDirection:"column", gap:10 }}>
          {panelMsgs.length === 0 && (
            <div style={{ textAlign:"center", marginTop:32, color:"#4a5568", fontSize:13 }}>
              {sessionActive ? `${isPat?"Patient":"Doctor"} speech appears here…` : "Start session to begin"}
            </div>
          )}

          {panelMsgs.map(msg => (
            <div key={msg.id} style={{ alignSelf: isPat?"flex-start":"flex-end", maxWidth:"92%", animation:"slideUp 0.3s ease both" }}>
              <div style={{
                background: isPat?"rgba(13,19,33,0.92)":"rgba(14,165,233,0.08)",
                border: `1px ${msg.isLive ? "dashed" : "solid"} rgba(56,189,248,${isPat?0.15:0.22})`,
                borderRadius: isPat?"12px 12px 12px 4px":"12px 12px 4px 12px",
                padding:"11px 14px",
                opacity: msg.isLive ? 0.85 : 1,
                transition:"border-style 0.3s, opacity 0.3s",
              }}>
                {/* Original text + live cursor */}
                <div style={{ fontSize:14, color:"#e8edf5", lineHeight:1.55, marginBottom:6 }}>
                  {msg.text}
                  {msg.isLive && (
                    <span style={{ display:"inline-block", width:8, height:14, background:"#38bdf8", marginLeft:3, verticalAlign:"middle", borderRadius:1, animation:"blink 0.8s step-end infinite" }} />
                  )}
                </div>

                {/* Translation pills */}
                <div style={{ borderTop:"1px solid rgba(56,189,248,0.08)", paddingTop:8, display:"flex", flexDirection:"column", gap:5 }}>
                  {([
                    { code:"en-IN", label:"EN", text: msg.english  },
                    { code:"hi-IN", label:"HI", text: msg.hindi    },
                    { code:"kn-IN", label:"KN", text: msg.kannada  },
                  ] as const).filter(t => t.code !== msg.language && t.text && t.text !== msg.text).map(t => (
                    <div key={t.code} style={{ display:"flex", gap:7, alignItems:"flex-start" }}>
                      <span style={{ fontSize:9, fontWeight:700, color:"#38bdf8", background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.2)", borderRadius:4, padding:"1px 5px", flexShrink:0, marginTop:2 }}>{t.label}</span>
                      <span style={{ fontSize:12, color:"#8b9ab5", lineHeight:1.5 }}>{t.text}</span>
                    </div>
                  ))}
                </div>

                {/* Bottom row */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8 }}>
                  <div style={{ display:"flex", gap:7, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:"#4a5568" }}>{msg.timestamp}</span>
                    <span style={{ fontSize:10, color:"#4a5568", background:"rgba(56,189,248,0.06)", borderRadius:4, padding:"1px 6px" }}>
                      {msg.isLive ? "🔴 Live" : `🎤 ${LANG_LABELS[msg.language]}`}
                    </span>
                  </div>

                  {/* TTS buttons for doctor (committed) messages */}
                  {!isPat && !msg.isLive && (
                    <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                      <span style={{ fontSize:9, color:"#4a5568", textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>Play:</span>
                      {([{ code:"en-IN", label:"EN" },{ code:"hi-IN", label:"HI" },{ code:"kn-IN", label:"KN" }] as const).map(({ code, label }) => {
                        const key       = `${msg.id}:${code}`
                        const isPlaying = playingMsgId === key
                        const isLoading = ttsLoading   === key
                        const otherBusy = !!ttsLoading && ttsLoading !== key
                        return (
                          <button key={code}
                            onClick={() => isPlaying ? stopTTS() : playTTS(msg, code)}
                            disabled={otherBusy}
                            title={`Play in ${LANG_LABELS[code]}`}
                            style={{ display:"flex", alignItems:"center", gap:3, background:isPlaying?"rgba(52,211,153,0.15)":"rgba(56,189,248,0.07)", border:`1px solid ${isPlaying?"rgba(52,211,153,0.4)":"rgba(56,189,248,0.18)"}`, borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:700, color:isPlaying?"#34d399":"#38bdf8", cursor:otherBusy?"not-allowed":"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s", opacity:otherBusy?0.35:1, minWidth:36 }}>
                            {isLoading ? <span style={{ width:9,height:9,border:"1.5px solid rgba(56,189,248,0.3)",borderTopColor:"#38bdf8",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} />
                              : isPlaying ? "⏹" : "▶"}
                            {" "}{label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:7, color:"#4a5568", fontSize:13 }}>
              <span style={{ width:14,height:14,border:"2px solid rgba(56,189,248,0.2)",borderTopColor:"#38bdf8",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} />
              Processing…
            </div>
          )}

          {isPat && <div ref={bottomRef} />}
        </div>

        {/* Input bar */}
        <div style={{ padding:"12px 14px", borderTop:"1px solid rgba(56,189,248,0.08)", background:"rgba(8,12,20,0.85)", flexShrink:0 }}>
          {isLive && (
            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:8 }}>
              {[0,1,2,3,4,5].map(i => (
                <div key={i} style={{ width:3, borderRadius:2, background:"#22c55e", animation:`waveform 0.6s ${i*0.09}s ease-in-out infinite` }} />
              ))}
              <span style={{ fontSize:11, color:"#22c55e", fontWeight:500, marginLeft:4 }}>Live… tap ⏹ to commit</span>
            </div>
          )}
          <div style={{ display:"flex", gap:9, alignItems:"flex-end" }}>
            {/* Mic button — tap to start/stop */}
            <button
              onClick={() => sessionActive && toggleMic(role)}
              disabled={!sessionActive}
              title={isLive ? "Stop recording" : "Start live recording"}
              style={{ width:42, height:42, borderRadius:"50%", border:`1px solid rgba(${isLive?"34,197,94":"56,189,248"},${isLive?0.5:0.2})`, background:`rgba(${isLive?"34,197,94":"56,189,248"},${isLive?0.15:0.1})`, cursor:sessionActive?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", fontSize:19, flexShrink:0, position:"relative", transition:"all 0.2s", boxShadow: isLive?"0 0 0 0 rgba(34,197,94,0.4)":"none", animation: isLive?"pulse-mic 1.5s infinite":"none" }}>
              {isLive ? "⏹" : "🎤"}
              {isLive && <span style={{ position:"absolute", inset:-4, borderRadius:"50%", border:"2px solid rgba(34,197,94,0.4)", animation:"ripple 1.2s ease-out infinite" }} />}
            </button>

            {/* File upload button */}
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              style={{ display:"none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(role, f); e.target.value="" }}
            />
            <button
              onClick={() => sessionActive && fileRef.current?.click()}
              disabled={!sessionActive}
              title="Upload audio file for transcription"
              style={{ width:42, height:42, borderRadius:10, border:"1px solid rgba(99,102,241,0.3)", background:"rgba(99,102,241,0.1)", cursor:sessionActive?"pointer":"not-allowed", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, flexShrink:0, transition:"all 0.2s", opacity:sessionActive?1:0.4 }}>
              <span style={{ fontSize:14 }}>📁</span>
              <span style={{ fontSize:8, fontWeight:700, letterSpacing:"0.06em", color:"#818cf8" }}>FILE</span>
            </button>

            <textarea rows={1}
              placeholder={isPat ? "Type your message…" : "Type your response…"}
              value={typing}
              onChange={e => setTyping(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendTyped(role) } }}
              disabled={!sessionActive}
              style={{ flex:1, background:"rgba(8,12,20,0.8)", border:"1px solid rgba(56,189,248,0.12)", borderRadius:9, padding:"10px 13px", fontSize:14, color:"#e8edf5", fontFamily:"'DM Sans',sans-serif", outline:"none", resize:"none", caretColor:"#38bdf8", lineHeight:"1.5" }} />
            <button
              onClick={() => sendTyped(role)}
              disabled={!sessionActive || !typing.trim()}
              style={{ width:36,height:36,borderRadius:8,border:"none",cursor:sessionActive&&typing.trim()?"pointer":"not-allowed",background:"linear-gradient(135deg,#38bdf8,#0ea5e9)",color:"#080c14",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0,opacity:sessionActive&&typing.trim()?1:0.4,transition:"all 0.2s" }}>➤</button>
          </div>
        </div>
      </div>
    )
  }

  /* ─── MAIN RETURN ─── */
  return (
    <div style={{ minHeight:"100vh", background:"#080c14", color:"#e8edf5", fontFamily:"'DM Sans','Segoe UI',sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Syne:wght@700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeIn  { from{opacity:0}to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulse   { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes ripple  { 0%{transform:scale(1);opacity:0.7}100%{transform:scale(2.2);opacity:0} }
        @keyframes waveform{ 0%,100%{height:5px}50%{height:20px} }
        @keyframes blink   { 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes pulse-mic { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 0 10px rgba(34,197,94,0)} }
        option { background:#0d1321; color:#e8edf5; }
      `}</style>

      {/* Navbar */}
      <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 22px", background:"rgba(8,12,20,0.96)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(56,189,248,0.1)", flexShrink:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:28,height:28,background:"linear-gradient(135deg,#38bdf8,#0ea5e9)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,boxShadow:"0 0 12px rgba(56,189,248,0.35)" }}>⚕</div>
          <span style={{ fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:"#e8edf5",letterSpacing:"-0.02em" }}>
            MediLingua <span style={{ color:"#38bdf8" }}>AI</span>
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {sessionActive && (
            <>
              <div style={{ display:"flex",alignItems:"center",gap:6,background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:100,padding:"4px 12px" }}>
                <span style={{ width:5,height:5,background:"#34d399",borderRadius:"50%",animation:"pulse 1.5s infinite" }} />
                <span style={{ fontSize:11,color:"#34d399",fontWeight:600 }}>Session Active</span>
              </div>
              <div style={{ background:"rgba(13,19,33,0.9)",border:"1px solid rgba(56,189,248,0.15)",borderRadius:100,padding:"4px 13px",fontSize:12,fontWeight:600,color:"#e8edf5",fontVariantNumeric:"tabular-nums" }}>
                ⏱ {fmt(sessionSeconds)}
              </div>
            </>
          )}
          {!sessionActive
            ? <button onClick={() => setSessionActive(true)} style={{ background:"linear-gradient(135deg,#38bdf8,#0ea5e9)",color:"#080c14",padding:"8px 18px",borderRadius:8,border:"none",fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:"pointer" }}>▶ Start</button>
            : <button onClick={endSession} style={{ background:"rgba(239,68,68,0.1)",color:"#ef4444",padding:"8px 18px",borderRadius:8,border:"1px solid rgba(239,68,68,0.3)",fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:"pointer" }}>✕ End Session</button>
          }
          <Link href="/doctor/dashboard" style={{ fontSize:12,color:"#8b9ab5",textDecoration:"none",padding:"6px 11px",borderRadius:7,border:"1px solid rgba(56,189,248,0.1)" }}>← Queue</Link>
        </div>
      </nav>

      {/* Patient strip */}
      <div style={{ background:"rgba(13,19,33,0.7)",borderBottom:"1px solid rgba(56,189,248,0.08)",padding:"8px 22px",display:"flex",gap:18,alignItems:"center",flexShrink:0 }}>
        <span style={{ fontSize:12,color:"#8b9ab5" }}>Patient: <b style={{ color:"#e8edf5" }}>{patientName}</b></span>
        <span style={{ fontSize:12,color:"#8b9ab5" }}>Age: <b style={{ color:"#e8edf5" }}>{patientAge}</b></span>
        <span style={{ fontSize:12,color:"#8b9ab5" }}>Dept: <b style={{ color:"#38bdf8" }}>{department.replace(/_/g," ")}</b></span>
        <span style={{ marginLeft:"auto",fontSize:11,color:sessionActive?"#34d399":"#4a5568" }}>
          {sessionActive ? `${messages.filter(m=>!m.isLive).length} message${messages.filter(m=>!m.isLive).length!==1?"s":""}` : "Session not started"}
        </span>
      </div>

      {/* Dual panels */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>
        {renderPanel("patient")}
        <div style={{ width:44,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:"rgba(8,12,20,0.25)" }}>
          <div style={{ width:28,height:28,borderRadius:"50%",background:"rgba(56,189,248,0.05)",border:"1px solid rgba(56,189,248,0.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"#4a5568",fontSize:12 }}>⇄</div>
        </div>
        {renderPanel("doctor")}
      </div>

      {/* Bottom panel */}
      <div style={{ height:310,flexShrink:0,borderTop:"1px solid rgba(56,189,248,0.12)",background:"rgba(10,15,26,0.97)",display:"flex",flexDirection:"column" }}>
        {/* Tab bar */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 18px",borderBottom:"1px solid rgba(56,189,248,0.08)",flexShrink:0 }}>
          <div style={{ display:"flex",gap:6,alignItems:"center" }}>
            {(["transcript","report"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding:"6px 16px",borderRadius:7,border:`1px solid ${tab===t?"rgba(56,189,248,0.3)":"transparent"}`,background:tab===t?"rgba(56,189,248,0.1)":"transparent",color:tab===t?"#38bdf8":"#8b9ab5",fontSize:12,fontWeight:500,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>
                {t==="transcript" ? "📝 Transcript" : "📋 Report"}
                {t==="report" && report && <span style={{ width:6,height:6,background:"#34d399",borderRadius:"50%",display:"inline-block" }} />}
              </button>
            ))}
            {tab === "transcript" && (
              <div style={{ display:"flex",alignItems:"center",gap:6,marginLeft:8 }}>
                <span style={{ fontSize:10,color:"#4a5568",textTransform:"uppercase",letterSpacing:"0.08em" }}>Show in:</span>
                <select value={transcriptLang} onChange={e => setTranscriptLang(e.target.value)}
                  style={{ background:"rgba(8,12,20,0.9)",border:"1px solid rgba(56,189,248,0.15)",borderRadius:6,padding:"3px 8px",fontSize:11,color:"#8b9ab5",fontFamily:"'DM Sans',sans-serif",outline:"none",cursor:"pointer" }}>
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
            )}
          </div>
          <div style={{ display:"flex",gap:8 }}>
            {tab==="report" && report && (
              <>
                <button onClick={() => setEditingReport(e=>!e)} style={{ background:"transparent",border:"1px solid rgba(56,189,248,0.2)",borderRadius:7,padding:"5px 12px",fontSize:11,color:"#38bdf8",cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
                  {editingReport ? "✓ Done" : "✎ Edit"}
                </button>
                <button onClick={downloadPDF} style={{ background:"rgba(52,211,153,0.08)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:7,padding:"5px 12px",fontSize:11,color:"#34d399",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:5 }}>
                  ⬇ Download PDF
                </button>
              </>
            )}
            <button onClick={generateReport} disabled={!messages.length||reportLoading} style={{ background:"rgba(56,189,248,0.08)",border:"1px solid rgba(56,189,248,0.2)",borderRadius:7,padding:"5px 12px",fontSize:11,color:"#38bdf8",cursor:messages.length?"pointer":"not-allowed",fontFamily:"'DM Sans',sans-serif",opacity:messages.length?1:0.4,display:"flex",alignItems:"center",gap:5 }}>
              {reportLoading ? <><span style={{ width:11,height:11,border:"1.5px solid rgba(56,189,248,0.2)",borderTopColor:"#38bdf8",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} /> Generating…</> : "⚡ Generate"}
            </button>
            <button onClick={handleSave} disabled={saving||!messages.length} style={{ background:"linear-gradient(135deg,#38bdf8,#0ea5e9)",color:"#080c14",padding:"5px 18px",borderRadius:7,border:"none",fontSize:12,fontWeight:700,fontFamily:"'DM Sans',sans-serif",cursor:messages.length?"pointer":"not-allowed",opacity:messages.length?1:0.5,display:"flex",alignItems:"center",gap:5 }}>
              {saving ? <><span style={{ width:11,height:11,border:"1.5px solid rgba(8,12,20,0.3)",borderTopColor:"#080c14",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} /> Saving…</> : saved ? "✓ Saved!" : "💾 Save"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1,overflowY:"auto",padding:"12px 18px" }}>
          {tab==="transcript" && (
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {messages.length===0 && <div style={{ textAlign:"center",color:"#4a5568",fontSize:12,marginTop:14 }}>Conversation transcript will appear here.</div>}
              {messages.map(msg => (
                <div key={msg.id} style={{ display:"flex",gap:9,alignItems:"flex-start",animation:"fadeIn 0.3s ease" }}>
                  <span style={{ fontSize:10,color:"#4a5568",minWidth:34,marginTop:2,fontVariantNumeric:"tabular-nums" }}>{msg.timestamp}</span>
                  <span style={{ fontSize:11,fontWeight:700,minWidth:50,color:msg.role==="patient"?"#38bdf8":"#34d399" }}>{msg.role==="patient"?"Patient":"Doctor"}</span>
                  <span style={{ fontSize:13,color: msg.isLive?"#8b9ab5":"#e8edf5",lineHeight:1.55,flex:1 }}>
                    {getMsgText(msg, transcriptLang)}
                    {msg.isLive && <span style={{ fontSize:11,color:"#22c55e",marginLeft:6 }}>●</span>}
                  </span>
                  <span style={{ fontSize:9,color:"#4a5568",background:"rgba(56,189,248,0.06)",borderRadius:4,padding:"1px 5px",flexShrink:0,marginTop:2 }}>
                    {LANG_LABELS[msg.language]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab==="report" && (
            <div>
              {reportLoading && <div style={{ display:"flex",alignItems:"center",gap:9,color:"#8b9ab5",fontSize:13,justifyContent:"center",marginTop:20 }}><span style={{ width:16,height:16,border:"2px solid rgba(56,189,248,0.2)",borderTopColor:"#38bdf8",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} /> Generating report…</div>}
              {!reportLoading&&!report && <div style={{ textAlign:"center",color:"#4a5568",fontSize:12,marginTop:14 }}>Click "⚡ Generate" after consultation to build a structured medical report.</div>}
              {!reportLoading&&report && (
                <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8 }}>
                  {REPORT_FIELDS.map(f => {
                    const val = report[f.key]
                    const isEmpty = Array.isArray(val) ? val.length===0 : !val
                    return (
                      <div key={f.key} style={{ background:"rgba(13,19,33,0.75)",border:`1px solid rgba(56,189,248,${isEmpty?0.06:0.14})`,borderRadius:10,padding:"10px 12px" }}>
                        <div style={{ fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase" as const,color:isEmpty?"#4a5568":"#38bdf8",marginBottom:7,display:"flex",gap:5,alignItems:"center" }}>
                          <span>{f.icon}</span>{f.label}
                        </div>
                        {editingReport ? (
                          <textarea value={reportEdits[f.key]??""} onChange={e=>setReportEdits(r=>({...r,[f.key]:e.target.value}))} rows={f.isArray?3:2} placeholder={f.isArray?"One item per line…":""}
                            style={{ width:"100%",background:"rgba(8,12,20,0.7)",border:"1px solid rgba(56,189,248,0.12)",borderRadius:6,padding:"7px 9px",fontSize:12,color:"#e8edf5",fontFamily:"'DM Sans',sans-serif",outline:"none",resize:"vertical" as const }} />
                        ) : f.isArray ? (
                          <div style={{ display:"flex",flexWrap:"wrap" as const,gap:4 }}>
                            {(Array.isArray(val)?val as string[]:[String(val)]).filter(Boolean).length===0
                              ? <span style={{ fontSize:12,color:"#4a5568" }}>—</span>
                              : (Array.isArray(val)?val as string[]:[String(val)]).filter(Boolean).map((item,i)=>(
                                  <span key={i} style={{ background:"rgba(56,189,248,0.08)",border:"1px solid rgba(56,189,248,0.15)",borderRadius:100,padding:"2px 9px",fontSize:11,color:"#7dd3fc" }}>{item}</span>
                                ))
                            }
                          </div>
                        ) : (
                          <div style={{ fontSize:12,color:isEmpty?"#4a5568":"#e8edf5",lineHeight:1.6 }}>{String(val||"—")}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}