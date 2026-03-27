// app/api/sarvam/report/route.ts
//
// HYBRID APPROACH: NER + Groq LLM
// ─────────────────────────────────
// Step 1 — Run biomedical NER (HuggingFace free) on English transcript
//           → extracts raw medical entity hints
// Step 2 — Send transcript + NER hints to Groq (free tier, llama-3.1-8b-instant)
//           → LLM understands context, structures the final SOAP report
// Step 3 — Rule-based fallback if both fail
//
// Required env vars:
//   HUGGINGFACE_API_KEY=hf_xxx   (free at huggingface.co/settings/tokens)
//   GROQ_API_KEY=gsk_xxx         (free at console.groq.com)

import { NextRequest, NextResponse } from "next/server"

const HF_URL   = "https://router.huggingface.co/hf-inference/models/d4data/biomedical-ner-all"
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

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

type Msg = { role: string; text: string; english?: string; translated?: string }

/* ─────────────────────────────────────────
   UTIL
───────────────────────────────────────── */
function buildEnglishTranscript(messages: Msg[]): string {
  return messages
    .map(m => `${m.role === "patient" ? "Patient" : "Doctor"}: ${m.english ?? m.translated ?? m.text}`)
    .join("\n")
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() }
function dedup(arr: string[]) { return [...new Set(arr.map(s => s.trim()).filter(Boolean))] }

/* ─────────────────────────────────────────
   STEP 1 — NER (entity hints only, best-effort)
───────────────────────────────────────── */
interface NEREntity { word: string; entity_group?: string; entity?: string; score: number; start?: number; end?: number }

async function runNER(text: string): Promise<NEREntity[]> {
  try {
    const res = await fetch(HF_URL, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ inputs: text }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data as NEREntity[] : []
  } catch { return [] }
}

function mergeAndCleanNER(raw: NEREntity[]): { symptoms: string[]; medications: string[]; diagnoses: string[]; investigations: string[] } {
  // Merge consecutive same-label tokens (BERT subword fix)
  const merged: NEREntity[] = []
  let cur: NEREntity | null = null
  for (const e of raw) {
    if (!cur) { cur = { ...e }; continue }
    const sameLabel  = (cur.entity_group ?? cur.entity) === (e.entity_group ?? e.entity)
    const adjacent   = (e.start ?? 0) - (cur.end ?? 0) <= 3
    if (sameLabel && adjacent) {
      cur.word  = (cur.word + e.word.replace(/^##/, " ")).trim()
      cur.end   = e.end
      cur.score = Math.max(cur.score, e.score)
    } else { merged.push(cur); cur = { ...e } }
  }
  if (cur) merged.push(cur)

  const symptoms: string[]      = []
  const medications: string[]   = []
  const diagnoses: string[]     = []
  const investigations: string[] = []

  for (const e of merged) {
    if (e.score < 0.55) continue
    const label = (e.entity_group ?? e.entity ?? "").toUpperCase()
    const word  = e.word.replace(/^##/, "").replace(/[^\w\s\-]/g, "").trim()
    if (!word || word.length < 3) continue
    // Skip pure numbers / fragments
    if (/^\d+$/.test(word)) continue
    if (["the","and","or","is","a","an","of","to","in","for","was","has","yes","no","not","any","some"].includes(word.toLowerCase())) continue

    if (/SIGN|SYMPTOM/.test(label))              symptoms.push(cap(word))
    else if (/DISEASE|DISORDER/.test(label))     diagnoses.push(cap(word))
    else if (/MEDICATION|DRUG|PHARMA/.test(label)) medications.push(cap(word))
    else if (/DIAGNOSTIC|LAB|PROCEDURE/.test(label) && !/^\d/.test(word)) investigations.push(cap(word))
  }

  return { symptoms: dedup(symptoms), medications: dedup(medications), diagnoses: dedup(diagnoses), investigations: dedup(investigations) }
}

/* ─────────────────────────────────────────
   STEP 2 — Groq LLM structuring
───────────────────────────────────────── */
async function extractWithGroq(
  transcript: string,
  nerHints: ReturnType<typeof mergeAndCleanNER>,
  patientName: string, patientAge: number, patientGender: string, department: string
): Promise<MedicalReport> {

  const hintsBlock = `
NER pre-extracted hints (use as guidance, verify against transcript):
- Symptoms found: ${nerHints.symptoms.join(", ") || "none detected"}
- Medications found: ${nerHints.medications.join(", ") || "none detected"}
- Diagnoses found: ${nerHints.diagnoses.join(", ") || "none detected"}
- Investigations found: ${nerHints.investigations.join(", ") || "none detected"}`

  const systemPrompt = `You are a precise clinical documentation assistant. Extract a structured SOAP medical report from a doctor-patient conversation.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences. Follow this exact structure:
{
  "chiefComplaint": "Patient's main complaint in one clear English sentence",
  "historyOfPresentIllness": "2-3 sentence summary of the illness history from patient statements, in English",
  "symptoms": ["Fever", "Headache", "Body ache"],
  "examFindings": "Any physical exam findings mentioned, or empty string",
  "diagnosis": "Doctor's stated diagnosis or most likely condition, or empty string",
  "treatment": ["Drink plenty of fluids", "Take adequate rest"],
  "medications": ["Paracetamol 650mg every 6 hours"],
  "investigations": ["CBC", "Dengue screening", "Malaria screening"],
  "followUp": "Follow-up instruction if mentioned, or empty string",
  "additionalNotes": "Any urgent warning signs or other important notes"
}

Rules:
- chiefComplaint and historyOfPresentIllness MUST be in English — translate from any other language
- symptoms: each symptom as a separate item, capitalised
- medications: include full name + dosage if mentioned, e.g. "Paracetamol 650mg every 6 hours"
- investigations: only actual tests ordered by the doctor
- treatment: care instructions (rest, fluids, diet) separate from medications
- followUp: when to return or follow up
- additionalNotes: warning signs, red flags, urgent instructions
- Empty string "" for missing text fields, [] for missing array fields
- Never hallucinate — only extract what is explicitly in the transcript`

  const userContent = `Patient: ${patientName}, Age: ${patientAge}, Gender: ${patientGender}, Department: ${department}

${hintsBlock}

Full consultation transcript:
${transcript}`

  const res = await fetch(GROQ_URL, {
    method:  "POST",
    headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model:       "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens:  1024,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userContent  },
      ],
    }),
  })

  if (!res.ok) throw new Error(`Groq API error: ${res.status} ${await res.text()}`)

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  const raw  = data.choices?.[0]?.message?.content?.trim() ?? ""

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
  return JSON.parse(cleaned) as MedicalReport
}

/* ─────────────────────────────────────────
   STEP 3 — Pure rule-based fallback
───────────────────────────────────────── */
function extractRuleBased(messages: Msg[]): MedicalReport {
  const patientLines = messages.filter(m => m.role === "patient").map(m => m.english ?? m.translated ?? m.text)
  const doctorLines  = messages.filter(m => m.role === "doctor").map(m => m.english ?? m.translated ?? m.text)
  const patientText  = patientLines.join(" ")
  const doctorText   = doctorLines.join(" ")
  const fullText     = patientText + " " + doctorText

  const SYMPTOM_KW = ["fever","headache","body ache","body pain","cough","sore throat","fatigue","weakness","nausea","vomiting","diarrhea","chills","breathlessness","rash","swelling","dizziness"]
  const symptoms = SYMPTOM_KW.filter(kw => new RegExp(`\\b${kw}\\b`, "i").test(fullText)).map(kw => cap(kw))

  const MED_KW = ["paracetamol","ibuprofen","amoxicillin","azithromycin","dolo","cetirizine","pantoprazole","omeprazole","aspirin"]
  const medications: string[] = []
  MED_KW.forEach(med => {
    const m = fullText.match(new RegExp(`\\b${med}[^.]{0,40}`, "i"))
    if (m) medications.push(m[0].trim())
  })

  const INV_KW = ["cbc","blood test","dengue","malaria","urine test","x-ray","ecg","ultrasound","complete blood count"]
  const investigations = INV_KW.filter(kw => new RegExp(`\\b${kw}\\b`, "i").test(doctorText)).map(kw => kw.toUpperCase())

  const dxMatch = doctorText.match(/(?:may be|likely|probably|it is|viral|bacterial|infection|fever|flu)\s*(?:a\s+)?([a-z][a-z\s]{3,30})/i)
  const diagnosis = dxMatch ? cap(dxMatch[0].trim()) : ""

  const fuMatch = doctorText.match(/(?:come back|return|follow.?up|review|after \d)[^.]+/i)

  return {
    chiefComplaint:          patientLines[0] ?? "",
    historyOfPresentIllness: patientLines.join(" "),
    symptoms:                dedup(symptoms),
    examFindings:            "",
    diagnosis,
    treatment:               [],
    medications:             dedup(medications),
    investigations:          dedup(investigations),
    followUp:                fuMatch?.[0]?.trim() ?? "",
    additionalNotes:         "",
  }
}

/* ─────────────────────────────────────────
   MAIN HANDLER
───────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const { messages, patientName, patientAge, patientGender, department } = await req.json()

    if (!messages?.length) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 })
    }

    const msgs: Msg[]    = messages
    const transcript     = buildEnglishTranscript(msgs)

    // Step 1 — NER hints (best-effort, won't block if it fails)
    const nerHints = mergeAndCleanNER(await runNER(transcript))
    console.log("[report] NER hints:", nerHints)

    // Step 2 — Groq structures the report using transcript + NER hints
    let report: MedicalReport
    let source = "groq+ner"

    try {
      report = await extractWithGroq(
        transcript, nerHints,
        patientName ?? "Unknown",
        patientAge  ?? 0,
        patientGender ?? "Not specified",
        department ?? "General"
      )
    } catch (groqErr) {
      console.error("[report] Groq failed, using rule-based fallback:", groqErr)
      report = extractRuleBased(msgs)
      source = "rule-based"
    }

    return NextResponse.json({ report, source })

  } catch (err) {
    console.error("[report] error:", err)
    return NextResponse.json({ error: "Report generation failed", detail: String(err) }, { status: 500 })
  }
}