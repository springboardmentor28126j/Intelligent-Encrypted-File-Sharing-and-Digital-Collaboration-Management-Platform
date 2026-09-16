import { createContext, useContext, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('trustshare_user') || 'null'))
  const login = async (email, password, totpCode) => {
    const payload = { email, password }
    if (totpCode) payload.totp_code = totpCode
    const { data } = await api.post('/auth/login', payload)
    localStorage.setItem('trustshare_token', data.access_token)
    localStorage.setItem('trustshare_user', JSON.stringify(data.user))
    setUser(data.user)
  }
  const updateUser = (updatedUser) => {
    localStorage.setItem('trustshare_user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }
  const logout = () => { localStorage.clear(); setUser(null) }
  return <AuthContext.Provider value={{ user, login, updateUser, logout }}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
