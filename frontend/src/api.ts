const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);

async function authorizedGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type HelloResponse = {
  message: string;
  user_id: string;
};

export type LoginRecord = {
  user_id: string;
  login_time: string;
};

export type LoginListResponse = {
  logins: LoginRecord[];
};

export function fetchHello(token: string): Promise<HelloResponse> {
  return authorizedGet<HelloResponse>("/hello", token);
}

export function fetchLogins(token: string): Promise<LoginListResponse> {
  return authorizedGet<LoginListResponse>("/logins", token);
}

export const loginsUrl = `${apiUrl}/logins`;
export const helloUrl = `${apiUrl}/hello`;
