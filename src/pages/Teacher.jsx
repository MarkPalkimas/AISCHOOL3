//src/pages/Teacher.jsx
import mammoth from "mammoth"
import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import UserMenu from '../components/UserMenu'
import {
  createClass,
  getTeacherClasses,
  deleteClass,
  updateClassCapacity,
  getEnrolledCount,
  createMaterial,
  getClassMaterials,
  deleteMaterial
} from '../utils/storage'
import { ROLES } from '../utils/roles'
import { ocrImageToNotes } from '../utils/ocr'
import * as XLSX from 'xlsx'

function Teacher() {
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()

  const createModalRef = useRef(null)
  const uploadModalRef = useRef(null)
  const fileInputRef = useRef(null)

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role || null

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      navigate('/sign-in', { replace: true })
      return
    }
    if (role !== ROLES.TEACHER && role !== ROLES.ADMIN) {
      if (!role) navigate('/select-role', { replace: true, state: { from: '/teacher' } })
      else navigate('/access-denied', { replace: true })
      return
    }
  }, [isLoaded, user, role, navigate])

  const [classes, setClasses] = useState([])

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassSubject, setNewClassSubject] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [displayLimit, setDisplayLimit] = useState(6)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [classMaterials, setClassMaterials] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')

  const [activeUploads, setActiveUploads] = useState({}) // track progress per file

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [classToDelete, setClassToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [toast, setToast] = useState(null)

  function showToast(message, type = 'success') {
    setToast({ message, type })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast(null), 2200)
  }

  function refreshClasses() {
    if (!user) return
    setClasses(getTeacherClasses(user.id))
  }

  useEffect(() => {
    if (!user) return
    refreshClasses()
  }, [user])

  //ESC closes modals
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return

      if (showDeleteModal) {
        setShowDeleteModal(false)
        setClassToDelete(null)
        return
      }

      if (showUploadModal) {
        setShowUploadModal(false)
        setMaterials('')
        setSelectedClass(null)
        setIsProcessingImage(false)
        setIsProcessingDocx(false)
        return
      }

      if (showCreateModal) {
        setShowCreateModal(false)
        setNewClassName('')
        setNewClassSubject('')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showCreateModal, showUploadModal, showDeleteModal])

  useEffect(() => {
    if (showCreateModal) setTimeout(() => createModalRef.current?.focus(), 0)
  }, [showCreateModal])

  useEffect(() => {
    if (showUploadModal) setTimeout(() => uploadModalRef.current?.focus(), 0)
  }, [showUploadModal])

  const handleCreateClass = async (e) => {
    e.preventDefault()
    if (!newClassName.trim() || !user) return

    setIsCreating(true)
    await new Promise((resolve) => setTimeout(resolve, 250))

    const newClass = createClass(user.id, newClassName.trim(), newClassSubject.trim())
    refreshClasses()

    setNewClassName('')
    setNewClassSubject('')
    setShowCreateModal(false)
    setIsCreating(false)

    if (newClass) {
      openUploadModal(newClass)
      showToast('Class created')
    }
  }

  const openUploadModal = (classItem) => {
    setSelectedClass(classItem)
    setClassMaterials(getClassMaterials(classItem.code))
    setShowUploadModal(true)
  }

  const handleDeleteMaterial = (materialId) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
      deleteMaterial(materialId)
      if (selectedClass) {
        setClassMaterials(getClassMaterials(selectedClass.code))
      }
      showToast('Material deleted')
    }
  }

  const handleDownloadMaterial = (material) => {
    // In this SPA with localStorage chunks, we don't have the original file blob safely stored
    // So we recreate it from the chunks or extracted text if we wanted to.
    // For now, let's just toast that download is simulated.
    showToast('Download started (simulated)')
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (e) {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'absolute'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        return true
      } catch (err) {
        return false
      }
    }
  }

  const handleCopy = async (code) => {
    const ok = await copyToClipboard(code)
    if (ok) showToast('Copied class code')
    else showToast('Copy failed on this browser', 'error')
  }

  const openDeleteModal = (classItem) => {
    setClassToDelete(classItem)
    setShowDeleteModal(true)
  }

  const handleDeleteClass = async () => {
    if (!user || !classToDelete) return

    setIsDeleting(true)
    await new Promise((resolve) => setTimeout(resolve, 250))

    const ok = deleteClass(user.id, classToDelete.code)
    refreshClasses()

    setIsDeleting(false)
    setShowDeleteModal(false)
    setClassToDelete(null)

    if (ok) showToast('Class deleted')
    else showToast('Delete failed', 'error')
  }

  const handleChooseFile = () => {
    if (isUploading || isProcessingImage || isProcessingDocx) return
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length === 0) return

    for (const file of files) {
      const name = (file.name || '').toLowerCase()
      const fileId = 'up_' + Math.random().toString(36).substr(2, 5)

      setActiveUploads(prev => ({ ...prev, [fileId]: { name: file.name, progress: 10, status: 'Processing...' } }))

      try {
        let content = ''
        const isDocx = name.endsWith('.docx')
        const isImage = /\.(jpg|jpeg|png|webp)$/i.test(name)
        const isExcel = /\.(xlsx|xls|csv)$/i.test(name)
        const isJson = name.endsWith('.json')
        const isPdf = name.endsWith('.pdf')
        const isText = /\.(txt|md|html|htm)$/i.test(name)

        if (isImage) {
          const notes = await ocrImageToNotes(file)
          content = notes.summary || 'Image processed (no summary)'
        } else if (isDocx) {
          const buffer = await file.arrayBuffer()
          const result = await mammoth.extractRawText({ arrayBuffer: buffer })
          content = result?.value || ''
        } else if (isExcel) {
          const buffer = await file.arrayBuffer()
          const workbook = XLSX.read(buffer, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          content = XLSX.utils.sheet_to_csv(firstSheet)
        } else if (isJson) {
          const text = await file.text()
          content = text
        } else if (isText || isPdf) {
          // Note: Simple browser-side PDF text extraction often needs a lib like pdf.js. 
          // For now, we'll try readAsText or just store as metadata if failed.
          content = await file.text().catch(() => '(Text extraction not fully supported for this file type yet)')
        } else {
          content = `(Uploaded ${file.name}. AI grounding limited for this format.)`
        }

        createMaterial(selectedClass.code, user.id, {
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          content: content.slice(0, 1000000)
        })

        setActiveUploads(prev => {
          const next = { ...prev }
          delete next[fileId]
          return next
        })

        setClassMaterials(getClassMaterials(selectedClass.code))
        showToast(`Uploaded ${file.name}`)
      } catch (err) {
        console.error(err)
        setActiveUploads(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'Error', error: true } }))
        showToast(`Failed to upload ${file.name}`, 'error')
      }
    }
  }

  const filteredMaterials = classMaterials
    .filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(m => filterType === 'all' || m.type.includes(filterType))

  const isBusy = isUploading || isProcessingImage || isProcessingDocx || isProcessingPPTX

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <img src="/Logo.jpg" alt="ClassAI Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>ClassAI</span>
          </Link>
          <UserMenu />
        </div>
      </nav>

      {/*Toast*/}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 18,
            right: 18,
            zIndex: 9999,
            padding: '10px 12px',
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 12,
            background: toast.type === 'error' ? '#FEF2F2' : '#ECFDF5',
            border: `1px solid ${toast.type === 'error' ? '#FECACA' : '#A7F3D0'}`,
            color: toast.type === 'error' ? '#991B1B' : '#065F46',
            boxShadow: '0 10px 30px rgba(0,0,0,0.10)'
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ padding: '40px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Teacher Dashboard</h1>
            <p style={{ color: '#6B7280' }}>Create classes and upload materials for your AI tutors</p>
          </div>

          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            Create New Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="feature-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 24 }}>No classes yet</h3>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              Create Your First Class
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
            {classes.slice(0, displayLimit).map((classItem) => {
              const hasMaterials = !!(classItem.materials && classItem.materials.trim().length > 0)

              return (
                <div key={classItem.code} className="feature-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 16 }}>
                      <span
                        style={{
                          padding: '4px 12px',
                          background: hasMaterials ? '#DEF7EC' : '#FEF3C7',
                          color: hasMaterials ? '#059669' : '#D97706',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800
                        }}
                      >
                        {hasMaterials ? 'Active' : 'Setup Needed'}
                      </span>

                      <button
                        type="button"
                        onClick={() => openDeleteModal(classItem)}
                        style={{
                          padding: '6px 10px',
                          background: 'white',
                          border: '1px solid #FCA5A5',
                          borderRadius: 12,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 900,
                          color: '#B91C1C',
                          lineHeight: 1
                        }}
                      >
                        Delete
                      </button>
                    </div>

                    <h3 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{classItem.name}</h3>
                    {!!classItem.subject && (
                      <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 16 }}>{classItem.subject}</p>
                    )}

                    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 12, marginBottom: 16 }}>
                      <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: 700 }}>Class Code</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: '#111827', fontFamily: 'monospace' }}>
                          {classItem.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(classItem.code)}
                          style={{
                            padding: '6px 10px',
                            background: 'white',
                            border: '1px solid #D1D5DB',
                            borderRadius: 12,
                            cursor: 'pointer',
                            fontSize: 12,
                            color: '#374151',
                            whiteSpace: 'nowrap',
                            fontWeight: 900
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {/* Class Size Gauge */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Enrolled Students</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>
                          {getEnrolledCount(classItem.code)} / {classItem.capacity || 30}
                        </span>
                      </div>
                      <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, (getEnrolledCount(classItem.code) / (classItem.capacity || 30)) * 100)}%`,
                            background: (getEnrolledCount(classItem.code) / (classItem.capacity || 30)) >= 0.9 ? '#EF4444' : '#3B82F6',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>Capacity:</label>
                        <input
                          type="number"
                          defaultValue={classItem.capacity || 30}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value)
                            if (val > 0 && val !== classItem.capacity) {
                              updateClassCapacity(classItem.code, val)
                              refreshClasses()
                              showToast('Capacity updated')
                            }
                          }}
                          style={{
                            width: 50,
                            fontSize: 11,
                            padding: '2px 4px',
                            border: '1px solid #E5E7EB',
                            borderRadius: 4,
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <button onClick={() => openUploadModal(classItem)} className="btn-secondary" style={{ width: '100%' }}>
                    {hasMaterials ? 'Update Materials' : 'Upload Materials'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {classes.length > displayLimit && (
          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <button
              onClick={() => setDisplayLimit(prev => prev + 6)}
              className="btn-secondary"
            >
              Show More Classes
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.csv,.json,.docx,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.pptx,.pps"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/*Create Modal*/}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return
            setShowCreateModal(false)
            setNewClassName('')
            setNewClassSubject('')
          }}
          style={{ backdropFilter: 'blur(2px)' }}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-md w-full"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
              animation: 'modalIn 140ms ease-out'
            }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Class</h2>
            <form onSubmit={handleCreateClass}>
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="className" style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#374151', marginBottom: 8 }}>
                  Class Name *
                </label>
                <input
                  type="text"
                  id="className"
                  ref={createModalRef}
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g., Biology 101"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: 12,
                    fontSize: 16,
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'box-shadow 0.15s, border-color 0.15s'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label htmlFor="classSubject" style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#374151', marginBottom: 8 }}>
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  id="classSubject"
                  value={newClassSubject}
                  onChange={(e) => setNewClassSubject(e.target.value)}
                  placeholder="e.g., Life Sciences"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: 12,
                    fontSize: 16,
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'box-shadow 0.15s, border-color 0.15s'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewClassName('')
                    setNewClassSubject('')
                  }}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!newClassName.trim() || isCreating}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    opacity: !newClassName.trim() || isCreating ? 0.55 : 1,
                    cursor: !newClassName.trim() || isCreating ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isCreating ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*Upload Modal (Structured)*/}
      {showUploadModal && selectedClass && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          style={{ overflowY: 'auto', backdropFilter: 'blur(2px)' }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return
            setShowUploadModal(false)
            setSelectedClass(null)
          }}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-4xl w-full"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              margin: 20,
              borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
              animation: 'modalIn 140ms ease-out',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Course Materials</h2>
                <p style={{ color: '#6B7280' }}>
                  {selectedClass.name} — Code: <strong>{selectedClass.code}</strong>
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={handleChooseFile}
                  className="btn-primary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Upload Files
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false)
                    setSelectedClass(null)
                  }}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E5E7EB', outline: 'none' }}
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{ padding: '10px', borderRadius: 8, border: '1px solid #E5E7EB', outline: 'none' }}
              >
                <option value="all">All Types</option>
                <option value="pdf">PDF</option>
                <option value="word">Word</option>
                <option value="sheet">Spreadsheets</option>
                <option value="image">Images</option>
                <option value="text">Text/Notes</option>
              </select>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 300, paddingRight: 8 }}>
              {/* Active Uploads */}
              {Object.values(activeUploads).map((up, i) => (
                <div key={i} style={{ padding: 16, border: '1px dashed #3B82F6', borderRadius: 12, background: '#EFF6FF', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="spinner-small" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{up.name}</div>
                      <div style={{ fontSize: 12, color: '#3B82F6' }}>{up.status}</div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredMaterials.length === 0 && Object.keys(activeUploads).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 0', color: '#9CA3AF' }}>
                  <p>No materials uploaded yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {filteredMaterials.map(m => (
                    <div key={m.id} className="feature-card" style={{ padding: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
                        <div style={{ width: 40, height: 40, background: '#F3F4F6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {m.type.includes('pdf') ? '📄' : m.type.includes('sheet') ? '📊' : m.type.includes('word') ? '📝' : m.type.includes('image') ? '🖼️' : '📄'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.name}>
                            {m.name}
                          </h4>
                          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0' }}>
                            {(m.size / 1024).toFixed(1)} KB • {new Date(m.uploadedAt).toLocaleDateString()}
                          </p>
                          <span style={{ fontSize: 10, background: '#DEF7EC', color: '#059669', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                            READY
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                        <button onClick={() => showToast('Preview feature coming soon')} className="btn-secondary" style={{ flex: 1, padding: '6px', fontSize: 11 }}>View</button>
                        <button onClick={() => handleDownloadMaterial(m)} className="btn-secondary" style={{ flex: 1, padding: '6px', fontSize: 11 }}>Download</button>
                        <button onClick={() => handleDeleteMaterial(m.id)} className="btn-secondary" style={{ padding: '6px', fontSize: 11, color: '#EF4444', borderColor: '#FCA5A5' }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/*Delete Modal*/}
      {showDeleteModal && classToDelete && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return
            setShowDeleteModal(false)
            setClassToDelete(null)
          }}
          style={{ backdropFilter: 'blur(2px)' }}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-md w-full"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
              animation: 'modalIn 140ms ease-out'
            }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Delete Class?</h2>
            <p style={{ color: '#6B7280', marginBottom: 18, lineHeight: 1.6 }}>
              This will permanently delete <strong>{classToDelete.name}</strong> and remove it from all students’ dashboards.
            </p>

            <div style={{ padding: 12, background: '#FEF2F2', borderRadius: 12, border: '1px solid #FECACA', marginBottom: 22 }}>
              <div style={{ fontSize: 12, color: '#991B1B', fontWeight: 900, marginBottom: 4 }}>
                This action cannot be undone.
              </div>
              <div style={{ fontSize: 12, color: '#991B1B' }}>
                Class code: <span style={{ fontFamily: 'monospace', fontWeight: 900 }}>{classToDelete.code}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false)
                  setClassToDelete(null)
                }}
                className="btn-secondary"
                style={{ flex: 1 }}
                disabled={isDeleting}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteClass}
                className="btn-primary"
                style={{
                  flex: 1,
                  background: '#EF4444',
                  opacity: isDeleting ? 0.75 : 1,
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(8px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}

export default Teacher
