import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env?.VITE_API_URL || 'http://localhost:8000/api' })
export const FILE_INTEGRITY_ERROR = 'File integrity check failed. The file may have been modified or corrupted.'
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('trustshare_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) window.dispatchEvent(new Event('trustshare:unauthorized'))
    return Promise.reject(error)
  },
)
export default api

export function getErrorMessage(error) {
  if (error.response?.status === 422) return FILE_INTEGRITY_ERROR
  const detail = error.response?.data?.detail
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(', ')
  return detail || error.message || 'Something went wrong'
}
