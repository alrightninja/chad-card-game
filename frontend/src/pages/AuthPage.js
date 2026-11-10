import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { EULA_TEXT, EULA_TITLE } from "../legal/eula";

export default function AuthPage() {
  const { login, register } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [form, setForm] = useState({
    email: "",
    emailConfirm: "",
    username: "",
    password: "",
    passwordConfirm: "",
    termsAccepted: false
  });

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        const data = await api("/api/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: form.email })
        });
        setNotice(data.message || "If that email is on an account, we sent a reset link.");
        return;
      }
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        if (form.email.trim().toLowerCase() !== form.emailConfirm.trim().toLowerCase()) {
          throw new Error("Email addresses do not match. Check the spelling.");
        }
        if (form.password !== form.passwordConfirm) {
          throw new Error("Passwords do not match.");
        }
        await register({
          email: form.email,
          emailConfirm: form.emailConfirm,
          username: form.username,
          password: form.password,
          passwordConfirm: form.passwordConfirm,
          termsAccepted: form.termsAccepted
        });
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth panel">
      <h1 style={{ marginTop: 0 }}>Gigachad TCG</h1>
      <p className="muted">A turn-based trading card game.</p>
      <div className="row">
        <button className={`btn ${mode === "login" ? "" : "secondary"}`} type="button" onClick={() => setMode("login")}>
          Log in
        </button>
        <button className={`btn ${mode === "register" ? "" : "secondary"}`} type="button" onClick={() => setMode("register")}>
          Sign up
        </button>
      </div>
      <form className="stack" onSubmit={onSubmit} style={{ marginTop: "1rem" }}>
        <label>
          Email
          <input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" required />
        </label>
        {mode === "forgot" ? (
          <>
            <p className="muted">We will email a link so you can choose a new password.</p>
            {notice ? <p className="muted">{notice}</p> : null}
            {error ? <div className="error">{error}</div> : null}
            <button className="btn" type="submit">
              Send reset link
            </button>
            <button className="btn secondary" type="button" onClick={() => setMode("login")}>
              Back to log in
            </button>
          </>
        ) : (
          <>
        {mode === "register" ? (
          <label>
            Confirm email
            <input
              value={form.emailConfirm}
              onChange={(e) => update("emailConfirm", e.target.value)}
              type="email"
              required
              autoComplete="email"
            />
          </label>
        ) : null}
        {mode === "register" ? (
          <label>
            Username
            <input value={form.username} onChange={(e) => update("username", e.target.value)} required />
          </label>
        ) : null}
        <label>
          Password
          <input value={form.password} onChange={(e) => update("password", e.target.value)} type="password" required />
        </label>
        {mode === "register" ? (
          <label>
            Confirm password
            <input
              value={form.passwordConfirm}
              onChange={(e) => update("passwordConfirm", e.target.value)}
              type="password"
              required
              autoComplete="new-password"
            />
          </label>
        ) : null}
        {mode === "register" ? (
          <>
            <div>
              <strong>{EULA_TITLE}</strong>
              <div className="eula">{EULA_TEXT}</div>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={form.termsAccepted}
                onChange={(e) => update("termsAccepted", e.target.checked)}
              />
              I accept these terms.
            </label>
          </>
        ) : null}
        {notice ? <p className="muted">{notice}</p> : null}
        {error ? <div className="error">{error}</div> : null}
        <button className="btn" type="submit">
          {mode === "login" ? "Enter" : "Create account"}
        </button>
        {mode === "login" ? (
          <button className="btn secondary" type="button" onClick={() => setMode("forgot")}>
            Forgot password?
          </button>
        ) : null}
          </>
        )}
      </form>
    </div>
  );
}
