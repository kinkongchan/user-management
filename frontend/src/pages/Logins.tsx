import { useEffect, useState } from "react";

import { fetchLogins, loginsUrl, type LoginRecord } from "../api";
import { useAuth } from "../auth";

export function Logins() {
  const { getToken } = useAuth();
  const [logins, setLogins] = useState<LoginRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = await getToken();
      if (!token) {
        setError("Not signed in");
        setLoading(false);
        return;
      }
      try {
        const data = await fetchLogins(token);
        if (!cancelled) {
          setLogins(data.logins);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load logins");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <main className="card wide">
      <h1>User logins</h1>
      <p className="muted">Every authenticated visit to /hello is stored with a timestamp.</p>
      <p className="endpoint">
        GET <code>{loginsUrl}</code>
      </p>
      {loading ? <p className="muted">Loading...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && !error ? (
        <table>
          <thead>
            <tr>
              <th>User id</th>
              <th>Login time</th>
            </tr>
          </thead>
          <tbody>
            {logins.length === 0 ? (
              <tr>
                <td colSpan={2}>No logins yet. Open the Hello page first.</td>
              </tr>
            ) : (
              logins.map((row) => (
                <tr key={`${row.user_id}-${row.login_time}`}>
                  <td>
                    <code>{row.user_id}</code>
                  </td>
                  <td>{new Date(row.login_time).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
