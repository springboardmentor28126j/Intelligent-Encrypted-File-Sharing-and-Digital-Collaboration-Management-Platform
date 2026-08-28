import { useState } from 'react'
import api, { getErrorMessage } from '../services/api'
import { Notice } from '../components/common'
import { useAuth } from '../context/AuthContext'

export default function Profile() { const { user, updateUser } = useAuth(); const [name, setName] = useState(user.name); const [message, setMessage] = useState(''); const [error, setError] = useState(''); async function save(e) { e.preventDefault(); try { const r = await api.put('/users/me', { name }); updateUser(r.data); setMessage('Profile updated') } catch (x) { setError(getErrorMessage(x)) } } return <section className="panel form-panel"><h2>Your profile</h2><Notice error={error} success={message} /><form onSubmit={save}><label>Name<input value={name} onChange={e => setName(e.target.value)} /></label><label>Email<input value={user.email} disabled /></label><label>Role<input value={user.role} disabled /></label><label>Member since<input value={new Date(user.created_at).toLocaleDateString()} disabled /></label><button className="primary">Save changes</button></form></section> }
