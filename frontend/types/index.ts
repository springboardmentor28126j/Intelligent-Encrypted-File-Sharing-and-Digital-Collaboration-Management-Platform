export interface User {
  id:number;
  name:string;
  email:string;
  role:string;
  is_active:boolean;
  mfa_enabled:boolean;
  storage_quota:number;
  used_storage:number;
  created_at:string;
}

export interface LoginResponse {
  access_token:string;
  token_type:string;
  expires_in?:number;
}

export interface LoginRequest {
  email:string;
  password:string;
  mfa_code?:string;
}

export interface RegisterRequest {
  name:string;
  email:string;
  password:string;
}

export interface FileItem {
  id:number;
  owner_id:number;
  folder_id:number|null;
  filename:string;
  storage_path?:string;
  content_type:string|null;
  size:number;
  category:string;
  is_deleted:boolean;
  created_at:string;
  updated_at:string;
}

export interface Folder {
  id:number;
  name:string;
  parent_id:number|null;
  owner_id:number;
  created_at:string;
  updated_at:string;
}

export interface FileShare {
  id:number;
  file_id:number;
  owner_id:number;
  shared_with_id:number;
  permission:string;
  can_download:boolean;
  expires_at:string|null;
  max_downloads:number|null;
  download_count:number;
  is_revoked:boolean;
  created_at:string;
  updated_at:string;
}

export interface ShareLink {
  id:number;
  file_id:number;
  owner_id:number;
  permission:string;
  can_download:boolean;
  max_downloads:number|null;
  download_count:number;
  expires_at:string;
  is_revoked:boolean;
  created_at:string;
}

export interface MFASetup {
  secret:string;
  provisioning_uri:string;
}
