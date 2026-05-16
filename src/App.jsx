import { useState, useEffect, useCallback, useRef } from "react";
import {
  saveEncrypted, loadEncrypted, hasStoredData, clearStoredData
} from "./crypto.js";
import {
  JPY_TO_INR, JPY_SALARY, DEFAULT_BONUS_MO,
  EQUITY_HOLDINGS, MF_HOLDINGS, ADVISOR_MF,
  EQ_INV, EQ_CUR, ZMF_INV, ZMF_CUR, AMF_INV, AMF_CUR, TOT_INV, TOT_CUR,
  eqByCap, zCap, aCap, combLarge, combMid, combSmall,
  DEFAULT_STATE,
} from "./data.js";

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n, d=0) => new Intl.NumberFormat("en-IN", { minimumFractionDigits:d, maximumFractionDigits:d }).format(n||0);
const inr  = n => `₹${fmt(n)}`;
const pct  = (a, b) => b ? Math.min(100, (a/b)*100) : 0;
const yearsToFire = (pv, tgt, c, r) => {
  if (pv >= tgt) return 0;
  const m = r/100/12;
  if (m === 0) return c > 0 ? (tgt-pv)/c/12 : Infinity;
  let v = pv;
  for (let i = 1; i <= 1200; i++) { v = v*(1+m)+c; if (v >= tgt) return i/12; }
  return Infinity;
};

// ── colours ───────────────────────────────────────────────────────────────────
const C = {
  bg:"#080c14", card:"#0f1824", border:"#1a2840",
  accent:"#00d4b4", accent2:"#f59e0b", accent3:"#818cf8",
  danger:"#f87171", success:"#34d399", text:"#e2e8f0", muted:"#64748b",
  grad:"linear-gradient(135deg,#00d4b4,#0ea5e9)",
  large:"#818cf8", mid:"#00d4b4", small:"#f59e0b",
};
const COLS = ["#818cf8","#00d4b4","#f59e0b","#34d399","#f472b6","#fb923c","#a78bfa","#38bdf8","#4ade80","#e879f9"];

// ── atoms ─────────────────────────────────────────────────────────────────────
const Card = ({ children, style={} }) => (
  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:"18px 20px", ...style }}>
    {children}
  </div>
);
const Lbl = ({ children }) => (
  <div style={{ fontSize:10, letterSpacing:"0.12em", textTransform:"uppercase", color:C.muted, marginBottom:4, fontFamily:"monospace" }}>
    {children}
  </div>
);
const Bar = ({ p, color=C.accent, h=8, label, showP=true }) => (
  <div style={{ marginBottom:9 }}>
    {label && (
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:3, fontFamily:"monospace" }}>
        <span>{label}</span>{showP && <span style={{ color }}>{fmt(p,1)}%</span>}
      </div>
    )}
    <div style={{ background:"#1a2840", borderRadius:100, height:h, overflow:"hidden" }}>
      <div style={{ width:`${Math.min(100,p)}%`, height:"100%", background:color, borderRadius:100, transition:"width 0.5s ease", boxShadow:`0 0 8px ${color}40` }} />
    </div>
  </div>
);
const Inp = ({ label, value, onChange, prefix="₹", suffix="", step=1000, min=0 }) => (
  <div style={{ marginBottom:12 }}>
    <Lbl>{label}</Lbl>
    <div style={{ display:"flex", alignItems:"center", background:"#080c14", border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
      {prefix && <span style={{ padding:"0 8px", color:C.muted, fontSize:13, fontFamily:"monospace" }}>{prefix}</span>}
      <input type="number" value={value} min={min} step={step}
        onChange={e => onChange(parseFloat(e.target.value)||0)}
        style={{ flex:1, background:"transparent", border:"none", outline:"none", color:C.text, fontSize:14, padding:"8px 4px", fontFamily:"monospace" }} />
      {suffix && <span style={{ padding:"0 8px", color:C.muted, fontSize:13, fontFamily:"monospace" }}>{suffix}</span>}
    </div>
  </div>
);
const Btn = ({ children, onClick, color=C.accent, style={} }) => (
  <button onClick={onClick} style={{ background:"transparent", border:`1px solid ${color}`, color, borderRadius:7, padding:"6px 14px", fontSize:11, fontFamily:"monospace", cursor:"pointer", ...style }}>
    {children}
  </button>
);

const TABS = [
  { id:"dashboard", label:"🔥 Dashboard" },
  { id:"portfolio", label:"📊 Portfolio" },
  { id:"budget",    label:"💰 Budget"    },
  { id:"fire",      label:"📈 FIRE Plan" },
  { id:"networth",  label:"🏦 Net Worth" },
  { id:"analysis",  label:"🔬 Analysis"  },
];

// ── lock screen ───────────────────────────────────────────────────────────────
function LockScreen({ onUnlock }) {
  const [pw, setPw]     = useState("");
  const [confirm, setCf]= useState("");
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);
  const isNew = !hasStoredData();

  const handle = async () => {
    setErr(""); setBusy(true);
    try {
      if (isNew) {
        if (pw.length < 6)       { setErr("Password must be at least 6 characters"); setBusy(false); return; }
        if (pw !== confirm)      { setErr("Passwords do not match"); setBusy(false); return; }
        await onUnlock(pw, true);
      } else {
        await onUnlock(pw, false);
      }
    } catch {
      setErr("Wrong password — please try again");
    }
    setBusy(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:"40px 36px", width:360, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔥</div>
        <div style={{ fontSize:22, fontWeight:800, fontFamily:"'Playfair Display',serif", color:C.text, marginBottom:6 }}>BudgetFIRE</div>
        <div style={{ fontSize:12, color:C.muted, fontFamily:"monospace", marginBottom:28 }}>
          {isNew ? "Create a password to encrypt your data" : "Enter your password to unlock"}
        </div>

        <input
          type="password"
          placeholder="Password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key==="Enter" && handle()}
          style={{ width:"100%", background:"#080c14", border:`1px solid ${C.border}`, borderRadius:8, padding:"11px 14px", color:C.text, fontSize:14, fontFamily:"monospace", outline:"none", marginBottom:10 }}
          autoFocus
        />
        {isNew && (
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={e => setCf(e.target.value)}
            onKeyDown={e => e.key==="Enter" && handle()}
            style={{ width:"100%", background:"#080c14", border:`1px solid ${C.border}`, borderRadius:8, padding:"11px 14px", color:C.text, fontSize:14, fontFamily:"monospace", outline:"none", marginBottom:10 }}
          />
        )}

        {err && <div style={{ color:C.danger, fontSize:12, fontFamily:"monospace", marginBottom:10 }}>{err}</div>}

        <button onClick={handle} disabled={busy} style={{ width:"100%", background:C.grad, border:"none", borderRadius:9, padding:"12px", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", marginTop:4 }}>
          {busy ? "Please wait…" : isNew ? "Create & Unlock" : "Unlock"}
        </button>

        <div style={{ marginTop:18, fontSize:10, color:C.muted, fontFamily:"monospace", lineHeight:1.6 }}>
          🔒 AES-256-GCM encrypted · stored locally · never sent anywhere
        </div>
      </div>
    </div>
  );
}

// ── main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const [password, setPassword] = useState(null);   // null = locked
  const [s, setS]               = useState(DEFAULT_STATE);
  const [tab, setTab]           = useState("dashboard");
  const [mfF, setMfF]           = useState("all");
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState("");
  const importRef               = useRef();
  const saveTimer               = useRef();

  // unlock handler
  const handleUnlock = async (pw, isNew) => {
    if (isNew) {
      await saveEncrypted(DEFAULT_STATE, pw);
      setPassword(pw);
      setS(DEFAULT_STATE);
    } else {
      const data = await loadEncrypted(pw);
      if (!data) throw new Error("wrong password");
      setPassword(pw);
      setS({ ...DEFAULT_STATE, ...data });
    }
  };

  // auto-save with debounce whenever state changes
  useEffect(() => {
    if (!password) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await saveEncrypted(s, password);
      setSaving(false);
      setSaveMsg("Saved ✓");
      setTimeout(() => setSaveMsg(""), 2000);
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [s, password]);

  const upd = useCallback((k, v) => setS(p => ({ ...p, [k]: v })), []);

  // snapshot
  const snap = () => {
    const sn = { date: new Date().toLocaleDateString("en-IN",{month:"short",year:"2-digit"}), netWorth, fp: parseFloat(firePct.toFixed(1)) };
    setS(p => ({ ...p, history: [...(p.history||[]).slice(-11), sn] }));
  };

  // export encrypted backup
  const exportBackup = async () => {
    const stored = localStorage.getItem("bf_neha_enc_v1");
    if (!stored) return;
    const blob = new Blob([stored], { type:"text/plain" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `budgetfire-backup-${new Date().toISOString().slice(0,10)}.enc`;
    a.click();
  };

  // import encrypted backup
  const importBackup = (e) => {
    const file   = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        localStorage.setItem("bf_neha_enc_v1", ev.target.result.trim());
        const data = await loadEncrypted(password);
        setS({ ...DEFAULT_STATE, ...data });
        setSaveMsg("Backup imported ✓");
        setTimeout(() => setSaveMsg(""), 2500);
      } catch { alert("Failed to import — make sure you're using the correct password."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // lock
  const lock = () => { setPassword(null); setS(DEFAULT_STATE); };

  // reset
  const resetData = () => {
    if (!window.confirm("Delete all saved data and reset to defaults?")) return;
    clearStoredData();
    setPassword(null);
    setS(DEFAULT_STATE);
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const income     = s.salaryINR + s.rentINR + s.sideIncome;
  const bonus      = Math.round(JPY_SALARY * s.bonusMonths * JPY_TO_INR);
  const avgIncome  = income + bonus/12;
  const curExp     = { Housing:s.housing, Food:s.food, Transport:s.transport, Health:s.health, Entertainment:s.entertainment, Clothing:s.clothing, Education:s.education, Travel:s.travel, Other:s.other };
  const totalCur   = Object.values(curExp).reduce((a,b)=>a+b,0);
  const surplus    = income - totalCur;
  const saveRate   = avgIncome>0 ? ((avgIncome-totalCur)/avgIncome)*100 : 0;
  const netWorth   = TOT_CUR + s.cashSavings + s.otherAssets - s.otherDebt;
  const retExp     = { Housing:s.rHousing, Food:s.rFood, Transport:s.rTransport, Health:s.rHealth, Entertainment:s.rEntertain, Travel:s.rTravel, "Intl Trip÷12":s.rIntlTrip, Clothing:s.rClothing, Education:s.rEducation, Misc:s.rMisc };
  const retToday   = Object.values(retExp).reduce((a,b)=>a+b,0);
  const yrsToRet   = Math.max(0, s.retireAge - s.currentAge);
  const inflMult   = Math.pow(1 + s.inflationRate/100, yrsToRet);
  const retFuture  = Math.round(retToday * inflMult);
  const retAnnual  = retFuture * 12;
  const fireNum    = retAnnual / (s.withdrawalRate/100);
  const leanFire   = (retAnnual*0.7) / (s.withdrawalRate/100);
  const fatFire    = (retAnnual*1.5) / (s.withdrawalRate/100);
  const coastFire  = fireNum / Math.pow(1 + s.expectedReturn/100, yrsToRet);
  const mInvest    = s.sipAmount + Math.max(0, surplus*0.5);
  const yrsLeft    = yearsToFire(netWorth, fireNum, mInvest, s.expectedReturn);
  const fireYear   = new Date().getFullYear() + Math.ceil(yrsLeft);
  const firePct    = pct(netWorth, fireNum);

  // ── lock screen ────────────────────────────────────────────────────────────
  if (!password) return <LockScreen onUnlock={handleUnlock} />;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>

      {/* HEADER */}
      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:"14px 22px 0", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:C.grad, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🔥</div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, fontFamily:"'Playfair Display',serif" }}>BudgetFIRE — Neha</div>
              <div style={{ fontSize:10, color:C.muted, fontFamily:"monospace" }}>₹ INR · Japan · 1 JPY = ₹0.58 · Apr 2026</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {saveMsg && <span style={{ fontSize:10, color:C.success, fontFamily:"monospace" }}>{saveMsg}</span>}
            {saving   && <span style={{ fontSize:10, color:C.muted,  fontFamily:"monospace" }}>saving…</span>}
            <Btn onClick={snap}>📸 Snap</Btn>
            <Btn onClick={exportBackup} color={C.accent3}>⬇ Export</Btn>
            <Btn onClick={() => importRef.current.click()} color={C.accent3}>⬆ Import</Btn>
            <Btn onClick={lock} color={C.muted}>🔒 Lock</Btn>
            <input ref={importRef} type="file" accept=".enc" onChange={importBackup} style={{ display:"none" }} />
          </div>
        </div>
        <div style={{ display:"flex", gap:1, overflowX:"auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ background:tab===t.id?`${C.accent}18`:"transparent", border:"none", borderBottom:`2px solid ${tab===t.id?C.accent:"transparent"}`, color:tab===t.id?C.accent:C.muted, padding:"7px 13px", fontSize:12, cursor:"pointer", fontWeight:tab===t.id?700:400, whiteSpace:"nowrap", transition:"all 0.2s" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:"20px 22px", maxWidth:980, margin:"0 auto" }}>

        {/* ══════════════════ DASHBOARD ══════════════════ */}
        {tab==="dashboard" && (
          <div>
            <div style={{ background:`linear-gradient(135deg,${C.accent}14,${C.accent3}14)`, border:`1px solid ${C.accent}25`, borderRadius:20, padding:"22px 24px", marginBottom:16 }}>
              <Lbl>FIRE Progress — Inflation-adjusted corpus target</Lbl>
              <div style={{ display:"flex", alignItems:"flex-end", gap:10, marginBottom:10 }}>
                <div style={{ fontSize:44, fontWeight:900, color:C.accent, fontFamily:"'Playfair Display',serif", lineHeight:1 }}>{fmt(firePct,1)}%</div>
                <div style={{ color:C.muted, fontSize:13, paddingBottom:5 }}>toward FIRE</div>
              </div>
              <Bar p={firePct} color={C.accent} h={13} showP={false} />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginTop:14 }}>
                {[
                  { l:"Net Worth",  v:inr(netWorth),                                  c:C.success },
                  { l:"FIRE Number",v:inr(fireNum),                                   c:C.accent2 },
                  { l:"Years Left", v:isFinite(yrsLeft)?`${fmt(yrsLeft,1)} yrs`:"∞", c:C.accent3 },
                  { l:"FIRE Year",  v:isFinite(yrsLeft)?fireYear:"—",                 c:C.accent  },
                ].map(k => <div key={k.l}><Lbl>{k.l}</Lbl><div style={{ fontSize:17, fontWeight:700, color:k.c }}>{k.v}</div></div>)}
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
              {[
                { l:"Monthly Income",  v:inr(income),    c:C.success, i:"💵" },
                { l:"Japan Expenses",  v:inr(totalCur),  c:C.danger,  i:"💸" },
                { l:"Savings Rate",    v:`${fmt(saveRate,1)}%`, c:C.accent, i:"📊" },
                { l:"Portfolio Value", v:inr(TOT_CUR),   c:C.accent2, i:"📈" },
              ].map(k => (
                <Card key={k.l}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{k.i}</div>
                  <Lbl>{k.l}</Lbl>
                  <div style={{ fontSize:19, fontWeight:800, color:k.c }}>{k.v}</div>
                </Card>
              ))}
            </div>

            <Card style={{ marginBottom:16 }}>
              <Lbl>FIRE Type Progress</Lbl>
              <div style={{ marginTop:10 }}>
                <Bar p={pct(netWorth,leanFire)} color={C.success} label={`Lean FIRE — ${inr(leanFire)}`} />
                <Bar p={pct(netWorth,fireNum)}  color={C.accent}  label={`Regular FIRE — ${inr(fireNum)}`} />
                <Bar p={pct(netWorth,fatFire)}  color={C.accent2} label={`Fat FIRE — ${inr(fatFire)}`} />
              </div>
            </Card>

            <Card style={{ marginBottom:16 }}>
              <Lbl>Portfolio Cap Mix (Equity + Equity MFs)</Lbl>
              <div style={{ display:"flex", height:22, borderRadius:8, overflow:"hidden", marginTop:10, gap:2 }}>
                {[{ v:combLarge,c:C.large,l:"Large" },{ v:combMid,c:C.mid,l:"Mid" },{ v:combSmall,c:C.small,l:"Small" }].map(x => {
                  const w = pct(x.v, combLarge+combMid+combSmall);
                  return <div key={x.l} title={`${x.l}: ${fmt(w,1)}%`} style={{ width:`${w}%`, background:x.c, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff", fontFamily:"monospace", minWidth:28 }}>{fmt(w,1)}%</div>;
                })}
              </div>
              <div style={{ display:"flex", gap:16, marginTop:8 }}>
                {[{ l:"Large Cap",v:combLarge,c:C.large },{ l:"Mid Cap",v:combMid,c:C.mid },{ l:"Small Cap",v:combSmall,c:C.small }].map(x => (
                  <div key={x.l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ width:8, height:8, borderRadius:2, background:x.c }} />
                    <span style={{ fontSize:11, fontFamily:"monospace", color:C.muted }}>{x.l}</span>
                    <span style={{ fontSize:11, fontFamily:"monospace", color:x.c, fontWeight:700 }}>{fmt(pct(x.v,combLarge+combMid+combSmall),1)}%</span>
                  </div>
                ))}
              </div>
            </Card>

            {s.history?.length>1 ? (
              <Card>
                <Lbl>Net Worth History</Lbl>
                <svg viewBox={`0 0 ${s.history.length*62} 115`} style={{ width:"100%", height:105, marginTop:8 }}>
                  {s.history.map((h,i) => {
                    const mx = Math.max(...s.history.map(x=>x.netWorth),1);
                    const bh = Math.max(4,(h.netWorth/mx)*85);
                    return (
                      <g key={i}>
                        <rect x={i*62+8} y={95-bh} width={46} height={bh} rx={4} fill={`${C.accent}65`} />
                        <text x={i*62+31} y={110} textAnchor="middle" fill={C.muted} fontSize={8} fontFamily="monospace">{h.date}</text>
                        <text x={i*62+31} y={91-bh} textAnchor="middle" fill={C.accent} fontSize={8} fontFamily="monospace">{h.fp}%</text>
                      </g>
                    );
                  })}
                </svg>
              </Card>
            ) : (
              <div style={{ textAlign:"center", color:C.muted, fontSize:12, padding:20, fontFamily:"monospace" }}>
                📸 Hit Snap each month to build your FIRE progress timeline
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ PORTFOLIO ══════════════════ */}
        {tab==="portfolio" && (
          <div>
            <div style={{ marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", margin:0 }}>Investment Portfolio</h2>
              <p style={{ color:C.muted, fontSize:12, margin:"4px 0 0", fontFamily:"monospace" }}>Zerodha Equity · Direct MF · Advisor MF (BHIMSEN TUKARAM KURALE)</p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
              {[
                { l:"Total Invested",  v:inr(TOT_INV),                               c:C.accent2 },
                { l:"Current Value",   v:inr(TOT_CUR),                               c:C.success },
                { l:"Unrealized Gain", v:inr(TOT_CUR-TOT_INV),                       c:TOT_CUR-TOT_INV>=0?C.success:C.danger },
                { l:"Overall Return",  v:`${fmt((TOT_CUR-TOT_INV)/TOT_INV*100,1)}%`, c:C.accent },
              ].map(k => <Card key={k.l}><Lbl>{k.l}</Lbl><div style={{ fontSize:17, fontWeight:800, color:k.c }}>{k.v}</div></Card>)}
            </div>

            <Card style={{ marginBottom:16 }}>
              <Lbl>Allocation Split</Lbl>
              {[{ l:"Zerodha Equity",v:EQ_CUR,c:C.accent3 },{ l:"Zerodha MF Direct",v:ZMF_CUR,c:C.accent },{ l:"Advisor MF",v:AMF_CUR,c:C.accent2 }].map(a => (
                <div key={a.l} style={{ display:"grid", gridTemplateColumns:"155px 1fr 88px 52px", alignItems:"center", gap:10, marginBottom:6 }}>
                  <div style={{ fontSize:12, fontFamily:"monospace", color:C.text }}>{a.l}</div>
                  <div style={{ background:"#1a2840", borderRadius:100, height:8, overflow:"hidden" }}><div style={{ width:`${pct(a.v,TOT_CUR)}%`, height:"100%", background:a.c, borderRadius:100 }} /></div>
                  <div style={{ fontSize:12, fontWeight:700, color:a.c, textAlign:"right", fontFamily:"monospace" }}>{inr(a.v)}</div>
                  <div style={{ fontSize:10, color:C.muted, textAlign:"right", fontFamily:"monospace" }}>{fmt(pct(a.v,TOT_CUR),1)}%</div>
                </div>
              ))}
            </Card>

            <Card style={{ marginBottom:16 }}>
              <Lbl>📈 Zerodha Equity — {inr(EQ_CUR)}</Lbl>
              <div style={{ overflowX:"auto", marginTop:10 }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:"monospace" }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                      {["Symbol","Cap","Sector","Qty","Avg","CMP","P&L","Ret%"].map(h => (
                        <th key={h} style={{ padding:"5px 7px", color:C.muted, textAlign:["Symbol","Cap","Sector"].includes(h)?"left":"right", fontWeight:600, fontSize:10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {EQUITY_HOLDINGS.map(h => {
                      const inv=h.qty*h.avg, cur=h.qty*h.cmp, pl=cur-inv, ret=(pl/inv)*100;
                      const cc = h.cap==="Large Cap"?C.large:h.cap==="Mid Cap"?C.mid:C.small;
                      return (
                        <tr key={h.symbol} style={{ borderBottom:`1px solid ${C.border}22` }}>
                          <td style={{ padding:"6px 7px", color:C.text, fontWeight:700 }}>{h.symbol}</td>
                          <td style={{ padding:"6px 7px" }}><span style={{ fontSize:10, background:`${cc}20`, color:cc, borderRadius:4, padding:"2px 5px" }}>{h.cap.split(" ")[0]}</span></td>
                          <td style={{ padding:"6px 7px", color:C.muted }}>{h.sector}</td>
                          <td style={{ padding:"6px 7px", textAlign:"right", color:C.muted }}>{h.qty}</td>
                          <td style={{ padding:"6px 7px", textAlign:"right", color:C.muted }}>₹{fmt(h.avg,2)}</td>
                          <td style={{ padding:"6px 7px", textAlign:"right" }}>₹{fmt(h.cmp,2)}</td>
                          <td style={{ padding:"6px 7px", textAlign:"right", color:pl>=0?C.success:C.danger }}>₹{fmt(Math.abs(pl))}{pl<0?" ▼":" ▲"}</td>
                          <td style={{ padding:"6px 7px", textAlign:"right", color:ret>=0?C.success:C.danger, fontWeight:700 }}>{fmt(ret,1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              {["all","zerodha","advisor"].map(f => (
                <button key={f} onClick={() => setMfF(f)} style={{ background:mfF===f?`${C.accent}20`:"transparent", border:`1px solid ${mfF===f?C.accent:C.border}`, color:mfF===f?C.accent:C.muted, borderRadius:6, padding:"4px 12px", fontSize:11, cursor:"pointer", fontFamily:"monospace" }}>
                  {f==="all"?"All MFs":f==="zerodha"?"Zerodha Direct":"Advisor MFs"}
                </button>
              ))}
            </div>

            <Card>
              <Lbl>{mfF==="zerodha"?`Zerodha Direct — ${inr(ZMF_CUR)}`:mfF==="advisor"?`Advisor MFs — ${inr(AMF_CUR)} · XIRR 12.42%`:`All MFs — ${inr(ZMF_CUR+AMF_CUR)}`}</Lbl>
              <div style={{ overflowX:"auto", marginTop:10 }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, fontFamily:"monospace" }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                      {["Fund","Type","Invested","Value","Gain","Ret%"].map(h => (
                        <th key={h} style={{ padding:"5px 7px", color:C.muted, textAlign:["Fund","Type"].includes(h)?"left":"right", fontWeight:600, fontSize:10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...(mfF!=="advisor"?MF_HOLDINGS:[]), ...(mfF!=="zerodha"?ADVISOR_MF:[])].map(m => {
                      const gain=m.cur-m.invested, ret=(gain/m.invested)*100;
                      return (
                        <tr key={m.name} style={{ borderBottom:`1px solid ${C.border}22` }}>
                          <td style={{ padding:"6px 7px", color:C.text, maxWidth:180 }}>{m.name}</td>
                          <td style={{ padding:"6px 7px", color:C.muted }}>{m.type}</td>
                          <td style={{ padding:"6px 7px", textAlign:"right", color:C.muted }}>₹{fmt(m.invested)}</td>
                          <td style={{ padding:"6px 7px", textAlign:"right" }}>₹{fmt(m.cur)}</td>
                          <td style={{ padding:"6px 7px", textAlign:"right", color:gain>=0?C.success:C.danger }}>₹{fmt(Math.abs(gain))}</td>
                          <td style={{ padding:"6px 7px", textAlign:"right", color:ret>=0?C.success:C.danger, fontWeight:700 }}>{fmt(ret,1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {mfF!=="zerodha" && <div style={{ marginTop:10, padding:"8px 12px", background:`${C.accent}10`, borderRadius:8, fontSize:11, fontFamily:"monospace", color:C.muted }}>📌 Active SIPs: ₹5,000 → ICICI Pru Multicap + ₹5,000 → Kotak Special Opps = ₹10,000/mo</div>}
            </Card>
          </div>
        )}

        {/* ══════════════════ BUDGET ══════════════════ */}
        {tab==="budget" && (
          <div>
            <div style={{ marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", margin:0 }}>Monthly Budget</h2>
              <p style={{ color:C.muted, fontSize:12, margin:"4px 0 0", fontFamily:"monospace" }}>Current Japan expenses are separate from retirement FIRE expenses</p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <Card>
                <Lbl>💴 Income (INR equivalent)</Lbl>
                <div style={{ marginTop:10 }}>
                  <Inp label="Base Salary (¥3,01,700 → ₹)" value={s.salaryINR} onChange={v=>upd("salaryINR",v)} step={1000} />
                  <Inp label="Rent Allowance (¥65,000 → ₹)" value={s.rentINR} onChange={v=>upd("rentINR",v)} step={500} />
                  <Inp label="Side Income / Etsy" value={s.sideIncome} onChange={v=>upd("sideIncome",v)} step={500} />
                  <Inp label="Bonus Months" value={s.bonusMonths} onChange={v=>upd("bonusMonths",v)} prefix="" suffix="months" step={0.5} />
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginTop:4 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}><span style={{ color:C.muted, fontSize:12, fontFamily:"monospace" }}>Monthly Take-Home</span><span style={{ color:C.success, fontWeight:700 }}>{inr(income)}</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:C.muted, fontSize:12, fontFamily:"monospace" }}>Avg incl. Bonus ÷12</span><span style={{ color:C.accent2, fontWeight:700 }}>{inr(avgIncome)}</span></div>
                </div>
              </Card>
              <Card>
                <Lbl>💸 Current Expenses — Japan (¥1,00,000 ≈ ₹58,000/mo)</Lbl>
                <div style={{ marginTop:8 }}>
                  {Object.entries(curExp).map(([k,v]) => <Inp key={k} label={k} value={v} onChange={val=>upd(k.toLowerCase(),val)} step={500} />)}
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginTop:4, display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:C.muted, fontSize:12, fontFamily:"monospace" }}>Total Expenses</span>
                  <span style={{ color:C.danger, fontWeight:700 }}>{inr(totalCur)}</span>
                </div>
              </Card>
            </div>
            <Card style={{ marginTop:16 }}>
              <Lbl>Monthly Summary</Lbl>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginTop:12 }}>
                {[
                  { l:"Income",      v:inr(income),    c:C.success },
                  { l:"Expenses",    v:inr(totalCur),  c:C.danger  },
                  { l:"Surplus",     v:inr(surplus),   c:surplus>=0?C.accent:C.danger },
                  { l:"Savings Rate",v:`${fmt(saveRate,1)}%`, c:saveRate>=50?C.success:saveRate>=30?C.accent2:C.danger },
                ].map(m => <div key={m.l} style={{ textAlign:"center", padding:12, background:"#080c14", borderRadius:10 }}><Lbl>{m.l}</Lbl><div style={{ fontSize:17, fontWeight:800, color:m.c }}>{m.v}</div></div>)}
              </div>
              <div style={{ marginTop:14 }}>
                <Lbl>Expense Breakdown</Lbl>
                <div style={{ display:"flex", height:14, borderRadius:7, overflow:"hidden", marginTop:7, gap:2 }}>
                  {Object.entries(curExp).map(([k,v],i) => { const w=totalCur>0?(v/totalCur)*100:0; return <div key={k} title={`${k}: ${inr(v)}`} style={{ width:`${w}%`, background:COLS[i%COLS.length], minWidth:w>2?3:0 }} />; })}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"3px 12px", marginTop:7 }}>
                  {Object.keys(curExp).map((k,i) => <div key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, fontFamily:"monospace", color:C.muted }}><div style={{ width:7, height:7, borderRadius:2, background:COLS[i%COLS.length] }} />{k}</div>)}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ══════════════════ FIRE PLAN ══════════════════ */}
        {tab==="fire" && (
          <div>
            <div style={{ marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", margin:0 }}>FIRE Plan</h2>
              <p style={{ color:C.muted, fontSize:12, margin:"4px 0 0", fontFamily:"monospace" }}>India lifestyle · Inflation-adjusted · {yrsToRet} yrs away · @{s.inflationRate}% p.a.</p>
            </div>
            <div style={{ background:`${C.accent2}12`, border:`1px solid ${C.accent2}30`, borderRadius:14, padding:"14px 18px", marginBottom:16, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
              {[
                { l:"Lifestyle Today (₹/mo)",                          v:inr(retToday)+"/mo",  c:C.accent2 },
                { l:`At Retirement (${new Date().getFullYear()+yrsToRet})`, v:inr(retFuture)+"/mo", c:C.danger },
                { l:"Annual Corpus Need",                              v:inr(retAnnual),       c:C.accent  },
                { l:"Inflation Multiplier",                            v:`${fmt(inflMult,2)}×`,c:C.accent3 },
              ].map(k => <div key={k.l}><Lbl>{k.l}</Lbl><div style={{ fontSize:14, fontWeight:800, color:k.c }}>{k.v}</div></div>)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div>
                <Card style={{ marginBottom:14 }}>
                  <Lbl>⚙️ Assumptions</Lbl>
                  <div style={{ marginTop:10 }}>
                    <Inp label="Current Age" value={s.currentAge} onChange={v=>upd("currentAge",v)} prefix="" suffix="yrs" step={1} />
                    <Inp label="Target Retirement Age" value={s.retireAge} onChange={v=>upd("retireAge",v)} prefix="" suffix="yrs" step={1} />
                    <Inp label="Monthly SIP" value={s.sipAmount} onChange={v=>upd("sipAmount",v)} step={1000} />
                    <Inp label="Withdrawal Rate" value={s.withdrawalRate} onChange={v=>upd("withdrawalRate",v)} prefix="" suffix="%" step={0.1} />
                    <Inp label="Expected Return" value={s.expectedReturn} onChange={v=>upd("expectedReturn",v)} prefix="" suffix="%" step={0.5} />
                    <Inp label="Inflation (India)" value={s.inflationRate} onChange={v=>upd("inflationRate",v)} prefix="" suffix="%" step={0.1} />
                  </div>
                </Card>
                <Card>
                  <Lbl>🏡 India Retirement Lifestyle — Today's ₹</Lbl>
                  <p style={{ color:C.muted, fontSize:10, fontFamily:"monospace", margin:"2px 0 10px" }}>Enter at today's prices — inflation applied automatically</p>
                  <Inp label="Housing"                value={s.rHousing}  onChange={v=>upd("rHousing",v)}  step={1000} />
                  <Inp label="Food & Dining"           value={s.rFood}     onChange={v=>upd("rFood",v)}     step={1000} />
                  <Inp label="Transport"               value={s.rTransport}onChange={v=>upd("rTransport",v)}step={1000} />
                  <Inp label="Health & Insurance"      value={s.rHealth}   onChange={v=>upd("rHealth",v)}   step={1000} />
                  <Inp label="Entertainment & Lifestyle"value={s.rEntertain}onChange={v=>upd("rEntertain",v)}step={1000}/>
                  <Inp label="Domestic Travel"         value={s.rTravel}   onChange={v=>upd("rTravel",v)}   step={1000} />
                  <Inp label="✈️ Intl Trip/year (÷12)" value={s.rIntlTrip} onChange={v=>upd("rIntlTrip",v)} step={1000} />
                  <Inp label="Clothing & Skincare"     value={s.rClothing} onChange={v=>upd("rClothing",v)} step={500}  />
                  <Inp label="Education / Growth"      value={s.rEducation}onChange={v=>upd("rEducation",v)}step={500}  />
                  <Inp label="Misc / Buffer"            value={s.rMisc}     onChange={v=>upd("rMisc",v)}     step={500}  />
                  <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginTop:4, display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:C.muted, fontSize:12, fontFamily:"monospace" }}>Total Today</span>
                    <span style={{ color:C.accent2, fontWeight:700 }}>{inr(retToday)}/mo</span>
                  </div>
                </Card>
              </div>
              <div>
                <Card style={{ marginBottom:14 }}>
                  <Lbl>🎯 FIRE Numbers (Inflation-Adjusted)</Lbl>
                  <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:12 }}>
                    {[
                      { l:"Lean FIRE (70% lifestyle)", val:leanFire, c:C.success },
                      { l:"Regular FIRE",              val:fireNum,  c:C.accent  },
                      { l:"Fat FIRE (150% lifestyle)", val:fatFire,  c:C.accent2 },
                    ].map(f => (
                      <div key={f.l} style={{ padding:14, background:"#080c14", borderRadius:10, border:`1px solid ${f.c}25` }}>
                        <Lbl>{f.l}</Lbl>
                        <div style={{ fontSize:22, fontWeight:800, color:f.c }}>{inr(f.val)}</div>
                        <Bar p={pct(netWorth,f.val)} color={f.c} h={6} showP />
                      </div>
                    ))}
                  </div>
                </Card>
                <Card>
                  <Lbl>⏱ Timeline</Lbl>
                  <div style={{ marginTop:10 }}>
                    {[
                      { l:"Lifestyle Today",        v:inr(retToday)+"/mo",                                       c:C.accent2 },
                      { l:"Lifestyle at FIRE",       v:inr(retFuture)+"/mo",                                      c:C.danger  },
                      { l:"Annual Need at FIRE",     v:inr(retAnnual),                                            c:C.accent  },
                      { l:"Net Worth Now",           v:inr(netWorth),                                             c:C.success },
                      { l:"Monthly Invested (est.)", v:inr(mInvest),                                              c:C.accent3 },
                      { l:"Years to FIRE",           v:isFinite(yrsLeft)?`${fmt(yrsLeft,1)} yrs`:"∞",            c:C.accent  },
                      { l:"Projected FIRE Age",      v:isFinite(yrsLeft)?Math.ceil(s.currentAge+yrsLeft):"∞",    c:C.accent2 },
                      { l:"FIRE Year",               v:isFinite(yrsLeft)?fireYear:"—",                            c:C.success },
                      { l:"Coast FIRE Number",       v:inr(coastFire),                                            c:"#a78bfa" },
                    ].map(row => (
                      <div key={row.l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.border}40` }}>
                        <span style={{ color:C.muted, fontFamily:"monospace", fontSize:11 }}>{row.l}</span>
                        <span style={{ fontWeight:700, color:row.c, fontSize:12 }}>{row.v}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ NET WORTH ══════════════════ */}
        {tab==="networth" && (
          <div>
            <div style={{ marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", margin:0 }}>Net Worth</h2>
              <p style={{ color:C.muted, fontSize:12, margin:"4px 0 0", fontFamily:"monospace" }}>All in ₹ INR — portfolio auto-loaded from statements</p>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <Card>
                <Lbl>✅ Assets</Lbl>
                <div style={{ marginTop:10 }}>
                  {[{ l:"Zerodha Equity",v:EQ_CUR },{ l:"Zerodha MF Direct",v:ZMF_CUR },{ l:"Advisor MF (BHIMSEN)",v:AMF_CUR }].map(a => (
                    <div key={a.l} style={{ marginBottom:10, padding:"9px 12px", background:"#080c14", borderRadius:8, border:`1px solid ${C.border}` }}>
                      <Lbl>{a.l} 🔒 auto-loaded</Lbl>
                      <div style={{ fontSize:16, fontWeight:700, color:C.success }}>{inr(a.v)}</div>
                    </div>
                  ))}
                  <Inp label="Cash / Savings Account" value={s.cashSavings} onChange={v=>upd("cashSavings",v)} step={5000} />
                  <Inp label="Other Assets (FD/Gold)" value={s.otherAssets} onChange={v=>upd("otherAssets",v)} step={5000} />
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10, marginTop:4, display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:C.muted, fontSize:12, fontFamily:"monospace" }}>Total Assets</span>
                  <span style={{ color:C.success, fontWeight:700 }}>{inr(TOT_CUR+s.cashSavings+s.otherAssets)}</span>
                </div>
              </Card>
              <div>
                <Card style={{ marginBottom:14 }}>
                  <Lbl>❌ Liabilities</Lbl>
                  <div style={{ marginTop:10 }}><Inp label="Loans / Debt" value={s.otherDebt} onChange={v=>upd("otherDebt",v)} step={5000} /></div>
                </Card>
                <Card>
                  <Lbl>Net Worth</Lbl>
                  <div style={{ fontSize:30, fontWeight:900, color:netWorth>=0?C.success:C.danger, fontFamily:"'Playfair Display',serif", marginTop:8 }}>{inr(netWorth)}</div>
                  <div style={{ marginTop:14 }}><Bar p={pct(netWorth,fireNum)} color={C.accent} label="% of FIRE Number" h={10} /></div>
                  <div style={{ marginTop:10 }}>
                    {[{ l:"Equity",v:EQ_CUR,c:C.accent3 },{ l:"MF Zerodha",v:ZMF_CUR,c:C.accent },{ l:"MF Advisor",v:AMF_CUR,c:C.accent2 },{ l:"Cash/Other",v:s.cashSavings+s.otherAssets,c:C.success },{ l:"Net Worth",v:netWorth,c:C.text }].map(r => (
                      <div key={r.l} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:`1px solid ${C.border}40` }}>
                        <span style={{ color:C.muted, fontFamily:"monospace", fontSize:12 }}>{r.l}</span>
                        <span style={{ fontWeight:700, color:r.c }}>{inr(r.v)}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:10, padding:"8px 12px", background:`${C.accent}10`, borderRadius:8, fontSize:11, fontFamily:"monospace", color:C.muted }}>
                    💡 Advisor XIRR: 12.42% · Overall gain: {inr(TOT_CUR-TOT_INV)} ({fmt((TOT_CUR-TOT_INV)/TOT_INV*100,1)}%)
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ ANALYSIS ══════════════════ */}
        {tab==="analysis" && (
          <div>
            <div style={{ marginBottom:16 }}>
              <h2 style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", margin:0 }}>Portfolio Analysis</h2>
              <p style={{ color:C.muted, fontSize:12, margin:"4px 0 0", fontFamily:"monospace" }}>Cap allocation · Concentration · Sector risk across equity + all MFs</p>
            </div>

            {/* Combined cap hero */}
            {(() => {
              const total = combLarge+combMid+combSmall;
              const lp=pct(combLarge,total), mp=pct(combMid,total), sp=pct(combSmall,total);
              return (
                <Card style={{ marginBottom:16, border:`1px solid ${C.accent}30` }}>
                  <Lbl>🏆 Combined Cap Allocation — Equity + All Equity MFs</Lbl>
                  <p style={{ color:C.muted, fontSize:10, fontFamily:"monospace", margin:"2px 0 12px" }}>Excludes Debt, Gold. Ideal: 50% Large · 30% Mid · 20% Small</p>
                  <div style={{ display:"flex", height:32, borderRadius:10, overflow:"hidden", marginBottom:14, gap:3 }}>
                    {[{ v:combLarge,c:C.large,p:lp,l:"Large" },{ v:combMid,c:C.mid,p:mp,l:"Mid" },{ v:combSmall,c:C.small,p:sp,l:"Small" }].map(x => (
                      <div key={x.l} style={{ width:`${x.p}%`, background:x.c, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", fontFamily:"monospace", minWidth:30 }}>
                        {x.l} {fmt(x.p,1)}%
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
                    {[
                      { l:"Large Cap", val:combLarge, p:lp, ideal:50, c:C.large, note:"Nifty 50 — stability & liquidity" },
                      { l:"Mid Cap",   val:combMid,   p:mp, ideal:30, c:C.mid,   note:"Growth phase — higher alpha" },
                      { l:"Small Cap", val:combSmall, p:sp, ideal:20, c:C.small, note:"High risk/reward — long horizon" },
                    ].map(x => {
                      const diff = x.p - x.ideal;
                      const sc   = Math.abs(diff)<5?C.success:diff>5?C.accent2:C.danger;
                      const st   = Math.abs(diff)<5?"✅ On track":diff>5?"⚠️ Overweight":"📉 Underweight";
                      return (
                        <div key={x.l} style={{ padding:14, background:"#080c14", borderRadius:12, border:`1px solid ${x.c}30` }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
                            <div style={{ width:9, height:9, borderRadius:3, background:x.c }} /><Lbl>{x.l}</Lbl>
                          </div>
                          <div style={{ fontSize:30, fontWeight:900, color:x.c, fontFamily:"'Playfair Display',serif", lineHeight:1 }}>{fmt(x.p,1)}%</div>
                          <div style={{ fontSize:11, color:C.muted, fontFamily:"monospace", marginTop:3 }}>{inr(x.val)}</div>
                          <div style={{ marginTop:10 }}>
                            <div style={{ fontSize:10, color:C.muted, fontFamily:"monospace", marginBottom:3 }}>Ideal {x.ideal}% · Diff: {diff>0?"+":""}{fmt(diff,1)}%</div>
                            <div style={{ background:"#1a2840", borderRadius:100, height:7, position:"relative", overflow:"hidden" }}>
                              <div style={{ width:`${Math.min(100,x.p)}%`, height:"100%", background:x.c, borderRadius:100 }} />
                              <div style={{ position:"absolute", left:`${x.ideal}%`, top:0, bottom:0, width:2, background:"#ffffff55" }} />
                            </div>
                          </div>
                          <div style={{ marginTop:8, fontSize:10, color:sc, fontFamily:"monospace" }}>{st}</div>
                          <div style={{ marginTop:4, fontSize:10, color:C.muted, fontFamily:"monospace" }}>{x.note}</div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })()}

            {/* Large+Mid blended */}
            <Card style={{ marginBottom:16 }}>
              <Lbl>🔀 Blended View</Lbl>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginTop:12 }}>
                {(() => {
                  const total = combLarge+combMid+combSmall;
                  return [
                    { l:"Large + Mid Combined",  v:combLarge+combMid,         note:"Core — stable growth",          c:C.accent3 },
                    { l:"Pure Large Cap",         v:combLarge,                 note:"Index-like — portfolio floor",  c:C.large   },
                    { l:"Mid + Small Cap",        v:combMid+combSmall,         note:"Alpha engine — satellite",      c:"#f472b6" },
                  ].map(x => (
                    <div key={x.l} style={{ padding:14, background:"#080c14", borderRadius:12, border:`1px solid ${x.c}25` }}>
                      <Lbl>{x.l}</Lbl>
                      <div style={{ fontSize:24, fontWeight:900, color:x.c, fontFamily:"'Playfair Display',serif" }}>{fmt(pct(x.v,total),1)}%</div>
                      <div style={{ fontSize:11, color:C.muted, fontFamily:"monospace", marginTop:2 }}>{inr(x.v)}</div>
                      <div style={{ fontSize:10, color:x.c, fontFamily:"monospace", marginTop:6 }}>{x.note}</div>
                    </div>
                  ));
                })()}
              </div>
            </Card>

            {/* Per-bucket breakdown */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:16 }}>
              {[
                { title:"📈 Equity Stocks", total:EQ_CUR, cap:eqByCap, keys:["Large Cap","Mid Cap","Small Cap"], showSymbols:true },
                { title:"📂 Zerodha MF",   total:ZMF_CUR, cap:{...zCap, "Other (Debt/Gold)":zCap.other}, keys:["large","mid","small","other"], labels:["Large Cap","Mid Cap","Small Cap","Other"] },
                { title:"🏦 Advisor MF",   total:AMF_CUR, cap:{...aCap, "Other (Hybrid/Debt)":aCap.other}, keys:["large","mid","small","other"], labels:["Large Cap","Mid Cap","Small Cap","Other"] },
              ].map(bucket => {
                const capColors = [C.large, C.mid, C.small, C.muted];
                const entries = bucket.showSymbols
                  ? [["Large Cap",eqByCap["Large Cap"]],[" Mid Cap",eqByCap["Mid Cap"]],["Small Cap",eqByCap["Small Cap"]]]
                  : [["Large Cap",zCap.large||aCap.large],["Mid Cap",zCap.mid||aCap.mid],["Small Cap",zCap.small||aCap.small],["Other",zCap.other||aCap.other]];
                const capData = bucket.showSymbols
                  ? [{ l:"Large Cap",v:eqByCap["Large Cap"],c:C.large },{ l:"Mid Cap",v:eqByCap["Mid Cap"],c:C.mid },{ l:"Small Cap",v:eqByCap["Small Cap"],c:C.small }]
                  : bucket.title.includes("Zerodha")
                    ? [{ l:"Large Cap",v:zCap.large,c:C.large },{ l:"Mid Cap",v:zCap.mid,c:C.mid },{ l:"Small Cap",v:zCap.small,c:C.small },{ l:"Other",v:zCap.other,c:C.muted }]
                    : [{ l:"Large Cap",v:aCap.large,c:C.large },{ l:"Mid Cap",v:aCap.mid,c:C.mid },{ l:"Small Cap",v:aCap.small,c:C.small },{ l:"Other",v:aCap.other,c:C.muted }];
                return (
                  <Card key={bucket.title}>
                    <Lbl>{bucket.title}</Lbl>
                    <div style={{ marginTop:10 }}>
                      {capData.map(x => (
                        <div key={x.l} style={{ marginBottom:11 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                            <span style={{ fontSize:11, fontFamily:"monospace", color:x.c, fontWeight:700 }}>{x.l}</span>
                            <div>
                              <span style={{ fontSize:11, color:x.c, fontWeight:700, fontFamily:"monospace" }}>{fmt(pct(x.v,bucket.total),1)}%</span>
                              <span style={{ fontSize:9, color:C.muted, fontFamily:"monospace", marginLeft:4 }}>{inr(x.v)}</span>
                            </div>
                          </div>
                          <Bar p={pct(x.v,bucket.total)} color={x.c} h={6} showP={false} />
                          {bucket.showSymbols && x.l!=="Other" && (
                            <div style={{ fontSize:9, color:C.muted, fontFamily:"monospace" }}>
                              {EQUITY_HOLDINGS.filter(h=>h.cap===x.l).map(h=>h.symbol).join(", ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Concentration risk */}
            <Card>
              <Lbl>⚠️ Concentration Risk — Top 8 Positions</Lbl>
              <p style={{ color:C.muted, fontSize:10, fontFamily:"monospace", margin:"2px 0 12px" }}>Sorted by current value across equity + all MFs</p>
              {[
                ...EQUITY_HOLDINGS.map(h => ({ name:h.symbol, v:h.qty*h.cmp, type:"Equity", sub:h.cap })),
                ...MF_HOLDINGS.map(m => ({ name:m.name, v:m.cur, type:"Zerodha MF", sub:m.type })),
                ...ADVISOR_MF.map(m => ({ name:m.name, v:m.cur, type:"Advisor MF", sub:m.type })),
              ].sort((a,b)=>b.v-a.v).slice(0,8).map((p,i) => (
                <div key={p.name} style={{ display:"grid", gridTemplateColumns:"22px 1fr 90px 60px", alignItems:"center", gap:10, marginBottom:7 }}>
                  <div style={{ fontSize:10, color:C.muted, fontFamily:"monospace", textAlign:"center" }}>#{i+1}</div>
                  <div>
                    <div style={{ fontSize:12, fontFamily:"monospace", color:C.text }}>{p.name}</div>
                    <div style={{ fontSize:9, color:C.muted, fontFamily:"monospace" }}>{p.type} · {p.sub}</div>
                  </div>
                  <div style={{ background:"#1a2840", borderRadius:100, height:7, overflow:"hidden" }}>
                    <div style={{ width:`${pct(p.v,TOT_CUR)}%`, height:"100%", background:COLS[i%COLS.length], borderRadius:100 }} />
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:11, color:COLS[i%COLS.length], fontWeight:700, fontFamily:"monospace" }}>{fmt(pct(p.v,TOT_CUR),1)}%</div>
                    <div style={{ fontSize:9, color:C.muted, fontFamily:"monospace" }}>{inr(p.v)}</div>
                  </div>
                </div>
              ))}
            </Card>

            {/* Danger zone */}
            <Card style={{ marginTop:16, border:`1px solid ${C.danger}30` }}>
              <Lbl>⚙️ Danger Zone</Lbl>
              <div style={{ marginTop:10 }}>
                <button onClick={resetData} style={{ background:"transparent", border:`1px solid ${C.danger}`, color:C.danger, borderRadius:7, padding:"7px 16px", fontSize:11, fontFamily:"monospace", cursor:"pointer" }}>
                  🗑 Reset All Data
                </button>
                <span style={{ fontSize:10, color:C.muted, fontFamily:"monospace", marginLeft:12 }}>Clears encrypted storage and resets to defaults</span>
              </div>
            </Card>
          </div>
        )}

      </div>

      <div style={{ textAlign:"center", padding:"14px 22px", borderTop:`1px solid ${C.border}`, color:C.muted, fontSize:10, fontFamily:"monospace", letterSpacing:"0.06em" }}>
        BUDGETFIRE · NEHA RAVINDRA MOTHE · 🔒 AES-256-GCM Encrypted · Not financial advice
      </div>
    </div>
  );
}
