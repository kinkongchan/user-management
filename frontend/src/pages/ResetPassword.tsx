import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { confirmResetPassword, forgotPassword } from "../cognito";

export function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onRequestCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await forgotPassword(email);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset code");
    } finally {
      setPending(false);
    }
  }

  async function onConfirm(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await confirmResetPassword(email, code, password);
      navigate("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="card">
      <h1>Reset password</h1>
      {step === "request" ? (
        <>
          <p className="muted">
            Enter your email. If that account exists, Cognito will send a reset code.
          </p>
          <form onSubmit={onRequestCode}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" disabled={pending}>
              {pending ? "Sending..." : "Send reset code"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="muted">
            If that email is registered, Cognito sent a code. Enter it and choose a new
            password.
          </p>
          <form onSubmit={onConfirm}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              Reset code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="one-time-code"
              />
            </label>
            <label>
              New password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <p className="hint">At least 8 characters, with upper, lower, and a number.</p>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" disabled={pending}>
              {pending ? "Updating..." : "Update password"}
            </button>
          </form>
        </>
      )}
      <p>
        Remembered it? <Link to="/login">Log in</Link>
      </p>
    </main>
  );
}
