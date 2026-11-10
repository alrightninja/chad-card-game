import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [error, setError] = useState(token ? "" : "This reset link is missing a token.");
  const [form, setForm] = useState({ newPassword: "", newPasswordConfirm: "" });

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          newPassword: form.newPassword,
          newPasswordConfirm: form.newPasswordConfirm
        })
      });
      navigate("/login", { replace: true, state: { notice: "Password updated. Log in with your new password." } });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth panel">
      <h1 style={{ marginTop: 0 }}>Reset password</h1>
      <p className="muted">Choose a new password for your account.</p>
      <form className="stack" onSubmit={onSubmit} style={{ marginTop: "1rem" }}>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
            minLength={6}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            value={form.newPasswordConfirm}
            onChange={(e) => setForm((p) => ({ ...p, newPasswordConfirm: e.target.value }))}
            minLength={6}
            required
          />
        </label>
        {error ? <div className="error">{error}</div> : null}
        <button className="btn" type="submit" disabled={!token}>
          Update password
        </button>
      </form>
      <p className="muted" style={{ marginTop: "1rem" }}>
        <Link to="/login">Back to log in</Link>
      </p>
    </div>
  );
}
