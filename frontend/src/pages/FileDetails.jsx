import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { Notice } from '../components/common'
import FileActions from '../components/FileActions'
import FilePreview from '../components/FilePreview'
import FileRenameModal from '../components/FileRenameModal'
import FileTypeIcon from '../components/FileTypeIcon'
import ShareModal from '../components/ShareModal'

export default function FileDetails() {
	const { id } = useParams(); const navigate = useNavigate(); const [file, setFile] = useState(null); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [preview, setPreview] = useState(null); const [renameOpen, setRenameOpen] = useState(false); const [shareOpen, setShareOpen] = useState(false); const [shares, setShares] = useState([])
	useEffect(() => { api.get(`/files/${id}`).then(r => setFile(r.data)).catch(e => setError(getErrorMessage(e))) }, [id])
	useEffect(() => { if (!shareOpen && !file?.owner_id) return; if (file && file.owner_id) api.get(`/files/${id}/shares`).then(r => setShares(r.data)).catch(() => setShares([])) }, [id, file, shareOpen])
	async function download() { try { const response = await api.get(`/files/${id}/download`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = file.original_filename; link.click(); URL.revokeObjectURL(url); setError('') } catch (e) { setError(getErrorMessage(e)); setSuccess('') } }
	async function openPreview() { const supported = file.file_type === 'application/pdf' || file.file_type.startsWith('image/') || file.file_type.startsWith('audio/') || file.file_type.startsWith('video/'); if (!supported) return setPreview({ ...file, previewUrl: '' }); try { const response = await api.get(`/files/${id}/download`, { responseType: 'blob' }); setPreview({ ...file, previewUrl: URL.createObjectURL(response.data) }); setError('') } catch (e) { setError(getErrorMessage(e)); setSuccess('') } }
	async function rename(name) { try { const response = await api.put(`/files/${id}`, { original_filename: name }); setFile(response.data); setRenameOpen(false); setError(''); setSuccess('File renamed successfully.') } catch (e) { setError(getErrorMessage(e)); setSuccess('') } }
	async function share({ recipients, permission }) { try { const response = await api.post(`/files/${id}/share`, { emails: recipients, permission }); setShares(current => [response.data, ...current.filter(item => item.id !== response.data.id)]); setShareOpen(false); setError(''); setSuccess('File shared successfully.') } catch (e) { setError(getErrorMessage(e)); setSuccess('') } }
	async function generateLink(options = {}) {
  const response = await api.post(`/files/${id}/share-links`, options)
  return response.data
}
	async function revokeLink(linkId) { await api.delete(`/files/${id}/share-links/${linkId}`) }
	async function remove() { if (!window.confirm('Are you sure you want to delete this file?')) return; try { await api.delete(`/files/${id}`); navigate('/files') } catch (e) { setError(getErrorMessage(e)); setSuccess('') } }
	function closePreview() { if (preview?.previewUrl) URL.revokeObjectURL(preview.previewUrl); setPreview(null) }
	if (error && !file) return <Notice error={error} />
	if (!file) return <p className="muted">Loading file...</p>
	return <><Link className="back-link" to="/files">← Back to My Files</Link><Notice error={error} success={success} /><section className="panel detail"><FileTypeIcon file={file} /><h2 title={file.original_filename}>{file.original_filename}</h2><p>{file.file_type} · {(file.file_size / 1024).toFixed(1)} KB · Version {file.version}{file.folder_name ? ` · ${file.folder_name}` : ''}</p><FileActions file={file} onOpen={openPreview} onDownload={download} onShare={() => setShareOpen(true)} onRename={() => setRenameOpen(true)} onDelete={remove} /></section>{preview && <FilePreview file={preview} onClose={closePreview} onDownload={download} />}{renameOpen && <FileRenameModal file={file} onClose={() => setRenameOpen(false)} onSave={rename} />}{shareOpen && <ShareModal file={file} existingShares={shares} onClose={() => setShareOpen(false)} onShare={share} onGenerateLink={generateLink} onRevokeLink={revokeLink} />}</>
}
