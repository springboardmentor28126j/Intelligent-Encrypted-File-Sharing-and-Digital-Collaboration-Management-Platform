import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { getErrorMessage } from '../services/api'
import { FileTable, Notice } from '../components/common'

export default function Folders() {
	const { folderId } = useParams()
	const [folders, setFolders] = useState([])
	const [files, setFiles] = useState([])
	const [name, setName] = useState('')
	const [error, setError] = useState('')

	const loadFolders = () => api.get('/folders').then(response => setFolders(response.data)).catch(e => setError(getErrorMessage(e)))

	useEffect(() => {
		loadFolders()
	}, [])

	useEffect(() => {
		if (!folderId) {
			setFiles([])
			return
		}
		api.get('/files', { params: { folder_id: Number(folderId) } })
			.then(response => setFiles(response.data))
			.catch(e => setError(getErrorMessage(e)))
	}, [folderId])

	async function submit(event) {
		event.preventDefault()
		try {
			await api.post('/folders', { name })
			setName('')
			setError('')
			loadFolders()
		} catch (requestError) {
			setError(getErrorMessage(requestError))
		}
	}

	async function remove(id) {
		try {
			await api.delete(`/folders/${id}`)
			loadFolders()
		} catch (requestError) {
			setError(getErrorMessage(requestError))
		}
	}

	const selectedFolder = folders.find(folder => String(folder.id) === folderId)

	return (
		<>
			<section className="panel form-panel">
				<h2>Create a folder</h2>
				<Notice error={error} />
				<form onSubmit={submit}>
					<label>Folder name<input required value={name} onChange={event => setName(event.target.value)} /></label>
					<button className="primary">Create folder</button>
				</form>
			</section>

			<section className="panel folder-list">
				<h3>Your folders</h3>
				{folders.length ? folders.map(folder => (
					<div className="folder-row" key={folder.id}>
						<Link to={`/folders/${folder.id}`}><strong>{folder.name}</strong></Link>
						<button className="link-button" onClick={() => remove(folder.id)}>Delete</button>
					</div>
				)) : <p className="empty">No folders yet.</p>}
			</section>

			{folderId && (
				<section className="panel">
					<div className="panel-title">
						<h3>{selectedFolder?.name || 'Folder files'}</h3>
						<Link to="/folders">Back to folders</Link>
					</div>
					{files.length ? <FileTable files={files} /> : <p className="empty">No files in this folder yet.</p>}
				</section>
			)}
		</>
	)
}
