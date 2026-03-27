// app/api/report/explain/route.ts
import { NextRequest, NextResponse } from "next/server"

interface MedicalReport {
  chiefComplaint?:  string
  diagnosis?:       string
  symptoms?:        string[]
  medications?:     string[]
  treatment?:       string[]
  investigations?:  string[]
  followUp?:        string
  additionalNotes?: string
  [key: string]:    unknown
}

function arr(v: unknown): string {
  if (Array.isArray(v)) return (v as string[]).filter(Boolean).join(", ")
  return String(v ?? "")
}

export async function POST(req: NextRequest) {
  try {
    // Read env vars inside handler (not at module level)
    const GROQ_KEY   = process.env.GROQ_API_KEY   ?? ""
    const SARVAM_KEY = process.env.SARVAM_API_KEY  ?? ""

    if (!GROQ_KEY)   return NextResponse.json({ error: "GROQ_API_KEY not configured" },   { status: 500 })
    if (!SARVAM_KEY) return NextResponse.json({ error: "SARVAM_API_KEY not configured" }, { status: 500 })

    const { report, patientName, patientAge, targetLanguage } = await req.json() as {
      report:         MedicalReport
      patientName:    string
      patientAge:     number
      targetLanguage: string
    }

    if (!report)         return NextResponse.json({ error: "No report"         }, { status: 400 })
    if (!targetLanguage) return NextResponse.json({ error: "No targetLanguage" }, { status: 400 })

    // ── Step 1: Groq → plain English summary ──
    const reportText = [
      `Diagnosis: ${report.diagnosis || "Not confirmed"}`,
      `Symptoms: ${arr(report.symptoms) || "None"}`,
      `Medications: ${arr(report.medications) || "None"}`,
      `Treatment: ${arr(report.treatment) || "None"}`,
      `Investigations: ${arr(report.investigations) || "None ordered"}`,
      `Follow-up: ${report.followUp || "As needed"}`,
      `Notes: ${report.additionalNotes || "None"}`,
    ].join("\n")

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model:       "llama-3.1-8b-instant",
        temperature: 0.2,
        max_tokens:  300,
        messages: [
          {
            role: "system",
            content: `You are a doctor explaining a diagnosis to a patient in very simple language.
Write exactly 4 short sentences in plain English. No jargon. No lists. No bullet points.
1: What condition the patient has.
2: What medicine to take and when.
3: What to do at home.
4: When to come back or get emergency help.
Each sentence under 20 words. Output ONLY the 4 sentences, nothing else.`,
          },
          {
            role:    "user",
            content: `Patient: ${patientName ?? "the patient"}, Age: ${patientAge ?? ""}\n\n${reportText}`,
          },
        ],
      }),
    })

    if (!groqRes.ok) {
      const e = await groqRes.text()
      return NextResponse.json({ error: `Groq failed: ${groqRes.status}`, detail: e }, { status: 502 })
    }

    const groqData = await groqRes.json() as { choices?: Array<{ message?: { content?: string } }> }
    const englishSummary = (groqData.choices?.[0]?.message?.content ?? "").trim()

    if (!englishSummary) {
      return NextResponse.json({ error: "Groq returned empty response" }, { status: 502 })
    }

    // ── Step 2: Sarvam translate ──
    let translatedSummary = englishSummary
    if (targetLanguage !== "en-IN") {
      const tRes = await fetch("https://api.sarvam.ai/translate", {
        method:  "POST",
        headers: { "api-subscription-key": SARVAM_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          input:                englishSummary,
          source_language_code: "en-IN",
          target_language_code: targetLanguage,
          speaker_gender:       "Female",
          mode:                 "formal",
          model:                "mayura:v1",
          enable_preprocessing: true,
        }),
      })
      if (tRes.ok) {
        const tData = await tRes.json() as { translated_text?: string }
        translatedSummary = tData.translated_text?.trim() || englishSummary
      }
      // if translate fails, fall back to English — don't block TTS
    }

    // ── Step 3: Sarvam TTS ──
    const ttsRes = await fetch("https://api.sarvam.ai/text-to-speech", {
      method:  "POST",
      headers: { "api-subscription-key": SARVAM_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs:               [translatedSummary],
        target_language_code: targetLanguage,
        speaker:              "anushka",
        pitch:                0,
        pace:                 0.9,
        loudness:             1.5,
        speech_sample_rate:   22050,
        enable_preprocessing: true,
        model:                "bulbul:v2",
      }),
    })

    if (!ttsRes.ok) {
      const e = await ttsRes.text()
      return NextResponse.json({ error: `Sarvam TTS failed: ${ttsRes.status}`, detail: e }, { status: 502 })
    }

    const ttsData = await ttsRes.json() as { audios?: string[]; audio?: string }
    const audioBase64 = ttsData.audios?.[0] ?? ttsData.audio ?? ""

    if (!audioBase64) {
      return NextResponse.json({ error: "Sarvam TTS returned no audio" }, { status: 502 })
    }

    return NextResponse.json({ englishSummary, translatedSummary, audioBase64, targetLanguage })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[explain]", msg)
    return NextResponse.json({ error: "Explanation failed", detail: msg }, { status: 500 })
  }
}