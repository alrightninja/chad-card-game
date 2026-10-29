let ctx;

function context() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone({ freq, duration = 0.12, type = "square", volume = 0.08, slide = 0 }) {
  const audio = context();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq + slide),
      audio.currentTime + duration
    );
  }
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

export function unlockSfx() {
  context();
}

export function playSfx(name) {
  switch (name) {
    case "select":
      tone({ freq: 520, duration: 0.05, volume: 0.04, type: "triangle" });
      break;
    case "play":
      tone({ freq: 330, duration: 0.09, type: "triangle" });
      setTimeout(() => tone({ freq: 490, duration: 0.12, type: "triangle" }), 70);
      break;
    case "draw":
      tone({ freq: 880, duration: 0.07, type: "sine", volume: 0.05 });
      break;
    case "attack":
      tone({ freq: 140, duration: 0.16, type: "sawtooth", volume: 0.1, slide: -80 });
      setTimeout(() => tone({ freq: 90, duration: 0.18, type: "square", volume: 0.07 }), 40);
      break;
    case "ko":
      tone({ freq: 220, duration: 0.28, type: "sawtooth", volume: 0.09, slide: -160 });
      break;
    case "endTurn":
      tone({ freq: 260, duration: 0.1, type: "sine", volume: 0.05 });
      setTimeout(() => tone({ freq: 200, duration: 0.12, type: "sine", volume: 0.04 }), 90);
      break;
    case "error":
      tone({ freq: 160, duration: 0.14, type: "square", volume: 0.06 });
      break;
    default:
      break;
  }
}
