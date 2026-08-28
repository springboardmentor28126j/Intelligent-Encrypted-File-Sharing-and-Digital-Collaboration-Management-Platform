export default function FilePreview({ file, onClose, onDownload }) {
  const image = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.file_type)
  const pdf = file.file_type === 'application/pdf'
  const audio = file.file_type.startsWith('audio/')
  const video = file.file_type.startsWith('video/')
  return <div className="modal-backdrop" onClick={onClose}><div className="preview-modal" role="dialog" aria-modal="true" aria-labelledby="preview-title" onClick={event => event.stopPropagation()}><div className="modal-heading"><h2 id="preview-title">{file.original_filename}</h2><button type="button" className="modal-close" aria-label="Close preview" onClick={onClose}>×</button></div>{image ? <img className="preview-image" src={file.previewUrl} alt={file.original_filename} /> : pdf ? <iframe className="preview-frame" src={file.previewUrl} title={file.original_filename} /> : audio ? <audio className="preview-media" controls src={file.previewUrl} /> : video ? <video className="preview-media" controls src={file.previewUrl} /> : <p className="empty">Preview not available for this file type.</p>}<button type="button" className="primary" onClick={onDownload}>Download</button></div></div>
}
