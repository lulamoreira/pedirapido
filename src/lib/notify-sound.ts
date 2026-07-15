// Sintetiza um "ding-dong" de novo pedido usando Web Audio API — sem asset.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC: typeof AudioContext | undefined =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function beep(freq: number, startAt: number, dur = 0.28, gain = 0.22) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + startAt;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Toca um alerta curto ("ding-dong-ding") estilo delivery. */
export function playNewOrderChime() {
  // Toca 3 tons em sequência para funcionar bem mesmo com aba em segundo plano.
  beep(880, 0, 0.25);
  beep(1174, 0.22, 0.25);
  beep(1567, 0.44, 0.35, 0.28);
}

/** Deve ser chamado após um gesto do usuário (clique) para desbloquear o áudio. */
export function unlockAudio() {
  getCtx();
}
