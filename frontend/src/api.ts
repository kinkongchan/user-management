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

async function authorizedPost<T>(path: string, token: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type MediaPartUrl = {
  part_number: number;
  url: string;
};

export type MediaUploadResponse = {
  id: number;
  upload_id: string;
  parts: MediaPartUrl[];
};

export type MediaRecord = {
  id: number;
  timestamp: string;
  file_name: string;
  file_size: number;
  url: string;
};

export type MediaListResponse = {
  media: MediaRecord[];
};

export function fetchMedia(token: string): Promise<MediaListResponse> {
  return authorizedGet<MediaListResponse>("/media", token);
}

export function startMediaUpload(
  token: string,
  body: { file_name: string; content_type: string; file_size: number },
): Promise<MediaUploadResponse> {
  return authorizedPost<MediaUploadResponse>("/media/uploads", token, body);
}

export function completeMediaUpload(
  token: string,
  mediaId: number,
  parts: { part_number: number; etag: string }[],
): Promise<{ status: string }> {
  return authorizedPost<{ status: string }>(`/media/uploads/${mediaId}/complete`, token, {
    parts,
  });
}

export async function deleteMedia(
  token: string,
  mediaId: number,
): Promise<{ status: string }> {
  const response = await fetch(`${apiUrl}/media/${mediaId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<{ status: string }>;
}

export const loginsUrl = `${apiUrl}/logins`;
export const helloUrl = `${apiUrl}/hello`;
export const mediaUrl = `${apiUrl}/media`;
