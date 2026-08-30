import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

if (!userPoolId || !clientId) {
  console.warn(
    "Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID in frontend/.env",
  );
}

export const userPool = new CognitoUserPool({
  UserPoolId: userPoolId || "us-west-2_placeholder",
  ClientId: clientId || "placeholder",
});

function getUser(email: string): CognitoUser {
  return new CognitoUser({
    Username: email,
    Pool: userPool,
  });
}

export function signUp(email: string, password: string): Promise<void> {
  const attributes = [
    new CognitoUserAttribute({ Name: "email", Value: email }),
  ];

  return new Promise((resolve, reject) => {
    userPool.signUp(email, password, attributes, [], (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getUser(email).confirmRegistration(code, true, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  const details = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  return new Promise((resolve, reject) => {
    getUser(email).authenticateUser(details, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
    });
  });
}

export function signOut(): void {
  const current = userPool.getCurrentUser();
  current?.signOut();
}

export function getCurrentSession(): Promise<CognitoUserSession | null> {
  const current = userPool.getCurrentUser();
  if (!current) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    current.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) {
        resolve(null);
        return;
      }
      resolve(session);
    });
  });
}

export async function getIdToken(): Promise<string | null> {
  const session = await getCurrentSession();
  return session?.getIdToken().getJwtToken() ?? null;
}

export function getUserIdFromSession(session: CognitoUserSession): string {
  return session.getIdToken().payload.sub as string;
}
