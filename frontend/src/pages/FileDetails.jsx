import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { Notice } from '../components/common'
import FileActions from '../components/FileActions'
import FilePreview from '../components/FilePreview'
import FileRenameModal from '../components/FileRenameModal'
import FileTypeIcon from '../components/FileTypeIcon'

export default function FileDetails() {
	const { id } = useParams(); const navigate = useNavigate(); const [file, setFile] = useState(null); const [error, setError] = useState(''); const [preview, setPreview] = useState(null); const [renameOpen, setRenameOpen] = useState(false)
	useEffect(() => { api.get(`/files/${id}`).then(r => setFile(r.data)).catch(e => setError(getErrorMessage(e))) }, [id])
	async function download() { try { const response = await api.get(`/files/${id}/download`, { responseType: 'blob' }); const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = file.original_filename; link.click(); URL.revokeObjectURL(url) } catch (e) { setError(getErrorMessage(e)) } }
	async function openPreview() { const supported = file.file_type === 'application/pdf' || file.file_type.startsWith('image/') || file.file_type.startsWith('audio/') || file.file_type.startsWith('video/'); if (!supported) return setPreview({ ...file, previewUrl: '' }); try { const response = await api.get(`/files/${id}/download`, { responseType: 'blob' }); setPreview({ ...file, previewUrl: URL.createObjectURL(response.data) }) } catch (e) { setError(getErrorMessage(e)) } }
	async function rename(name) { try { const response = await api.put(`/files/${id}`, { original_filename: name }); setFile(response.data); setRenameOpen(false); setError('') } catch (e) { setError(getErrorMessage(e)) } }
	async function remove() { if (!window.confirm('Are you sure you want to delete this file?')) return; try { await api.delete(`/files/${id}`); navigate('/files') } catch (e) { setError(getErrorMessage(e)) } }
	function closePreview() { if (preview?.previewUrl) URL.revokeObjectURL(preview.previewUrl); setPreview(null) }
	if (error && !file) return <Notice error={error} />
	if (!file) return <p className="muted">Loading file...</p>
	return <><Link className="back-link" to="/files">← Back to My Files</Link><Notice error={error} /><section className="panel detail"><FileTypeIcon file={file} /><h2 title={file.original_filename}>{file.original_filename}</h2><p>{file.file_type} · {(file.file_size / 1024).toFixed(1)} KB · Version {file.version}{file.folder_name ? ` · ${file.folder_name}` : ''}</p><FileActions file={file} onOpen={openPreview} onDownload={download} onRename={() => setRenameOpen(true)} onDelete={remove} /></section>{preview && <FilePreview file={preview} onClose={closePreview} onDownload={download} />}{renameOpen && <FileRenameModal file={file} onClose={() => setRenameOpen(false)} onSave={rename} />}</>
}
