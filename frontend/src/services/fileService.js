import api from './api';

// Get Files & Folders with Filters
export const getFilesAndFolders = async (folderId = null, category = 'all', search = '') => {
  const params = {};
  if (folderId) params.folder_id = folderId;
  if (category && category !== 'all') params.category = category;
  if (search) params.search = search;

  const response = await api.get('/files/list', { params });
  return response.data;
};

// Create Folder
export const createFolder = async (name, parentId = null) => {
  const response = await api.post('/files/folder/create', { name, parent_id: parentId });
  return response.data;
};

// Upload File with Folder ID
export const uploadFile = async (file, folderId = null) => {
  const formData = new FormData();
  formData.append('file', file);
  if (folderId) formData.append('folder_id', folderId);

  const response = await api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// View File
export const viewFile = async (fileId) => {
  const response = await api.get(`/files/view/${fileId}`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] }));
  window.open(url, '_blank');
};

// Download File
export const downloadFile = async (fileId, fileName) => {
  const response = await api.get(`/files/view/${fileId}`, {
    responseType: 'blob',
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

// Delete File
export const deleteFile = async (fileId) => {
  const response = await api.delete(`/files/delete/${fileId}`);
  return response.data;
};

// Rename Folder
export const renameFolder = async (folderId, newName) => {
  const response = await api.put(`/files/folder/rename/${folderId}`, { name: newName });
  return response.data;
};

// Delete Folder
export const deleteFolder = async (folderId) => {
  const response = await api.delete(`/files/folder/delete/${folderId}`);
  return response.data;
};