"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

/* ── Animated counter hook ── */
function useCounter(target: number, duration = 2000, start = false) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setValue(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return value
}

/* ── Spotlight card ── */
function SpotlightCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0, visible: false })

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: 32,
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.3s, transform 0.3s, box-shadow 0.3s",
        cursor: "default",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = "var(--border-hover)"
        el.style.transform = "translateY(-6px)"
        el.style.boxShadow = "0 24px 60px rgba(0,0,0,0.5)"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = "var(--border)"
        el.style.transform = "translateY(0)"
        el.style.boxShadow = "none"
      }}
    >
      {pos.visible && (
        <div style={{
          position: "absolute",
          top: pos.y - 120,
          left: pos.x - 120,
          width: 240, height: 240,
          background: "radial-gradient(circle, rgba(56,189,248,0.13) 0%, transparent 70%)",
          pointerEvents: "none",
          borderRadius: "50%",
        }} />
      )}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.45), transparent)",
        opacity: pos.visible ? 1 : 0, transition: "opacity 0.3s",
      }} />
      <div style={{
        width: 48, height: 48,
        background: "var(--accent-dim)",
        border: "1px solid var(--border-hover)",
        borderRadius: 12,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, marginBottom: 20,
      }}>{icon}</div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>{desc}</div>
    </div>
  )
}

/* ── Typewriter ── */
function Typewriter({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0)
  const [displayed, setDisplayed] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const word = words[index]
    let timeout: ReturnType<typeof setTimeout>
    if (!deleting && displayed.length < word.length) {
      timeout = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 80)
    } else if (!deleting && displayed.length === word.length) {
      timeout = setTimeout(() => setDeleting(true), 2000)
    } else if (deleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 45)
    } else {
      setDeleting(false)
      setIndex((index + 1) % words.length)
    }
    return () => clearTimeout(timeout)
  }, [displayed, deleting, index, words])

  return (
    <span style={{ color: "var(--accent)", borderRight: "3px solid var(--accent)", paddingRight: 3 }}>
      {displayed}
    </span>
  )
}

/* ── Particle canvas ── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    let W = canvas.width = canvas.offsetWidth
    let H = canvas.height = canvas.offsetHeight
    const N = 55
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
    }))
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (let i = 0; i < N; i++) {
        const p = particles[i]
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > W) p.vx *= -1
        if (p.y < 0 || p.y > H) p.vy *= -1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(56,189,248,0.55)"
        ctx.fill()
        for (let j = i + 1; j < N; j++) {
          const q = particles[j]
          const dx = p.x - q.x, dy = p.y - q.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 130) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.strokeStyle = `rgba(56,189,248,${0.18 * (1 - d / 130)})`
            ctx.lineWidth = 0.6
            ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight }
    window.addEventListener("resize", resize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.55, pointerEvents: "none" }} />
}

/* ── Stats with counter animation ── */
function StatsRow() {
  const ref = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true) }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  const accuracy = useCounter(95, 1800, started)
  const speed = useCounter(30, 1500, started)
  return (
    <div ref={ref} style={{
      display: "flex", justifyContent: "center", gap: 52,
      marginTop: 64, paddingTop: 48,
      borderTop: "1px solid var(--border)",
      flexWrap: "wrap",
      animation: "fadeIn 1s 0.6s ease both", opacity: 0, animationFillMode: "both",
    }}>
      {[
        { val: "3", label: "Languages Supported" },
        { val: `~${accuracy}%`, label: "Transcription Accuracy" },
        { val: `<${speed}s`, label: "Report Generation" },
        { val: "24/7", label: "Availability" },
      ].map(s => (
        <div key={s.label} style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 30, fontWeight: 700, color: "var(--text-primary)" }}>{s.val}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5, textTransform: "uppercase", letterSpacing: "0.09em" }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

/* ══════════════ MAIN PAGE ══════════════ */
export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#080c14",
      color: "#e8edf5",
      fontFamily: "'DM Sans','Segoe UI',sans-serif",
      overflowX: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg-primary: #080c14;
          --bg-secondary: #0d1321;
          --bg-card: #111827;
          --bg-card-hover: #161f30;
          --border: rgba(56,189,248,0.12);
          --border-hover: rgba(56,189,248,0.35);
          --accent: #38bdf8;
          --accent-dim: rgba(56,189,248,0.1);
          --accent-glow: rgba(56,189,248,0.28);
          --text-primary: #e8edf5;
          --text-secondary: #8b9ab5;
          --text-muted: #4a5568;
          --success: #34d399;
        }

        body::after {
          content: '';
          position: fixed; inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.035) 2px, rgba(0,0,0,0.035) 4px);
          pointer-events: none; z-index: 9999;
        }

        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes float { 0%,100% { transform:translateY(0) rotate(0deg); } 33% { transform:translateY(-14px) rotate(1deg); } 66% { transform:translateY(-6px) rotate(-1deg); } }
        @keyframes orbPulse { 0%,100% { opacity:0.6; transform:scale(1) translateX(-50%); } 50% { opacity:1; transform:scale(1.12) translateX(-44%); } }
        @keyframes shimmer { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
        @keyframes borderGlow { 0%,100% { box-shadow:0 0 0 0 transparent; } 50% { box-shadow:0 0 0 3px rgba(56,189,248,0.2); } }
        @keyframes pulseDot { 0%,100% { box-shadow:0 0 4px var(--success); } 50% { box-shadow:0 0 14px var(--success), 0 0 24px rgba(52,211,153,0.35); } }

        .nav-link {
          background: linear-gradient(135deg,#38bdf8,#0ea5e9);
          color: #080c14; padding:10px 22px; border-radius:8px;
          text-decoration:none; font-weight:700; font-size:14px;
          transition:all 0.25s; display:inline-block;
          position:relative; overflow:hidden;
        }
        .nav-link::before {
          content:''; position:absolute; top:-100%; left:-60%; width:40%; height:300%;
          background:rgba(255,255,255,0.22); transform:skewX(-20deg); transition:left 0.4s;
        }
        .nav-link:hover::before { left:130%; }
        .nav-link:hover { box-shadow:0 0 22px var(--accent-glow), 0 0 60px rgba(56,189,248,0.12); transform:translateY(-1px); }

        .hero-badge {
          display:inline-flex; align-items:center; gap:8px;
          background:var(--accent-dim); border:1px solid var(--border-hover);
          border-radius:100px; padding:7px 18px; font-size:13px; font-weight:500; color:var(--accent);
          margin-bottom:28px;
          animation:fadeSlideUp 0.6s ease both, borderGlow 3s 1s infinite;
        }
        .badge-dot {
          width:7px; height:7px; background:var(--success); border-radius:50%;
          animation:pulseDot 2s infinite;
        }

        .shimmer-text {
          background:linear-gradient(90deg,#38bdf8 0%,#7dd3fc 30%,#bae6fd 50%,#7dd3fc 70%,#38bdf8 100%);
          background-size:200% auto;
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          background-clip:text;
          animation:shimmer 3s linear infinite;
        }

        .hero-cta {
          display:inline-flex; align-items:center; gap:10px;
          background:linear-gradient(135deg,#38bdf8,#0ea5e9);
          color:#080c14; padding:14px 32px; border-radius:10px;
          text-decoration:none; font-weight:700; font-size:15px;
          transition:all 0.25s; position:relative; overflow:hidden;
          animation:fadeSlideUp 0.7s 0.3s ease both;
        }
        .hero-cta::before {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,0.15),transparent);
          opacity:0; transition:opacity 0.25s;
        }
        .hero-cta:hover::before { opacity:1; }
        .hero-cta:hover { transform:translateY(-3px); box-shadow:0 16px 44px var(--accent-glow), 0 0 0 1px rgba(56,189,248,0.3); }
        .arrow { transition:transform 0.2s; display:inline-block; }
        .hero-cta:hover .arrow { transform:translateX(5px); }

        .ghost-btn {
          display:inline-flex; align-items:center; gap:8px;
          background:transparent; color:var(--text-secondary);
          padding:14px 28px; border-radius:10px;
          text-decoration:none; font-weight:500; font-size:15px;
          border:1px solid var(--border); transition:all 0.25s;
        }
        .ghost-btn:hover { border-color:var(--border-hover); color:var(--text-primary); background:var(--accent-dim); }

        .lang-pill {
          display:inline-flex; align-items:center; gap:6px;
          background:var(--bg-card); border:1px solid var(--border);
          border-radius:100px; padding:6px 14px; font-size:13px; color:var(--text-secondary);
          transition:all 0.2s;
        }
        .lang-pill:hover { border-color:var(--border-hover); color:var(--text-primary); }
        .lang-dot { width:6px; height:6px; background:var(--success); border-radius:50%; box-shadow:0 0 6px var(--success); }

        .section-tag { display:inline-block; font-size:11px; font-weight:600; letter-spacing:0.15em; text-transform:uppercase; color:var(--accent); margin-bottom:16px; }
        .section-title { font-family:'Syne',sans-serif; font-size:clamp(26px,3.5vw,38px); font-weight:700; letter-spacing:-0.02em; color:var(--text-primary); margin-bottom:12px; }

        .grid-bg {
          background-image: linear-gradient(rgba(56,189,248,0.04) 1px,transparent 1px), linear-gradient(90deg,rgba(56,189,248,0.04) 1px,transparent 1px);
          background-size:48px 48px;
        }

        .feature-float { animation:float 6s ease-in-out infinite; }
        .feature-float:nth-child(2) { animation-delay:-2s; }
        .feature-float:nth-child(3) { animation-delay:-4s; }

        .features-section { position:relative; }
        .features-section::before {
          content:''; position:absolute; top:0; left:50%; transform:translateX(-50%);
          width:600px; height:1px;
          background:linear-gradient(90deg,transparent,var(--accent),transparent);
          animation:shimmer 4s linear infinite;
        }

        .step-card {
          background:var(--bg-card); border:1px solid var(--border);
          border-radius:16px; padding:32px 24px; text-align:center;
          transition:all 0.3s;
        }
        .step-card:hover { border-color:var(--border-hover); transform:translateY(-5px); box-shadow:0 20px 52px rgba(0,0,0,0.45); }
        .step-num {
          width:56px; height:56px;
          background:var(--accent-dim); border:2px solid var(--accent);
          border-radius:50%; display:flex; align-items:center; justify-content:center;
          font-family:'Syne',sans-serif; font-size:18px; font-weight:700; color:var(--accent);
          margin:0 auto 20px;
          box-shadow:0 0 22px var(--accent-glow);
        }
        .steps-wrap { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:24px; position:relative; }
        .steps-wrap::before {
          content:''; position:absolute; top:56px; left:10%; right:10%; height:2px;
          background:linear-gradient(90deg,transparent,var(--border-hover) 20%,var(--accent) 50%,var(--border-hover) 80%,transparent);
          background-size:200% 100%;
          animation:shimmer 3s linear infinite;
        }

        .cta-wrap {
          background:linear-gradient(135deg,rgba(56,189,248,0.08),rgba(14,165,233,0.04));
          border:1px solid var(--border-hover);
          border-radius:24px; padding:64px 48px;
          position:relative; overflow:hidden;
        }
        .cta-wrap::before {
          content:''; position:absolute; top:-50%; right:-5%;
          width:360px; height:360px;
          background:radial-gradient(circle,rgba(56,189,248,0.09),transparent 70%);
          border-radius:50%; pointer-events:none;
          animation:float 9s ease-in-out infinite;
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"20px 48px",
        background:"rgba(8,12,20,0.9)", backdropFilter:"blur(24px)",
        borderBottom:"1px solid var(--border)",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width:34, height:34,
            background:"linear-gradient(135deg,#38bdf8,#0ea5e9)",
            borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:16, boxShadow:"0 0 18px rgba(56,189,248,0.4)",
          }}>⚕</div>
          <span style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>
            MediLingua <span style={{ color:"var(--accent)" }}>AI</span>
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:32 }}>
          {["Features","Workflow","About"].map(item => (
            <span key={item}
              style={{ fontSize:14, color:"var(--text-secondary)", cursor:"pointer", transition:"color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color="var(--text-primary)")}
              onMouseLeave={e => (e.currentTarget.style.color="var(--text-secondary)")}
            >{item}</span>
          ))}
          <Link href="/login" className="nav-link">Login</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="grid-bg" style={{
        position:"relative", textAlign:"center",
        padding:"110px 24px 90px", overflow:"hidden",
        minHeight:"92vh", display:"flex", flexDirection:"column", justifyContent:"center",
      }}>
        <ParticleCanvas />

        {/* Orbs */}
        <div style={{ position:"absolute", width:640, height:640, background:"radial-gradient(circle,rgba(56,189,248,0.09) 0%,transparent 65%)", top:-120, left:"50%", borderRadius:"50%", pointerEvents:"none", animation:"orbPulse 7s ease-in-out infinite", transformOrigin:"center" }} />
        <div style={{ position:"absolute", width:340, height:340, background:"radial-gradient(circle,rgba(14,165,233,0.07) 0%,transparent 70%)", bottom:40, right:"8%", borderRadius:"50%", pointerEvents:"none", animation:"float 10s ease-in-out infinite" }} />
        <div style={{ position:"absolute", width:190, height:190, background:"radial-gradient(circle,rgba(52,211,153,0.06) 0%,transparent 70%)", bottom:80, left:"6%", borderRadius:"50%", pointerEvents:"none", animation:"float 8s 2s ease-in-out infinite" }} />

        <div style={{ position:"relative", zIndex:1 }}>
          <div className="hero-badge">
            <span className="badge-dot" />
            System Operational — OPD Ready
          </div>

          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize:"clamp(36px,6vw,68px)", fontWeight:800, lineHeight:1.06, letterSpacing:"-0.03em", color:"var(--text-primary)", animation:"fadeSlideUp 0.7s 0.1s ease both" }}>
            AI-Powered Medical<br />
            <span className="shimmer-text">Documentation</span> Platform
          </h1>

          <p style={{ fontSize:17, lineHeight:1.75, color:"var(--text-secondary)", maxWidth:560, margin:"24px auto 0", fontWeight:300, animation:"fadeSlideUp 0.7s 0.2s ease both" }}>
            Transcribe consultations in{" "}
            <Typewriter words={["Hindi", "Kannada", "English"]} />{" "}
            and auto-generate structured medical reports for high-volume OPDs.
          </p>

          <div style={{ marginTop:44, display:"flex", justifyContent:"center", gap:16, flexWrap:"wrap" }}>
            <Link href="/login" className="hero-cta">Get Started <span className="arrow">→</span></Link>
            <a href="#features" className="ghost-btn">▶ View Demo</a>
          </div>

          <div style={{ display:"flex", justifyContent:"center", gap:10, marginTop:40, flexWrap:"wrap", animation:"fadeIn 1s 0.5s ease both", opacity:0, animationFillMode:"both" }}>
            {["🇮🇳 Hindi","🇮🇳 Kannada","🇬🇧 English"].map(lang => (
              <span key={lang} className="lang-pill"><span className="lang-dot" />{lang}</span>
            ))}
          </div>

          <StatsRow />
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="features-section" style={{ padding:"96px 40px", background:"var(--bg-secondary)", borderTop:"1px solid var(--border)", borderBottom:"1px solid var(--border)" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:64 }}>
            <span className="section-tag">Core Features</span>
            <h2 className="section-title">Everything a busy OPD needs</h2>
            <p style={{ color:"var(--text-secondary)", fontSize:16, maxWidth:500, margin:"0 auto" }}>From consultation to report in seconds — zero manual entry.</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:20 }}>
            {[
              { icon:"🎙", title:"Multilingual Speech Recognition", desc:"Real-time transcription of Hindi, Kannada, and English with medical vocabulary awareness and adaptive noise filtering." },
              { icon:"📋", title:"AI-Generated Medical Reports", desc:"Converts raw consultation audio into SOAP-format reports — symptoms, diagnosis, prescriptions, all structured in under 30 seconds." },
              { icon:"🗂", title:"Patient History Tracking", desc:"Complete longitudinal OPD records per patient, enabling faster differential diagnoses and better continuity of care." },
            ].map((f, i) => (
              <div key={f.title} className="feature-float" style={{ animationDelay:`${i * -2}s` }}>
                <SpotlightCard {...f} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ padding:"96px 40px", background:"var(--bg-primary)" }}>
        <div style={{ maxWidth:1060, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:64 }}>
            <span className="section-tag">Workflow</span>
            <h2 className="section-title">From patient entry to report</h2>
          </div>
          <div className="steps-wrap">
            {[
              { n:"01", title:"Register Patient", desc:"Reception registers the patient and assigns them to the relevant department." },
              { n:"02", title:"Doctor Consultation", desc:"Doctor begins consultation; conversation is captured in real-time audio." },
              { n:"03", title:"AI Transcription", desc:"Speech is processed and converted into structured medical text automatically." },
              { n:"04", title:"Report Generated", desc:"A structured report is finalized, saved, and instantly accessible." },
            ].map(step => (
              <div key={step.n} className="step-card">
                <div className="step-num">{step.n}</div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:600, color:"var(--text-primary)", marginBottom:8 }}>{step.title}</div>
                <div style={{ fontSize:14, color:"var(--text-secondary)", lineHeight:1.6 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding:"0 40px 80px", maxWidth:1160, margin:"0 auto" }}>
        <div className="cta-wrap" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:32 }}>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:30, fontWeight:700, color:"var(--text-primary)", marginBottom:10 }}>Ready to digitise your OPD?</div>
            <p style={{ color:"var(--text-secondary)", fontSize:15 }}>Set up takes under 5 minutes. No hardware required.</p>
          </div>
          <Link href="/login" className="hero-cta" style={{ flexShrink:0 }}>Start Now <span className="arrow">→</span></Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop:"1px solid var(--border)", padding:"32px 48px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:26, height:26, background:"linear-gradient(135deg,#38bdf8,#0ea5e9)", borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, boxShadow:"0 0 10px rgba(56,189,248,0.35)" }}>⚕</div>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15, color:"var(--text-primary)" }}>MediLingua <span style={{ color:"var(--accent)" }}>AI</span></span>
        </div>
        <p style={{ color:"var(--text-muted)", fontSize:13 }}>© 2026 MediLingua AI — Hackathon Project</p>
        <div style={{ display:"flex", gap:24 }}>
          {["Privacy","Terms","Contact"].map(l => (
            <span key={l} style={{ fontSize:13, color:"var(--text-muted)", cursor:"pointer", transition:"color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color="var(--text-secondary)")}
              onMouseLeave={e => (e.currentTarget.style.color="var(--text-muted)")}
            >{l}</span>
          ))}
        </div>
      </footer>
    </main>
  )
}