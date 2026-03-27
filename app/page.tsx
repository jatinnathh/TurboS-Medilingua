"use client"
import Link from "next/link"
import { useEffect, useRef, useState, useCallback } from "react"

/* ══════════ SCANNER LINE ══════════ */
function ScanLine() {
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, height: 1, zIndex: 4,
      background: "linear-gradient(90deg, transparent 0%, rgba(56,189,248,0) 10%, rgba(56,189,248,0.7) 40%, rgba(56,189,248,1) 50%, rgba(56,189,248,0.7) 60%, rgba(56,189,248,0) 90%, transparent 100%)",
      animation: "scan 4s ease-in-out infinite",
      boxShadow: "0 0 18px 4px rgba(56,189,248,0.35)",
      pointerEvents: "none",
    }} />
  )
}

/* ══════════ VITAL MONITOR ══════════ */
function VitalMonitor({ label, value, unit, status }: { label: string; value: string; unit: string; status: "ok" | "warn" }) {
  const [blink, setBlink] = useState(true)
  useEffect(() => {
    const t = setInterval(() => setBlink(b => !b), 900)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{
      border: "1px solid rgba(56,189,248,0.15)", borderRadius: 4, padding: "16px 20px",
      background: "rgba(4,9,20,0.9)", position: "relative", overflow: "hidden",
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.4),transparent)" }} />
      <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "rgba(56,189,248,0.5)", marginBottom: 8, textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: status === "ok" ? "#34d399" : "#f59e0b", letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{unit}</span>
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: status === "ok" ? "#34d399" : "#f59e0b", opacity: blink ? 1 : 0.3, transition: "opacity 0.4s", boxShadow: status === "ok" ? "0 0 8px #34d399" : "0 0 8px #f59e0b" }} />
        <span style={{ fontSize: 9, letterSpacing: "0.14em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" as const }}>NOMINAL</span>
      </div>
    </div>
  )
}

/* ══════════ WAVEFORM CANVAS ══════════ */
function Waveform({ color = "#38bdf8", height = 48 }: { color?: string; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext("2d")!
    let W = c.width = c.offsetWidth, H = c.height = height
    let t = 0; let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.beginPath()
      for (let x = 0; x < W; x++) {
        const freq1 = Math.sin((x / W * Math.PI * 6) + t) * 0.45
        const freq2 = Math.sin((x / W * Math.PI * 14) + t * 1.7) * 0.2
        const freq3 = Math.sin((x / W * Math.PI * 3) + t * 0.5) * 0.25
        const y = H / 2 + (freq1 + freq2 + freq3) * (H * 0.4)
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      const grad = ctx.createLinearGradient(0, 0, W, 0)
      grad.addColorStop(0, "transparent")
      grad.addColorStop(0.15, color)
      grad.addColorStop(0.85, color)
      grad.addColorStop(1, "transparent")
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.5
      ctx.shadowBlur = 6; ctx.shadowColor = color
      ctx.stroke()
      t += 0.022; raf = requestAnimationFrame(draw)
    }
    draw()
    const onResize = () => { W = c.width = c.offsetWidth }
    window.addEventListener("resize", onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize) }
  }, [color, height])
  return <canvas ref={ref} style={{ width: "100%", height, display: "block", opacity: 0.7 }} />
}

/* ══════════ TILT CARD ══════════ */
function TiltCard({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50, active: false })
  const onMove = useCallback((e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const rx = ((e.clientY - r.top) / r.height - 0.5) * -12
    const ry = ((e.clientX - r.left) / r.width - 0.5) * 12
    setTilt({ rx, ry, gx: ((e.clientX - r.left) / r.width) * 100, gy: ((e.clientY - r.top) / r.height) * 100, active: true })
  }, [])
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={() => setTilt(t => ({ ...t, active: false, rx: 0, ry: 0 }))}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(${tilt.active ? 6 : 0}px)`,
        transition: tilt.active ? "transform 0.08s ease" : "transform 0.5s ease",
        position: "relative", ...style,
      }}
    >
      {tilt.active && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", zIndex: 2,
          background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(56,189,248,0.1) 0%, transparent 60%)`,
        }} />
      )}
      {children}
    </div>
  )
}

/* ══════════ LANGUAGE TICKER ══════════ */
function LangTicker() {
  const items = [
    "ಕನ್ನಡ — Kannada", "தமிழ் — Tamil", "తెలుగు — Telugu", "മലയാളം — Malayalam", "हिन्दी — Hindi", "English",
    "ಕನ್ನಡ — Kannada", "தமிழ் — Tamil", "తెలుగు — Telugu", "മലയാളം — Malayalam", "हिन्दी — Hindi", "English",
  ]
  return (
    <div style={{ overflow: "hidden", borderTop: "1px solid rgba(56,189,248,0.1)", borderBottom: "1px solid rgba(56,189,248,0.1)", padding: "14px 0", position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 100, background: "linear-gradient(90deg, #04050d, transparent)", zIndex: 2, pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 100, background: "linear-gradient(-90deg, #04050d, transparent)", zIndex: 2, pointerEvents: "none" }} />
      <div style={{ display: "flex", gap: 56, animation: "ticker 20s linear infinite", width: "max-content" }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
            <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, color: "rgba(255,255,255,0.4)", letterSpacing: "0.02em" }}>{item}</span>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(56,189,248,0.5)" }} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════ FEATURE ROW ══════════ */
function FeatureRow({ n, icon, title, body, reversed = false }: { n: string; icon: string; title: string; body: string; reversed?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.2 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{
      display: "grid", gridTemplateColumns: reversed ? "1fr auto" : "auto 1fr", gap: 0,
      opacity: visible ? 1 : 0, transform: visible ? "none" : `translateX(${reversed ? 32 : -32}px)`,
      transition: "opacity 0.7s ease, transform 0.7s ease",
      borderBottom: "1px solid rgba(56,189,248,0.07)",
    }}>
      {!reversed && (
        <div style={{ width: 200, padding: "36px 28px", borderRight: "1px solid rgba(56,189,248,0.07)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(56,189,248,0.4)", letterSpacing: "0.14em", marginBottom: 10 }}>FEATURE_{n}</div>
          <div style={{ fontSize: 30 }}>{icon}</div>
        </div>
      )}
      <div style={{ padding: "36px 44px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(18px, 2vw, 24px)", fontWeight: 700, color: "#e8edf5", marginBottom: 10, letterSpacing: "-0.01em", lineHeight: 1.25 }}>{title}</h3>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 2, color: "rgba(180,196,220,0.5)", maxWidth: 500, fontWeight: 300 }}>{body}</p>
      </div>
      {reversed && (
        <div style={{ width: 200, padding: "36px 28px", borderLeft: "1px solid rgba(56,189,248,0.07)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(56,189,248,0.4)", letterSpacing: "0.14em", marginBottom: 10 }}>FEATURE_{n}</div>
          <div style={{ fontSize: 30 }}>{icon}</div>
        </div>
      )}
    </div>
  )
}

/* ══════════ MOCK CONSULTATION ══════════ */
function MockConsultation() {
  const msgs = [
    { role: "P", text: "ತಲೆನೋವು ಮತ್ತು ಜ್ವರ ಇದೆ", xlat: "Headache & fever", lang: "KN" },
    { role: "D", text: "Since how many days?", xlat: "ಎಷ್ಟು ದಿನದಿಂದ?", lang: "EN" },
    { role: "P", text: "ಮೂರು ದಿನದಿಂದ, ಹೊಟ್ಟೆ ನೋವು ಕೂಡ", xlat: "3 days, stomach pain too", lang: "KN" },
  ]
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (shown >= msgs.length) return
    const t = setTimeout(() => setShown(s => s + 1), shown === 0 ? 900 : 1500)
    return () => clearTimeout(t)
  }, [shown, msgs.length])
  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "rgba(56,189,248,0.05)", borderBottom: "1px solid rgba(56,189,248,0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399", animation: "pulseDot 2s infinite" }} />
          <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "#34d399" }}>SESSION ACTIVE</span>
        </div>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em" }}>DEPT: GENERAL</span>
      </div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, minHeight: 178 }}>
        {msgs.slice(0, shown).map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", animation: "fadeUp 0.4s ease" }}>
            <div style={{ width: 22, height: 22, borderRadius: 3, background: m.role === "P" ? "rgba(56,189,248,0.12)" : "rgba(52,211,153,0.1)", border: `1px solid ${m.role === "P" ? "rgba(56,189,248,0.28)" : "rgba(52,211,153,0.22)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: m.role === "P" ? "#38bdf8" : "#34d399", flexShrink: 0 }}>{m.role}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#e8edf5", marginBottom: 4, lineHeight: 1.5 }}>{m.text}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 9, background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "#38bdf8", padding: "1px 5px", borderRadius: 2 }}>{m.lang}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", fontStyle: "italic" }}>{m.xlat}</span>
              </div>
            </div>
          </div>
        ))}
        {shown < msgs.length && (
          <div style={{ display: "flex", gap: 4, padding: "4px 0" }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(56,189,248,0.4)", animation: `dotBounce 1s ${i * 0.15}s infinite` }} />)}
          </div>
        )}
      </div>
      {shown >= msgs.length && (
        <div style={{ margin: "0 16px 16px", padding: "10px 14px", background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.18)", borderRadius: 4, animation: "fadeUp 0.5s ease" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.15em", color: "#34d399", marginBottom: 6 }}>AUTO-GENERATED REPORT</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginBottom: 3 }}>🔬 Dx: Viral Fever + Gastritis</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)" }}>💊 Paracetamol 500mg · Pantoprazole 40mg</div>
        </div>
      )}
    </div>
  )
}

/* ══════════════════════ MAIN PAGE ══════════════════════ */
export default function Home() {
  const [navSolid, setNavSolid] = useState(false)
  useEffect(() => {
    const fn = () => setNavSolid(window.scrollY > 60)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  return (
    <main style={{ minHeight: "100vh", background: "#04050d", color: "#e8edf5", overflowX: "hidden", fontFamily: "'Fraunces', Georgia, serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,300;1,9..144,600;1,9..144,700&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: rgba(56,189,248,0.25); color: #fff; }
        html { scroll-behavior: smooth; }

        :root {
          --c: #38bdf8;
          --g: #34d399;
          --bg: #04050d;
          --bg2: #060810;
          --bd: rgba(56,189,248,0.1);
          --txt: #e8edf5;
          --txt2: rgba(180,196,220,0.55);
          --mono: 'JetBrains Mono', 'Courier New', monospace;
          --serif: 'Fraunces', Georgia, serif;
        }

        body::after {
          content: ''; position: fixed; inset: 0; z-index: 9999; pointer-events: none;
          background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.018) 3px, rgba(0,0,0,0.018) 4px);
        }
        body::before {
          content: ''; position: fixed; inset: 0; z-index: 9998; pointer-events: none; opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 120px 120px;
        }

        @keyframes scan      { 0%{top:-2%} 100%{top:102%} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes ticker    { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes pulseDot  { 0%,100%{box-shadow:0 0 4px var(--g)} 50%{box-shadow:0 0 16px var(--g), 0 0 32px rgba(52,211,153,.28)} }
        @keyframes glow      { 0%,100%{opacity:0.45} 50%{opacity:0.9} }
        @keyframes dotBounce { 0%,80%,100%{transform:scale(0.7);opacity:.35} 40%{transform:scale(1.2);opacity:1} }
        @keyframes lineSlide { from{transform:scaleX(0);transform-origin:left} to{transform:scaleX(1);transform-origin:left} }
        @keyframes shimmer   { from{background-position:-200% center} to{background-position:200% center} }
        @keyframes borderFlow{ 0%,100%{border-color:rgba(56,189,248,0.1)} 50%{border-color:rgba(56,189,248,0.3)} }
        @keyframes slideInLeft  { from{opacity:0;transform:translateX(-28px)} to{opacity:1;transform:none} }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 10px;
          background: #38bdf8; color: #04050d;
          font-family: var(--mono); font-size: 12px; font-weight: 600; letter-spacing: 0.07em;
          padding: 13px 30px; border-radius: 3px; text-decoration: none;
          transition: all 0.22s; position: relative; overflow: hidden;
        }
        .btn-primary::after { content:''; position:absolute; top:0; left:-100%; width:55%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent); transition:left 0.4s; }
        .btn-primary:hover { background: #7dd3fc; transform: translateY(-2px); box-shadow: 0 12px 36px rgba(56,189,248,0.28); }
        .btn-primary:hover::after { left: 150%; }

        .btn-outline {
          display: inline-flex; align-items: center; gap: 10px;
          border: 1px solid rgba(56,189,248,0.22); color: rgba(255,255,255,0.42);
          font-family: var(--mono); font-size: 12px; letter-spacing: 0.07em;
          padding: 13px 26px; border-radius: 3px; text-decoration: none; background: transparent;
          transition: all 0.22s;
        }
        .btn-outline:hover { border-color: rgba(56,189,248,0.55); color: #38bdf8; background: rgba(56,189,248,0.05); }

        .pill-tag {
          display: inline-flex; align-items: center; gap: 7px;
          font-family: var(--mono); font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase;
          color: rgba(56,189,248,0.65); border: 1px solid rgba(56,189,248,0.16); border-radius: 3px;
          padding: 5px 12px; background: rgba(56,189,248,0.04);
        }

        .nav-link-item {
          font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;
          color: rgba(255,255,255,0.35); text-decoration: none; transition: color 0.2s;
        }
        .nav-link-item:hover { color: #e8edf5; }

        .section-label {
          font-family: var(--mono); font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(56,189,248,0.5); display: flex; align-items: center; gap: 12px;
        }
        .section-label::before { content: ''; width: 28px; height: 1px; background: rgba(56,189,248,0.25); }

        .lang-row {
          display: flex; align-items: center; gap: 20; padding: 22px 28px;
          background: rgba(4,5,13,0.8); border: 1px solid rgba(56,189,248,0.1);
          transition: all 0.25s; cursor: default;
        }
        .lang-row:hover { background: rgba(56,189,248,0.04); border-color: rgba(56,189,248,0.32); }
      `}</style>

      {/* ══ NAV ══ */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 52px", height: 60,
        background: navSolid ? "rgba(4,5,13,0.96)" : "rgba(4,5,13,0.65)",
        backdropFilter: "blur(22px)",
        borderBottom: navSolid ? "1px solid rgba(56,189,248,0.09)" : "1px solid transparent",
        transition: "all 0.4s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, border: "1px solid rgba(56,189,248,0.35)", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: "rgba(56,189,248,0.07)", animation: "glow 4s infinite" }}>⚕</div>
          <div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.1 }}>MediLingua</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: "0.16em", color: "rgba(56,189,248,0.45)", marginTop: 1 }}>AI PLATFORM</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {[["Features", "#features"], ["Workflow", "#workflow"], ["Languages", "#languages"]].map(([label, href]) => (
            <a key={label} href={href} className="nav-link-item">{label}</a>
          ))}
          <Link href="/login" className="btn-primary" style={{ padding: "8px 20px", fontSize: 11 }}>Login →</Link>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section style={{
        position: "relative", minHeight: "calc(100vh - 60px)",
        display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center",
        padding: "0 52px", overflow: "hidden",
      }}>
        <ScanLine />
        {/* Ambient glow */}
        <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,189,248,0.05) 0%, transparent 65%)", top: "50%", left: "35%", transform: "translate(-50%,-50%)", pointerEvents: "none", animation: "glow 8s infinite" }} />
        {/* Grid lines */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(56,189,248,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.03) 1px,transparent 1px)", backgroundSize: "54px 54px", pointerEvents: "none" }} />
        {/* Right border */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.22),transparent)" }} />

        {/* ── LEFT ── */}
        <div style={{ paddingRight: 56, paddingTop: 72, paddingBottom: 72, zIndex: 1 }}>
          <div style={{ marginBottom: 36, animation: "fadeIn 0.6s ease both" }}>
            <span className="pill-tag">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px #34d399", animation: "pulseDot 2s infinite", flexShrink: 0 }} />
              System operational — Sarvam AI
            </span>
          </div>

          {/* Giant headline — 3 words, 3 sizes/styles */}
          <h1 style={{ fontFamily: "var(--serif)", fontWeight: 800, lineHeight: 0.96, letterSpacing: "-0.035em", marginBottom: 32 }}>
            <span style={{ display: "block", fontSize: "clamp(52px,6.5vw,90px)", color: "#e8edf5", animation: "fadeUp 0.7s 0.05s ease both", opacity: 0, animationFillMode: "both" }}>Medical</span>
            <span style={{ display: "block", fontSize: "clamp(52px,6.5vw,90px)", color: "#38bdf8", fontStyle: "italic", animation: "fadeUp 0.7s 0.15s ease both", opacity: 0, animationFillMode: "both" }}>Lingua</span>
            <span style={{ display: "block", fontSize: "clamp(52px,6.5vw,90px)", color: "rgba(255,255,255,0.12)", animation: "fadeUp 0.7s 0.25s ease both", opacity: 0, animationFillMode: "both" }}>Franca</span>
          </h1>

          <p style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 2.1, color: "rgba(180,196,220,0.5)", maxWidth: 400, fontWeight: 300, letterSpacing: "0.02em", marginBottom: 40, animation: "fadeUp 0.7s 0.35s ease both", opacity: 0, animationFillMode: "both" }}>
            AI-powered OPD consultation platform — transcribes Kannada, Tamil, Telugu, Malayalam, Hindi &amp; English simultaneously, generates structured medical reports via biomedical NER, and maintains complete patient visit history.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 52, animation: "fadeUp 0.7s 0.45s ease both", opacity: 0, animationFillMode: "both" }}>
            <Link href="/login" className="btn-primary">Start Consultation →</Link>
            <a href="#features" className="btn-outline">See features</a>
          </div>

          {/* Vital readouts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, animation: "fadeUp 0.7s 0.6s ease both", opacity: 0, animationFillMode: "both" }}>
            <VitalMonitor label="Accuracy" value="~95" unit="%" status="ok" />
            <VitalMonitor label="Languages" value="6" unit="langs" status="ok" />
            <VitalMonitor label="Report" value="<30" unit="sec" status="ok" />
          </div>
        </div>

        {/* ── RIGHT — live demo card ── */}
        <div style={{ paddingTop: 72, paddingBottom: 72, paddingLeft: 48, zIndex: 1, borderLeft: "1px solid rgba(56,189,248,0.07)" }}>
          <TiltCard style={{
            background: "rgba(5,7,15,0.95)", border: "1px solid rgba(56,189,248,0.14)",
            borderRadius: 5, overflow: "hidden",
            boxShadow: "0 56px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.04)",
          }}>
            <MockConsultation />
          </TiltCard>

          <div style={{ marginTop: 16, border: "1px solid rgba(56,189,248,0.1)", borderRadius: 4, overflow: "hidden", background: "rgba(4,5,13,0.85)" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.16em", color: "rgba(56,189,248,0.28)", padding: "10px 16px 4px" }}>AUDIO CHANNEL INPUT</div>
            <Waveform color="#38bdf8" height={34} />
            <Waveform color="#34d399" height={26} />
          </div>
        </div>
      </section>

      {/* ══ TICKER ══ */}
      <LangTicker />

      {/* ══ FEATURES ══ */}
      <section id="features" style={{ background: "var(--bg2)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "96px 52px" }}>
          <div style={{ marginBottom: 52 }}>
            <div className="section-label" style={{ marginBottom: 18 }}>Core Capabilities</div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(28px,3.5vw,46px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, color: "#e8edf5" }}>
              Everything in the<br /><em style={{ color: "#38bdf8" }}>consultation loop.</em>
            </h2>
          </div>
          <div style={{ border: "1px solid rgba(56,189,248,0.08)", borderRadius: 5, overflow: "hidden" }}>
            {[
              { n: "01", icon: "🎙", title: "Live multilingual transcription", body: "Sarvam saarika:v2.5 captures patient speech in any South Indian language (Kannada, Tamil, Telugu, Malayalam) or Hindi, and doctor speech in English — transcribed and translated to all 6 languages in real time, with separate visual panels per speaker.", reversed: false },
              { n: "02", icon: "🧬", title: "NER-powered report generation", body: "d4data/biomedical-ner-all extracts symptoms, diagnosis, medications, dosage, investigations, and follow-up instructions from the transcript into a structured SOAP report — no templates, no manual input.", reversed: true },
              { n: "03", icon: "🔊", title: "Text-to-speech in patient's language", body: "Doctor responses are synthesised in the patient's language via Sarvam bulbul:v2. Each message gets independent EN / HI / KN playback buttons — making consultations accessible regardless of literacy level.", reversed: false },
              { n: "04", icon: "✏️", title: "Inline correction with re-translation", body: "Any mistranscribed term can be corrected directly on the bubble. The edit immediately re-translates to all three language versions, keeping the entire record consistent without restarting the session.", reversed: true },
              { n: "05", icon: "🕐", title: "Patient history on every visit", body: "Returning patients trigger an auto-loading sidebar showing every past visit with full reports — diagnoses, medications, follow-up notes — giving the doctor complete context before the session begins.", reversed: false },
              { n: "06", icon: "✅", title: "Complete visit & PDF export", body: "One click marks the visit closed, appends the report to the patient's history array, and renders a formatted PDF for print or digital records. The report is stored as a versioned array — never overwritten.", reversed: true },
            ].map(f => <FeatureRow key={f.n} {...f} />)}
          </div>
        </div>
      </section>

      {/* ══ WORKFLOW ══ */}
      <section id="workflow" style={{ padding: "96px 52px", background: "var(--bg)", borderTop: "1px solid rgba(56,189,248,0.07)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 18 }}>Step-by-step</div>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#e8edf5", marginBottom: 56, lineHeight: 1.05 }}>
            Patient in.<br />
            <em style={{ color: "#38bdf8" }}>Report out.</em><br />
            <span style={{ color: "rgba(255,255,255,0.18)" }}>Under 5 minutes.</span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { n: "01", title: "Register patient", desc: "Reception adds name, age, department. 30 seconds.", hl: false },
              { n: "02", title: "History auto-loads", desc: "Past diagnoses and medications appear in sidebar before the session starts.", hl: true },
              { n: "03", title: "Record consultation", desc: "Patient speaks in native language. Doctor responds in English. Both streams captured.", hl: false },
              { n: "04", title: "Correct transcript", desc: "Inline editing fixes mistranscribed terms. Re-translation is instant.", hl: false },
              { n: "05", title: "Generate report", desc: "NER model extracts structured data. Review and edit each field.", hl: false },
              { n: "06", title: "Complete & export", desc: "One click closes the visit, saves report to history, enables PDF download.", hl: true },
            ].map((step, i, arr) => (
              <div key={step.n} style={{ display: "flex", gap: 22, position: "relative", paddingBottom: i < arr.length - 1 ? 36 : 0 }}>
                {i < arr.length - 1 && (
                  <div style={{ position: "absolute", left: 21, top: 44, bottom: 0, width: 1, background: "linear-gradient(to bottom, rgba(56,189,248,0.25), rgba(56,189,248,0.03))" }} />
                )}
                <div style={{
                  width: 44, height: 44, flexShrink: 0, borderRadius: 3,
                  border: `1px solid ${step.hl ? "rgba(56,189,248,0.55)" : "rgba(56,189,248,0.15)"}`,
                  background: step.hl ? "rgba(56,189,248,0.1)" : "rgba(56,189,248,0.03)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
                  color: step.hl ? "#38bdf8" : "rgba(56,189,248,0.4)",
                  boxShadow: step.hl ? "0 0 20px rgba(56,189,248,0.18)" : "none",
                }}>{step.n}</div>
                <div style={{ paddingTop: 10 }}>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 700, color: step.hl ? "#38bdf8" : "#e8edf5", marginBottom: 5, letterSpacing: "-0.01em" }}>{step.title}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.9, color: "rgba(180,196,220,0.45)", fontWeight: 300 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ LANGUAGES ══ */}
      <section id="languages" style={{ padding: "96px 52px", background: "var(--bg2)", borderTop: "1px solid rgba(56,189,248,0.07)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div>
            <div className="section-label" style={{ marginBottom: 18 }}>Language Stack</div>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(28px,3.5vw,44px)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.05, color: "#e8edf5", marginBottom: 20 }}>
              Spoken by<br />
              <em style={{ color: "#38bdf8" }}>South India</em><br />
              <span style={{ color: "rgba(255,255,255,0.18)" }}>Documented in one.</span>
            </h2>
            <p style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 2, color: "rgba(180,196,220,0.45)", maxWidth: 380, fontWeight: 300 }}>
              South India's OPDs see patients speaking Kannada, Tamil, Telugu, or Malayalam — but documentation is expected in English. MediLingua bridges that gap invisibly across all 6 languages, reducing miscommunication and improving diagnostic accuracy.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {[
              { flag: "🇮🇳", name: "Kannada",   script: "ಕನ್ನಡ",    region: "Karnataka · ~61M speakers",      code: "kn-IN", delay: 0   },
              { flag: "🇮🇳", name: "Tamil",     script: "தமிழ்",   region: "Tamil Nadu · ~75M speakers",     code: "ta-IN", delay: 0.3 },
              { flag: "🇮🇳", name: "Telugu",    script: "తెలుగు",  region: "Andhra/Telangana · ~80M speakers",code: "te-IN", delay: 0.6 },
              { flag: "🇮🇳", name: "Malayalam", script: "മലയാളം", region: "Kerala · ~38M speakers",          code: "ml-IN", delay: 0.9 },
              { flag: "🇮🇳", name: "Hindi",     script: "हिन्दी",  region: "Pan-India · ~600M speakers",     code: "hi-IN", delay: 1.2 },
              { flag: "🌐", name: "English",    script: "Medical standard", region: "Documentation layer",   code: "en-IN", delay: 1.5 },
            ].map((l, i) => (
              <div key={l.code} className="lang-row" style={{
                display: "flex", alignItems: "center", gap: 20, padding: "22px 28px",
                background: "rgba(4,5,13,0.85)", border: "1px solid rgba(56,189,248,0.1)",
                borderRadius: i === 0 ? "5px 5px 0 0" : i === 2 ? "0 0 5px 5px" : 0,
                transition: "all 0.25s", cursor: "default", animation: `borderFlow ${4 + i}s ${l.delay}s infinite`,
              }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(56,189,248,0.05)"; el.style.borderColor = "rgba(56,189,248,0.3)" }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(4,5,13,0.85)"; el.style.borderColor = "rgba(56,189,248,0.1)" }}
              >
                <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>{l.flag}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 700, color: "#e8edf5", marginBottom: 3 }}>
                    {l.name} <em style={{ color: "#38bdf8", fontSize: 15 }}>— {l.script}</em>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em" }}>{l.region}</div>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "rgba(56,189,248,0.4)", padding: "3px 9px", border: "1px solid rgba(56,189,248,0.14)", borderRadius: 3 }}>{l.code}</div>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px #34d399", animation: "pulseDot 2s infinite", animationDelay: `${i * 0.4}s` }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA BANNER ══ */}
      <section style={{ padding: "80px 52px 96px", background: "var(--bg)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{
            border: "1px solid rgba(56,189,248,0.18)", borderRadius: 5, padding: "64px 60px",
            background: "rgba(56,189,248,0.025)", position: "relative", overflow: "hidden",
            display: "grid", gridTemplateColumns: "1fr auto", gap: 56, alignItems: "center",
          }}>
            <div style={{ position: "absolute", top: 0, left: "-100%", right: 0, height: 1, background: "linear-gradient(90deg,transparent,#38bdf8,transparent)", animation: "lineSlide 2.5s 1s ease forwards" }} />

            <div>
              <div className="section-label" style={{ marginBottom: 16 }}>Ready to deploy</div>
              <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(24px,3.2vw,38px)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1, marginBottom: 14, color: "#e8edf5" }}>
                Transform your OPD<br />
                <em style={{ color: "#38bdf8" }}>starting today.</em>
              </h2>
              <p style={{ fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.9, color: "rgba(180,196,220,0.42)", fontWeight: 300 }}>
                No hardware. No setup fees. Works on any device with a microphone.<br />Complete integration in under 5 minutes.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
              <Link href="/login" className="btn-primary" style={{ justifyContent: "center" }}>Get Started →</Link>
              <Link href="/login" className="btn-outline" style={{ justifyContent: "center" }}>Doctor Login</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer style={{ borderTop: "1px solid rgba(56,189,248,0.07)", padding: "24px 52px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 22, height: 22, border: "1px solid rgba(56,189,248,0.28)", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, background: "rgba(56,189,248,0.05)" }}>⚕</div>
          <span style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: 14 }}>MediLingua <em style={{ color: "#38bdf8" }}>AI</em></span>
        </div>
        <p style={{ fontFamily: "var(--mono)", color: "rgba(255,255,255,0.12)", fontSize: 10, letterSpacing: "0.12em" }}>© 2026 — HACKATHON PROJECT</p>
        <div style={{ display: "flex", gap: 28 }}>
          {["Features", "Workflow", "Languages"].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", color: "rgba(255,255,255,0.18)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => ((e.target as HTMLElement).style.color = "rgba(255,255,255,0.45)")}
              onMouseLeave={e => ((e.target as HTMLElement).style.color = "rgba(255,255,255,0.18)")}
            >{l.toUpperCase()}</a>
          ))}
        </div>
      </footer>
    </main>
  )
}