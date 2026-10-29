import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setReady(true);
      return;
    }
    api("/api/me")
      .then((data) => setUser(data.user))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      setUser,
      async login(email, password) {
        const data = await api("/api/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        setToken(data.token);
        setUser(data.user);
        return data.user;
      },
      async register(payload) {
        const data = await api("/api/register", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        setToken(data.token);
        setUser(data.user);
        return data.user;
      },
      logout() {
        setToken(null);
        setUser(null);
      },
      async refresh() {
        const data = await api("/api/me");
        setUser(data.user);
        return data.user;
      }
    }),
    [user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
