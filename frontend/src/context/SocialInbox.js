import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getToken } from "../api/client";
import { WS_URL } from "../api/config";

const SocialInboxContext = createContext({
  notice: null,
  ping: 0,
  clearNotice: () => {}
});

export function SocialInboxProvider({ children }) {
  const [notice, setNotice] = useState(null);
  const [ping, setPing] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;
    const socket = io(WS_URL, { auth: { token } });
    const bump = (nextNotice) => {
      if (nextNotice) setNotice(nextNotice);
      setPing((n) => n + 1);
    };
    socket.on("challenge_update", (payload) => {
      if (payload?.kind === "accepted" && payload.matchId) {
        bump({
          text: "Your challenge was accepted. Join the match.",
          href: `/battle/${payload.matchId}`
        });
      } else if (payload?.kind === "incoming") {
        bump({ text: "New battle challenge.", href: "/friends" });
      } else if (payload?.kind === "declined") {
        bump({ text: "A challenge was declined.", href: "/friends" });
      } else {
        bump({ text: "Challenge update.", href: "/friends" });
      }
    });
    socket.on("direct_message", () => {
      bump({ text: "New message from a friend.", href: "/friends" });
    });
    return () => socket.disconnect();
  }, []);

  return (
    <SocialInboxContext.Provider value={{ notice, ping, clearNotice: () => setNotice(null) }}>
      {children}
    </SocialInboxContext.Provider>
  );
}

export function useSocialInbox() {
  return useContext(SocialInboxContext);
}
