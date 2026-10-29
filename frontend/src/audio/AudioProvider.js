import { createContext, useContext, useEffect, useState } from "react";
import { playSfx, unlockSfx } from "./sfx";

const AudioContextValue = createContext(null);

const MUSIC_KEY = "gigachad_music";

const PLAYLIST = [
  "/audio/where-did-the-gains-go.mp3",
  "/audio/no-power-without-pain.mp3",
  "/audio/the-prophecy-spoken.mp3",
  "/audio/im-doing-everything-right.mp3",
  "/audio/ultra-nightmare-mode.mp3",
  "/audio/to-the-hilt.mp3"
];

function bgmState() {
  if (typeof window === "undefined") return null;
  if (!window.__gigachadBgm) {
    window.__gigachadBgm = {
      el: null,
      index: 0,
      enabled: false
    };
  }
  return window.__gigachadBgm;
}

function getPlayer() {
  const state = bgmState();
  if (!state) return null;
  if (!state.el) {
    const el = new Audio();
    el.preload = "auto";
    el.volume = 0.38;
    el.addEventListener("ended", () => {
      const current = bgmState();
      if (!current?.enabled) return;
      current.index = (current.index + 1) % PLAYLIST.length;
      el.src = PLAYLIST[current.index];
      el.play().catch(() => {});
    });
    state.el = el;
  }
  return state.el;
}

function stopMusic() {
  const state = bgmState();
  if (!state) return;
  state.enabled = false;
  if (state.el) {
    state.el.pause();
  }
}

function startMusic() {
  const state = bgmState();
  const el = getPlayer();
  if (!state || !el) return;
  state.enabled = true;
  const src = PLAYLIST[state.index];
  if (!el.src || !el.src.endsWith(src)) {
    el.src = src;
  }
  el.play().catch(() => {});
}

function readStoredEnabled() {
  try {
    return localStorage.getItem(MUSIC_KEY) === "on";
  } catch {
    return false;
  }
}

export function AudioProvider({ children }) {
  const [enabled, setEnabledState] = useState(readStoredEnabled);

  function setEnabled(next) {
    setEnabledState(next);
    try {
      localStorage.setItem(MUSIC_KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (next) startMusic();
    else stopMusic();
  }

  useEffect(() => {
    getPlayer();
    if (readStoredEnabled()) startMusic();
    else stopMusic();

    const unlock = () => {
      unlockSfx();
      if (bgmState()?.enabled) startMusic();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  return (
    <AudioContextValue.Provider
      value={{
        enabled,
        setEnabled,
        setTrack: () => {},
        playSfx
      }}
    >
      {children}
    </AudioContextValue.Provider>
  );
}

export function useAudio() {
  return useContext(AudioContextValue);
}
