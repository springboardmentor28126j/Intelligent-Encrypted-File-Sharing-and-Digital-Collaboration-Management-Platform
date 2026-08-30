/**
 * api.ts – Centralized API client for TrustShare frontend.
 *
 * Provides methods for:
 *   - Authentication (register, login, logout, get current user profile)
 *   - File management (upload with progress, list with search/filter, download, delete)
 *   - File sharing (generate share link with expiration & permissions, revoke share)
 *   - Public share recipient access & downloads
 *   - Storage statistics & system health diagnostics (Postgres, MongoDB, Redis)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserOut {
  id: number;
  full_name: string;
  email: string;
  role: "admin" | "user";
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface MessageResponse {
  message: string;
  success?: boolean;
}

export type FileCategory =
  | "document"
  | "pdf"
  | "image"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "other";

export type SharePermission = "view_only" | "can_download";

export type ShareDuration = "1h" | "24h" | "7d" | "30d" | "never" | "custom";

export interface ShareLink {
  share_token: string;
  share_url: string;
  permission: SharePermission;
  expires_at?: string | null;
  max_downloads?: number | null;
  download_count: number;
  created_at: string;
  is_expired?: boolean;
}

export interface FileMetadata {
  id: string;
  original_name: string;
  stored_name: string;
  file_size: number;
  content_type: string;
  extension: string;
  category: FileCategory;
  sha256_hash: string;
  owner_id: number;
  owner_email: string;
  description?: string | null;
  upload_date: string;
  download_count: number;
  shares: ShareLink[];
  is_public: boolean;
}

export interface FileSummary {
  id: string;
  original_name: string;
  file_size: number;
  content_type: string;
  extension: string;
  category: FileCategory;
  upload_date: string;
  download_count: number;
  shares_count: number;
  owner_email: string;
  description?: string | null;
}

export interface StorageStats {
  total_files: int;
  total_bytes: int;
  total_storage_mb: number;
  active_shares: number;
  categories_count: Record<string, number>;
}

type int = number;

export interface ShareCreatePayload {
  duration: ShareDuration;
  custom_expires_at?: string | null;
  permission: SharePermission;
  max_downloads?: number | null;
}

export interface PublicShareData {
  file_id: string;
  original_name: string;
  file_size: number;
  content_type: string;
  extension: string;
  category: FileCategory;
  upload_date: string;
  share_token: string;
  permission: SharePermission;
  can_download: boolean;
  expires_at?: string | null;
  is_expired: boolean;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  postgres: {
    status: string;
    connected: boolean;
    latency_ms: number;
  };
  mongodb: {
    status: string;
    connected: boolean;
    latency_ms: number;
    database: string;
    file_count: number;
    mode: string;
    detail?: string;
  };
  redis: {
    status: string;
    connected: boolean;
    latency_ms: number;
    mode: string;
    version?: string;
    used_memory?: string;
    detail?: string;
  };
}

// ─── Core Fetch Helper ────────────────────────────────────────────────────────

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Attach auth token if available and not already specified
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Set json content-type only if not FormData
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError: unknown) {
    throw new Error(
      `Unable to connect to the backend server (${API_BASE}). Please ensure the backend server is running.`
    );
  }

  let data: any = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      if (text) {
        data = { detail: text };
      }
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (data && data.detail) {
      if (typeof data.detail === "string") {
        throw new Error(data.detail);
      }
      if (Array.isArray(data.detail)) {
        const messages = data.detail.map((errItem: any) => {
          const field = Array.isArray(errItem.loc) ? errItem.loc.slice(1).join(".") : "";
          return field ? `${field}: ${errItem.msg}` : errItem.msg || JSON.stringify(errItem);
        });
        throw new Error(messages.join(", "));
      }
      if (typeof data.detail === "object") {
        throw new Error(JSON.stringify(data.detail));
      }
    }

    if (response.status === 400) throw new Error("Bad request. Please verify your input.");
    if (response.status === 401) throw new Error("Unauthorized. Please log in again.");
    if (response.status === 403) throw new Error("Access forbidden. You do not have permission.");
    if (response.status === 404) throw new Error(`Resource '${endpoint}' not found (404).`);
    if (response.status === 409) throw new Error("A conflict occurred. Record already exists.");
    if (response.status === 410) throw new Error("This resource has expired or is no longer available.");
    if (response.status === 413) throw new Error("File is too large. Exceeds size limit.");
    if (response.status >= 500) throw new Error(`Backend error (${response.status}). Please try again later.`);

    throw new Error(`Request failed with status ${response.status}`);
  }

  return data as T;
}

// ─── Token Utilities ──────────────────────────────────────────────────────────

export function storeToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", token);
  }
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
  }
}

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("access_token");
  }
  return null;
}

export function hasToken(): boolean {
  return !!getToken();
}

// ─── Authentication APIs ──────────────────────────────────────────────────────

export async function registerUser(payload: RegisterPayload): Promise<UserOut> {
  return apiFetch<UserOut>("/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: LoginPayload): Promise<Token> {
  return apiFetch<Token>("/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logoutUser(): Promise<MessageResponse> {
  try {
    const res = await apiFetch<MessageResponse>("/logout", {
      method: "POST",
    });
    clearToken();
    return res;
  } catch (err) {
    clearToken();
    return { message: "Logged out locally." };
  }
}

export async function getCurrentUser(): Promise<UserOut> {
  const token = getToken();
  if (!token) throw new Error("No access token found");
  return apiFetch<UserOut>("/me", {
    method: "GET",
  });
}

// ─── File APIs ────────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  description?: string,
  onProgress?: (percent: number) => void
): Promise<FileMetadata> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  if (description) {
    formData.append("description", description);
  }

  // Use XMLHttpRequest to track actual upload progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/files/upload`, true);

    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result as FileMetadata);
        } catch (e) {
          reject(new Error("Invalid response format from server."));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.detail || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error(`Unable to connect to backend server (${API_BASE}).`));
    };

    xhr.send(formData);
  });
}

export async function listFiles(
  search?: string,
  category?: string
): Promise<FileSummary[]> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.append("search", search.trim());
  if (category && category !== "all") params.append("category", category);

  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<FileSummary[]>(`/files${qs}`, { method: "GET" });
}

export async function getFileStats(): Promise<StorageStats> {
  return apiFetch<StorageStats>("/files/stats/summary", { method: "GET" });
}

export async function getFileDetails(fileId: string): Promise<FileMetadata> {
  return apiFetch<FileMetadata>(`/files/${fileId}`, { method: "GET" });
}

export async function deleteFile(fileId: string): Promise<MessageResponse> {
  return apiFetch<MessageResponse>(`/files/${fileId}`, { method: "DELETE" });
}

export async function downloadFile(fileId: string, filename: string): Promise<void> {
  const token = getToken();
  const url = `${API_BASE}/files/${fileId}/download`;

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    let msg = `Download failed with status ${response.status}`;
    try {
      const err = await response.json();
      if (err.detail) msg = err.detail;
    } catch {}
    throw new Error(msg);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

// ─── File Sharing APIs ────────────────────────────────────────────────────────

export async function createShareLink(
  fileId: string,
  payload: ShareCreatePayload
): Promise<ShareLink> {
  return apiFetch<ShareLink>(`/files/${fileId}/share`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeShareLink(
  fileId: string,
  shareToken: string
): Promise<MessageResponse> {
  return apiFetch<MessageResponse>(`/files/${fileId}/share/${shareToken}`, {
    method: "DELETE",
  });
}

export async function getPublicShare(token: string): Promise<PublicShareData> {
  return apiFetch<PublicShareData>(`/share/${token}`, { method: "GET" });
}

export async function downloadPublicShare(token: string, filename: string): Promise<void> {
  const url = `${API_BASE}/share/${token}/download`;
  const response = await fetch(url);

  if (!response.ok) {
    let msg = `Download failed with status ${response.status}`;
    try {
      const err = await response.json();
      if (err.detail) msg = err.detail;
    } catch {}
    throw new Error(msg);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

// ─── Health APIs ──────────────────────────────────────────────────────────────

export async function getSystemHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health", { method: "GET" });
}
