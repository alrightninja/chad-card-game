import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { EULA_TEXT, EULA_TITLE } from "../legal/eula";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
    termsAccepted: false,
    guardianPermission: false
  });

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register({
          email: form.email,
          username: form.username,
          password: form.password,
          termsAccepted: form.termsAccepted,
          guardianPermission: form.guardianPermission
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
            <label className="check">
              <input
                type="checkbox"
                checked={form.guardianPermission}
                onChange={(e) => update("guardianPermission", e.target.checked)}
              />
              I am 18 or older, or I have permission from a parent or guardian.
            </label>
          </>
        ) : null}
        {error ? <div className="error">{error}</div> : null}
        <button className="btn" type="submit">
          {mode === "login" ? "Enter" : "Create account"}
        </button>
      </form>
    </div>
  );
}
