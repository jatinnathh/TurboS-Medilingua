// app/consultation/[visitId]/ConsultationForm.tsx
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"

/* ── Types ── */
interface Message {
  id:          string
  role:        "patient" | "doctor"
  text:        string
  english:     string
  hindi:       string
  kannada:     string
  tamil:       string
  telugu:      string
  malayalam:   string
  timestamp:   string
  language:    string
  via:         "mic" | "text"   // how the message was sent
  hasTTS?:     boolean
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

export interface HistoryReport {
  chiefComplaint?:  string
  diagnosis?:       string
  symptoms?:        string[]
  medications?:     string[]
  treatment?:       string[]
  followUp?:        string
  _savedAt?:        string
  _sessionIndex?:   number
  [key: string]:    unknown
}

export interface PastVisit {
  visitId:    string
  department: string
  date:       string
  language:   string
  reports:    HistoryReport[]
}

interface Props {
  visitId:        string
  department:     string
  patientName:    string
  patientAge:     number
  patientGender?: string
  patientId:      string
  patientHistory: PastVisit[]
}

// South Indian languages first, then Hindi and English
const LANGUAGES = [
  { code: "kn-IN", label: "ಕನ್ನಡ", name: "Kannada",   flag: "🇮🇳", group: "south" },
  { code: "ta-IN", label: "தமிழ்", name: "Tamil",     flag: "🇮🇳", group: "south" },
  { code: "te-IN", label: "తెలుగు", name: "Telugu",  flag: "🇮🇳", group: "south" },
  { code: "ml-IN", label: "മലയാളം", name: "Malayalam", flag: "🇮🇳", group: "south" },
  { code: "hi-IN", label: "हिन्दी",  name: "Hindi",    flag: "🇮🇳", group: "north" },
  { code: "en-IN", label: "English",  name: "English",  flag: "🇬🇧", group: "int"   },
]

const LANG_LABELS: Record<string, string> = {
  "en-IN": "English",
  "hi-IN": "हिन्दी",
  "kn-IN": "ಕನ್ನಡ",
  "ta-IN": "தமிழ்",
  "te-IN": "తెలుగు",
  "ml-IN": "മലയാളം",
}

// Short badge labels for bubbles
const LANG_SHORT: Record<string, string> = {
  "en-IN": "EN", "hi-IN": "HI", "kn-IN": "KN",
  "ta-IN": "TA", "te-IN": "TE", "ml-IN": "ML",
}

// English name for each language (for TTS button labels)
const LANG_EN_NAME: Record<string, string> = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "kn-IN": "Kannada",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
  "ml-IN": "Malayalam",
}

const REPORT_FIELDS: { key: keyof MedicalReport; label: string; icon: string; isArray: boolean }[] = [
  { key: "chiefComplaint",          label: "Chief Complaint",            icon: "🤒", isArray: false },
  { key: "historyOfPresentIllness", label: "History of Illness",         icon: "📋", isArray: false },
  { key: "symptoms",                label: "Symptoms",                   icon: "🔍", isArray: true  },
  { key: "examFindings",            label: "Examination Findings",       icon: "🩺", isArray: false },
  { key: "diagnosis",               label: "Diagnosis",                  icon: "🔬", isArray: false },
  { key: "treatment",               label: "Treatment Plan",             icon: "💊", isArray: true  },
  { key: "medications",             label: "Medications",                icon: "💉", isArray: true  },
  { key: "investigations",          label: "Investigations",             icon: "🧪", isArray: true  },
  { key: "followUp",                label: "Follow-up",                  icon: "📅", isArray: false },
  { key: "additionalNotes",         label: "Additional Notes",           icon: "📝", isArray: false },
]

function uid()    { return Math.random().toString(36).slice(2, 9) }
function nowTime(){ return new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }) }

/* ══════════════════════════════════════════════ */
export function ConsultationForm({ visitId, department, patientName, patientAge, patientGender, patientId, patientHistory }: Props) {

  const [sessionActive,    setSessionActive]    = useState(false)
  const [sessionSeconds,   setSessionSeconds]   = useState(0)
  const [messages,         setMessages]         = useState<Message[]>([])
  const [patientLang,      setPatientLang]      = useState("kn-IN")
  const [doctorLang,       setDoctorLang]       = useState("en-IN")

  // Display language for transcript panel (what language to show bubbles in)
  const [transcriptLang,   setTranscriptLang]   = useState("en-IN")

  const [patientRec,       setPatientRec]       = useState(false)
  const [doctorRec,        setDoctorRec]        = useState(false)
  const [patientTyping,    setPatientTyping]    = useState("")
  const [doctorTyping,     setDoctorTyping]     = useState("")
  const [patientLoading,   setPatientLoading]   = useState(false)
  const [doctorLoading,    setDoctorLoading]    = useState(false)

  const [tab,              setTab]              = useState<"transcript"|"report">("transcript")
  const [report,           setReport]           = useState<MedicalReport | null>(null)
  const [reportLoading,    setReportLoading]    = useState(false)
  const [editingReport,    setEditingReport]    = useState(false)
  const [reportEdits,      setReportEdits]      = useState<Record<string, string>>({})
  const [saving,           setSaving]           = useState(false)
  const [saved,            setSaved]            = useState(false)

  // PDF language — using ref as well so downloadPDF always reads latest value
  const [pdfLang,          setPdfLang]          = useState("en-IN")
  const pdfLangRef = useRef("en-IN")
  // Keep ref in sync with state
  useEffect(() => { pdfLangRef.current = pdfLang }, [pdfLang])

  // PDF translating state
  const [pdfTranslating,   setPdfTranslating]   = useState(false)

  // Explain to patient
  const [explaining,       setExplaining]       = useState(false)
  const [explanation,      setExplanation]      = useState<{
    englishSummary: string; translatedSummary: string; audioBase64: string; targetLanguage: string
  } | null>(null)
  const [explainPlaying,   setExplainPlaying]   = useState(false)
  const explainAudioRef = useRef<HTMLAudioElement | null>(null)

  // Per-bubble: set of message IDs with all translations expanded
  const [expandedTranslations, setExpandedTranslations] = useState<Set<string>>(new Set())
  const toggleTranslations = useCallback((id: string) => {
    setExpandedTranslations(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])


  // Completion state
  const [completed,      setCompleted]      = useState(false)
  const [completing,     setCompleting]     = useState(false)

  // History panel state
  const [historyOpen,    setHistoryOpen]    = useState(patientHistory.length > 0)
  const [expandedVisit,  setExpandedVisit]  = useState<string | null>(
    patientHistory.length > 0 ? patientHistory[0].visitId : null
  )
  const [expandedReport, setExpandedReport] = useState<number | null>(0)

  // TTS state
  const [playingMsgId,     setPlayingMsgId]     = useState<string | null>(null)
  const [ttsLoading,       setTtsLoading]       = useState<string | null>(null)
  // Inline transcript edit state
  const [editingMsgId,  setEditingMsgId]  = useState<string | null>(null)
  const [editDraft,     setEditDraft]     = useState("")   // draft for the original text field

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const patientMicRef  = useRef<MediaRecorder | null>(null)
  const doctorMicRef   = useRef<MediaRecorder | null>(null)
  const patientChunks  = useRef<Blob[]>([])
  const doctorChunks   = useRef<Blob[]>([])
  const bottomRef      = useRef<HTMLDivElement>(null)

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

  /* ── Get display text for a message in chosen lang ── */
  const getMsgText = (msg: Message, lang: string) => {
    if (lang === "en-IN") return msg.english   || msg.text
    if (lang === "hi-IN") return msg.hindi     || msg.text
    if (lang === "kn-IN") return msg.kannada   || msg.text
    if (lang === "ta-IN") return msg.tamil     || msg.text
    if (lang === "te-IN") return msg.telugu    || msg.text
    if (lang === "ml-IN") return msg.malayalam || msg.text
    return msg.text
  }

  /* ── Edit a message's original text + re-translate ── */
  const startEdit = useCallback((msg: Message) => {
    setEditingMsgId(msg.id)
    setEditDraft(msg.text)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingMsgId(null)
    setEditDraft("")
  }, [])

  const saveEdit = useCallback(async (msg: Message) => {
    const newText = editDraft.trim()
    if (!newText) return
    setEditingMsgId(null)
    setEditDraft("")

    // Re-translate corrected text to all 6 languages
    const lang = msg.language
    try {
      const translate = async (text: string, src: string, tgt: string) => {
        const r = await fetch("/api/sarvam/translate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, sourceLanguage: src, targetLanguage: tgt }),
        })
        const d = await r.json() as { translatedText?: string }
        return d.translatedText ?? text
      }
      // Step 1: get English pivot
      const english = lang === "en-IN" ? newText : await translate(newText, lang, "en-IN")
      // Step 2: all others in parallel from English
      const [hindi, kannada, tamil, telugu, malayalam] = await Promise.all([
        lang === "hi-IN" ? newText : translate(english, "en-IN", "hi-IN"),
        lang === "kn-IN" ? newText : translate(english, "en-IN", "kn-IN"),
        lang === "ta-IN" ? newText : translate(english, "en-IN", "ta-IN"),
        lang === "te-IN" ? newText : translate(english, "en-IN", "te-IN"),
        lang === "ml-IN" ? newText : translate(english, "en-IN", "ml-IN"),
      ])
      setMessages(prev => prev.map(m =>
        m.id === msg.id
          ? { ...m, text: newText, english, hindi, kannada, tamil, telugu, malayalam }
          : m
      ))
    } catch {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, text: newText } : m))
    }
  }, [editDraft])

  /* ── Transcribe + get all 3 translations ── */
  const transcribeAll = useCallback(async (blob: Blob, lang: string) => {
    const buf  = await blob.arrayBuffer()
    const b64  = btoa(new Uint8Array(buf).reduce((d,b) => d + String.fromCharCode(b), ""))
    const res  = await fetch("/api/sarvam/transcribe", {
      method: "POST", headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ audioBase64: b64, languageCode: lang }),
    })
    const data = await res.json()
    return {
      original:  (data.original  ?? "") as string,
      english:   (data.english   ?? "") as string,
      hindi:     (data.hindi     ?? "") as string,
      kannada:   (data.kannada   ?? "") as string,
      tamil:     (data.tamil     ?? "") as string,
      telugu:    (data.telugu    ?? "") as string,
      malayalam: (data.malayalam ?? "") as string,
    }
  }, [])

  /* ── Translate typed text to all 6 langs (English as pivot) ── */
  const translateAll = useCallback(async (text: string, sourceLang: string) => {
    const tr = async (src: string, tgt: string) => {
      if (src === tgt) return text
      const r = await fetch("/api/sarvam/translate", {
        method: "POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ text, sourceLanguage: src, targetLanguage: tgt }),
      })
      const d = await r.json() as { translatedText?: string }
      return d.translatedText ?? text
    }

    // Step 1: get English pivot
    const english = sourceLang === "en-IN" ? text : await tr(sourceLang, "en-IN")

    // Step 2: all others from English in parallel
    const trFromEn = async (tgt: string) => {
      if (sourceLang === tgt) return text
      const r = await fetch("/api/sarvam/translate", {
        method: "POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ text: english, sourceLanguage: "en-IN", targetLanguage: tgt }),
      })
      const d = await r.json() as { translatedText?: string }
      return d.translatedText ?? english
    }

    const [hindi, kannada, tamil, telugu, malayalam] = await Promise.all([
      trFromEn("hi-IN"), trFromEn("kn-IN"),
      trFromEn("ta-IN"), trFromEn("te-IN"), trFromEn("ml-IN"),
    ])

    return { "en-IN": english, "hi-IN": hindi, "kn-IN": kannada, "ta-IN": tamil, "te-IN": telugu, "ml-IN": malayalam }
  }, [])

  const addMsg = useCallback((
    role: "patient"|"doctor",
    text: string,
    english: string, hindi: string, kannada: string,
    tamil: string, telugu: string, malayalam: string,
    lang: string,
    via: "mic" | "text" = "text"
  ) => {
    setMessages(prev => [...prev, {
      id: uid(), role, text,
      english, hindi, kannada, tamil, telugu, malayalam,
      timestamp: nowTime(), language: lang,
      via, hasTTS: role === "doctor",
    }])
  }, [])

  /* ── Recording ── */
  const startRecording = useCallback(async (role: "patient"|"doctor") => {
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      const chunks: Blob[] = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      if (role === "patient") { patientChunks.current = chunks; patientMicRef.current = recorder; setPatientRec(true) }
      else                    { doctorChunks.current  = chunks; doctorMicRef.current  = recorder; setDoctorRec(true)  }
      recorder.start()
    } catch { alert("Microphone access denied.") }
  }, [])

  const stopRecording = useCallback(async (role: "patient"|"doctor") => {
    const recorder = role === "patient" ? patientMicRef.current : doctorMicRef.current
    const lang     = role === "patient" ? patientLang : doctorLang
    const chunks   = role === "patient" ? patientChunks.current : doctorChunks.current
    const setRec   = role === "patient" ? setPatientRec  : setDoctorRec
    const setLoad  = role === "patient" ? setPatientLoading : setDoctorLoading
    if (!recorder) return
    setRec(false); setLoad(true)
    recorder.onstop = async () => {
      try {
        const blob   = new Blob(chunks, { type: "audio/webm" })
        const result = await transcribeAll(blob, lang)
        if (result.original.trim()) {
          addMsg(role, result.original, result.english, result.hindi, result.kannada, result.tamil, result.telugu, result.malayalam, lang, "mic")
        }
      } finally { setLoad(false); recorder.stream.getTracks().forEach(t => t.stop()) }
    }
    recorder.stop()
  }, [patientLang, doctorLang, transcribeAll, addMsg])

  /* ── Typed send ── */
  const sendTyped = useCallback(async (role: "patient"|"doctor") => {
    const text  = (role === "patient" ? patientTyping : doctorTyping).trim()
    const lang  = role === "patient" ? patientLang : doctorLang
    if (!text) return
    role === "patient" ? setPatientTyping("") : setDoctorTyping("")
    const setLoad = role === "patient" ? setPatientLoading : setDoctorLoading
    setLoad(true)
    try {
      const result = await translateAll(text, lang)
      addMsg(role, text,
        result["en-IN"] ?? text,
        result["hi-IN"] ?? text,
        result["kn-IN"] ?? text,
        result["ta-IN"] ?? text,
        result["te-IN"] ?? text,
        result["ml-IN"] ?? text,
        lang, "text"
      )
    } finally { setLoad(false) }
  }, [patientTyping, doctorTyping, patientLang, doctorLang, translateAll, addMsg])

  /* TTS: play doctor reply in chosen language (EN / HI / KN) */
  // ttsKey = `${msg.id}:${lang}` so each language button has independent state
  const playTTS = useCallback(async (msg: Message, lang: string) => {
    const key = `${msg.id}:${lang}`
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = "" }
    if (playingMsgId === key) { setPlayingMsgId(null); return }  // toggle off

    setTtsLoading(key)
    try {
      const textToSpeak = getMsgText(msg, lang)
      if (!textToSpeak?.trim()) throw new Error("No text available for this language")

      const res = await fetch("/api/sarvam/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSpeak, targetLanguage: lang }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as Record<string, string>
        throw new Error(errData.details ?? errData.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json() as { audioBase64?: string }
      if (!data.audioBase64) throw new Error("Sarvam returned no audio field")

      const binary = atob(data.audioBase64)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob   = new Blob([bytes], { type: "audio/wav" })
      const url    = URL.createObjectURL(blob)

      const audio  = new Audio(url)
      audioRef.current = audio
      setPlayingMsgId(key)
      audio.onended = () => { setPlayingMsgId(null); URL.revokeObjectURL(url) }
      audio.onerror = () => { setPlayingMsgId(null); URL.revokeObjectURL(url) }
      await audio.play()
    } catch (err) {
      console.error("[TTS] play error:", err)
      alert(`TTS failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTtsLoading(null)
    }
  }, [ttsLoading, playingMsgId])

  const stopTTS = useCallback(() => {
    audioRef.current?.pause()
    setPlayingMsgId(null)
  }, [])


  /* ── Generate report ── */
  const generateReport = useCallback(async () => {
    if (!messages.length) return
    setReportLoading(true); setTab("report")
    try {
      const res  = await fetch("/api/sarvam/report", {
        method: "POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ messages, patientName, patientAge, patientGender, department }),
      })
      const data = await res.json()
      const r    = data.report as MedicalReport
      setReport(r)
      // Pre-populate edit state
      const edits: Record<string, string> = {}
      REPORT_FIELDS.forEach(f => {
        const val = r[f.key]
        edits[f.key] = Array.isArray(val) ? val.join("\n") : String(val ?? "")
      })
      setReportEdits(edits)
    } finally { setReportLoading(false) }
  }, [messages, patientName, patientAge, patientGender, department])

  /* ── Download PDF (multilingual) ── */
  // FIX: Read pdfLang from ref so we always get latest value, avoiding stale closure.
  // Also accept explicit lang override so button can pass pdfLangRef.current directly.
  const downloadPDF = useCallback(async (reportLang?: string) => {
    // Use passed lang, or read from ref (always fresh), or fall back to state
    const targetLang = reportLang ?? pdfLangRef.current ?? "en-IN"

    const baseReport = editingReport
      ? Object.fromEntries(REPORT_FIELDS.map(f => [
          f.key,
          f.isArray ? (reportEdits[f.key] ?? "").split("\n").filter(Boolean) : (reportEdits[f.key] ?? "")
        ]))
      : report

    if (!baseReport) return

    const isEnglish = targetLang === "en-IN"

    // Show translating indicator for non-English
    if (!isEnglish) setPdfTranslating(true)

    const now     = new Date().toLocaleString("en-IN")
    const deptLbl = department.replace(/_/g, " ")

    const PDF_LANG_LABELS: Record<string, string> = {
      "en-IN": "English",
      "hi-IN": "हिन्दी (Hindi)",
      "kn-IN": "ಕನ್ನಡ (Kannada)",
      "ta-IN": "தமிழ் (Tamil)",
      "te-IN": "తెలుగు (Telugu)",
      "ml-IN": "മലയാളം (Malayalam)",
    }
    const langLabel = PDF_LANG_LABELS[targetLang] ?? "English"

    // Translate a single string field from English to target language
    const translateField = async (text: string): Promise<string> => {
      if (isEnglish || !text?.trim() || text === "—") return text
      try {
        const r = await fetch("/api/sarvam/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, sourceLanguage: "en-IN", targetLanguage: targetLang }),
        })
        if (!r.ok) return text
        const d = await r.json() as { translatedText?: string }
        return d.translatedText?.trim() || text
      } catch {
        return text
      }
    }

    // Translate an array of strings
    const translateArr = async (arr: unknown): Promise<string[]> => {
      const items = Array.isArray(arr) ? (arr as string[]) : []
      if (isEnglish || items.length === 0) return items
      const results = await Promise.all(items.map(item => translateField(String(item))))
      return results
    }

    try {
      // Translate all scalar fields in parallel
      const [
        tChief, tHistory, tExam, tDiagnosis, tFollowUp, tNotes,
      ] = await Promise.all([
        translateField(String(baseReport.chiefComplaint ?? "")),
        translateField(String(baseReport.historyOfPresentIllness ?? "")),
        translateField(String(baseReport.examFindings ?? "")),
        translateField(String(baseReport.diagnosis ?? "")),
        translateField(String(baseReport.followUp ?? "")),
        translateField(String(baseReport.additionalNotes ?? "")),
      ])

      // Translate all array fields in parallel
      const [tSymptoms, tTreatment, tMeds, tInvestigations] = await Promise.all([
        translateArr(baseReport.symptoms),
        translateArr(baseReport.treatment),
        translateArr(baseReport.medications),
        translateArr(baseReport.investigations),
      ])

      const finalReport = {
        chiefComplaint:           tChief,
        historyOfPresentIllness:  tHistory,
        examFindings:             tExam,
        diagnosis:                tDiagnosis,
        followUp:                 tFollowUp,
        additionalNotes:          tNotes,
        symptoms:                 tSymptoms,
        treatment:                tTreatment,
        medications:              tMeds,
        investigations:           tInvestigations,
      }

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Medical Report – ${patientName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; font-size: 13px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; padding-bottom:20px; border-bottom:2px solid #0ea5e9; }
  .logo { font-size:20px; font-weight:700; color:#0ea5e9; }
  .logo span { color:#1a1a2e; }
  .report-title { font-size:22px; font-weight:700; color:#1a1a2e; margin-bottom:4px; }
  .meta { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:16px; margin-bottom:24px; }
  .meta-item label { font-size:10px; font-weight:600; text-transform:uppercase; color:#0284c7; letter-spacing:0.06em; display:block; margin-bottom:3px; }
  .meta-item span  { font-size:13px; font-weight:500; color:#1a1a2e; }
  .section { margin-bottom:18px; break-inside:avoid; }
  .section-header { display:flex; align-items:center; gap:8px; background:#0ea5e9; color:#fff; padding:8px 14px; border-radius:7px 7px 0 0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; }
  .section-body   { background:#f8fafc; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 7px 7px; padding:12px 14px; }
  .section-body p { color:#334155; line-height:1.65; }
  .tag-list { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
  .tag { background:#dbeafe; color:#1d4ed8; border:1px solid #93c5fd; border-radius:100px; padding:3px 10px; font-size:12px; font-weight:500; }
  .tag.green  { background:#dcfce7; color:#166534; border-color:#86efac; }
  .tag.amber  { background:#fef9c3; color:#854d0e; border-color:#fde047; }
  .tag.purple { background:#f3e8ff; color:#7e22ce; border-color:#d8b4fe; }
  .footer { margin-top:32px; padding-top:16px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">⚕ MediLingua <span>AI</span></div>
    <div style="font-size:11px;color:#64748b;margin-top:4px">AI-Powered Medical Documentation</div>
  </div>
  <div style="text-align:right">
    <div class="report-title">Consultation Report</div>
    <div style="font-size:12px;color:#64748b">${now}</div>
    ${!isEnglish ? `<div style="margin-top:5px;display:inline-flex;align-items:center;gap:5px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:100px;padding:2px 10px;font-size:10px;font-weight:600;color:#0284c7">${langLabel}</div>` : ""}
  </div>
</div>

<div class="meta">
  <div class="meta-item"><label>Patient Name</label><span>${patientName}</span></div>
  <div class="meta-item"><label>Age</label><span>${patientAge} years</span></div>
  <div class="meta-item"><label>Gender</label><span>${patientGender ?? "Not specified"}</span></div>
  <div class="meta-item"><label>Department</label><span>${deptLbl}</span></div>
  <div class="meta-item"><label>Visit ID</label><span style="font-size:11px">${visitId}</span></div>
  <div class="meta-item"><label>Messages</label><span>${messages.length} recorded</span></div>
</div>

<div class="section">
  <div class="section-header">🤒 Chief Complaint</div>
  <div class="section-body"><p>${finalReport.chiefComplaint || "Not documented"}</p></div>
</div>

<div class="section">
  <div class="section-header">📋 History of Present Illness</div>
  <div class="section-body"><p>${finalReport.historyOfPresentIllness || "Not documented"}</p></div>
</div>

<div class="grid2">
<div class="section">
  <div class="section-header">🔍 Symptoms</div>
  <div class="section-body">
    <div class="tag-list">
      ${(Array.isArray(finalReport.symptoms) ? finalReport.symptoms : [finalReport.symptoms]).filter(Boolean).map((s: string) => `<span class="tag">${s}</span>`).join("") || "<p>Not documented</p>"}
    </div>
  </div>
</div>
<div class="section">
  <div class="section-header">🩺 Examination Findings</div>
  <div class="section-body"><p>${finalReport.examFindings || "Not documented"}</p></div>
</div>
</div>

<div class="section">
  <div class="section-header">🔬 Diagnosis</div>
  <div class="section-body"><p style="font-weight:600;color:#0f172a">${finalReport.diagnosis || "Pending"}</p></div>
</div>

<div class="grid2">
<div class="section">
  <div class="section-header">💊 Treatment Plan</div>
  <div class="section-body">
    <div class="tag-list">
      ${(Array.isArray(finalReport.treatment) ? finalReport.treatment : [finalReport.treatment]).filter(Boolean).map((t: string) => `<span class="tag green">${t}</span>`).join("") || "<p>Not documented</p>"}
    </div>
  </div>
</div>
<div class="section">
  <div class="section-header">💉 Medications</div>
  <div class="section-body">
    <div class="tag-list">
      ${(Array.isArray(finalReport.medications) ? finalReport.medications : [finalReport.medications]).filter(Boolean).map((m: string) => `<span class="tag amber">${m}</span>`).join("") || "<p>None prescribed</p>"}
    </div>
  </div>
</div>
</div>

<div class="section">
  <div class="section-header">🧪 Investigations Ordered</div>
  <div class="section-body">
    <div class="tag-list">
      ${(Array.isArray(finalReport.investigations) ? finalReport.investigations : [finalReport.investigations]).filter(Boolean).map((i: string) => `<span class="tag purple">${i}</span>`).join("") || "<p>None ordered</p>"}
    </div>
  </div>
</div>

<div class="grid2">
<div class="section">
  <div class="section-header">📅 Follow-up Instructions</div>
  <div class="section-body"><p>${finalReport.followUp || "As needed"}</p></div>
</div>
<div class="section">
  <div class="section-header">📝 Additional Notes</div>
  <div class="section-body"><p>${finalReport.additionalNotes || "—"}</p></div>
</div>
</div>

<div class="footer">
  <span>Generated by MediLingua AI · ${now}</span>
  <span>CONFIDENTIAL — For clinical use only</span>
</div>
</body>
</html>`

      // Open in new tab and trigger print/save as PDF
      const win = window.open("", "_blank")
      if (win) {
        win.document.write(htmlContent)
        win.document.close()
        setTimeout(() => win.print(), 800)
      }
    } finally {
      setPdfTranslating(false)
    }
  }, [report, reportEdits, editingReport, patientName, patientAge, patientGender, department, visitId, messages.length])

  /* ── Save to DB ── */
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const finalReport = editingReport
        ? Object.fromEntries(REPORT_FIELDS.map(f => [
            f.key,
            f.isArray ? (reportEdits[f.key] ?? "").split("\n").filter(Boolean) : (reportEdits[f.key] ?? "")
          ]))
        : report
      await fetch(`/api/consultation/${visitId}/save`, {
        method: "POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ messages, report: finalReport, language: patientLang }),
      })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }, [messages, report, reportEdits, editingReport, visitId, patientLang])

  /* ── Complete consultation ── */
  const handleComplete = useCallback(async () => {
    if (!report) { alert("Please generate the report before completing."); return }
    setCompleting(true)
    try {
      // Save first if not already saved
      await fetch(`/api/consultation/${visitId}/save`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, report, language: patientLang }),
      })
      // Then mark complete
      const res  = await fetch(`/api/consultation/${visitId}/complete`, { method: "POST" })
      const data = await res.json() as { success?: boolean }
      if (data.success) {
        setCompleted(true)
        setSessionActive(false)
      }
    } catch (err) {
      console.error("Complete error:", err)
    } finally {
      setCompleting(false)
    }
  }, [report, visitId, messages, patientLang])

  const playAudioBase64 = useCallback((base64: string) => {
    // Stop any current explanation audio
    if (explainAudioRef.current) {
      explainAudioRef.current.pause()
      explainAudioRef.current.src = ""
    }
    try {
      const binary = atob(base64)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob  = new Blob([bytes], { type: "audio/wav" })
      const url   = URL.createObjectURL(blob)
      const audio = new Audio(url)
      explainAudioRef.current = audio
      setExplainPlaying(true)
      audio.onended = () => { setExplainPlaying(false); URL.revokeObjectURL(url) }
      audio.onerror = (e) => {
        console.error("[explain] Audio playback error:", e)
        setExplainPlaying(false)
        URL.revokeObjectURL(url)
        alert("Audio playback failed. The explanation text is still shown below.")
      }
      audio.play().catch(err => {
        console.error("[explain] play() rejected:", err)
        setExplainPlaying(false)
        // Autoplay blocked by browser — user must interact first
        alert("Tap the Play button to hear the explanation (browser blocked autoplay).")
      })
    } catch (err) {
      console.error("[explain] audio decode error:", err)
      setExplainPlaying(false)
    }
  }, [])

  /* ── Explain report to patient in their language ── */
  const handleExplain = useCallback(async () => {
    if (!report) return
    setExplaining(true)
    setExplanation(null)
    try {
      const res  = await fetch("/api/sarvam/report/explain", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          report,
          patientName,
          patientAge,
          targetLanguage: patientLang,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string; detail?: string }
        throw new Error(errData.detail ?? errData.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as {
        englishSummary: string; translatedSummary: string; audioBase64: string; targetLanguage: string
      }
      if (!data.audioBase64) throw new Error("No audio returned from explain API")
      setExplanation(data)
      // Auto-play immediately — user just clicked the button so autoplay is allowed
      playAudioBase64(data.audioBase64)
    } catch (err) {
      console.error("[explain] error:", err)
      const msg = err instanceof Error ? err.message : String(err)
      alert(`Explanation failed: ${msg}`)
    } finally {
      setExplaining(false)
    }
  }, [report, patientName, patientAge, patientLang, playAudioBase64])

  const playExplanation = useCallback(() => {
    if (!explanation?.audioBase64) return
    if (explainPlaying) {
      explainAudioRef.current?.pause()
      setExplainPlaying(false)
      return
    }
    playAudioBase64(explanation.audioBase64)
  }, [explanation, explainPlaying, playAudioBase64])

  const endSession = useCallback(() => {
    setSessionActive(false)
    if (messages.length) generateReport()
  }, [messages.length, generateReport])

  /* ─────────────────── RENDER ─────────────────── */

  // Quick reply chips for doctor panel
  const QUICK_REPLIES = [
    "Can you describe the pain?",
    "How long has this been going on?",
    "Any fever or chills?",
    "Are you taking any medications?",
    "Any allergies?",
    "I will prescribe medication.",
    "Please take rest and stay hydrated.",
    "Come back in 3 days.",
  ]

  const renderPanel = (role: "patient"|"doctor") => {
    const isPat    = role === "patient"
    const lang     = isPat ? patientLang    : doctorLang
    const setLang  = isPat ? setPatientLang : setDoctorLang
    const rec      = isPat ? patientRec     : doctorRec
    const typing   = isPat ? patientTyping  : doctorTyping
    const setTyping= isPat ? setPatientTyping : setDoctorTyping
    const loading  = isPat ? patientLoading : doctorLoading
    const panelMsgs= messages.filter(m => m.role === role)

    const accentColor  = isPat ? "#38bdf8" : "#34d399"
    const accentRgb    = isPat ? "56,189,248" : "52,211,153"
    const bgPanel      = isPat ? "rgba(4,8,18,0.6)" : "rgba(4,12,20,0.6)"

    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, background:bgPanel, borderRight: isPat ? "1px solid rgba(56,189,248,0.07)" : "none", position:"relative" }}>

        {/* ── Panel Header ── */}
        <div style={{ padding:"11px 16px", borderBottom:`1px solid rgba(${accentRgb},0.09)`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, background:`rgba(4,7,15,0.85)`, backdropFilter:"blur(12px)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {/* Avatar circle */}
            <div style={{ position:"relative" }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,rgba(${accentRgb},0.22),rgba(${accentRgb},0.06))`, border:`1.5px solid rgba(${accentRgb},0.3)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, boxShadow:`0 0 14px rgba(${accentRgb},0.15)` }}>
                {isPat ? "🧑" : "👨‍⚕️"}
              </div>
              {/* Live indicator */}
              {rec && (
                <div style={{ position:"absolute", bottom:0, right:0, width:10, height:10, borderRadius:"50%", background:"#ef4444", border:"2px solid #04050d", animation:"recPulse 1s infinite" }} />
              )}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#e8edf5", lineHeight:1.15 }}>
                {isPat ? patientName : "Doctor"}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:9, color:`rgba(${accentRgb},0.55)`, letterSpacing:"0.12em" }}>{isPat ? "PATIENT" : "PHYSICIAN"}</span>
                {panelMsgs.length > 0 && (
                  <span style={{ fontSize:9, color:"#2a3550" }}>· {panelMsgs.length} msg{panelMsgs.length!==1?"s":""}</span>
                )}
              </div>
            </div>
          </div>

          {/* Language selector */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {rec && (
              <div style={{ display:"flex", alignItems:"center", gap:4, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:100, padding:"3px 10px" }}>
                <span style={{ width:5, height:5, background:"#ef4444", borderRadius:"50%", animation:"pulse 0.8s infinite" }} />
                <span style={{ fontSize:9, color:"#ef4444", fontWeight:700, letterSpacing:"0.08em" }}>REC</span>
              </div>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:6, background:`rgba(${accentRgb},0.05)`, border:`1px solid rgba(${accentRgb},0.14)`, borderRadius:8, padding:"4px 6px 4px 10px" }}>
              <span style={{ fontSize:10, color:`rgba(${accentRgb},0.55)`, letterSpacing:"0.1em", fontWeight:600 }}>🗣</span>
              <select
                value={lang} onChange={e => setLang(e.target.value)}
                style={{ background:"transparent", border:"none", padding:"0 2px", fontSize:12, color:accentColor, fontFamily:"'DM Sans',sans-serif", outline:"none", cursor:"pointer", minWidth:80 }}
              >
                <optgroup label="South India">
                  <option value="kn-IN">ಕನ್ನಡ Kannada</option>
                  <option value="ta-IN">தமிழ் Tamil</option>
                  <option value="te-IN">తెలుగు Telugu</option>
                  <option value="ml-IN">മലയാളം Malayalam</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="hi-IN">हिन्दी Hindi</option>
                  <option value="en-IN">English</option>
                </optgroup>
              </select>
            </div>
          </div>
        </div>

        {/* ── Messages ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 14px 8px", display:"flex", flexDirection:"column", gap:10 }}>

          {/* Empty state */}
          {panelMsgs.length === 0 && !loading && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, gap:12 }}>
              <div style={{ width:52, height:52, borderRadius:"50%", background:`rgba(${accentRgb},0.06)`, border:`1px dashed rgba(${accentRgb},0.2)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>
                {isPat ? "🎙" : "💬"}
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:12, color:"#4a5568", lineHeight:1.7 }}>
                  {sessionActive ? `Waiting for ${isPat ? patientName.split(" ")[0] : "doctor"} to speak…` : "Start the session to begin recording"}
                </div>
              </div>
            </div>
          )}

          {/* Message list */}
          {panelMsgs.map((msg, msgIdx) => {
            const isExpanded  = expandedTranslations.has(msg.id)
            const isEditing   = editingMsgId === msg.id
            const langLabel   = LANG_LABELS[msg.language] ?? msg.language
            const engText     = msg.english
            const showEng     = msg.language !== "en-IN" && engText && engText !== msg.text
            const speakerName = isPat ? patientName : "Doctor"
            const initials    = isPat
              ? patientName.split(" ").map((w:string)=>w[0]).join("").slice(0,2).toUpperCase()
              : "Dr"

            const otherTranslations = [
              { code:"hi-IN", label:"हिन्दी",  name:"Hindi",     text: msg.hindi     },
              { code:"kn-IN", label:"ಕನ್ನಡ",   name:"Kannada",   text: msg.kannada   },
              { code:"ta-IN", label:"தமிழ்",   name:"Tamil",     text: msg.tamil     },
              { code:"te-IN", label:"తెలుగు",  name:"Telugu",    text: msg.telugu    },
              { code:"ml-IN", label:"മലയാളം", name:"Malayalam", text: msg.malayalam },
            ].filter(t => t.code !== msg.language && t.text && t.text !== msg.text)

            return (
              <div key={msg.id}
                className="msg-bubble"
                style={{ display:"flex", gap:8, alignItems:"flex-start",
                  animation:`${isPat?"slideInLeft":"slideInRight"} 0.28s ${Math.min(msgIdx,6)*0.04}s ease both`,
                  flexDirection: isPat ? "row" : "row-reverse",
                }}
              >
                {/* ── Avatar ── */}
                <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <div style={{
                    width:30, height:30, borderRadius:"50%",
                    background:`linear-gradient(135deg,rgba(${accentRgb},0.2),rgba(${accentRgb},0.06))`,
                    border:`1.5px solid rgba(${accentRgb},${isPat?0.22:0.35})`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:800, color:accentColor, letterSpacing:"-0.02em",
                    boxShadow:`0 0 ${isPat?"8":"14"}px rgba(${accentRgb},${isPat?0.1:0.2})`,
                  }}>
                    {initials}
                  </div>
                </div>

                {/* ── Bubble ── */}
                <div style={{ maxWidth:"86%", display:"flex", flexDirection:"column", gap:2, alignItems: isPat?"flex-start":"flex-end" }}>

                  {/* Speaker name + source row */}
                  <div style={{ display:"flex", alignItems:"center", gap:6, paddingLeft: isPat?2:0, paddingRight: isPat?0:2, flexDirection: isPat?"row":"row-reverse" }}>
                    <span style={{ fontSize:11, fontWeight:700, color:accentColor }}>{speakerName}</span>
                    {/* Via indicator — shows HOW the message was sent */}
                    <div style={{ display:"flex", alignItems:"center", gap:3, background:`rgba(${accentRgb},0.06)`, border:`1px solid rgba(${accentRgb},0.12)`, borderRadius:100, padding:"1px 7px" }}>
                      <span style={{ fontSize:9 }}>{msg.via === "mic" ? "🎤" : "✍"}</span>
                      <span style={{ fontSize:9, color:`rgba(${accentRgb},0.6)`, letterSpacing:"0.06em", fontWeight:600 }}>
                        {msg.via === "mic" ? langLabel : langLabel}
                      </span>
                    </div>
                    <span style={{ fontSize:10, color:"#2a3550", fontVariantNumeric:"tabular-nums" }}>{msg.timestamp}</span>
                  </div>

                  {/* Bubble body */}
                  <div style={{
                    background: isPat ? "rgba(8,14,28,0.92)" : "rgba(6,18,32,0.95)",
                    border:`1px solid rgba(${accentRgb},${isPat?0.12:0.22})`,
                    borderRadius: isPat ? "3px 14px 14px 14px" : "14px 3px 14px 14px",
                    padding:"11px 14px",
                    boxShadow:`0 2px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(${accentRgb},0.06)`,
                    position:"relative", overflow:"hidden",
                  }}>
                    {/* Accent top border */}
                    <div style={{ position:"absolute", top:0, left: isPat?0:undefined, right: isPat?undefined:0, width:"40%", height:1, background:`linear-gradient(${isPat?"90deg":"270deg"},rgba(${accentRgb},0.4),transparent)` }} />

                    {/* Edit mode */}
                    {isEditing ? (
                      <div>
                        <div style={{ fontSize:9, color:"#38bdf8", fontWeight:700, letterSpacing:"0.1em", marginBottom:6, display:"flex", alignItems:"center", gap:5 }}>
                          ✏ EDITING — <span style={{ color:"#4a5568", fontWeight:400 }}>saves &amp; re-translates all languages</span>
                        </div>
                        <textarea value={editDraft} onChange={e => setEditDraft(e.target.value)} autoFocus rows={3}
                          style={{ width:"100%", background:"rgba(56,189,248,0.04)", border:"1.5px solid rgba(56,189,248,0.35)", borderRadius:8, padding:"9px 11px", fontSize:14, color:"#e8edf5", fontFamily:"'DM Sans',sans-serif", outline:"none", resize:"vertical" as const, lineHeight:1.55, caretColor:"#38bdf8" }}
                        />
                        <div style={{ display:"flex", gap:6, marginTop:7 }}>
                          <button onClick={() => saveEdit(msg)} disabled={!editDraft.trim()}
                            style={{ flex:1, background:"linear-gradient(135deg,#38bdf8,#0ea5e9)", color:"#04050d", border:"none", borderRadius:7, padding:"7px 0", fontSize:12, fontWeight:700, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>
                            ✓ Save &amp; Re-translate
                          </button>
                          <button onClick={cancelEdit}
                            style={{ background:"rgba(239,68,68,0.07)", color:"#ef4444", border:"1px solid rgba(239,68,68,0.2)", borderRadius:7, padding:"7px 13px", fontSize:12, fontFamily:"'DM Sans',sans-serif", cursor:"pointer" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Primary text */}
                        <div style={{ fontSize:14, color:"#e8edf5", lineHeight:1.65, fontWeight:400, marginBottom: showEng ? 9 : 0 }}>
                          {msg.text}
                        </div>

                        {/* English translation — always visible if not English */}
                        {showEng && (
                          <div style={{ display:"flex", gap:7, alignItems:"flex-start", borderLeft:"2px solid rgba(56,189,248,0.35)", paddingLeft:9, paddingTop:2, paddingBottom:2 }}>
                            <span style={{ fontSize:9, fontWeight:800, color:"#38bdf8", background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.22)", borderRadius:3, padding:"1px 5px", flexShrink:0, marginTop:2, letterSpacing:"0.06em" }}>EN</span>
                            <span style={{ fontSize:13, color:"rgba(147,197,253,0.85)", lineHeight:1.55, fontStyle:"italic" }}>{engText}</span>
                          </div>
                        )}

                        {/* Other translations — collapsible */}
                        {otherTranslations.length > 0 && (
                          <div style={{ marginTop:8 }}>
                            <button onClick={() => toggleTranslations(msg.id)}
                              style={{ background:"transparent", border:"none", cursor:"pointer", padding:"2px 0", display:"flex", alignItems:"center", gap:4 }}>
                              <span style={{ fontSize:9, color:`rgba(${accentRgb},0.35)`, letterSpacing:"0.1em", fontFamily:"'DM Sans',sans-serif" }}>
                                {isExpanded ? "▲ HIDE" : `▼ +${otherTranslations.length} LANGUAGES`}
                              </span>
                            </button>
                            {isExpanded && (
                              <div style={{ marginTop:5, display:"flex", flexDirection:"column" as const, gap:4, animation:"fadeIn 0.2s ease" }}>
                                {otherTranslations.map(t => (
                                  <div key={t.code} style={{ display:"flex", gap:7, alignItems:"flex-start", padding:"5px 8px", borderRadius:6, background:`rgba(${accentRgb},0.03)`, border:`1px solid rgba(${accentRgb},0.07)` }}>
                                    <div style={{ flexShrink:0, minWidth:32 }}>
                                      <div style={{ fontSize:9, fontWeight:700, color:`rgba(${accentRgb},0.6)`, background:`rgba(${accentRgb},0.08)`, border:`1px solid rgba(${accentRgb},0.15)`, borderRadius:3, padding:"1px 4px", textAlign:"center" }}>{t.label}</div>
                                      <div style={{ fontSize:8, color:"#2a3550", marginTop:1, textAlign:"center" }}>{t.name}</div>
                                    </div>
                                    <span style={{ fontSize:12, color:"#6b7fa3", lineHeight:1.55 }}>{t.text}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* ── Actions row — always faintly visible, bright on hover ── */}
                  {!isEditing && (
                    <div className="msg-actions"
                      style={{ display:"flex", alignItems:"center", gap:5, marginTop:3,
                        paddingLeft: isPat?2:0, paddingRight: isPat?0:2,
                        flexDirection: isPat?"row":"row-reverse",
                        opacity: 0.45,  /* visible at rest, CSS class makes it 1 on parent hover */
                      }}>

                      {/* ── Edit button — always visible ── */}
                      <button
                        onClick={() => startEdit(msg)}
                        title="Correct transcription"
                        style={{
                          display:"flex", alignItems:"center", gap:4,
                          background:"rgba(56,189,248,0.08)",
                          border:"1px solid rgba(56,189,248,0.22)",
                          borderRadius:6, padding:"4px 10px",
                          fontSize:11, fontWeight:600, color:"#38bdf8",
                          cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
                          transition:"all 0.18s",
                          letterSpacing:"0.02em",
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background="rgba(56,189,248,0.16)"
                          e.currentTarget.style.borderColor="rgba(56,189,248,0.45)"
                          e.currentTarget.style.boxShadow="0 2px 10px rgba(56,189,248,0.2)"
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background="rgba(56,189,248,0.08)"
                          e.currentTarget.style.borderColor="rgba(56,189,248,0.22)"
                          e.currentTarget.style.boxShadow="none"
                        }}>
                        ✏ Edit
                      </button>

                      {/* ── TTS for doctor messages ── */}
                      {!isPat && (() => {
                        const primaryKey = `${msg.id}:${patientLang}`
                        const isPlaying  = playingMsgId === primaryKey
                        const isLoad     = ttsLoading === primaryKey
                        const nativeName = LANG_LABELS[patientLang] ?? patientLang
                        const engName    = LANG_EN_NAME[patientLang] ?? patientLang
                        return (
                          <div style={{ display:"flex", alignItems:"center", gap:5 }}>

                            {/* Primary TTS button — plays in patient's language */}
                            <button
                              onClick={() => isPlaying ? stopTTS() : playTTS(msg, patientLang)}
                              title={`Play in ${engName} (${nativeName})`}
                              style={{
                                display:"flex", alignItems:"center", gap:6,
                                background: isPlaying ? "rgba(52,211,153,0.14)" : "rgba(52,211,153,0.07)",
                                border:`1px solid ${isPlaying ? "rgba(52,211,153,0.45)" : "rgba(52,211,153,0.2)"}`,
                                borderRadius:7, padding:"4px 11px 4px 9px",
                                fontSize:12, fontWeight:600,
                                color: isPlaying ? "#34d399" : "#2fb87a",
                                cursor:"pointer", fontFamily:"'DM Sans',sans-serif",
                                transition:"all 0.2s",
                                boxShadow: isPlaying ? "0 0 12px rgba(52,211,153,0.2)" : "none",
                              }}
                              onMouseEnter={e => {
                                if (!isPlaying) {
                                  e.currentTarget.style.background="rgba(52,211,153,0.12)"
                                  e.currentTarget.style.borderColor="rgba(52,211,153,0.4)"
                                  e.currentTarget.style.color="#34d399"
                                }
                              }}
                              onMouseLeave={e => {
                                if (!isPlaying) {
                                  e.currentTarget.style.background="rgba(52,211,153,0.07)"
                                  e.currentTarget.style.borderColor="rgba(52,211,153,0.2)"
                                  e.currentTarget.style.color="#2fb87a"
                                }
                              }}
                            >
                              {isLoad
                                ? <span style={{ width:10,height:10,border:"1.5px solid rgba(52,211,153,0.25)",borderTopColor:"#34d399",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} />
                                : <span style={{ fontSize:13 }}>{isPlaying ? "⏹" : "🔊"}</span>
                              }
                              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", lineHeight:1 }}>
                                <span style={{ fontSize:11, fontWeight:700 }}>{engName}</span>
                                <span style={{ fontSize:9, opacity:0.65, marginTop:1 }}>{nativeName}</span>
                              </div>
                            </button>

                            {/* Secondary dropdown — other languages */}
                            <div style={{ position:"relative" }}>
                              <select
                                onChange={e => { if(e.target.value){ playTTS(msg, e.target.value); e.target.value="" } }}
                                defaultValue=""
                                title="Play in another language"
                                style={{
                                  background:"rgba(6,10,22,0.95)",
                                  border:"1px solid rgba(56,189,248,0.18)",
                                  borderRadius:7, padding:"4px 8px",
                                  fontSize:11, color:"#6b93b5",
                                  fontFamily:"'DM Sans',sans-serif",
                                  outline:"none", cursor:"pointer",
                                  appearance:"none" as const,
                                  WebkitAppearance:"none" as const,
                                  minWidth:72,
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.borderColor="rgba(56,189,248,0.38)"
                                  e.currentTarget.style.color="#38bdf8"
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.borderColor="rgba(56,189,248,0.18)"
                                  e.currentTarget.style.color="#6b93b5"
                                }}
                              >
                                <option value="" disabled style={{ color:"#4a5568" }}>+ Play in…</option>
                                {["en-IN","hi-IN","kn-IN","ta-IN","te-IN","ml-IN"]
                                  .filter(c => c !== patientLang)
                                  .map(c => {
                                    const playing = playingMsgId === `${msg.id}:${c}`
                                    return (
                                      <option key={c} value={c} style={{ color:"#e8edf5" }}>
                                        {playing ? "⏹ " : "🔊 "}{LANG_EN_NAME[c]} ({LANG_SHORT[c]})
                                      </option>
                                    )
                                  })
                                }
                              </select>
                              {/* Dropdown arrow */}
                              <div style={{ position:"absolute", right:6, top:"50%", transform:"translateY(-50%)", pointerEvents:"none", fontSize:8, color:"#38bdf8" }}>▾</div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Transcribing indicator */}
          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:`rgba(${accentRgb},0.04)`, border:`1px solid rgba(${accentRgb},0.1)`, borderRadius:10, alignSelf: isPat?"flex-start":"flex-end" }}>
              <div style={{ display:"flex", gap:3 }}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{ width:6,height:6,borderRadius:"50%",background:`rgba(${accentRgb},0.5)`,animation:`dotBounce 1s ${i*0.18}s infinite` }} />
                ))}
              </div>
              <span style={{ fontSize:11, color:"#4a5568" }}>{isPat?"Transcribing":"Processing"}…</span>
            </div>
          )}

          {isPat && <div ref={bottomRef} />}
        </div>

        {/* ── Quick replies (doctor only) ── */}
        {!isPat && sessionActive && (
          <div style={{ padding:"8px 14px", borderTop:"1px solid rgba(52,211,153,0.07)", background:"rgba(4,9,18,0.8)", flexShrink:0 }}>
            <div style={{ fontSize:9, color:"#2a3550", letterSpacing:"0.12em", marginBottom:6, fontWeight:600 }}>QUICK RESPONSES</div>
            <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:2 }}>
              {QUICK_REPLIES.map(qr => (
                <button key={qr} className="qchip"
                  onClick={() => { setDoctorTyping(qr) }}>
                  {qr}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input bar ── */}
        <div style={{ padding:"10px 14px", borderTop:`1px solid rgba(${accentRgb},0.08)`, background:"rgba(4,7,16,0.97)", flexShrink:0 }}>

          {/* Recording banner */}
          {rec && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9, padding:"6px 12px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.18)", borderRadius:8 }}>
              <div style={{ display:"flex", gap:2, alignItems:"flex-end" }}>
                {[0,1,2,3,4,5,6].map(i=>(
                  <div key={i} style={{ width:3, minHeight:4, borderRadius:2, background:"#ef4444", animation:`waveform 0.5s ${i*0.065}s ease-in-out infinite` }} />
                ))}
              </div>
              <span style={{ fontSize:11, fontWeight:600, color:"#ef4444" }}>Recording {isPat ? patientName.split(" ")[0] : "Doctor"} in {LANG_LABELS[lang]}…</span>
              <span style={{ fontSize:10, color:"rgba(239,68,68,0.55)", marginLeft:"auto" }}>press ⏹ to stop</span>
            </div>
          )}

          <div style={{ display:"flex", gap:8, alignItems:"flex-end" }}>
            {/* Mic button */}
            <button
              onClick={() => sessionActive && (rec ? stopRecording(role) : startRecording(role))}
              disabled={!sessionActive}
              title={rec ? "Stop & transcribe" : `Record in ${LANG_LABELS[lang]}`}
              style={{ width:42, height:42, borderRadius:"50%", flexShrink:0, border:`1.5px solid rgba(${rec?"239,68,68":accentRgb},${rec?0.5:0.22})`, background:rec?"rgba(239,68,68,0.1)":`rgba(${accentRgb},0.07)`, cursor:sessionActive?"pointer":"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, position:"relative", transition:"all 0.25s", boxShadow:rec?"0 0 16px rgba(239,68,68,0.25)":"none" }}>
              {rec ? "⏹" : "🎤"}
              {rec && <span style={{ position:"absolute", inset:-5, borderRadius:"50%", border:"2px solid rgba(239,68,68,0.35)", animation:"ripple 1.2s ease-out infinite" }} />}
            </button>

            {/* Input */}
            <div style={{ flex:1, position:"relative" }}>
              <textarea rows={1}
                placeholder={sessionActive ? (isPat ? `Message in ${LANG_LABELS[lang]}…` : `Response in ${LANG_LABELS[lang]}…`) : "Start session first"}
                value={typing}
                onChange={e => setTyping(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendTyped(role) } }}
                disabled={!sessionActive}
                style={{ width:"100%", background:"rgba(8,13,25,0.9)", border:`1px solid rgba(${accentRgb},0.13)`, borderRadius:12, padding:"10px 44px 10px 14px", fontSize:13, color:"#e8edf5", fontFamily:"'DM Sans',sans-serif", outline:"none", resize:"none", caretColor:accentColor, lineHeight:"1.5", transition:"border-color 0.2s", opacity:sessionActive?1:0.4 }}
                onFocus={e => (e.target.style.borderColor=`rgba(${accentRgb},0.42)`)}
                onBlur={e  => (e.target.style.borderColor=`rgba(${accentRgb},0.13)`)}
              />
              {typing.length > 0 && (
                <div style={{ position:"absolute", bottom:7, right:46, fontSize:9, color:"#1e2a3a", pointerEvents:"none" }}>{typing.length}</div>
              )}
            </div>

            {/* Send */}
            <button onClick={() => sendTyped(role)} disabled={!sessionActive||!typing.trim()} title="Send (Enter)"
              style={{ width:42, height:42, borderRadius:12, border:"none", flexShrink:0, cursor:sessionActive&&typing.trim()?"pointer":"not-allowed", background:sessionActive&&typing.trim()?`linear-gradient(135deg,${accentColor},${isPat?"#0ea5e9":"#059669"})`:`rgba(${accentRgb},0.06)`, color:sessionActive&&typing.trim()?"#04050d":"#1e2a3a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, transition:"all 0.2s", boxShadow:sessionActive&&typing.trim()?`0 4px 16px rgba(${accentRgb},0.3)`:"none" }}>
              ➤
            </button>
          </div>

          <div style={{ marginTop:4, fontSize:9, color:"#0d1828", textAlign:"right", letterSpacing:"0.06em" }}>ENTER TO SEND · SHIFT+ENTER FOR NEW LINE</div>
        </div>
      </div>
    )
  }


  /* ─── MAIN RETURN ─── */
  return (
    <div style={{ minHeight:"100vh", background:"#04060f", color:"#e8edf5", fontFamily:"'DM Sans','Segoe UI',sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        ::selection { background:rgba(56,189,248,0.28); color:#fff; }

        /* ── Noise grain ── */
        body::before { content:''; position:fixed; inset:0; z-index:9998; pointer-events:none; opacity:0.018;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size:120px 120px; }

        /* ── Scanline overlay ── */
        body::after { content:''; position:fixed; inset:0; background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.016) 3px,rgba(0,0,0,0.016) 4px); pointer-events:none; z-index:9999; }

        /* ── Custom scrollbar ── */
        ::-webkit-scrollbar { width:3px; height:3px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(56,189,248,0.15); border-radius:10px; }
        ::-webkit-scrollbar-thumb:hover { background:rgba(56,189,248,0.35); }

        /* ── Keyframes ── */
        @keyframes fadeIn     { from{opacity:0} to{opacity:1} }
        @keyframes slideUp    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes slideInLeft  { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:none} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(10px)}  to{opacity:1;transform:none} }
        @keyframes pulse      { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes pulseDot   { 0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,0.5)} 60%{box-shadow:0 0 0 6px rgba(52,211,153,0)} }
        @keyframes spin       { to{transform:rotate(360deg)} }
        @keyframes ripple     { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.6);opacity:0} }
        @keyframes waveform   { 0%,100%{height:3px} 50%{height:20px} }
        @keyframes dotBounce  { 0%,80%,100%{transform:scale(0.5);opacity:0.25} 40%{transform:scale(1.15);opacity:1} }
        @keyframes recPulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.92)} }
        @keyframes shimmer    { from{background-position:-200% center} to{background-position:200% center} }
        @keyframes glowBorder { 0%,100%{border-color:rgba(56,189,248,0.12)} 50%{border-color:rgba(56,189,248,0.38)} }
        @keyframes floatY     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes msgIn      { from{opacity:0;transform:translateY(8px) scale(0.97)} to{opacity:1;transform:none} }

        /* ── Select / option ── */
        select, option { background:#060b18; color:#e8edf5; }
        select:focus   { outline:none; }

        /* ── Textarea ── */
        textarea:focus { outline:none; box-shadow:0 0 0 3px rgba(56,189,248,0.08) !important; }
        textarea::placeholder { color:#1e2a3a; }

        /* ── Message bubble ── */
        .msg-bubble { position:relative; }
        .msg-bubble:hover .msg-actions { opacity:1 !important; transform:translateY(0) !important; }
        /* Actions always faintly visible (0.45), full brightness on hover */
        .msg-actions { opacity:0.45; transform:translateY(0); transition:opacity 0.22s, transform 0.22s; }

        /* ── Doctor bubble glow on hover ── */
        .doc-bubble:hover { box-shadow:0 4px 28px rgba(52,211,153,0.12), inset 0 1px 0 rgba(52,211,153,0.08) !important; border-color:rgba(52,211,153,0.28) !important; }
        .pat-bubble:hover { box-shadow:0 4px 24px rgba(56,189,248,0.1), inset 0 1px 0 rgba(56,189,248,0.06) !important; border-color:rgba(56,189,248,0.2) !important; }

        /* ── Quick reply chip ── */
        .qchip { background:rgba(52,211,153,0.05); border:1px solid rgba(52,211,153,0.14); border-radius:100px; padding:5px 13px; font-size:11px; color:#4a9575; cursor:pointer; transition:all 0.22s; white-space:nowrap; font-family:'DM Sans',sans-serif; }
        .qchip:hover { background:rgba(52,211,153,0.1); border-color:rgba(52,211,153,0.38); color:#34d399; transform:translateY(-1px); box-shadow:0 4px 12px rgba(52,211,153,0.12); }
        .qchip:active { transform:translateY(0); }

        /* ── Tab buttons ── */
        .btab { padding:7px 18px; border-radius:8px; border:1px solid transparent; background:transparent; font-size:12px; font-weight:500; font-family:'DM Sans',sans-serif; cursor:pointer; transition:all 0.22s; display:flex; align-items:center; gap:6px; color:#4a5568; letter-spacing:0.02em; }
        .btab:hover { background:rgba(56,189,248,0.05); color:#8b9ab5; }
        .btab.active { border-color:rgba(56,189,248,0.28); background:rgba(56,189,248,0.09); color:#38bdf8; }

        /* ── Action buttons ── */
        .act-btn { border-radius:8px; padding:6px 14px; font-size:11px; font-family:'DM Sans',sans-serif; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.2s; font-weight:600; letter-spacing:0.02em; }
        .act-btn:hover:not(:disabled) { filter:brightness(1.12); transform:translateY(-1px); }
        .act-btn:disabled { opacity:0.35; cursor:not-allowed; }

        /* ── Doctor panel accent ── */
        .doctor-panel { background: linear-gradient(180deg, rgba(4,14,22,0.7) 0%, rgba(4,10,18,0.85) 100%); }
        .patient-panel { background: linear-gradient(180deg, rgba(4,8,20,0.65) 0%, rgba(4,6,16,0.8) 100%); }

        /* ── Panel divider ── */
        .panel-divider { background:linear-gradient(180deg, transparent 0%, rgba(56,189,248,0.12) 30%, rgba(56,189,248,0.12) 70%, transparent 100%); }

        /* ── Recording waveform bar ── */
        .rec-bar { width:3px; border-radius:3px; background:#ef4444; }

        /* ── Transcript row hover ── */
        .tx-row { border-radius:6px; padding:5px 8px; transition:background 0.15s; }
        .tx-row:hover { background:rgba(56,189,248,0.04); }

        /* ── Report card ── */
        .report-card { background:rgba(8,14,26,0.8); border:1px solid rgba(56,189,248,0.1); border-radius:12px; padding:12px 14px; transition:all 0.22s; }
        .report-card:hover { border-color:rgba(56,189,248,0.22); background:rgba(8,16,30,0.9); }

        /* ── History sidebar ── */
        .hist-visit { border-radius:8px; padding:10px 11px; cursor:pointer; transition:all 0.2s; border:1px solid rgba(56,189,248,0.08); background:rgba(6,10,22,0.7); }
        .hist-visit:hover { border-color:rgba(56,189,248,0.25); background:rgba(56,189,248,0.05); }
        .hist-visit.active { border-color:rgba(56,189,248,0.32); background:rgba(56,189,248,0.07); }

        /* ── TTS play btn ── */
        .tts-play { display:flex; align-items:center; gap:5px; border-radius:100px; padding:4px 11px 4px 8px; font-size:11px; font-weight:600; cursor:pointer; transition:all 0.22s; font-family:'DM Sans',sans-serif; border:1px solid rgba(52,211,153,0.18); background:rgba(52,211,153,0.06); color:#34d399; }
        .tts-play:hover { background:rgba(52,211,153,0.12); border-color:rgba(52,211,153,0.38); box-shadow:0 2px 12px rgba(52,211,153,0.15); }
        .tts-play.playing { background:rgba(52,211,153,0.14); border-color:rgba(52,211,153,0.45); color:#34d399; }

        /* ── Badge pill ── */
        .via-badge { display:inline-flex; align-items:center; gap:3px; border-radius:100px; padding:1px 7px; font-size:9px; font-weight:600; letter-spacing:0.07em; }
      `}</style>

      {/* ══ NAVBAR ══ */}
      <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 22px", height:58, background:"rgba(3,5,14,0.98)", backdropFilter:"blur(28px)", borderBottom:"1px solid rgba(56,189,248,0.08)", flexShrink:0, zIndex:100, position:"relative" }}>
        {/* Animated gradient line at bottom */}
        <div style={{ position:"absolute", bottom:0, left:0, right:0, height:1, background:"linear-gradient(90deg,transparent,rgba(56,189,248,0.6) 30%,rgba(52,211,153,0.4) 60%,transparent)", backgroundSize:"200% 100%", animation:"shimmer 5s linear infinite" }} />

        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:11 }}>
          <div style={{ width:32, height:32, background:"linear-gradient(135deg,#38bdf8,#0284c7)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, boxShadow:"0 0 20px rgba(56,189,248,0.4), inset 0 1px 0 rgba(255,255,255,0.15)", fontWeight:700, position:"relative" }}>
            ⚕
            <div style={{ position:"absolute", inset:-1, borderRadius:10, boxShadow:"0 0 0 1px rgba(56,189,248,0.2)", pointerEvents:"none" }} />
          </div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, color:"#e8edf5", letterSpacing:"-0.025em", lineHeight:1.1 }}>MediLingua <span style={{ color:"#38bdf8" }}>AI</span></div>
            <div style={{ fontSize:8, letterSpacing:"0.18em", color:"rgba(56,189,248,0.35)", fontFamily:"monospace", marginTop:1 }}>CONSULTATION ROOM</div>
          </div>
        </div>

        {/* Centre — session status */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {sessionActive ? (
            <>
              {/* Live badge */}
              <div style={{ display:"flex", alignItems:"center", gap:7, background:"rgba(52,211,153,0.07)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:100, padding:"6px 14px", boxShadow:"0 0 16px rgba(52,211,153,0.08)" }}>
                <span style={{ width:7, height:7, background:"#34d399", borderRadius:"50%", animation:"pulseDot 1.8s infinite", boxShadow:"0 0 8px #34d399" }} />
                <span style={{ fontSize:11, color:"#34d399", fontWeight:700, letterSpacing:"0.1em" }}>LIVE</span>
              </div>
              {/* Timer */}
              <div style={{ background:"rgba(6,12,24,0.9)", border:"1px solid rgba(56,189,248,0.15)", borderRadius:8, padding:"5px 14px", fontSize:13, fontWeight:700, color:"#e8edf5", fontVariantNumeric:"tabular-nums", fontFamily:"'Courier New',monospace", letterSpacing:"0.08em" }}>
                ⏱ {fmt(sessionSeconds)}
              </div>
              {/* Message count */}
              <div style={{ background:"rgba(56,189,248,0.05)", border:"1px solid rgba(56,189,248,0.1)", borderRadius:8, padding:"5px 12px", fontSize:11, color:"#6b93b5", fontFamily:"'DM Sans',sans-serif" }}>
                {messages.length} msg{messages.length !== 1 ? "s" : ""}
              </div>
            </>
          ) : (
            <div style={{ fontSize:11, color:"#1e2a3a", letterSpacing:"0.12em", fontFamily:"monospace" }}>◦ SESSION INACTIVE</div>
          )}
        </div>

        {/* Right actions */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {!sessionActive ? (
            <button onClick={() => setSessionActive(true)}
              style={{ background:"linear-gradient(135deg,#38bdf8,#0ea5e9)", color:"#04050d", padding:"9px 22px", borderRadius:9, border:"none", fontSize:13, fontWeight:700, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", display:"flex", alignItems:"center", gap:8, boxShadow:"0 4px 20px rgba(56,189,248,0.35)", transition:"all 0.22s", letterSpacing:"0.02em" }}
              onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 6px 28px rgba(56,189,248,0.5)")}
              onMouseLeave={e=>(e.currentTarget.style.boxShadow="0 4px 20px rgba(56,189,248,0.35)")}>
              ▶ Start Session
            </button>
          ) : (
            <button onClick={endSession}
              style={{ background:"rgba(239,68,68,0.07)", color:"#ef4444", padding:"9px 20px", borderRadius:9, border:"1px solid rgba(239,68,68,0.22)", fontSize:13, fontWeight:700, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", transition:"all 0.22s" }}
              onMouseEnter={e=>(e.currentTarget.style.background="rgba(239,68,68,0.12)")}
              onMouseLeave={e=>(e.currentTarget.style.background="rgba(239,68,68,0.07)")}>
              ⏹ End Session
            </button>
          )}
          <Link href="/doctor/dashboard"
            style={{ fontSize:12, color:"#3a5070", textDecoration:"none", padding:"8px 14px", borderRadius:8, border:"1px solid rgba(56,189,248,0.08)", transition:"all 0.22s", letterSpacing:"0.04em" }}
            onMouseEnter={e=>{ (e.currentTarget as HTMLAnchorElement).style.color="#6b93b5"; (e.currentTarget as HTMLAnchorElement).style.borderColor="rgba(56,189,248,0.2)" }}
            onMouseLeave={e=>{ (e.currentTarget as HTMLAnchorElement).style.color="#3a5070"; (e.currentTarget as HTMLAnchorElement).style.borderColor="rgba(56,189,248,0.08)" }}>
            ← Queue
          </Link>
        </div>
      </nav>

      {/* ══ PATIENT INFO BAR ══ */}
      <div style={{ background:"rgba(4,7,18,0.97)", borderBottom:"1px solid rgba(56,189,248,0.07)", padding:"0 22px", height:48, display:"flex", alignItems:"center", gap:0, flexShrink:0, position:"relative" }}>
        {/* Left accent bar */}
        <div style={{ position:"absolute", left:0, top:8, bottom:8, width:3, background:"linear-gradient(180deg,#38bdf8,#0ea5e9)", borderRadius:"0 3px 3px 0", boxShadow:"2px 0 12px rgba(56,189,248,0.3)" }} />

        {/* Avatar + name */}
        <div style={{ display:"flex", alignItems:"center", gap:11, paddingRight:22, borderRight:"1px solid rgba(56,189,248,0.07)", marginRight:22, marginLeft:10 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,rgba(56,189,248,0.22),rgba(56,189,248,0.07))", border:"1.5px solid rgba(56,189,248,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#38bdf8", boxShadow:"0 0 14px rgba(56,189,248,0.15), inset 0 1px 0 rgba(56,189,248,0.2)" }}>
            {patientName.split(" ").map((w:string)=>w[0]).join("").slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#e8edf5", lineHeight:1.15, letterSpacing:"-0.01em" }}>{patientName}</div>
            <div style={{ fontSize:9, color:"rgba(56,189,248,0.4)", letterSpacing:"0.14em", marginTop:1 }}>PATIENT</div>
          </div>
        </div>

        {/* Meta pills */}
        {[
          { label:"AGE",    value: `${patientAge} yrs`,           color:"#8b9ab5" },
          { label:"GENDER", value: patientGender ?? "—",          color:"#8b9ab5" },
          { label:"DEPT",   value: department.replace(/_/g," "),  color:"#38bdf8" },
          { label:"DATE",   value: new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"2-digit" }), color:"#6b7fa3" },
        ].map(p => (
          <div key={p.label} style={{ display:"flex", alignItems:"center", gap:6, marginRight:20, padding:"4px 12px", background:"rgba(56,189,248,0.03)", borderRadius:6, border:"1px solid rgba(56,189,248,0.07)" }}>
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.14em", color:"#1e2a3a" }}>{p.label}</span>
            <span style={{ fontSize:12, fontWeight:600, color:p.color }}>{p.value}</span>
          </div>
        ))}

        <div style={{ flex:1 }} />

        {/* Translation pair badge */}
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(56,189,248,0.04)", border:"1px solid rgba(56,189,248,0.1)", borderRadius:100, padding:"5px 14px" }}>
          <span style={{ fontSize:10, fontWeight:600, color:"#38bdf8" }}>{LANG_LABELS[patientLang]}</span>
          <span style={{ fontSize:12, color:"rgba(56,189,248,0.3)" }}>⇄</span>
          <span style={{ fontSize:10, fontWeight:600, color:"#34d399" }}>{LANG_LABELS[doctorLang]}</span>
          <span style={{ fontSize:9, color:"#2a3550", letterSpacing:"0.08em", marginLeft:2 }}>ACTIVE</span>
        </div>
      </div>

      {/* ── History sidebar + dual panels ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

        {/* ── Patient History Sidebar ── */}
        {patientHistory.length > 0 && (
          <div style={{
            width: historyOpen ? 280 : 36, flexShrink:0, transition:"width 0.25s ease",
            borderRight:"1px solid rgba(56,189,248,0.1)", background:"rgba(8,12,20,0.7)",
            display:"flex", flexDirection:"column", overflow:"hidden",
          }}>
            {/* Sidebar toggle header */}
            <div
              onClick={() => setHistoryOpen(o => !o)}
              style={{ padding:"10px 12px", borderBottom:"1px solid rgba(56,189,248,0.08)", display:"flex", alignItems:"center", gap:8, cursor:"pointer", flexShrink:0, background:"rgba(13,19,33,0.6)" }}
            >
              <span style={{ fontSize:14 }}>🕐</span>
              {historyOpen && (
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#e8edf5" }}>Patient History</div>
                  <div style={{ fontSize:10, color:"#4a5568" }}>{patientHistory.length} past visit{patientHistory.length!==1?"s":""}</div>
                </div>
              )}
              <span style={{ fontSize:11, color:"#38bdf8", marginLeft:"auto" }}>{historyOpen ? "◀" : "▶"}</span>
            </div>

            {/* History list */}
            {historyOpen && (
              <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
                {patientHistory.map((visit, vi) => {
                  const isExpanded = expandedVisit === visit.visitId
                  const date       = new Date(visit.date)
                  const dateStr    = date.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })

                  return (
                    <div key={visit.visitId} style={{ marginBottom:8 }}>
                      {/* Visit header */}
                      <div
                        onClick={() => setExpandedVisit(isExpanded ? null : visit.visitId)}
                        style={{
                          background: isExpanded ? "rgba(56,189,248,0.1)" : "rgba(13,19,33,0.8)",
                          border:`1px solid rgba(56,189,248,${isExpanded?0.3:0.1})`,
                          borderRadius:8, padding:"9px 10px", cursor:"pointer",
                          display:"flex", flexDirection:"column", gap:3,
                        }}
                      >
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:11, fontWeight:700, color: isExpanded?"#38bdf8":"#e8edf5" }}>
                            {visit.department.replace(/_/g," ")}
                          </span>
                          <span style={{ fontSize:9, color:"#4a5568" }}>{isExpanded?"▲":"▼"}</span>
                        </div>
                        <span style={{ fontSize:10, color:"#4a5568" }}>{dateStr}</span>
                        <span style={{ fontSize:10, color:"#8b9ab5" }}>
                          {visit.reports.length} report{visit.reports.length!==1?"s":""}
                        </span>
                      </div>

                      {/* Reports for this visit */}
                      {isExpanded && visit.reports.map((rep, ri) => {
                        const isRepExpanded = expandedVisit === visit.visitId && expandedReport === ri
                        const savedAt = rep._savedAt ? new Date(rep._savedAt as string).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }) : ""
                        return (
                          <div key={ri} style={{ marginTop:4, marginLeft:8, borderLeft:"2px solid rgba(56,189,248,0.15)", paddingLeft:8 }}>
                            {/* Report header */}
                            <div
                              onClick={() => setExpandedReport(isRepExpanded ? null : ri)}
                              style={{ padding:"7px 8px", background:"rgba(8,12,20,0.9)", borderRadius:6, cursor:"pointer", border:"1px solid rgba(56,189,248,0.08)" }}
                            >
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                <span style={{ fontSize:10, fontWeight:600, color:"#38bdf8" }}>
                                  Report {typeof rep._sessionIndex === "number" ? rep._sessionIndex : ri + 1}
                                </span>
                                <span style={{ fontSize:9, color:"#4a5568" }}>{savedAt} {isRepExpanded?"▲":"▼"}</span>
                              </div>
                              {rep.diagnosis && (
                                <div style={{ fontSize:10, color:"#8b9ab5", marginTop:3, lineHeight:1.4 }}>
                                  Dx: {String(rep.diagnosis).slice(0,60)}{String(rep.diagnosis).length > 60 ? "…" : ""}
                                </div>
                              )}
                            </div>

                            {/* Expanded report detail */}
                            {isRepExpanded && (
                              <div style={{ background:"rgba(8,12,20,0.95)", border:"1px solid rgba(56,189,248,0.1)", borderRadius:"0 0 7px 7px", padding:"9px 10px", display:"flex", flexDirection:"column", gap:7 }}>
                                {[
                                  { label:"Chief Complaint", value: rep.chiefComplaint },
                                  { label:"Diagnosis",       value: rep.diagnosis       },
                                  { label:"Symptoms",        value: Array.isArray(rep.symptoms) ? (rep.symptoms as string[]).join(", ") : rep.symptoms },
                                  { label:"Medications",     value: Array.isArray(rep.medications) ? (rep.medications as string[]).join(", ") : rep.medications },
                                  { label:"Treatment",       value: Array.isArray(rep.treatment)  ? (rep.treatment  as string[]).join(", ") : rep.treatment  },
                                  { label:"Follow-up",       value: rep.followUp        },
                                ].filter(f => f.value).map(f => (
                                  <div key={f.label}>
                                    <div style={{ fontSize:9, fontWeight:700, color:"#38bdf8", textTransform:"uppercase" as const, letterSpacing:"0.07em", marginBottom:2 }}>{f.label}</div>
                                    <div style={{ fontSize:11, color:"#c8d6e8", lineHeight:1.5 }}>{String(f.value)}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Consultation panels ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>
          {renderPanel("patient")}
          {/* Divider */}
          <div className="panel-divider" style={{ width:1, flexShrink:0 }} />
          {renderPanel("doctor")}
        </div>
      </div>


      {/* ══ BOTTOM PANEL ══ */}
      <div style={{ height:320, flexShrink:0, borderTop:"1px solid rgba(56,189,248,0.1)", background:"linear-gradient(180deg,rgba(4,7,18,0.98),rgba(3,5,14,1))", display:"flex", flexDirection:"column", position:"relative" }}>
        {/* Top glow line */}
        <div style={{ position:"absolute", top:0, left:"10%", right:"10%", height:1, background:"linear-gradient(90deg,transparent,rgba(56,189,248,0.4),rgba(52,211,153,0.3),transparent)", pointerEvents:"none" }} />

        {/* ── Tab bar ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 20px", borderBottom:"1px solid rgba(56,189,248,0.07)", flexShrink:0 }}>
          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            {(["transcript","report"] as const).map(t => (
              <button key={t} className={`btab${tab===t?" active":""}`} onClick={() => setTab(t)}>
                {t==="transcript" ? "📝 Transcript" : "📋 Report"}
                {t==="report" && report && <span style={{ width:5,height:5,background:"#34d399",borderRadius:"50%",boxShadow:"0 0 6px #34d399",display:"inline-block" }} />}
              </button>
            ))}

            {tab === "transcript" && (
              <div style={{ display:"flex", alignItems:"center", gap:7, marginLeft:10, background:"rgba(56,189,248,0.04)", border:"1px solid rgba(56,189,248,0.1)", borderRadius:8, padding:"3px 4px 3px 10px" }}>
                <span style={{ fontSize:9, color:"rgba(56,189,248,0.45)", letterSpacing:"0.12em", fontWeight:600 }}>VIEW IN</span>
                <select value={transcriptLang} onChange={e => setTranscriptLang(e.target.value)}
                  style={{ background:"transparent", border:"none", fontSize:11, color:"#38bdf8", fontFamily:"'DM Sans',sans-serif", outline:"none", cursor:"pointer" }}>
                  <optgroup label="South India">
                    <option value="kn-IN">ಕನ್ನಡ Kannada</option>
                    <option value="ta-IN">தமிழ் Tamil</option>
                    <option value="te-IN">తెలుగు Telugu</option>
                    <option value="ml-IN">മലയാളം Malayalam</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="hi-IN">हिन्दी Hindi</option>
                    <option value="en-IN">English</option>
                  </optgroup>
                </select>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {tab==="report" && report && (
              <>
                <button className="act-btn" onClick={() => setEditingReport(e => !e)}
                  style={{ background:"transparent", border:"1px solid rgba(56,189,248,0.18)", color:"#38bdf8" }}>
                  {editingReport ? "✓ Done" : "✏ Edit"}
                </button>

                {/* ── Multilingual PDF download ── */}
                {/* FIX: pass pdfLangRef.current to always use the latest selected language */}
                <div style={{ display:"flex", alignItems:"center", gap:0, border:"1px solid rgba(52,211,153,0.22)", borderRadius:8, overflow:"hidden" }}>
                  <button className="act-btn"
                    onClick={() => downloadPDF(pdfLangRef.current)}
                    disabled={pdfTranslating}
                    style={{ background:"rgba(52,211,153,0.07)", border:"none", borderRadius:0, color: pdfTranslating ? "#2a5040" : "#34d399", minWidth:90 }}>
                    {pdfTranslating
                      ? <><span style={{ width:10,height:10,border:"1.5px solid rgba(52,211,153,0.2)",borderTopColor:"#34d399",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} /> Translating…</>
                      : <>⬇ PDF {pdfLang !== "en-IN" ? `(${LANG_SHORT[pdfLang]})` : ""}</>
                    }
                  </button>
                  <div style={{ width:1, background:"rgba(52,211,153,0.18)", alignSelf:"stretch" }} />
                  <select
                    value={pdfLang}
                    onChange={e => {
                      setPdfLang(e.target.value)
                      pdfLangRef.current = e.target.value
                    }}
                    title="PDF language"
                    style={{ background:"rgba(52,211,153,0.05)", border:"none", padding:"0 8px", fontSize:11, color:"#34d399", fontFamily:"'DM Sans',sans-serif", outline:"none", cursor:"pointer", height:"100%" }}>
                    <option value="en-IN">EN – English</option>
                    <option value="kn-IN">KN – ಕನ್ನಡ</option>
                    <option value="ta-IN">TA – தமிழ்</option>
                    <option value="te-IN">TE – తెలుగు</option>
                    <option value="ml-IN">ML – മലയാളം</option>
                    <option value="hi-IN">HI – हिन्दी</option>
                  </select>
                </div>

                {/* ── Explain to Patient ── */}
                <button className="act-btn"
                  onClick={handleExplain}
                  disabled={explaining}
                  title={`Explain report in ${LANG_LABELS[patientLang]} to patient`}
                  style={{ background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.25)", color:"#c084fc",
                    boxShadow: explaining ? "none" : "0 0 12px rgba(168,85,247,0.15)" }}>
                  {explaining
                    ? <><span style={{ width:10,height:10,border:"1.5px solid rgba(168,85,247,0.2)",borderTopColor:"#c084fc",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} /> Explaining…</>
                    : `🔊 Explain in ${LANG_EN_NAME[patientLang]}`
                  }
                </button>
              </>
            )}
            <button className="act-btn" onClick={generateReport} disabled={!messages.length||reportLoading}
              style={{ background:"rgba(56,189,248,0.07)", border:"1px solid rgba(56,189,248,0.18)", color:"#38bdf8" }}>
              {reportLoading ? <><span style={{ width:10,height:10,border:"1.5px solid rgba(56,189,248,0.2)",borderTopColor:"#38bdf8",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} /> Generating…</> : "⚡ Generate"}
            </button>
            <button className="act-btn" onClick={handleSave} disabled={saving||!messages.length}
              style={{ background: saved?"rgba(52,211,153,0.12)":"linear-gradient(135deg,#38bdf8,#0ea5e9)", border:"none", color: saved?"#34d399":"#04050d", fontWeight:700, boxShadow: saved?"none":"0 2px 12px rgba(56,189,248,0.25)" }}>
              {saving ? <><span style={{ width:10,height:10,border:"1.5px solid rgba(4,5,13,0.3)",borderTopColor:"#04050d",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} /> Saving…</> : saved ? "✓ Saved!" : "💾 Save"}
            </button>
            {report && !completed && (
              <button className="act-btn" onClick={handleComplete} disabled={completing}
                style={{ background: completing?"rgba(52,211,153,0.08)":"linear-gradient(135deg,#34d399,#10b981)", border:"none", color:"#04050d", fontWeight:700, boxShadow: completing?"none":"0 2px 14px rgba(52,211,153,0.3)" }}>
                {completing ? <><span style={{ width:10,height:10,border:"1.5px solid rgba(4,5,13,0.3)",borderTopColor:"#04050d",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block" }} /> Completing…</> : "✅ Complete"}
              </button>
            )}
            {completed && (
              <div style={{ display:"flex", alignItems:"center", gap:5, background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.25)", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600, color:"#34d399", boxShadow:"0 0 12px rgba(52,211,153,0.1)" }}>
                <span style={{ fontSize:14 }}>✅</span> Completed
              </div>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"10px 20px" }}>

          {/* Transcript tab */}
          {tab==="transcript" && (
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {messages.length===0 && (
                <div style={{ textAlign:"center", color:"#2a3550", fontSize:12, marginTop:18, letterSpacing:"0.04em" }}>
                  Conversation transcript will appear here as the session progresses.
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={msg.id} className="tx-row" style={{ display:"flex", gap:10, alignItems:"baseline", animation:"fadeIn 0.3s ease" }}>
                  {/* Time */}
                  <span style={{ fontSize:10, color:"#1e2a3a", minWidth:36, fontVariantNumeric:"tabular-nums", fontFamily:"monospace", flexShrink:0 }}>{msg.timestamp}</span>
                  {/* Speaker name + via badge */}
                  <div style={{ display:"flex", alignItems:"center", gap:5, minWidth:80, flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:700, color: msg.role==="patient"?"#38bdf8":"#34d399", letterSpacing:"-0.01em" }}>
                      {msg.role==="patient" ? patientName.split(" ")[0] : "Doctor"}
                    </span>
                    <span className="via-badge" style={{ background: msg.role==="patient"?"rgba(56,189,248,0.06)":"rgba(52,211,153,0.06)", border:`1px solid rgba(${msg.role==="patient"?"56,189,248":"52,211,153"},0.14)`, color: msg.role==="patient"?"rgba(56,189,248,0.5)":"rgba(52,211,153,0.5)" }}>
                      {msg.via === "mic" ? "🎤" : "✍"} {LANG_SHORT[msg.language] ?? msg.language}
                    </span>
                  </div>
                  {/* Text */}
                  <span style={{ fontSize:13, color:"#c8d6e8", lineHeight:1.55, flex:1 }}>
                    {getMsgText(msg, transcriptLang)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Report tab */}
          {tab==="report" && (
            <div>
              {reportLoading && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, marginTop:24, color:"#6b7fa3" }}>
                  <div style={{ display:"flex", gap:5 }}>
                    {[0,1,2].map(i=><div key={i} style={{ width:8,height:8,borderRadius:"50%",background:"rgba(56,189,248,0.5)",animation:`dotBounce 1s ${i*0.18}s infinite` }} />)}
                  </div>
                  <span style={{ fontSize:13 }}>Extracting medical entities and building report…</span>
                </div>
              )}
              {!reportLoading && !report && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, marginTop:24 }}>
                  <div style={{ fontSize:28, opacity:0.3 }}>📋</div>
                  <div style={{ fontSize:12, color:"#2a3550", textAlign:"center" }}>Click ⚡ Generate after the consultation to build a structured medical report.</div>
                </div>
              )}
              {!reportLoading && report && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:8 }}>
                  {REPORT_FIELDS.map(f => {
                    const val = report[f.key]
                    const isEmpty = Array.isArray(val) ? val.length===0 : !val
                    return (
                      <div key={f.key} className="report-card" style={{ borderColor: isEmpty?"rgba(56,189,248,0.07)":"rgba(56,189,248,0.14)" }}>
                        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase" as const, color:isEmpty?"#2a3550":"rgba(56,189,248,0.7)", marginBottom:8, display:"flex", gap:5, alignItems:"center" }}>
                          <span>{f.icon}</span>{f.label}
                        </div>
                        {editingReport ? (
                          <textarea value={reportEdits[f.key]??""} onChange={e => setReportEdits(r=>({...r,[f.key]:e.target.value}))}
                            rows={f.isArray?3:2} placeholder={f.isArray?"One item per line…":""}
                            style={{ width:"100%", background:"rgba(4,8,20,0.8)", border:"1px solid rgba(56,189,248,0.14)", borderRadius:6, padding:"7px 9px", fontSize:12, color:"#e8edf5", fontFamily:"'DM Sans',sans-serif", outline:"none", resize:"vertical" as const, lineHeight:1.55 }} />
                        ) : f.isArray ? (
                          <div style={{ display:"flex", flexWrap:"wrap" as const, gap:4 }}>
                            {(Array.isArray(val)?val as string[]:[String(val)]).filter(Boolean).length===0
                              ? <span style={{ fontSize:12,color:"#1e2a3a" }}>—</span>
                              : (Array.isArray(val)?val as string[]:[String(val)]).filter(Boolean).map((item,i)=>(
                                  <span key={i} style={{ background:"rgba(56,189,248,0.07)", border:"1px solid rgba(56,189,248,0.14)", borderRadius:100, padding:"2px 9px", fontSize:11, color:"#7dd3fc" }}>{item}</span>
                                ))
                            }
                          </div>
                        ) : (
                          <div style={{ fontSize:12, color:isEmpty?"#1e2a3a":"#c8d6e8", lineHeight:1.65 }}>{String(val||"—")}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

            {/* ── Explanation panel ── */}
            {(explanation || explaining) && (
              <div style={{ marginTop:14, background:"linear-gradient(135deg,rgba(168,85,247,0.07),rgba(139,92,246,0.04))", border:"1px solid rgba(168,85,247,0.22)", borderRadius:12, padding:"14px 16px", animation:"fadeIn 0.35s ease" }}>

                {/* Header */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:16 }}>🔊</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#c084fc" }}>Patient Explanation</div>
                      <div style={{ fontSize:10, color:"rgba(192,132,252,0.55)", marginTop:1 }}>
                        In {LANG_LABELS[patientLang]} — simple language for the patient
                      </div>
                    </div>
                  </div>
                  {explanation && (
                    <button
                      onClick={playExplanation}
                      style={{ display:"flex", alignItems:"center", gap:7, background: explainPlaying?"rgba(168,85,247,0.18)":"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.35)", borderRadius:100, padding:"6px 16px 6px 12px", fontSize:12, fontWeight:700, color:"#c084fc", cursor:"pointer", transition:"all 0.2s", boxShadow: explainPlaying?"0 0 16px rgba(168,85,247,0.3)":"none" }}>
                      <span style={{ fontSize:15 }}>{explainPlaying ? "⏹" : "▶"}</span>
                      {explainPlaying ? "Stop" : `Play in ${LANG_EN_NAME[patientLang]}`}
                    </button>
                  )}
                </div>

                {/* Translated text */}
                {explanation && (
                  <div style={{ display:"flex", flexDirection:"column" as const, gap:8 }}>
                    {/* Native language */}
                    <div style={{ background:"rgba(168,85,247,0.06)", borderRadius:8, padding:"10px 13px", border:"1px solid rgba(168,85,247,0.12)" }}>
                      <div style={{ fontSize:9, fontWeight:700, color:"rgba(192,132,252,0.6)", letterSpacing:"0.12em", marginBottom:5 }}>{LANG_LABELS[patientLang].toUpperCase()}</div>
                      <div style={{ fontSize:13, color:"#e8edf5", lineHeight:1.7, fontWeight:400 }}>{explanation.translatedSummary}</div>
                    </div>
                    {/* English reference */}
                    {patientLang !== "en-IN" && (
                      <div style={{ borderLeft:"2px solid rgba(168,85,247,0.25)", paddingLeft:10 }}>
                        <div style={{ fontSize:9, fontWeight:700, color:"rgba(192,132,252,0.4)", letterSpacing:"0.1em", marginBottom:3 }}>ENGLISH REFERENCE</div>
                        <div style={{ fontSize:11, color:"#6b7fa3", lineHeight:1.65, fontStyle:"italic" }}>{explanation.englishSummary}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Loading */}
                {explaining && !explanation && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, color:"rgba(192,132,252,0.6)", fontSize:12 }}>
                    <div style={{ display:"flex", gap:4 }}>
                      {[0,1,2].map(i=><div key={i} style={{ width:7,height:7,borderRadius:"50%",background:"rgba(168,85,247,0.5)",animation:`dotBounce 1s ${i*0.18}s infinite` }} />)}
                    </div>
                    Generating explanation in {LANG_LABELS[patientLang]}…
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}