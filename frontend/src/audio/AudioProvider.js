import { createContext, useContext, useEffect, useState } from "react";
import { playSfx, unlockSfx } from "./sfx";
import { pickNextIndex, reshuffleOrder } from "./shufflePlaylist";

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
      lastIndex: -1,
      queue: reshuffleOrder(PLAYLIST.length, -1),
      enabled: false
    };
  }
  return window.__gigachadBgm;
}

function takeNextTrack() {
  const state = bgmState();
  if (!state) return PLAYLIST[0];
  if (!state.queue.length) {
    state.queue = reshuffleOrder(PLAYLIST.length, state.lastIndex);
  }
  let next = state.queue.shift();
  if (next === state.lastIndex) {
    next = pickNextIndex(PLAYLIST.length, state.lastIndex);
  }
  state.lastIndex = next;
  state.index = next;
  return PLAYLIST[next];
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
      el.src = takeNextTrack();
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
    try {
      state.el.pause();
    } catch {
      /* jsdom has no media */
    }
  }
}

function startMusic() {
  const state = bgmState();
  const el = getPlayer();
  if (!state || !el) return;
  state.enabled = true;
  if (!el.src || el.paused) {
    el.src = takeNextTrack();
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
