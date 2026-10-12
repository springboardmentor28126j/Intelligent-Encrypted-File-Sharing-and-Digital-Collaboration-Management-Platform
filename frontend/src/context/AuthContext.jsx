import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(sessionStorage.getItem('trustshare_user') || 'null'))

  useEffect(() => {
    const handleUnauthorized = () => {
      sessionStorage.removeItem('trustshare_token')
      sessionStorage.removeItem('trustshare_user')
      setUser(null)
    }
    const handleBackToLogin = () => {
      if (window.location.pathname === '/login') handleUnauthorized()
    }
    window.addEventListener('trustshare:unauthorized', handleUnauthorized)
    window.addEventListener('popstate', handleBackToLogin)
    return () => {
      window.removeEventListener('trustshare:unauthorized', handleUnauthorized)
      window.removeEventListener('popstate', handleBackToLogin)
    }
  }, [])

  const login = async (email, password, totpCode) => {
    const payload = { email, password }
    if (totpCode) payload.totp_code = totpCode
    const { data } = await api.post('/auth/login', payload)
    sessionStorage.setItem('trustshare_token', data.access_token)
    sessionStorage.setItem('trustshare_user', JSON.stringify(data.user))
    setUser(data.user)
  }
  const updateUser = (updatedUser) => {
    sessionStorage.setItem('trustshare_user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }
  const logout = () => {
    sessionStorage.removeItem('trustshare_token')
    sessionStorage.removeItem('trustshare_user')
    setUser(null)
  }
  return <AuthContext.Provider value={{ user, login, updateUser, logout }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
