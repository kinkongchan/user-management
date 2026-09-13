import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await login(email, password);
      navigate("/media");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="card">
      <h1>Log in</h1>
      <p className="muted">Sign in with your Cognito user.</p>
      <form onSubmit={onSubmit}>
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
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Signing in..." : "Log in"}
        </button>
      </form>
      <p>
        Need an account? <Link to="/signup">Sign up</Link>
        {" · "}
        <Link to="/confirm">Confirm email</Link>
        {" · "}
        <Link
          to={
            email
              ? `/reset-password?email=${encodeURIComponent(email)}`
              : "/reset-password"
          }
        >
          Forgot password?
        </Link>
      </p>
    </main>
  );
}
