import { useEffect, useState } from "react";

import { fetchHello } from "../api";
import { useAuth } from "../auth";

export function Hello() {
  const { getToken, userId } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = await getToken();
      if (!token) {
        setError("Not signed in");
        return;
      }
      try {
        const data = await fetchHello(token);
        if (!cancelled) {
          setMessage(data.message);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load hello");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <main className="card">
      <h1>Hello</h1>
      <p className="muted">User id from Cognito after API Gateway (or local JWT) verification.</p>
      {message ? <p className="hello">{message}</p> : null}
      {userId && !message && !error ? <p className="muted">Loading...</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
