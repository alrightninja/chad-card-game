import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { api, getToken } from "../api/client";
import { WS_URL } from "../api/config";

const SocialInboxContext = createContext({
  notice: null,
  turnMatches: [],
  ping: 0,
  clearNotice: () => {}
});

function collectTurns(data) {
  const corr = data?.correspondences || (data?.correspondence ? [data.correspondence] : []);
  return corr.filter((m) => m.yourTurn);
}

export function SocialInboxProvider({ children }) {
  const [notice, setNotice] = useState(null);
  const [turnMatches, setTurnMatches] = useState([]);
  const [ping, setPing] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;
    const socket = io(WS_URL, { auth: { token } });
    const bump = (nextNotice) => {
      if (nextNotice) setNotice(nextNotice);
      setPing((n) => n + 1);
    };
    async function refreshTurns() {
      try {
        const data = await api("/api/matches/active");
        setTurnMatches(collectTurns(data));
      } catch {
        setTurnMatches([]);
      }
    }
    refreshTurns();
    const timer = window.setInterval(refreshTurns, 20000);
    socket.on("challenge_update", (payload) => {
      if (payload?.kind === "accepted" && payload.matchId) {
        bump({
          text: "Your challenge was accepted. Join the match.",
          href: `/battle/${payload.matchId}`
        });
      } else if (payload?.kind === "incoming") {
        bump({ text: "New battle challenge.", href: "/play" });
      } else if (payload?.kind === "declined") {
        bump({ text: "A challenge was declined.", href: "/play" });
      } else {
        bump({ text: "Challenge update.", href: "/play" });
      }
      refreshTurns();
    });
    socket.on("direct_message", () => {
      bump({ text: "New message from a friend.", href: "/friends" });
    });
    socket.on("trade_update", (payload) => {
      if (payload?.kind === "incoming") {
        bump({ text: "New trade offer.", href: "/friends" });
      } else if (payload?.kind === "accepted") {
        bump({ text: "A trade was accepted.", href: "/friends" });
      } else if (payload?.kind === "counter") {
        bump({ text: "A friend sent a counter-offer.", href: "/friends" });
      } else {
        bump({ text: "Trade update.", href: "/friends" });
      }
    });
    socket.on("your_turn", () => {
      refreshTurns();
    });
    return () => {
      window.clearInterval(timer);
      socket.disconnect();
    };
  }, []);

  return (
    <SocialInboxContext.Provider value={{ notice, turnMatches, ping, clearNotice: () => setNotice(null) }}>
      {children}
    </SocialInboxContext.Provider>
  );
}

export function useSocialInbox() {
  return useContext(SocialInboxContext);
}
