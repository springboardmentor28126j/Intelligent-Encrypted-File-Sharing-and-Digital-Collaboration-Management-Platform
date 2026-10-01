import { getToken, removeToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface RequestOptions extends RequestInit { auth?: boolean; }

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  if (!(fetchOptions.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_URL}${endpoint}`, { ...fetchOptions, headers });
  if (response.status === 401) {
    removeToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Authentication required");
  }
  const contentType = response.headers.get("content-type") || "";
  const data: unknown = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    if (typeof data === "object" && data !== null && "detail" in data && typeof (data as {detail?: unknown}).detail === "string") {
      message = (data as {detail: string}).detail;
    }
    throw new Error(message);
  }
  return data as T;
}

export interface RegisterPayload { name: string; email: string; password: string; }
export interface LoginPayload { email: string; password: string; mfa_code?: string; }
export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface MFARequiredResponse {
  mfa_required: true;
}

export type LoginResult =
  | LoginResponse
  | MFARequiredResponse;
export interface CurrentUser { id:number; name:string; email:string; role:string; is_active:boolean; mfa_enabled:boolean; storage_quota:number; used_storage:number; created_at:string; }
export interface MFASetupResponse { secret:string; provisioning_uri:string; }

// File metadata interface required by FileMetadataPanel
export interface FileMetadata {
  id: number;
  filename: string;
  size: number;
  category: string;
  content_type?: string;
  owner_id: number;
  folder_id: number | null;
  encryption_status: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export const registerUser = (payload:RegisterPayload) => request("/auth/register", {method:"POST", body:JSON.stringify(payload), auth:false});
export const loginUser = (payload: LoginPayload) =>
  request<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    auth: false,
  });
export const getCurrentUser = () => request<CurrentUser>("/auth/me");
export const setupMFA = () => request<MFASetupResponse>("/auth/mfa/setup", {method:"POST"});
export const enableMFA = (code:string) => request<{message:string}>("/auth/mfa/enable", {method:"POST", body:JSON.stringify({code})});
export const disableMFA = () => request<{message:string}>("/auth/mfa/disable", {method:"POST"});
export const forgotPassword = (email:string) => request<any>("/auth/forgot-password", {method:"POST",body:JSON.stringify({email}),auth:false});
export const resetPassword = (token:string,newPassword:string) => request<any>("/auth/reset-password", {method:"POST",body:JSON.stringify({token,new_password:newPassword}),auth:false});
export const getGoogleLoginUrl = () => request<{authorization_url:string}>("/auth/google/url", {auth:false});
export const logoutUser = () => request<{message:string}>("/auth/logout", {method:"POST"});
export const logoutAllSessions = () => request<{message:string}>("/auth/logout-all", {method:"POST"});
export const getSessions = () => request<any[]>("/auth/sessions");
export const revokeSession = (id:number) => request<{message:string}>(`/auth/sessions/${id}`, {method:"DELETE"});

export async function uploadFile(file:File, folderId?:number|null) {
  const form = new FormData(); form.append("file", file);
  if (folderId != null) form.append("folder_id", String(folderId));
  return request<any>("/files/upload", {method:"POST",body:form});
}
export const getFiles = (params:{category?:string;folder_id?:number}={}) => {
  const q=new URLSearchParams(); if(params.category)q.set("category",params.category); if(params.folder_id!=null)q.set("folder_id",String(params.folder_id));
  return request<any[]>(`/files/list${q.toString()?`?${q}`:""}`);
};
export const getSharedFiles = () => request<any[]>("/files/shared");
export const searchFiles = (params:{q?:string;category?:string;folder_id?:number}={}) => {
  const q=new URLSearchParams(); if(params.q)q.set("q",params.q); if(params.category)q.set("category",params.category); if(params.folder_id!=null)q.set("folder_id",String(params.folder_id));
  return request<any[]>(`/files/search${q.toString()?`?${q}`:""}`);
};

// Updated to return typed FileMetadata and targeting the single file endpoint
export const getFileMetadata = (id:number) => request<FileMetadata>(`/files/${id}`);

export const deleteFile = (id:number) => request<any>(`/files/${id}`,{method:"DELETE"});
export const getTrash = () => request<any[]>("/files/trash");
export const restoreFile = (id:number) => request<any>(`/files/${id}/restore`,{method:"POST"});
export const permanentlyDeleteFile = (id:number) => request<any>(`/files/${id}/permanent`,{method:"DELETE"});
export const rotateFileKey = (id:number) => request<any>(`/files/${id}/rotate-key`,{method:"POST"});
export const getFileVersions = (id:number) => request<any[]>(`/files/${id}/versions`);
export async function uploadFileVersion(id:number,file:File){const form=new FormData();form.append("file",file);return request<any>(`/files/${id}/versions`,{method:"POST",body:form});}
export async function downloadFile(id:number){return downloadBlob(`/files/${id}/download`);}
export async function downloadFileVersion(fileId:number,versionId:number){return downloadBlob(`/files/${fileId}/versions/${versionId}/download`);}
async function downloadBlob(endpoint:string){
  const token=getToken(); if(!token)throw new Error("Authentication required");
  const response=await fetch(`${API_URL}${endpoint}`,{headers:{Authorization:`Bearer ${token}`}});
  if(response.status===401){removeToken();if(typeof window!=="undefined")window.location.href="/login";throw new Error("Authentication required");}
  if(!response.ok){let msg="Unable to download file";try{const d=await response.json();if(typeof d?.detail==="string")msg=d.detail;}catch{}throw new Error(msg);} return response.blob();
}

export const getFolders = (parentId?:number|null) => request<any[]>(`/folders${parentId!=null?`?parent_id=${parentId}`:""}`);
export const createFolder = (name:string,parentId?:number|null) => request<any>("/folders",{method:"POST",body:JSON.stringify({name,parent_id:parentId??null})});
export const renameFolder = (id:number,name:string) => request<any>(`/folders/${id}`,{method:"PATCH",body:JSON.stringify({name})});
export const deleteFolder = (id:number) => request<any>(`/folders/${id}`,{method:"DELETE"});

export type SharePermission="READ"|"WRITE";
export interface DirectSharePayload {file_id:number;email:string;permission:SharePermission;can_download?:boolean;expires_at?:string|null;max_downloads?:number|null;}
export const shareFile = (payload:DirectSharePayload) => request<any>("/shares/user",{method:"POST",body:JSON.stringify(payload)});
export const getFileShares = () => request<any[]>("/shares/sent");
export const getSentShares = () => request<any[]>("/shares/sent");
export const getReceivedShares = () => request<any[]>("/shares/received");
export const revokeShare = (id:number) => request<any>(`/shares/user/${id}`,{method:"DELETE"});
export interface CreateShareLinkPayload {file_id:number;permission:SharePermission;can_download?:boolean;expires_at:string;max_downloads?:number|null;}
export const createShareLink = (payload:CreateShareLinkPayload) => request<any>("/shares/link",{method:"POST",body:JSON.stringify(payload)});
export const getShareLinks = () => request<any[]>("/shares/links");
export const revokeShareLink = (id:number) => request<any>(`/shares/link/${id}`,{method:"DELETE"});
export const publicShareInfo = (token:string) => request<any>(`/shares/link/${encodeURIComponent(token)}`,{auth:false});
export const publicShareDownload = (token:string) => fetch(`${API_URL}/shares/link/${encodeURIComponent(token)}/download`).then(async r=>{if(!r.ok){let m="Download failed";try{const d=await r.json();if(typeof d?.detail==="string")m=d.detail;}catch{}throw new Error(m);}return r.blob();});

export const getActivity = (limit=50) => request<any[]>(`/monitoring/activity?limit=${limit}`);
export const getNotifications = (limit=50) => request<any[]>(`/monitoring/notifications?limit=${limit}`);
export const getAnalytics = () => request<any>("/monitoring/analytics");
export const getAdminOverview = () => request<any>("/monitoring/admin/overview");
export const getSuspiciousActivity = (limit=100) => request<any[]>(`/monitoring/admin/suspicious?limit=${limit}`);

export const markNotificationRead = (id:string) => request<{success:boolean}>(`/monitoring/notifications/${encodeURIComponent(id)}/read`, {method:"PATCH"});
export const getSecurityMonitoring = () => request<any>("/monitoring/security");
export const getActivityReport = (days=30) => request<any>(`/monitoring/report?days=${days}`);