# MediLingua AI

> **AI-powered multilingual OPD consultation platform for Indian hospitals.**
> Transcribes Hindi, Kannada and English simultaneously, generates structured medical reports via biomedical NER, and maintains complete patient visit history — all in under 5 minutes per consultation.
live demo : https://turbo-s-medilingua.vercel.app
---
**eg login : general@hospital.com**
**password : password123**
## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [System Architecture](#system-architecture)
5. [Patient Registration and Queue Flow](#patient-registration-and-queue-flow)
6. [Consultation Lifecycle](#consultation-lifecycle)
7. [Audio Transcription Pipeline](#audio-transcription-pipeline)
8. [NER Report Generation Pipeline](#ner-report-generation-pipeline)
9. [Role-Based Activity Flow](#role-based-activity-flow)
10. [Project Structure](#project-structure)
11. [API Reference](#api-reference)
12. [Database Schema](#database-schema)
13. [Getting Started](#getting-started)
14. [Environment Variables](#environment-variables)
15. [Deployment](#deployment)
16. [Limitations](#limitations)

---

## Overview

India's OPDs serve patients who speak dozens of regional languages, yet documentation is expected in English. This gap leads to miscommunication, diagnostic errors, and physician burnout from manual note-taking.

**MediLingua AI** bridges this gap by:

- Transcribing patient speech (Kannada / Hindi) and doctor speech (English) in real time using **Sarvam AI `saarika:v2.5`**
- Translating every utterance to all three languages simultaneously so both parties always have full context
- Extracting clinical entities from the transcript using **HuggingFace `d4data/biomedical-ner-all`**
- Generating a fully structured SOAP-style report in under 30 seconds
- Synthesising doctor responses back in the patient's native language via **Sarvam `bulbul:v2`** TTS
- Persisting every visit and report in a versioned history array — never overwritten

---

## Key Features

| Feature | Description |
|---|---|
| Live Multilingual Transcription | Real-time STT for Hindi, Kannada and English simultaneously with live preview bubbles |
| NER-Powered Report Generation | `d4data/biomedical-ner-all` extracts symptoms, diagnosis, medications, and investigations into a SOAP report |
| Text-to-Speech Playback | Per-message EN / HI / KN playback buttons via Sarvam `bulbul:v2` |
| Inline Correction | Edit any mistranscribed bubble — instant re-translation to all 3 languages |
| Patient History Sidebar | All past completed visits with full reports auto-load before the session begins |
| Complete and Export | One-click visit completion plus formatted PDF download |
| Role-Based Access | RECEPTION registers patients; DOCTOR sees only their department's queue |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router with Server Components |
| Language | TypeScript |
| Auth | NextAuth.js v4 — Credentials provider, JWT strategy |
| Database | PostgreSQL via Prisma ORM |
| STT | Sarvam AI `saarika:v2.5` |
| Translation | Sarvam AI `mayura:v1` |
| TTS | Sarvam AI `bulbul:v2` |
| NER | HuggingFace `d4data/biomedical-ner-all` |
| Password Hashing | bcrypt |
| PDF Export | Client-side HTML via `window.print()` |

---

## System Architecture

The following diagram shows the high-level architecture across the browser, Next.js server, database, and third-party AI services.

```mermaid
flowchart TD
    subgraph BROWSER["Browser - Client"]
        A1["Landing Page"]
        A2["Login Page"]
        A3["Reception Register"]
        A4["Doctor Dashboard"]
        A5["Consultation Form"]
        A6["Patient Panel"]
        A7["Doctor Panel"]
        A8["Transcript and Report Tabs"]
        A5 --> A6
        A5 --> A7
        A5 --> A8
    end

    subgraph SERVER["Next.js Server - API Routes"]
        B1["auth - NextAuth Credentials and JWT"]
        B2["patient - POST create"]
        B3["patient search - GET"]
        B4["patient history - GET"]
        B5["visit - POST create"]
        B6["consultation save - POST"]
        B7["consultation complete - POST"]
        B8["sarvam transcribe - STT plus translate"]
        B9["sarvam translate - single pair"]
        B10["sarvam tts - text to speech"]
        B11["sarvam report - NER pipeline"]
    end

    subgraph DATABASE["PostgreSQL via Prisma"]
        C1[("User\nrole and department")]
        C2[("Patient\nname age gender phone")]
        C3[("Visit\nstatus transcript\nreport and reports array")]
        C1 --- C3
        C2 --- C3
    end

    subgraph SARVAM["Sarvam AI"]
        D1["saarika v2.5\nSpeech to Text"]
        D2["mayura v1\nTranslation"]
        D3["bulbul v2\nText to Speech"]
    end

    subgraph HF["HuggingFace"]
        E1["d4data biomedical-ner-all\nClinical Entity Recognition"]
    end

    BROWSER -->|"fetch API calls"| SERVER
    SERVER -->|"Prisma ORM"| DATABASE
    B8 -->|"audio and language"| D1
    B8 -->|"text pairs"| D2
    B9 -->|"text pairs"| D2
    B10 -->|"text and language"| D3
    B11 -->|"EN transcript"| E1
```

---

## Patient Registration and Queue Flow

The following diagram shows how a patient enters the system through Reception and appears in the doctor's OPD queue.

```mermaid
flowchart TD
    A(["Reception Logs In"]) --> B{"Patient Type?"}
    B -->|"New Patient"| C["Fill Form\nname, age, gender, phone, department"]
    B -->|"Returning Patient"| D["Search by name or phone\nGET api/patient/search"]
    C --> E{"Validation"}
    E -->|"Errors found"| C
    E -->|"All valid"| F["POST api/patient\nCreates Patient and Visit atomically"]
    D --> G["Results returned\nmax 10 matches ordered by name"]
    G --> H["Reception selects patient from list"]
    H --> I["Select Department\nGeneral Medicine, Pediatrics,\nGynecology, Orthopedics, ENT"]
    I --> J["POST api/visit\nCreates new Visit for existing patient"]
    F --> K["Visit created\nstatus: WAITING"]
    J --> K
    K --> L["Doctor Dashboard loads queue\nGET visits WHERE dept equals doctor dept\nAND status is WAITING or IN_PROGRESS\nOrdered by createdAt ascending"]
    L --> M(["Patient visible in OPD Queue"])
```

---

## Consultation Lifecycle

The following diagram shows the full lifecycle of a consultation session from the doctor opening the page to visit completion.

```mermaid
flowchart TD
    A(["Doctor clicks Start Consultation"]) --> B["Server Component fetches\nVisit and Patient via Prisma"]
    B --> C["Fetch patientHistory\nAll COMPLETED past visits\nGET api/patient/id/history"]
    C --> D{"Returning patient?"}
    D -->|"Yes - has history"| E["History sidebar auto-opens\nPast diagnoses, medications,\nreports visible"]
    D -->|"No - first visit"| F["Empty history sidebar"]
    E --> G["Doctor clicks Start Session"]
    F --> G
    G --> H{"Input Method"}
    H -->|"Voice - Patient"| I["MediaRecorder starts\n1500ms chunk slices into chunkQueue"]
    H -->|"Voice - Doctor"| I
    H -->|"Typed message"| J["sendTyped called\ntranslateAll runs"]
    I --> K["Queue Processor loop\nBlob to base64\nPOST api/sarvam/transcribe"]
    K --> L["Sarvam saarika v2.5\nSTT in original language"]
    L --> M["Parallel translate x3\nPOST api/sarvam/translate\nEnglish, Hindi, Kannada"]
    M --> N["Accumulate in accTextRef\nUpdate live preview bubble"]
    N --> O{"Still recording?"}
    O -->|"Yes"| K
    O -->|"No - Stop tapped"| P["translateAll on full accumulated text\nCoherent 3-language final translation"]
    P --> Q["addMsg committed\nMessage bubble appears\nEN, HI, KN stored on object"]
    J --> Q
    Q --> R{"Action on bubble?"}
    R -->|"Play TTS"| S["POST api/sarvam/tts\nSarvam bulbul v2 returns base64\nAudio plays in browser"]
    R -->|"Edit transcription"| T["Inline textarea opens\nUser corrects text"]
    T --> U["saveEdit re-translates all 3 langs\nMessage updated atomically"]
    U --> Q
    R -->|"Continue recording"| H
    R -->|"End Session"| V["End Session clicked\nAuto-triggers Generate Report"]
    V --> W["POST api/sarvam/report\nNER Pipeline executes"]
    W --> X["MedicalReport JSON returned\nRenders as editable field cards"]
    X --> Y{"Report actions"}
    Y -->|"Edit fields"| Z["Inline edit per card\nreportEdits state updated"]
    Z --> Y
    Y -->|"Download PDF"| AA["Client-side HTML built\nwindow.print opens"]
    Y -->|"Save progress"| AB["POST api/consultation/id/save\nreports array appended\nstatus set to IN_PROGRESS"]
    Y -->|"Complete visit"| AC["POST api/consultation/id/save\nTHEN POST api/consultation/id/complete\nstatus COMPLETED\ncompletedAt set to now"]
    AC --> AD(["Visit closed\nRemoved from queue\nHistory updated for next visit"])
```

---

## Audio Transcription Pipeline

The following diagram shows the detailed audio chunking, queue processing, and translation pipeline inside the Consultation Form.

```mermaid
flowchart TD
    A(["User taps Record"]) --> B["getUserMedia\nRequest microphone permission"]
    B -->|"Denied"| C(["Alert: Microphone access denied"])
    B -->|"Granted"| D["isRecordingRef = true\naccTextRef cleared\nchunkQueue cleared\nstartQueueProcessor launched"]
    D --> E["scheduleSlice called"]
    E --> F["new MediaRecorder on stream\nmimeType webm+opus or webm or ogg+opus"]
    F --> G["recorder.start with 250ms timeslice"]
    G --> H["Collect ondataavailable blobs"]
    H --> I{"1500ms elapsed?"}
    I -->|"Yes"| J["recorder.stop triggered"]
    J --> K{"Blob size greater than 500 bytes?"}
    K -->|"Yes - has audio"| L["Push Blob to chunkQueue"]
    K -->|"No - silence"| M["Discard chunk"]
    L --> N{"Still recording?"}
    M --> N
    N -->|"Yes"| E
    N -->|"No"| O["Stop all stream tracks"]

    D --> P{"chunkQueue has item?"}
    P -->|"No"| Q["Wait 50ms and retry"]
    Q --> P
    P -->|"Yes"| R["Shift Blob from front of queue\nprocessingRef = true"]
    R --> S["Blob to ArrayBuffer to base64 string"]
    S --> T["POST api/sarvam/transcribe\nbody: audioBase64 and languageCode from langRef"]
    T --> U["Sarvam saarika v2.5\nReturns original transcript text"]
    U --> V{"originalText empty?"}
    V -->|"Yes - silence"| W["processingRef = false\ncontinue loop"]
    W --> P
    V -->|"No - speech found"| X["Append to accTextRef\nFull accumulated utterance grows"]
    X --> Y["translateAll on full accTextRef\nPOST api/sarvam/translate x3 parallel\nsource to EN, source to HI, source to KN"]
    Y --> Z["Update lastTranslRef\nsetLive preview bubble\ntext, english, hindi, kannada, language"]
    Z --> AA["processingRef = false"]
    AA --> P

    O --> BB["User tapped Stop\nisRecordingRef = false\nqueue drains"]
    BB --> CC["translateAll on final accTextRef\nEnsure complete coherent translations"]
    CC --> DD["addMsg called\nCommits message to messages state\nEN, HI, KN permanently stored"]
    DD --> EE["Live bubble cleared\naccTextRef reset"]
    EE --> FF(["Message bubble rendered in panel"])
```

---

## NER Report Generation Pipeline

The following diagram shows the full report generation pipeline from raw messages to structured MedicalReport JSON.

```mermaid
flowchart TD
    A(["POST api/sarvam/report"]) --> B["Extract messages array\npatientName, patientAge,\npatientGender, department"]
    B --> C["Separate patientLines and doctorLines\nUse english or translated or text field"]
    C --> D["Build fullTranscript string\nPatient: line\nDoctor: line format"]
    D --> E{"Transcript over 380 words?"}
    E -->|"Yes - long consultation"| F["Split into 380-word chunks\nTrack char offset per chunk"]
    E -->|"No"| G["Single chunk"]
    F --> H["POST each chunk to HuggingFace\nd4data biomedical-ner-all\naggregation_strategy: simple\nwait_for_model: true"]
    G --> H
    H --> I{"HTTP 200?"}
    I -->|"No - loading or error"| J["Log warning\nSkip chunk\nContinue with remaining chunks"]
    I -->|"Yes"| K["NEREntity array returned\nentity_group, word, score, start, end"]
    J --> L["Merge all chunk results\nAdjust char offsets by chunk position"]
    K --> L
    L --> M["Filter: score >= 0.50\nDiscard low-confidence entities"]
    M --> N{"Map entity_group label"}
    N -->|"Sign_symptom or Symptom"| O["symptoms bucket"]
    N -->|"Disease_disorder or Disease"| P["diagnosis bucket"]
    N -->|"Medication or Drug or Medicine"| Q["medications bucket"]
    N -->|"Therapeutic_procedure"| R["treatment bucket"]
    N -->|"Lab_value or Diagnostic_procedure"| S["investigations bucket"]
    N -->|"Body_part or Anatomy"| T["bodyParts bucket - internal"]
    N -->|"Dosage or Frequency or Duration"| U["dosage bucket - internal"]
    N -->|"Clinical_event"| V["additionalNotes bucket"]
    Q --> W["mergeMedications\nLook ahead 3 tokens for Dosage or Frequency\nMerge if within 30 chars in source text"]
    U --> W
    W --> X["dedup all buckets\nNormalise whitespace\nRemove case duplicates"]
    O --> X
    P --> X
    R --> X
    S --> X
    T --> Y["extractExamFindings\nBody part NER hits\nplus doctor lines with exam keywords"]
    C --> Z["extractChiefComplaint\nFirst patient utterance\nTrimmed to first sentence max 200 chars"]
    C --> AA["extractFollowUp\nRegex on doctor lines\ncome back in, follow-up in, review after"]
    X --> BB["Assemble MedicalReport\nEmpty buckets filled by rule-based fallbacks\nfallbackSymptoms, fallbackDiagnosis,\nfallbackMedications, fallbackInvestigations"]
    Y --> BB
    Z --> BB
    AA --> BB
    BB --> CC(["Return MedicalReport JSON\nsource: ner or rule-based\nentityCount: N"])
```

---

## Role-Based Activity Flow

The following diagram shows the complete activity flow for all user personas across the full patient journey.

```mermaid
flowchart TD
    START(["User visits the app"]) --> LOGIN["Login Page\nEmail and Password form"]
    LOGIN --> AUTH["POST api/auth/nextauth\nCredentials validated\nbcrypt.compare against hashed password"]
    AUTH -->|"Invalid credentials"| LOGIN
    AUTH -->|"Valid - JWT issued"| REDIR["GET /dashboard\nRole-based redirect"]
    REDIR -->|"role = RECEPTION"| RX["Reception Register Page"]
    REDIR -->|"role = DOCTOR"| DOC["Doctor Dashboard Page"]

    subgraph RECEPTION["Reception Flow"]
        RX --> TAB{"Tab selected"}
        TAB -->|"New Patient"| NP["Register form\nname, age, gender, phone, dept"]
        TAB -->|"Existing Patient"| EP["Search input\nDebounced 350ms"]
        NP --> NP_VAL{"Client validation"}
        NP_VAL -->|"name missing or age invalid\nor phone less than 10 digits"| NP
        NP_VAL -->|"All valid"| NP_API["POST api/patient\nPatient record created\nVisit record created\nstatus: WAITING"]
        EP --> EP_API["GET api/patient/search\nmin 2 chars required"]
        EP_API --> EP_RES["Patient list rendered\nmax 10 results"]
        EP_RES --> EP_SEL["Select patient\nChoose department"]
        EP_SEL --> EP_BOOK["POST api/visit\nNew Visit created\nstatus: WAITING"]
        NP_API --> SUCCESS["Success toast shown\nQueue updated"]
        EP_BOOK --> SUCCESS
    end

    subgraph DOCTOR["Doctor Flow"]
        DOC --> DEPT_CHECK{"Department assigned\nto this doctor?"}
        DEPT_CHECK -->|"No"| NODEPT["Warning screen shown\nContact administrator"]
        DEPT_CHECK -->|"Yes"| QUEUE["Load patient queue\nWAITING and IN_PROGRESS only\nOrdered by arrival time"]
        QUEUE -->|"Zero patients"| EMPTY["All clear empty state shown"]
        QUEUE -->|"Patients waiting"| LIST["Visit rows rendered\nname, age, gender, phone,\nqueue position"]
        LIST --> START_CONSULT["Click Start Consultation\nNavigate to consultation page"]
    end

    subgraph CONSULTATION["Consultation Flow"]
        START_CONSULT --> LOAD["Server Component loads\nVisit and Patient from DB\npatientHistory COMPLETED visits"]
        LOAD --> RENDER["ConsultationForm renders\nDual panels, History sidebar,\nBottom tabs"]
        RENDER --> SESSION["Doctor clicks Start Session\nsessionActive = true\ntimer starts"]
        SESSION --> RLOOP{"Recording loop active"}
        RLOOP -->|"Patient voice"| PSTT["Patient audio chunks to STT\nPOST api/sarvam/transcribe\nLive bubble updates"]
        RLOOP -->|"Doctor voice"| DSTT["Doctor audio chunks to STT\nPOST api/sarvam/transcribe\nLive bubble updates"]
        RLOOP -->|"Patient types"| PTYPE["sendTyped\ntranslateAll called"]
        RLOOP -->|"Doctor types"| DTYPE["sendTyped\ntranslateAll called"]
        PSTT --> MSG["Message bubble committed\nEN, HI, KN stored on object"]
        DSTT --> MSG
        PTYPE --> MSG
        DTYPE --> MSG
        MSG --> ACTIONS{"Bubble action?"}
        ACTIONS -->|"Play in EN or HI or KN"| TTS_PLAY["POST api/sarvam/tts\nbulbul v2 returns base64\nAudio plays in browser"]
        ACTIONS -->|"Edit transcription"| EDIT["Inline textarea appears\nUser corrects text\nsaveEdit re-translates all 3 langs"]
        ACTIONS -->|"Continue"| RLOOP
        ACTIONS -->|"End session"| END_SESSION["End Session clicked\nAuto-generates report"]
        END_SESSION --> GEN["POST api/sarvam/report\nNER pipeline executes"]
        GEN --> REPORT_UI["Report tab active\nEditable field cards rendered"]
        REPORT_UI --> RACTION{"Report action?"}
        RACTION -->|"Edit any field"| EDIT_REPORT["reportEdits state updated\nAll fields independently editable"]
        EDIT_REPORT --> RACTION
        RACTION -->|"Save progress"| SAVE["POST api/consultation/id/save\nreports array appended\nstatus set to IN_PROGRESS"]
        RACTION -->|"Download PDF"| PDF["HTML document generated client-side\nwindow.print opens print dialog"]
        RACTION -->|"Complete visit"| COMP["POST api/consultation/id/save\nTHEN POST api/consultation/id/complete\nstatus set to COMPLETED\ncompletedAt set to now"]
        COMP --> DONE(["Visit closed\nRemoved from active queue\nAppears in history for all future\nvisits of same patient"])
    end
```

---

## Project Structure

```
medilingua-ai/
├── app/
│   ├── page.tsx                              # Public landing page
│   ├── layout.tsx                            # Root layout — Geist fonts, metadata
│   ├── globals.css                           # Tailwind import + CSS variables
│   │
│   ├── login/
│   │   └── page.tsx                          # Login form — NextAuth signIn()
│   │
│   ├── dashboard/
│   │   └── page.tsx                          # Role-based redirect hub (SSR)
│   │
│   ├── doctor/
│   │   └── dashboard/
│   │       └── page.tsx                      # Doctor queue — dept-filtered SSR
│   │
│   ├── reception/
│   │   └── register/
│   │       └── page.tsx                      # New + existing patient registration
│   │
│   ├── consultation/
│   │   └── [visitId]/
│   │       ├── page.tsx                      # Server component: visit + history load
│   │       └── Consultationform.tsx          # Full consultation UI — all logic here
│   │
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/
│       │       └── route.ts                  # NextAuth credentials + JWT callbacks
│       │
│       ├── patient/
│       │   ├── route.ts                      # POST: create patient + initial visit
│       │   ├── search/
│       │   │   └── route.ts                  # GET: search by name or phone (max 10)
│       │   └── [patientId]/
│       │       └── history/
│       │           └── route.ts              # GET: all COMPLETED visits + reports[]
│       │
│       ├── visit/
│       │   └── route.ts                      # POST: new visit for existing patient
│       │
│       ├── consultation/
│       │   └── [visitId]/
│       │       ├── save/
│       │       │   └── route.ts              # POST: transcript + append to reports[]
│       │       └── complete/
│       │           └── route.ts              # POST: status COMPLETED + completedAt
│       │
│       └── sarvam/
│           ├── transcribe/
│           │   └── route.ts                  # STT via saarika:v2.5 → EN + HI + KN
│           ├── translate/
│           │   └── route.ts                  # Single-pair translation via mayura:v1
│           ├── tts/
│           │   └── route.ts                  # TTS via bulbul:v2 → base64 audio
│           └── report/
│               └── route.ts                  # NER pipeline → MedicalReport JSON
│
├── lib/
│   └── prisma.ts                             # Prisma singleton (dev hot-reload safe)
│
├── prisma/
│   ├── schema.prisma                         # User · Patient · Visit data model
│   └── seed.ts                               # Sample patients + visits seeder
│
├── types/
│   └── next-auth.d.ts                        # Session · User · JWT type augmentation
│
├── next.config.ts
├── next-env.d.ts
└── package.json
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/[...nextauth]` | Credential login — issues JWT session cookie |
| GET | `/api/auth/[...nextauth]` | Session fetch and OAuth callback handler |

### Patient Management

| Method | Endpoint | Body / Params | Description |
|---|---|---|---|
| POST | `/api/patient` | `{ name, age, gender, phone, department }` | Create patient + initial visit atomically |
| GET | `/api/patient/search?q=` | `q` — min 2 characters | Search patients by name or phone — max 10 results |
| GET | `/api/patient/[patientId]/history` | — | All COMPLETED visits with full `reports[]` array |

### Visit Management

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/visit` | `{ patientId, department }` | Create new visit for an existing patient |

### Consultation

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/api/consultation/[visitId]/save` | `{ messages, report, language }` | Save transcript and append report to `reports[]` |
| POST | `/api/consultation/[visitId]/complete` | — | Set `status: COMPLETED` and set `completedAt` |

### Sarvam AI Integrations

| Method | Endpoint | Body | Response |
|---|---|---|---|
| POST | `/api/sarvam/transcribe` | `{ audioBase64, languageCode }` | `{ original, hindi, english, kannada, languageCode }` |
| POST | `/api/sarvam/translate` | `{ text, sourceLanguage, targetLanguage }` | `{ translatedText }` |
| POST | `/api/sarvam/tts` | `{ text, targetLanguage }` | `{ audioBase64, targetLanguage }` |
| POST | `/api/sarvam/report` | `{ messages, patientName, patientAge, patientGender, department }` | `{ report: MedicalReport, source, entityCount }` |

### MedicalReport JSON Schema

```typescript
interface MedicalReport {
  chiefComplaint:           string     // First patient utterance, max 200 chars
  historyOfPresentIllness:  string     // All patient lines joined, max 600 chars
  symptoms:                 string[]   // NER Sign_symptom entities
  examFindings:             string     // Body_part NER + doctor exam-keyword lines
  diagnosis:                string     // NER Disease_disorder entities joined by semicolon
  treatment:                string[]   // NER Therapeutic_procedure entities
  medications:              string[]   // NER Medication + merged Dosage/Frequency tokens
  investigations:           string[]   // NER Lab_value + Diagnostic_procedure entities
  followUp:                 string     // Regex extraction from doctor lines
  additionalNotes:          string     // NER Clinical_event + dept/patient summary
}
```

---

## Database Schema

```mermaid
erDiagram
    User {
        String id PK
        String name
        String email
        String password
        String role
        String department
        DateTime createdAt
    }

    Patient {
        String id PK
        String name
        Int age
        String gender
        String phone
        DateTime createdAt
    }

    Visit {
        String id PK
        String patientId FK
        String department
        String status
        String transcript
        String language
        Json messages
        Json report
        Json reports
        DateTime createdAt
        DateTime completedAt
    }

    Patient ||--o{ Visit : "has many"
```

**Enums:**

| Enum | Values |
|---|---|
| `Role` | `RECEPTION` · `DOCTOR` |
| `Department` | `GENERAL_MEDICINE` · `PEDIATRICS` · `GYNECOLOGY` · `ORTHOPEDICS` · `ENT` |
| `Status` | `WAITING` · `IN_PROGRESS` · `COMPLETED` |

---

