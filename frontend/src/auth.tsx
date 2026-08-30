import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CognitoUserSession } from "amazon-cognito-identity-js";

import {
  getCurrentSession,
  getIdToken,
  getUserIdFromSession,
  signIn,
  signOut as cognitoSignOut,
} from "./cognito";

type AuthContextValue = {
  ready: boolean;
  userId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const applySession = useCallback((session: CognitoUserSession | null) => {
    setUserId(session ? getUserIdFromSession(session) : null);
  }, []);

  useEffect(() => {
    getCurrentSession()
      .then(applySession)
      .finally(() => setReady(true));
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await signIn(email, password);
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(() => {
    cognitoSignOut();
    setUserId(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      userId,
      login,
      logout,
      getToken: getIdToken,
    }),
    [ready, userId, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
