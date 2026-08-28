function extensionOf(file) {
  return file.original_filename.split('.').pop()?.toLowerCase() || ''
}

export default function FileTypeIcon({ file }) {
  const extension = extensionOf(file)
  const image = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)
  const label = {
    pdf: 'PDF', doc: 'DOC', docx: 'DOC', xls: 'XLS', xlsx: 'XLS',
    ppt: 'PPT', pptx: 'PPT', mp3: 'AUD', wav: 'AUD', mp4: 'VID', mov: 'VID',
    zip: 'ZIP', rar: 'ZIP',
  }[extension] || (image ? 'IMG' : 'FILE')
  return <span className={`file-type-icon ${image ? 'image' : ''}`} title={file.original_filename}>{label}</span>
}
