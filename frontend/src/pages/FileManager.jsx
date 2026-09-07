import React, { useState, useEffect } from 'react';
import { getFilesAndFolders, createFolder, uploadFile, viewFile, deleteFile, renameFolder, deleteFolder, downloadFile } from '../services/fileService';
import FileMetadataModal from './FileMetadataModal';

function FileManager() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderStack, setFolderStack] = useState([{ id: null, name: 'Vault' }]);
  
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // For action bar simulation
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  // For Metadata Modal
  const [selectedMetadataFile, setSelectedMetadataFile] = useState(null);

  const categories = [
    { label: 'All files', value: 'all' },
    { label: 'Images 🖼️', value: 'image' },
    { label: 'PDFs 📄', value: 'pdf' },
    { label: 'Documents 📝', value: 'document' },
    { label: 'Videos 🎥', value: 'video' },
    { label: 'Archives 📦', value: 'archive' },
    { label: 'Other 📁', value: 'other' }
  ];

  const fetchContent = async () => {
    setLoading(true);
    try {
      const data = await getFilesAndFolders(currentFolder, selectedCategory, searchQuery);
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setSelectedFiles([]); // clear selection on navigate
    } catch (err) {
      console.error("Failed to load content", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, [currentFolder, selectedCategory, searchQuery]);

  const handleCreateFolder = async () => {
    const newFolderName = window.prompt("Enter new folder name:");
    if (!newFolderName || !newFolderName.trim()) return;
    try {
      await createFolder(newFolderName, currentFolder);
      fetchContent();
    } catch (err) {
      alert("Failed to create folder");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await uploadFile(file, currentFolder);
      fetchContent();
    } catch (err) {
      alert("Upload failed");
    }
  };

  const handleDeleteFile = async (e, fileId) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this file?")) {
      try {
        await deleteFile(fileId);
        fetchContent();
      } catch (err) {
        alert("Failed to delete file");
      }
    }
  };

  const handleViewFile = async (fileId) => {
    try {
      await viewFile(fileId);
    } catch (err) {
      alert("Failed to open file");
    }
  };

  const handleRenameFolder = async (e, folder) => {
    e.stopPropagation();
    const newName = window.prompt("Enter new folder name:", folder.name);
    if (newName && newName.trim() !== "" && newName !== folder.name) {
      try {
        await renameFolder(folder.id, newName.trim());
        fetchContent();
      } catch (err) {
        alert("Failed to rename folder");
      }
    }
  };

  const handleDeleteFolder = async (e, folderId) => {
    e.stopPropagation();
    if (window.confirm("WARNING: Are you sure you want to delete this folder? ALL subfolders and files inside it will be PERMANENTLY deleted!")) {
      try {
        await deleteFolder(folderId);
        fetchContent();
      } catch (err) {
        alert("Failed to delete folder");
      }
    }
  };

  const openFolder = (folder) => {
    setCurrentFolder(folder.id);
    setFolderStack([...folderStack, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index) => {
    const newStack = folderStack.slice(0, index + 1);
    setFolderStack(newStack);
    setCurrentFolder(newStack[newStack.length - 1].id);
  };

  const toggleSelectFile = (e, fileId) => {
    e.stopPropagation();
    if (selectedFiles.includes(fileId)) {
      setSelectedFiles(selectedFiles.filter(id => id !== fileId));
    } else {
      setSelectedFiles([...selectedFiles, fileId]);
    }
  };

  const handleDownloadSelectedFiles = async () => {
    for (const fileId of selectedFiles) {
      const file = files.find(f => f.id === fileId);
      if (file) {
        try {
          await downloadFile(fileId, file.original_filename || file.original_name);
        } catch (err) {
          console.error("Failed to download", err);
          alert(`Failed to download ${file.original_filename || file.original_name}`);
        }
      }
    }
    // Clear selection after download
    setSelectedFiles([]);
  };

  const handleDeleteSelectedFiles = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedFiles.length} selected file(s)?`)) {
      let hasError = false;
      for (const fileId of selectedFiles) {
        try {
          await deleteFile(fileId);
        } catch (err) {
          console.error("Failed to delete file", err);
          hasError = true;
        }
      }
      if (hasError) {
        alert("Failed to delete one or more files.");
      }
      fetchContent();
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Controls: Search & Upload */}
      <div style={styles.topHeader}>
        <div>
          <h1 style={styles.pageTitle}>My Files</h1>
          <div style={styles.breadcrumb}>
            {folderStack.map((item, idx) => (
              <span key={idx}>
                <span onClick={() => navigateToBreadcrumb(idx)} style={idx === folderStack.length - 1 ? styles.crumbItemActive : styles.crumbItem}>
                  {item.name}
                </span>
                {idx < folderStack.length - 1 && <span style={styles.crumbSeparator}> {'>'} </span>}
              </span>
            ))}
          </div>
        </div>
        
        <div style={styles.topRightControls}>
          <input
            type="text"
            placeholder="🔍 Search files, shares, people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          <input type="file" id="file-upload" style={{ display: 'none' }} onChange={handleFileUpload} />
          <label htmlFor="file-upload" style={styles.uploadBtn}>
            + Upload file
          </label>
        </div>
      </div>

      {/* Category Pills */}
      <div style={styles.categoryBar}>
        {categories.map((cat) => (
          <button
            key={cat.value}
            style={{
              ...styles.categoryBtn,
              ...(selectedCategory === cat.value ? styles.activeCategoryBtn : {})
            }}
            onClick={() => setSelectedCategory(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {/* Horizontal Folders List */}
          <div style={styles.foldersContainer}>
            {folders.map((folder) => (
              <div key={folder.id} style={styles.folderCard} onClick={() => openFolder(folder)}>
                <div style={styles.folderCardIcon}>📁</div>
                <div style={styles.folderCardContent}>
                  <div style={styles.folderName}>{folder.name}</div>
                  <div style={styles.folderMeta}>Folder</div>
                </div>
                <div style={styles.folderActions}>
                  <button onClick={(e) => handleRenameFolder(e, folder)} style={styles.iconBtn}>✏️</button>
                  <button onClick={(e) => handleDeleteFolder(e, folder.id)} style={styles.iconBtn}>🗑️</button>
                </div>
              </div>
            ))}
            
            {/* Create Folder Button */}
            <div style={styles.createFolderCard} onClick={handleCreateFolder}>
              <div style={styles.createFolderIcon}>+</div>
              <div style={styles.folderCardContent}>
                <div style={styles.folderName}>New folder</div>
                <div style={styles.folderMeta}>Create</div>
              </div>
            </div>
          </div>

          {/* Files Table */}
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.thCheck}></th>
                  <th style={styles.thn}>Name</th>
                  <th style={styles.th}>Metadata</th>
                  <th style={styles.th}>Size</th>
                  <th style={styles.th}>Shared with</th>
                  <th style={styles.th}>Modified</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} style={styles.tr} onClick={() => handleViewFile(file.id)}>
                    <td style={styles.tdCheck} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedFiles.includes(file.id)}
                        onChange={(e) => toggleSelectFile(e, file.id)}
                        style={styles.checkbox}
                      />
                    </td>
                    <td style={styles.td}>
                      <div style={styles.fileCell}>
                        <span style={styles.fileIcon}>📄</span>
                        <div>
                          <div style={styles.fileName}>{file.original_filename || file.original_name}</div>
                          <div style={styles.fileCategory}>{file.category}</div>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedMetadataFile(file); }} 
                        style={styles.infoBtn}
                        title="View File Details"
                      >
                       INFO ℹ️
                      </button>
                    </td>
                    <td style={styles.td}>{(file.file_size / 1024).toFixed(1)} KB</td>
                    <td style={styles.td}>
                      <span style={styles.avatar}>AM</span>
                    </td>
                    <td style={styles.td}>Just now</td>
                    <td style={styles.tdActions}>
                       <button onClick={(e) => handleDeleteFile(e, file.id)} style={styles.iconBtnText}>🗑️</button>
                    </td>
                  </tr>
                ))}
                {files.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      No files found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Action Bar (Mockup) */}
          {selectedFiles.length > 0 && (
            <div style={styles.actionBar}>
              <span style={styles.actionText}>{selectedFiles.length} selected</span>
              <button style={styles.actionBtn}>🔗 Share</button>
              <button style={styles.actionBtn} onClick={handleDownloadSelectedFiles}>⬇ Download</button>
              <button style={styles.actionBtn}>📁 Move</button>
              <button style={{ ...styles.actionBtn, color: '#ef4444' }} onClick={handleDeleteSelectedFiles}>🗑️ Delete</button>
            </div>
          )}
        </>
      )}

      {/* Render Metadata Modal if a file is selected */}
      <FileMetadataModal 
        file={selectedMetadataFile} 
        onClose={() => setSelectedMetadataFile(null)} 
      />
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', minHeight: '100%' },
  topHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' },
  pageTitle: { margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold', color: '#1e293b' },
  breadcrumb: { fontSize: '14px', color: '#64748b', display: 'flex', gap: '6px' },
  crumbItem: { cursor: 'pointer', color: '#64748b' },
  crumbItemActive: { color: '#1e293b', fontWeight: '600' },
  crumbSeparator: { color: '#94a3b8' },
  
  topRightControls: { display: 'flex', gap: '12px', alignItems: 'center' },
  searchInput: { width: '250px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: '#f8fafc' },
  uploadBtn: { padding: '10px 18px', backgroundColor: '#10b981', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-block' },
  
  categoryBar: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' },
  categoryBtn: { padding: '6px 14px', borderRadius: '20px', border: '1px solid #e2e8f0', backgroundColor: 'transparent', color: '#475569', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  activeCategoryBtn: { backgroundColor: '#1e293b', color: '#fff', borderColor: '#1e293b' },
  
  foldersContainer: { display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px' },
  folderCard: { minWidth: '220px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', position: 'relative' },
  folderCardIcon: { fontSize: '28px' },
  folderCardContent: { display: 'flex', flexDirection: 'column', flex: 1 },
  folderName: { fontSize: '14px', fontWeight: 'bold', color: '#1e293b' },
  folderMeta: { fontSize: '12px', color: '#94a3b8' },
  folderActions: { position: 'absolute', top: '12px', right: '12px', display: 'flex', flexDirection: 'column', gap: '4px' },
  iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px' },
  
  createFolderCard: { minWidth: '220px', backgroundColor: 'transparent', borderRadius: '12px', border: '1px dashed #cbd5e1', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' },
  createFolderIcon: { width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '20px' },

  tableContainer: { backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thn: { textAlign: 'left', padding: '15px', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0', fontWeight: '600' },
  th: { padding: '15px', fontSize: '12px', color: '#64748b', borderBottom: '1px solid #e2e8f0', fontWeight: '600' },
  thCheck: { width: '40px', padding: '16px', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #e2e8f0', cursor: 'pointer' },
  td: { padding: '1px', verticalAlign: 'middle', fontSize: '13px', color: '#334155' },
  tdCheck: { padding: '16px', verticalAlign: 'middle' },
  checkbox: { width: '16px', height: '16px', cursor: 'pointer' },
  fileCell: { display: 'flex', alignItems: 'center', gap: '12px' },
  fileIcon: { fontSize: '24px' },
  fileName: { fontSize: '14px', fontWeight: '600', color: '#1e293b' },
  fileCategory: { fontSize: '12px', color: '#94a3b8' },
  encryptionBadge: { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: '#f0fdf4', color: '#10b981', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', border: '1px solid #bbf7d0' },
  infoBtn: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', marginLeft: '8px', padding: '0', opacity: 0.7 },
  avatar: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: '10px', fontWeight: 'bold' },
  tdActions: { padding: '16px', textAlign: 'right' },
  iconBtnText: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#ef4444' },

  actionBar: { position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1e293b', color: '#fff', padding: '12px 24px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 100 },
  actionText: { fontSize: '14px', fontWeight: 'bold' },
  actionBtn: { background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }
};

export default FileManager;