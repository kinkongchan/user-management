import type { ReactElement } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth";
import { Confirm } from "./pages/Confirm";
import { Hello } from "./pages/Hello";
import { Login } from "./pages/Login";
import { Logins } from "./pages/Logins";
import { Signup } from "./pages/Signup";

function RequireAuth({ children }: { children: ReactElement }) {
  const { ready, userId } = useAuth();
  if (!ready) {
    return <p className="muted center">Loading session...</p>;
  }
  if (!userId) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export function App() {
  const { userId, logout, ready } = useAuth();

  return (
    <div className="page">
      <header className="nav">
        <span className="brand">User Management</span>
        <nav>
          {userId ? (
            <>
              <NavLink to="/hello">Hello</NavLink>
              <NavLink to="/logins">Logins</NavLink>
              <button type="button" className="linkish" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/signup">Sign up</NavLink>
            </>
          )}
        </nav>
      </header>
      {ready ? (
        <Routes>
          <Route path="/" element={<Navigate to={userId ? "/hello" : "/login"} replace />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/confirm" element={<Confirm />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/hello"
            element={
              <RequireAuth>
                <Hello />
              </RequireAuth>
            }
          />
          <Route
            path="/logins"
            element={
              <RequireAuth>
                <Logins />
              </RequireAuth>
            }
          />
        </Routes>
      ) : (
        <p className="muted center">Loading session...</p>
      )}
    </div>
  );
}
