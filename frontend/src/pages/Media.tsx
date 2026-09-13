import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  completeMediaUpload,
  deleteMedia,
  fetchMedia,
  mediaUrl,
  startMediaUpload,
  type MediaRecord,
} from "../api";
import { useAuth } from "../auth";

const PART_SIZE = 500 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function uploadPart(
  url: string,
  blob: Blob,
  onProgress: (loaded: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };
    xhr.onload = () => {
      onProgress(blob.size);
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(new Error("S3 did not return an ETag"));
          return;
        }
        resolve(etag.replaceAll('"', ""));
        return;
      }
      reject(new Error(`Part upload failed with ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Could not upload this part to S3"));
    xhr.send(blob);
  });
}

export function Media() {
  const { getToken } = useAuth();
  const [rows, setRows] = useState<MediaRecord[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const loadRows = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setError("Not signed in");
      setLoading(false);
      return;
    }
    const data = await fetchMedia(token);
    setRows(data.media);
    setError("");
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await loadRows();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load media");
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
  }, [loadRows]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose an image or video");
      return;
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Only image and video files are allowed");
      return;
    }
    setError("");
    setStatus("Starting upload...");
    setProgress(0);
    setPending(true);
    const loadedByPart = new Map<number, number>();
    const reportProgress = () => {
      let loaded = 0;
      loadedByPart.forEach((value) => {
        loaded += value;
      });
      setProgress(Math.min(100, Math.round((loaded / file.size) * 100)));
    };
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      const started = await startMediaUpload(token, {
        file_name: file.name,
        content_type: file.type || "application/octet-stream",
        file_size: file.size,
      });
      setStatus(`Uploading ${started.parts.length} part(s) in parallel...`);
      const completedParts = await Promise.all(
        started.parts.map(async (part) => {
          const start = (part.part_number - 1) * PART_SIZE;
          const end = Math.min(start + PART_SIZE, file.size);
          const etag = await uploadPart(part.url, file.slice(start, end, ""), (loaded) => {
            loadedByPart.set(part.part_number, loaded);
            reportProgress();
          });
          return { part_number: part.part_number, etag };
        }),
      );
      setProgress(100);
      setStatus("Completing upload...");
      await completeMediaUpload(token, started.id, completedParts);
      setFile(null);
      setStatus("Upload complete");
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStatus("");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(row: MediaRecord) {
    setError("");
    setDeletingId(row.id);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not signed in");
      }
      await deleteMedia(token, row.id);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="card wide">
      <h1>Media</h1>
      <p className="muted">Upload an image or video. Parts of 500 MB upload in parallel to S3.</p>
      <p className="endpoint">
        GET <code>{mediaUrl}</code>
      </p>
      <form onSubmit={onSubmit}>
        <label>
          File
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setProgress(0);
              setStatus("");
            }}
            disabled={pending}
          />
        </label>
        {status ? <p className="muted">{status}</p> : null}
        {pending || progress > 0 ? (
          <div
            className="upload-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Upload progress"
          >
            <div className="upload-progress-track">
              <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <span className="upload-progress-label">{progress}%</span>
          </div>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={pending || !file}>
          {pending ? "Uploading..." : "Upload"}
        </button>
      </form>
      {loading ? <p className="muted">Loading...</p> : null}
      {!loading ? (
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Uploaded file</th>
              <th>File size</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4}>No uploads yet.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.timestamp).toLocaleString()}</td>
                  <td>
                    <a href={row.url} target="_blank" rel="noreferrer">
                      {row.file_name}
                    </a>
                  </td>
                  <td>{formatSize(row.file_size)}</td>
                  <td>
                    <button
                      type="button"
                      className="danger"
                      disabled={pending || deletingId === row.id}
                      onClick={() => void onDelete(row)}
                    >
                      {deletingId === row.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
