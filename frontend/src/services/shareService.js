import api from './api';

export const createSharedLink = async (fileId, permission, expires_in_hours, shared_to = null) => {
  const response = await api.post('/share/create', { 
    file_id: fileId, 
    permission, 
    expires_in_hours: expires_in_hours === 'never' ? null : parseInt(expires_in_hours),
    shared_to: shared_to || null
  });
  return response.data;
};

export const getSharedLinks = async () => {
  const response = await api.get('/share/list');
  return response.data;
};

export const revokeSharedLink = async (linkId) => {
  const response = await api.delete(`/share/revoke/${linkId}`);
  return response.data;
};

export const updateSharedLink = async (linkId, permission) => {
  const response = await api.put(`/share/update/${linkId}`, { permission });
  return response.data;
};

export const getSharedLinkLogs = async (linkId) => {
  const response = await api.get(`/share/logs/${linkId}`);
  return response.data;
};

export const getPublicFileDetails = async (token) => {
  const response = await api.get(`/share/public/${token}`);
  return response.data;
};

export const downloadPublicFile = async (token, fileName) => {
  const response = await api.get(`/share/public/${token}/download`, {
    responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// --- USER-TO-USER (INTERNAL) SHARE SERVICES ---

// Search users by name or email (Gmail)
export const searchUsers = async (query = '') => {
  const response = await api.get('/auth/search-users', {
    params: { q: query }
  });
  return response.data;
};

// Share file directly with another user
export const createInternalShare = async (fileId, targetUserId, permission = 'view_only') => {
  const response = await api.post('/share/internal/create', {
    file_id: fileId,
    shared_with_user_id: targetUserId,
    permission
  });
  return response.data;
};

// Get list of users a specific file is shared with
export const getFileShares = async (fileId) => {
  const response = await api.get(`/share/internal/file/${fileId}`);
  return response.data;
};

// Revoke user access to a file
export const revokeInternalShare = async (accessId) => {
  const response = await api.delete(`/share/internal/revoke/${accessId}`);
  return response.data;
};

// Get list of files shared with current user
export const getSharedWithMe = async () => {
  const response = await api.get('/share/internal/shared-with-me');
  return response.data;
};

// Update user permission for shared file
export const updateInternalShare = async (accessId, permission) => {
  const response = await api.put(`/share/internal/update/${accessId}`, { permission });
  return response.data;
};
