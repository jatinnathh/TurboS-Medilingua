"use client"

import { signIn } from "next-auth/react"
import { useState, useRef, useEffect } from "react"
import Link from "next/link"

/* ── Particle canvas (same as homepage) ── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    let W = (canvas.width = canvas.offsetWidth)
    let H = (canvas.height = canvas.offsetHeight)
    const N = 38
    const particles = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.4 + 0.4,
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
        ctx.fillStyle = "rgba(56,189,248,0.5)"
        ctx.fill()
        for (let j = i + 1; j < N; j++) {
          const q = particles[j]
          const dx = p.x - q.x, dy = p.y - q.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 120) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.strokeStyle = `rgba(56,189,248,${0.15 * (1 - d / 120)})`
            ctx.lineWidth = 0.5
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
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.45, pointerEvents: "none" }} />
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [shake, setShake] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }
    setLoading(true)
    await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/dashboard",
    })
    setLoading(false)
  }
  const fillDemoCredentials = () => {
    setEmail("general@hospital.com")
    setPassword("password123")
  }
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin()
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c14",
      display: "flex",
      fontFamily: "'DM Sans','Segoe UI',sans-serif",
      overflow: "hidden",
      position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --accent: #38bdf8;
          --accent-glow: rgba(56,189,248,0.28);
          --accent-dim: rgba(56,189,248,0.1);
          --border: rgba(56,189,248,0.14);
          --border-hover: rgba(56,189,248,0.38);
          --bg-card: rgba(13,19,33,0.92);
          --text-primary: #e8edf5;
          --text-secondary: #8b9ab5;
          --text-muted: #4a5568;
          --success: #34d399;
          --error: #f87171;
        }

        body::after {
          content: '';
          position: fixed; inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
          pointer-events: none; z-index: 9999;
        }

        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes shimmer { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
        @keyframes orbFloat { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-20px) scale(1.05); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes shake {
          0%,100% { transform:translateX(0); }
          15%,45%,75% { transform:translateX(-6px); }
          30%,60%,90% { transform:translateX(6px); }
        }
        @keyframes pulse {
          0%,100% { box-shadow:0 0 0 0 rgba(56,189,248,0.4); }
          50% { box-shadow:0 0 0 8px rgba(56,189,248,0); }
        }
        @keyframes borderTrace {
          0% { stroke-dashoffset: 400; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes slideInLeft { from { opacity:0; transform:translateX(-40px); } to { opacity:1; transform:translateX(0); } }

        .login-card {
          animation: fadeSlideUp 0.7s ease both;
        }
        .shake { animation: shake 0.45s ease both !important; }

        .input-field {
          width: 100%;
          background: rgba(8,12,20,0.8);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 13px 16px;
          font-size: 15px;
          color: var(--text-primary);
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.25s, box-shadow 0.25s, background 0.25s;
          caret-color: var(--accent);
        }
        .input-field::placeholder { color: var(--text-muted); }
        .input-field:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(56,189,248,0.12), inset 0 0 12px rgba(56,189,248,0.03);
          background: rgba(12,18,30,0.95);
        }
        .input-field:hover:not(:focus) { border-color: rgba(56,189,248,0.25); }

        .login-btn {
          width: 100%;
          background: linear-gradient(135deg, #38bdf8, #0ea5e9);
          color: #080c14;
          padding: 14px;
          border-radius: 10px;
          border: none;
          font-size: 15px;
          font-weight: 700;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.25s;
          position: relative;
          overflow: hidden;
          letter-spacing: 0.02em;
        }
        .login-btn::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.18), transparent);
          opacity: 0; transition: opacity 0.25s;
        }
        .login-btn:hover::before { opacity: 1; }
        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 40px var(--accent-glow), 0 0 0 1px rgba(56,189,248,0.3);
        }
        .login-btn:active { transform: translateY(0); }
        .login-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

        .label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .show-pass-btn {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); font-size: 13px;
          transition: color 0.2s; padding: 4px;
        }
        .show-pass-btn:hover { color: var(--accent); }

        .divider {
          display: flex; align-items: center; gap: 12px;
          color: var(--text-muted); font-size: 12px;
          margin: 24px 0;
        }
        .divider::before, .divider::after {
          content: ''; flex: 1;
          height: 1px; background: var(--border);
        }

        .social-btn {
          width: 100%;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.25s;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .social-btn:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
          background: var(--accent-dim);
        }

        /* Left panel decorative elements */
        .deco-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(56,189,248,0.08);
          animation: orbFloat 8s ease-in-out infinite;
        }

        .feature-item {
          display: flex; align-items: flex-start; gap: 14px;
          animation: slideInLeft 0.6s ease both;
        }
        .feature-icon-wrap {
          width: 38px; height: 38px; flex-shrink: 0;
          background: var(--accent-dim);
          border: 1px solid var(--border-hover);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
        }

        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(8,12,20,0.3);
          border-top-color: #080c14;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
      `}</style>

      {/* ── Background particle canvas ── */}
      <ParticleCanvas />

      {/* ── Ambient orbs ── */}
      <div style={{ position: "absolute", width: 500, height: 500, background: "radial-gradient(circle,rgba(56,189,248,0.07) 0%,transparent 65%)", top: -80, left: "30%", borderRadius: "50%", pointerEvents: "none", animation: "orbFloat 9s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: 300, height: 300, background: "radial-gradient(circle,rgba(14,165,233,0.06) 0%,transparent 70%)", bottom: 60, right: "10%", borderRadius: "50%", pointerEvents: "none", animation: "orbFloat 7s 3s ease-in-out infinite" }} />

      {/* Grid bg */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(56,189,248,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.03) 1px,transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      {/* ══ LEFT PANEL ══ */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "center", padding: "60px 64px",
        position: "relative", zIndex: 1,
        borderRight: "1px solid var(--border)",
      }} className="hide-mobile">

        {/* Decorative rings */}
        <div className="deco-ring" style={{ width: 320, height: 320, top: -80, right: -80, animationDelay: "0s" }} />
        <div className="deco-ring" style={{ width: 180, height: 180, bottom: 100, left: -40, animationDelay: "-3s" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 64 }}>
          <div style={{
            width: 38, height: 38,
            background: "linear-gradient(135deg,#38bdf8,#0ea5e9)",
            borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, boxShadow: "0 0 20px rgba(56,189,248,0.4)",
          }}>⚕</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            MediLingua <span style={{ color: "var(--accent)" }}>AI</span>
          </span>
        </div>

        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(28px,3vw,42px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 16 }}>
            Smarter OPD.<br />
            <span style={{
              background: "linear-gradient(90deg,#38bdf8,#7dd3fc,#38bdf8)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "shimmer 3s linear infinite",
            }}>Zero Paperwork.</span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-secondary)", maxWidth: 380 }}>
            AI-powered transcription and report generation for high-volume Indian hospitals.
          </p>
        </div>

        {/* Feature list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[
            { icon: "🎙", title: "Multilingual transcription", sub: "Hindi, Kannada & English", delay: "0.1s" },
            { icon: "📋", title: "Instant SOAP reports", sub: "Structured in under 30 seconds", delay: "0.2s" },
            { icon: "🗂", title: "Patient history at a glance", sub: "Full longitudinal OPD records", delay: "0.3s" },
          ].map(f => (
            <div key={f.title} className="feature-item" style={{ animationDelay: f.delay }}>
              <div className="feature-icon-wrap">{f.icon}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom badge */}
        <div style={{
          marginTop: 56,
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(52,211,153,0.08)",
          border: "1px solid rgba(52,211,153,0.2)",
          borderRadius: 100, padding: "7px 16px",
          width: "fit-content",
        }}>
          <span style={{ width: 7, height: 7, background: "#34d399", borderRadius: "50%", display: "inline-block", boxShadow: "0 0 8px #34d399" }} />
          <span style={{ fontSize: 12, color: "#34d399", fontWeight: 500 }}>All systems operational</span>
        </div>
      </div>

      {/* ══ RIGHT PANEL — Login Form ══ */}
      <div style={{
        width: "min(100%, 480px)",
        display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        padding: "48px 40px",
        position: "relative", zIndex: 1,
      }}>
        <div
          className={`login-card${shake ? " shake" : ""}`}
          style={{ width: "100%", maxWidth: 400 }}
        >
          {/* Card header */}
          <div style={{ marginBottom: 36 }}>
            {/* Mobile logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
              <div style={{
                width: 30, height: 30,
                background: "linear-gradient(135deg,#38bdf8,#0ea5e9)",
                borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, boxShadow: "0 0 14px rgba(56,189,248,0.35)",
              }}>⚕</div>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
                MediLingua <span style={{ color: "var(--accent)" }}>AI</span>
              </span>
            </div>

            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 8 }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Sign in to your MediLingua workspace
            </p>
          </div>

          {/* Card body */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            padding: "32px 28px",
            backdropFilter: "blur(20px)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(56,189,248,0.06)",
          }}>

            {/* Email */}
            <div style={{ marginBottom: 20 }}>
              <label className="label">Email address</label>
              <div style={{ position: "relative" }}>
                <input
                  className="input-field"
                  placeholder="doctor@hospital.in"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKey}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  style={{ paddingLeft: 42 }}
                />
                <span style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  fontSize: 15, opacity: focused === "email" ? 1 : 0.45,
                  transition: "opacity 0.2s",
                }}>✉</span>
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 12 }}>
              <label className="label">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  className="input-field"
                  placeholder="••••••••••"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKey}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  style={{ paddingLeft: 42, paddingRight: 52 }}
                />
                <span style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  fontSize: 15, opacity: focused === "password" ? 1 : 0.45,
                  transition: "opacity 0.2s",
                }}>🔒</span>
                <button className="show-pass-btn" onClick={() => setShowPass(s => !s)} type="button">
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Forgot */}
            <div style={{ textAlign: "right", marginBottom: 28 }}>
              <a href="#" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", opacity: 0.8, transition: "opacity 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "0.8")}
              >Forgot password?</a>
            </div>

            {/* Login button */}
            <button className="login-btn" onClick={handleLogin} disabled={loading}>

              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <span className="spinner" />
                  Signing in…
                </span>
              ) : "Sign In →"}
            </button>
            {/* Demo login helper */}
            <div
              onClick={fillDemoCredentials}
              style={{
                marginTop: 14,
                fontSize: 13,
                color: "var(--accent)",
                textAlign: "center",
                cursor: "pointer",
                opacity: 0.8,
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
            >
              Use demo account credentials
            </div>




          </div>

          {/* Footer */}
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 24 }}>
            Don't have an account?{" "}
            <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
              Request access →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
