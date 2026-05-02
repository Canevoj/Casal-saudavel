import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAYERS = {
  player1: { name: "Lucas", emoji: "🧔", color: "#4ade80", bg: "#052e16", colorDark: "#16a34a" },
  player2: { name: "Josi",  emoji: "👩", color: "#f472b6", bg: "#4a044e", colorDark: "#db2777" },
};

const CATEGORIES = [
  { id: "treino",      label: "Treino",      emoji: "💪", max: 30 },
  { id: "alimentacao", label: "Alimentação", emoji: "🥗", max: 25 },
  { id: "sono",        label: "Sono",        emoji: "😴", max: 20 },
  { id: "devocional",  label: "Devocional",  emoji: "🙏", max: 25 },
];

const OPTIONS_MAP = {
  treino: [
    { label: "Não treinei hoje",   sublabel: "Dia de descanso",           pts: 0,  icon: "😴" },
    { label: "Caminhada leve",     sublabel: "Menos de 30 min",           pts: 8,  icon: "🚶" },
    { label: "Treino moderado",    sublabel: "30 a 60 minutos",           pts: 20, icon: "🏃" },
    { label: "Treino intenso",     sublabel: "Mais de 60 min",            pts: 30, icon: "🔥" },
  ],
  alimentacao: [
    { label: "Dia ruim",           sublabel: "Muita besteira",            pts: 0,  icon: "🍔" },
    { label: "Mais ou menos",      sublabel: "Equilibrado com excessos",  pts: 10, icon: "😐" },
    { label: "Bom, com deslizes",  sublabel: "Quase lá!",                 pts: 18, icon: "😅" },
    { label: "Perfeito!",          sublabel: "Alimentação limpa o dia todo", pts: 25, icon: "🥦" },
  ],
  sono: [
    { label: "Menos de 5h",        sublabel: "Noite muito ruim",          pts: 0,  icon: "😵" },
    { label: "5 a 6 horas",        sublabel: "Irregular",                 pts: 8,  icon: "😪" },
    { label: "6 a 7 horas",        sublabel: "Razoável",                  pts: 14, icon: "😌" },
    { label: "7 a 9 horas",        sublabel: "Noite ótima!",              pts: 20, icon: "✨" },
  ],
  devocional: [
    { label: "Não fiz hoje",       sublabel: "Sem tempo dessa vez",       pts: 0,  icon: "😔" },
    { label: "Orei rapidinho",     sublabel: "Pequena oração",            pts: 10, icon: "🙏" },
    { label: "Li a Palavra",       sublabel: "Tempo na Bíblia",           pts: 18, icon: "📖" },
    { label: "Devocional completo",sublabel: "Oração + Leitura + Louvor", pts: 25, icon: "🕊️" },
  ],
};

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const defaultLog = () => ({ treino: null, alimentacao: null, sono: null, devocional: null });
const getMaxScore = () => CATEGORIES.reduce((s, c) => s + c.max, 0);
const getTodayKey = () => new Date().toISOString().split("T")[0];

function getScore(log) {
  if (!log) return 0;
  return CATEGORIES.reduce((sum, cat) => {
    const sel = log[cat.id];
    if (sel === null || sel === undefined) return sum;
    return sum + (OPTIONS_MAP[cat.id][sel]?.pts || 0);
  }, 0);
}

function getWeekDates() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
}

function calcStreak(history) {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if (getScore(history[key]) > 0) streak++;
    else break;
  }
  return streak;
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [activePlayer, setActivePlayer] = useState(null);
  const [view, setView]                 = useState("home");
  const [data, setData]                 = useState({ player1: {}, player2: {} });
  const [syncing, setSyncing]           = useState(true);
  const [toast, setToast]               = useState(null);
  const [expandedCat, setExpandedCat]   = useState(null);
  const [saving, setSaving]             = useState(false);

  const today    = getTodayKey();
  const maxScore = getMaxScore();
  const weekDates = getWeekDates();

  // ── Firebase real-time listener ──
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "casal", "data"), (snap) => {
      if (snap.exists()) {
        setData(snap.data());
      }
      setSyncing(false);
    }, () => setSyncing(false));
    return () => unsub();
  }, []);

  // ── Derived helpers ──
  const todayLog      = (p) => data[p]?.[today] || defaultLog();
  const todayScore    = (p) => getScore(data[p]?.[today]);
  const totalScore    = (p) => Object.values(data[p] || {}).reduce((s, l) => s + getScore(l), 0);
  const streak        = (p) => calcStreak(data[p] || {});
  const completedCats = (p) => CATEGORIES.filter(c => { const v = todayLog(p)[c.id]; return v !== null && v !== undefined; }).length;

  // ── Save to Firestore ──
  async function saveOption(cat, idx) {
    if (!activePlayer) return;
    const newLog = { ...todayLog(activePlayer), [cat]: idx };
    const newData = {
      ...data,
      [activePlayer]: { ...(data[activePlayer] || {}), [today]: newLog }
    };
    setData(newData); // optimistic update
    await setDoc(doc(db, "casal", "data"), newData, { merge: true });

    const catIdx = CATEGORIES.findIndex(c => c.id === cat);
    if (catIdx < CATEGORIES.length - 1) {
      setTimeout(() => setExpandedCat(CATEGORIES[catIdx + 1].id), 300);
    } else {
      setExpandedCat(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setDoc(doc(db, "casal", "data"), data, { merge: true });
      showToast(`✅ Salvo! Bom trabalho, ${PLAYERS[activePlayer].name}!`);
      setTimeout(() => { setView("home"); setActivePlayer(null); setExpandedCat(null); setSaving(false); }, 1800);
    } catch (e) {
      showToast("❌ Erro ao salvar. Verifique a conexão.");
      setSaving(false);
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function goToLog(pid) {
    setActivePlayer(pid);
    setExpandedCat(CATEGORIES[0].id);
    setView("log");
  }

  const p1score = todayScore("player1");
  const p2score = todayScore("player2");
  const leader  = p1score > p2score ? "player1" : p2score > p1score ? "player2" : null;

  // ── CSS ──
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #080b12; overscroll-behavior: none; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }

    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; }

    .progress-bar { height: 6px; border-radius: 99px; background: rgba(255,255,255,0.07); overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 99px; transition: width 0.8s cubic-bezier(0.34,1.56,0.64,1); }

    .nav-btn {
      background: transparent; border: none; color: #475569;
      font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 700;
      padding: 8px 14px; cursor: pointer; border-radius: 12px; transition: all 0.2s;
      display: flex; flex-direction: column; align-items: center; gap: 3px; letter-spacing: 0.3px;
    }
    .nav-btn.active { color: #e2e8f0; background: rgba(255,255,255,0.07); }
    .nav-btn:hover:not(.active) { color: #94a3b8; }

    .player-pick-btn {
      flex: 1; border-radius: 18px; border: 2px solid transparent;
      cursor: pointer; transition: all 0.25s;
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      font-family: 'Sora', sans-serif; font-weight: 700;
    }
    .player-pick-btn:hover { transform: scale(1.03); }
    .player-pick-btn:active { transform: scale(0.97); }

    .option-row {
      border-radius: 14px; border: 1.5px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.03); padding: 13px 15px;
      cursor: pointer; transition: all 0.2s;
      display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
      font-family: 'Sora', sans-serif;
    }
    .option-row:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.14); }

    .cat-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; cursor: pointer; border-radius: 16px;
      transition: background 0.15s; user-select: none;
    }
    .cat-header:hover { background: rgba(255,255,255,0.03); }

    .cat-body { overflow: hidden; transition: max-height 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease; }

    .slide-up { animation: slideUp 0.35s cubic-bezier(0.22,1,0.36,1); }
    @keyframes slideUp { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }

    .bounce-in { animation: bounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes bounceIn { from{transform:scale(0.85);opacity:0} to{transform:scale(1);opacity:1} }

    .fade-in { animation: fadeIn 0.25s ease; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

    .save-btn {
      width: 100%; padding: 16px; border-radius: 16px; border: none;
      font-family: 'Sora', sans-serif; font-weight: 800; font-size: 15px;
      cursor: pointer; transition: all 0.2s; letter-spacing: 0.3px;
    }
    .save-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.08); }
    .save-btn:active:not(:disabled) { transform: translateY(0); }

    .tag { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 99px; font-size: 12px; font-weight: 600; }

    .toggle-pill { display: flex; background: rgba(255,255,255,0.05); border-radius: 14px; padding: 4px; border: 1px solid rgba(255,255,255,0.08); }
    .toggle-pill button { flex: 1; padding: 9px 12px; border-radius: 10px; border: none; font-family: 'Sora', sans-serif; font-weight: 700; font-size: 13px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }

    .sync-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }

    .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.15); border-top-color: #4ade80; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  if (syncing) return (
    <div style={{ minHeight: "100vh", background: "#080b12", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Sora', sans-serif", gap: 16 }}>
      <style>{css}</style>
      <div style={{ fontSize: 48 }}>💪</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#e2e8f0" }}>Casal Saudável</div>
      <div className="spinner" />
      <div style={{ fontSize: 12, color: "#475569" }}>Sincronizando com Firebase...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080b12", fontFamily: "'Sora', sans-serif", color: "#e2e8f0" }}>
      <style>{css}</style>

      {/* BG orbs */}
      <div style={{ position: "fixed", top: -120, left: -80, width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, #4ade8012 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, #f472b612 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Toast */}
      {toast && (
        <div className="fade-in" style={{ position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#4ade80,#22c55e)", color: "#052e16", padding: "12px 24px", borderRadius: 99, fontWeight: 800, fontSize: 13, zIndex: 999, boxShadow: "0 8px 30px #0008", whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "20px 20px 0", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#2d3f55", letterSpacing: 2.5, textTransform: "uppercase" }}>Casal Saudável</div>
            <div style={{ fontSize: 22, fontWeight: 900, background: "linear-gradient(100deg, #4ade80 0%, #f472b6 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              ⚡ Casal Saudável
            </div>
          </div>
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ fontSize: 12, color: "#2d3f55", fontWeight: 600 }}>
              {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div className="sync-dot" />
              <span style={{ fontSize: 10, color: "#334155", fontWeight: 600 }}>Ao vivo</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 20px 110px", maxWidth: 500, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* ════════════ HOME ════════════ */}
        {view === "home" && (
          <div className="slide-up">

            {/* Battle card */}
            <div className="card" style={{ padding: 20, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 1.5, textTransform: "uppercase" }}>Batalha de Hoje</span>
                {leader
                  ? <span className="tag" style={{ background: `${PLAYERS[leader].color}18`, color: PLAYERS[leader].color, border: `1px solid ${PLAYERS[leader].color}40` }}>👑 {PLAYERS[leader].name} na frente!</span>
                  : p1score > 0
                    ? <span className="tag" style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)" }}>⚖️ Empate</span>
                    : <span className="tag" style={{ background: "rgba(255,255,255,0.04)", color: "#475569", border: "1px solid rgba(255,255,255,0.07)" }}>Sem dados ainda</span>
                }
              </div>
              {["player1", "player2"].map((pid, i) => {
                const p = PLAYERS[pid];
                const score = todayScore(pid);
                const pct = Math.round((score / maxScore) * 100);
                const done = completedCats(pid);
                return (
                  <div key={pid} style={{ marginBottom: i === 0 ? 20 : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 42, height: 42, borderRadius: "50%", background: `${p.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, border: `2px solid ${p.color}50` }}>{p.emoji}</div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>
                            {done === 4 ? "✅ Dia completo" : done === 0 ? "Ainda sem registro" : `${done}/4 categorias`} · 🔥 {streak(pid)}d
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 30, fontWeight: 900, color: p.color, lineHeight: 1 }}>{score}</div>
                        <div style={{ fontSize: 11, color: "#334155" }}>/{maxScore} pts</div>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg,${p.color}70,${p.color})` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick register */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>📝 Registrar Hoje</div>
              <div style={{ display: "flex", gap: 10 }}>
                {["player1", "player2"].map(pid => {
                  const p = PLAYERS[pid];
                  const done = completedCats(pid) === 4;
                  return (
                    <button key={pid} className="player-pick-btn" onClick={() => goToLog(pid)} style={{ background: `${p.color}10`, border: `2px solid ${done ? p.color + "70" : p.color + "30"}`, color: p.color, padding: "20px 16px" }}>
                      <span style={{ fontSize: 30 }}>{done ? "✅" : p.emoji}</span>
                      <span style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 800 }}>{p.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{done ? "Completo hoje!" : `${completedCats(pid)}/4 feitos`}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category breakdown */}
            <div className="card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Categorias de Hoje</div>
              {CATEGORIES.map(cat => {
                const opts = OPTIONS_MAP[cat.id];
                const p1sel = data.player1?.[today]?.[cat.id];
                const p2sel = data.player2?.[today]?.[cat.id];
                const p1pts = (p1sel !== null && p1sel !== undefined) ? opts[p1sel].pts : null;
                const p2pts = (p2sel !== null && p2sel !== undefined) ? opts[p2sel].pts : null;
                return (
                  <div key={cat.id} style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat.emoji}</div>
                    <div style={{ flex: 1, marginLeft: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e0" }}>{cat.label}</div>
                      <div style={{ fontSize: 10, color: "#334155" }}>máx {cat.max} pts</div>
                    </div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: p1pts !== null ? PLAYERS.player1.color : "#1e293b" }}>{p1pts !== null ? p1pts : "—"}</div>
                        <div style={{ fontSize: 9, color: "#334155", fontWeight: 600 }}>Lucas</div>
                      </div>
                      <div style={{ width: 1, height: 22, background: "#1e293b" }} />
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: p2pts !== null ? PLAYERS.player2.color : "#1e293b" }}>{p2pts !== null ? p2pts : "—"}</div>
                        <div style={{ fontSize: 9, color: "#334155", fontWeight: 600 }}>Josi</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════ LOG ════════════ */}
        {view === "log" && (
          <div className="slide-up">

            {/* Pick player */}
            {!activePlayer && (
              <div>
                <div style={{ marginTop: 20, marginBottom: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 900 }}>📝 Registrar Dia</div>
                  <div style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>Quem está registrando agora?</div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                  {["player1", "player2"].map(pid => {
                    const p = PLAYERS[pid];
                    const done = completedCats(pid);
                    return (
                      <button key={pid} className="player-pick-btn"
                        onClick={() => { setActivePlayer(pid); setExpandedCat(CATEGORIES[0].id); }}
                        style={{ background: `${p.color}10`, border: `2px solid ${p.color}40`, color: p.color, padding: "28px 16px" }}
                      >
                        <span style={{ fontSize: 48 }}>{p.emoji}</span>
                        <span style={{ fontSize: 20, color: "#e2e8f0", fontWeight: 900 }}>{p.name}</span>
                        <div style={{ marginTop: 4, textAlign: "center" }}>
                          <div style={{ fontSize: 28, fontWeight: 900, color: p.color }}>{todayScore(pid)}</div>
                          <div style={{ fontSize: 11, color: "#475569" }}>{done}/4 categorias hoje</div>
                        </div>
                        <div style={{ background: `${p.color}20`, color: p.color, padding: "9px 22px", borderRadius: 99, fontSize: 13, fontWeight: 800, border: `1px solid ${p.color}50`, marginTop: 6 }}>
                          {done === 4 ? "✅ Editar" : done > 0 ? "Continuar →" : "Começar →"}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16, padding: "14px 18px", background: "rgba(255,255,255,0.02)", borderRadius: 14, textAlign: "center", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: 12, color: "#334155" }}>💡 Cada um registra suas próprias informações do dia</div>
                </div>
              </div>
            )}

            {/* Log form */}
            {activePlayer && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20, marginBottom: 18 }}>
                  <button onClick={() => { setActivePlayer(null); setExpandedCat(null); }} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 15, cursor: "pointer", borderRadius: 12, padding: "8px 14px", fontFamily: "Sora,sans-serif", fontWeight: 700 }}>← Voltar</button>
                  <div className="toggle-pill" style={{ flex: 1 }}>
                    {["player1", "player2"].map(pid => {
                      const p = PLAYERS[pid];
                      const isActive = activePlayer === pid;
                      return (
                        <button key={pid} onClick={() => { setActivePlayer(pid); setExpandedCat(CATEGORIES[0].id); }} style={{ background: isActive ? `${p.color}22` : "transparent", color: isActive ? p.color : "#475569" }}>
                          {p.emoji} {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Progress header */}
                <div className="card" style={{ padding: "14px 18px", marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Progresso de hoje</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: PLAYERS[activePlayer].color }}>{completedCats(activePlayer)}/4 categorias</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${(completedCats(activePlayer) / 4) * 100}%`, background: `linear-gradient(90deg,${PLAYERS[activePlayer].color}70,${PLAYERS[activePlayer].color})` }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "center", minWidth: 50 }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: PLAYERS[activePlayer].color, lineHeight: 1 }}>{todayScore(activePlayer)}</div>
                    <div style={{ fontSize: 10, color: "#334155" }}>pts</div>
                  </div>
                </div>

                {/* Accordion */}
                {CATEGORIES.map(cat => {
                  const opts = OPTIONS_MAP[cat.id];
                  const sel = todayLog(activePlayer)[cat.id];
                  const isOpen = expandedCat === cat.id;
                  const isDone = sel !== null && sel !== undefined;
                  const pColor = PLAYERS[activePlayer].color;
                  return (
                    <div key={cat.id} className="card" style={{ marginBottom: 10, overflow: "hidden", border: isDone ? `1px solid ${pColor}35` : "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="cat-header" onClick={() => setExpandedCat(isOpen ? null : cat.id)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: isDone ? `${pColor}20` : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                            {cat.emoji}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: isDone ? "#e2e8f0" : "#94a3b8" }}>{cat.label}</div>
                            <div style={{ fontSize: 11, color: isDone ? pColor : "#334155", marginTop: 1, fontWeight: 600 }}>
                              {isDone ? `${opts[sel].icon} ${opts[sel].label}` : "Toque para registrar"}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {isDone && <div style={{ fontSize: 22, fontWeight: 900, color: pColor }}>{opts[sel].pts}</div>}
                          <div style={{ fontSize: 18, color: "#334155", transition: "transform 0.25s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</div>
                        </div>
                      </div>
                      <div className="cat-body" style={{ maxHeight: isOpen ? 600 : 0, opacity: isOpen ? 1 : 0 }}>
                        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                          {opts.map((opt, i) => {
                            const isSelected = sel === i;
                            return (
                              <button key={i} className="option-row"
                                onClick={() => saveOption(cat.id, i)}
                                style={{ background: isSelected ? `${pColor}18` : "rgba(255,255,255,0.03)", border: isSelected ? `1.5px solid ${pColor}55` : "1.5px solid rgba(255,255,255,0.07)" }}
                              >
                                <div style={{ width: 38, height: 38, borderRadius: 10, background: isSelected ? `${pColor}25` : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{opt.icon}</div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? pColor : "#cbd5e0" }}>{opt.label}</div>
                                  <div style={{ fontSize: 11, color: isSelected ? `${pColor}90` : "#475569", marginTop: 1 }}>{opt.sublabel}</div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  <div style={{ fontSize: 17, fontWeight: 900, color: isSelected ? pColor : "#334155" }}>+{opt.pts}</div>
                                  <div style={{ fontSize: 10, color: "#334155" }}>pts</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button className="save-btn" onClick={handleSave} disabled={completedCats(activePlayer) === 0 || saving}
                  style={{
                    marginTop: 8,
                    background: completedCats(activePlayer) > 0 ? `linear-gradient(135deg,${PLAYERS[activePlayer].color},${PLAYERS[activePlayer].colorDark})` : "rgba(255,255,255,0.05)",
                    color: completedCats(activePlayer) > 0 ? (activePlayer === "player1" ? "#052e16" : "#fff") : "#334155",
                    opacity: completedCats(activePlayer) === 0 ? 0.5 : 1,
                    cursor: completedCats(activePlayer) === 0 ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {saving ? <><div className="spinner" style={{ borderTopColor: activePlayer === "player1" ? "#052e16" : "#fff" }} /> Salvando...</> : completedCats(activePlayer) === 4 ? "✅ Salvar Dia Completo" : completedCats(activePlayer) > 0 ? `💾 Salvar (${completedCats(activePlayer)}/4 categorias)` : "Selecione pelo menos 1 categoria"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════════ HISTORY ════════════ */}
        {view === "history" && (
          <div className="slide-up">
            <div style={{ marginTop: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>📅 Histórico</div>
              <div style={{ fontSize: 13, color: "#475569" }}>Últimos 7 dias</div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 14 }}>
                {weekDates.map(d => {
                  const day = new Date(d + "T12:00:00");
                  return <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: d === today ? "#e2e8f0" : "#334155" }}>{DAYS_PT[day.getDay()]}</div>;
                })}
              </div>
              {["player1", "player2"].map(pid => {
                const p = PLAYERS[pid];
                return (
                  <div key={pid} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: p.color, marginBottom: 8 }}>{p.emoji} {p.name}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
                      {weekDates.map(d => {
                        const score = getScore(data[pid]?.[d]);
                        const pct = score / maxScore;
                        return (
                          <div key={d} style={{ aspectRatio: "1", borderRadius: 10, background: score > 0 ? p.color : "rgba(255,255,255,0.05)", opacity: score > 0 ? (0.2 + pct * 0.8) : 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff", border: d === today ? `2px solid ${p.color}` : "2px solid transparent" }}>
                            {score > 0 ? score : ""}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card" style={{ padding: 20, marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Placar da Semana</div>
              {["player1", "player2"].map(pid => {
                const p = PLAYERS[pid];
                const weekScore = weekDates.reduce((s, d) => s + getScore(data[pid]?.[d]), 0);
                const pct = Math.round((weekScore / (maxScore * 7)) * 100);
                return (
                  <div key={pid} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{p.emoji}</span>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: 22, fontWeight: 900, color: p.color }}>{weekScore}</span>
                        <span style={{ fontSize: 11, color: "#475569" }}> ({pct}%)</span>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg,${p.color}70,${p.color})` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card" style={{ padding: 20, marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>Duelo por Categoria</div>
              {CATEGORIES.map(cat => {
                const opts = OPTIONS_MAP[cat.id];
                const calc = (pid) => weekDates.reduce((s, d) => {
                  const log = data[pid]?.[d];
                  if (!log || log[cat.id] === null || log[cat.id] === undefined) return s;
                  return s + opts[log[cat.id]].pts;
                }, 0);
                const p1t = calc("player1"), p2t = calc("player2");
                const maxCat = cat.max * 7;
                const catW = p1t > p2t ? "player1" : p2t > p1t ? "player2" : null;
                return (
                  <div key={cat.id} style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 13 }}>{cat.emoji} {cat.label} {catW ? <span style={{ color: PLAYERS[catW].color }}>👑</span> : ""}</span>
                      <span style={{ fontSize: 10, color: "#334155" }}>máx {maxCat}</span>
                    </div>
                    <div style={{ display: "flex", gap: 3, height: 10 }}>
                      <div style={{ flex: 1, borderRadius: "99px 0 0 99px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(p1t / maxCat) * 100}%`, background: PLAYERS.player1.color, borderRadius: "99px 0 0 99px" }} />
                      </div>
                      <div style={{ flex: 1, borderRadius: "0 99px 99px 0", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(p2t / maxCat) * 100}%`, background: PLAYERS.player2.color, borderRadius: "0 99px 99px 0", marginLeft: "auto" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: PLAYERS.player1.color }}>{p1t} pts</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: PLAYERS.player2.color }}>{p2t} pts</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11, color: PLAYERS.player1.color, fontWeight: 700 }}>🧔 Lucas</span>
                <span style={{ fontSize: 11, color: PLAYERS.player2.color, fontWeight: 700 }}>Josi 👩</span>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ RANKING ════════════ */}
        {view === "compare" && (
          <div className="slide-up">
            <div style={{ marginTop: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>🏆 Ranking Geral</div>
              <div style={{ fontSize: 13, color: "#475569" }}>Todos os tempos</div>
            </div>

            {(() => {
              const t1 = totalScore("player1"), t2 = totalScore("player2");
              const champ = t1 > t2 ? "player1" : t2 > t1 ? "player2" : null;
              if (!champ && t1 === 0) return (
                <div className="card" style={{ padding: 28, textAlign: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 40 }}>⚔️</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#475569", marginTop: 10 }}>A batalha ainda não começou!</div>
                  <div style={{ fontSize: 13, color: "#334155", marginTop: 4 }}>Registrem o primeiro dia para ver o ranking</div>
                </div>
              );
              if (!champ) return (
                <div className="card" style={{ padding: 28, textAlign: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 40 }}>⚖️</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>Empate total!</div>
                  <div style={{ fontSize: 14, color: "#475569", marginTop: 4 }}>{t1} pontos cada</div>
                </div>
              );
              const p = PLAYERS[champ];
              return (
                <div className="bounce-in card" style={{ padding: 28, textAlign: "center", background: `linear-gradient(135deg,${p.bg}dd,#080b12)`, border: `2px solid ${p.color}50`, marginBottom: 12 }}>
                  <div style={{ fontSize: 56 }}>👑</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: p.color, marginTop: 8 }}>{p.emoji} {p.name}</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Liderando com</div>
                  <div style={{ fontSize: 48, fontWeight: 900, color: p.color, lineHeight: 1.1 }}>{Math.abs(t1 - t2)}</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>pontos de vantagem</div>
                </div>
              );
            })()}

            {["player1", "player2"].map(pid => {
              const p = PLAYERS[pid];
              const allDays = Object.keys(data[pid] || {});
              const activeDays = allDays.filter(d => getScore(data[pid][d]) > 0).length;
              const avg = activeDays > 0 ? Math.round(totalScore(pid) / activeDays) : 0;
              const best = allDays.reduce((b, d) => Math.max(b, getScore(data[pid][d])), 0);
              return (
                <div key={pid} className="card" style={{ padding: 20, marginBottom: 12, border: `1px solid ${p.color}25` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 16, background: `${p.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, border: `2px solid ${p.color}50` }}>{p.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: p.color }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "#475569" }}>🔥 Streak: {streak(pid)} dias</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 38, fontWeight: 900, color: p.color, lineHeight: 1 }}>{totalScore(pid)}</div>
                      <div style={{ fontSize: 11, color: "#334155" }}>pts totais</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Dias ativos", value: activeDays, icon: "📅" },
                      { label: "Média/dia",   value: avg,        icon: "📊" },
                      { label: "Melhor dia",  value: best,       icon: "⭐" },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: "center", background: `${p.color}0a`, borderRadius: 14, padding: "12px 8px", border: `1px solid ${p.color}20` }}>
                        <div style={{ fontSize: 18 }}>{s.icon}</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: p.color, marginTop: 4 }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>🎖️ Conquistas</div>
              {["player1", "player2"].map(pid => {
                const p = PLAYERS[pid];
                const str = streak(pid);
                const best = Object.keys(data[pid] || {}).reduce((b, d) => Math.max(b, getScore(data[pid][d])), 0);
                const acts = [
                  str >= 3  && { emoji: "🔥", label: "3 dias seguidos" },
                  str >= 7  && { emoji: "⚡", label: "Semana perfeita" },
                  str >= 14 && { emoji: "🌟", label: "2 semanas seguidas" },
                  best >= maxScore && { emoji: "💯", label: "Dia perfeito" },
                  best >= 80       && { emoji: "⭐", label: "Quase perfeito" },
                  Object.keys(data[pid] || {}).length >= 7 && { emoji: "📅", label: "7 dias de app" },
                  totalScore(pid) >= 500 && { emoji: "🏅", label: "500 pontos totais" },
                ].filter(Boolean);
                return (
                  <div key={pid} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: p.color, marginBottom: 8 }}>{p.emoji} {p.name}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {acts.length > 0 ? acts.map((a, i) => (
                        <div key={i} className="tag" style={{ background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}40` }}>
                          {a.emoji} {a.label}
                        </div>
                      )) : (
                        <div style={{ fontSize: 12, color: "#334155", fontStyle: "italic" }}>Continue registrando para desbloquear conquistas!</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(8,11,18,0.97)", backdropFilter: "blur(24px)", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-around", padding: "10px 0 20px", zIndex: 10 }}>
        {[
          { id: "home",    emoji: "🏠", label: "Início"    },
          { id: "log",     emoji: "📝", label: "Registrar" },
          { id: "history", emoji: "📅", label: "Histórico" },
          { id: "compare", emoji: "🏆", label: "Ranking"   },
        ].map(item => (
          <button key={item.id}
            className={`nav-btn ${view === item.id ? "active" : ""}`}
            onClick={() => { setView(item.id); if (item.id !== "log") { setActivePlayer(null); setExpandedCat(null); } }}
          >
            <span style={{ fontSize: 20 }}>{item.emoji}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
