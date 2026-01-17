import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import UserMenu from '../components/UserMenu'
import { createClass, deleteClass, getTeacherClasses, updateClassMaterials } from '../utils/storage'
import { ROLES } from '../utils/roles'
import { extractTextFromFile, normalizeForMaterialsAppend } from '../utils/fileText'

function Teacher() {
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()

  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role || null

  const createNameRef = useRef(null)
  const uploadTextRef = useRef(null)
  const fileInputRef = useRef(null)

  const UI_LIMITS = {
    MATERIALS_MAX_UI_CHARS: 22000, //keeps UI snappy
    APPEND_FILE_MAX_CHARS: 9000, //per file extracted text cap
    MAX_TEXT_FILE_MB: 1,
    MAX_PDF_DOCX_MB: 10
  }

  const [classes, setClasses] = useState([])

  const [toast, setToast] = useState(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassSubject, setNewClassSubject] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [materials, setMaterials] = useState('')
  const [isSavingMaterials, setIsSavingMaterials] = useState(false)
  const [isParsingFile, setIsParsingFile] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [classToDelete, setClassToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function showToast(message, type = 'success') {
    setToast({ message, type })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => setToast(null), 2300)
  }

  function refreshClasses() {
    if (!user) return
    setClasses(getTeacherClasses(user.id))
  }

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
    refreshClasses()
  }, [isLoaded, user, role, navigate])

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
        setSelectedClass(null)
        setMaterials('')
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

  //Auto focus
  useEffect(() => {
    if (showCreateModal) setTimeout(() => createNameRef.current?.focus(), 0)
  }, [showCreateModal])

  useEffect(() => {
    if (showUploadModal) setTimeout(() => uploadTextRef.current?.focus(), 0)
  }, [showUploadModal])

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

  async function handleCopy(code) {
    const ok = await copyToClipboard(code)
    if (ok) showToast('Copied class code')
    else showToast('Copy failed on this browser', 'error')
  }

  function openUploadModalForClass(classItem) {
    setSelectedClass(classItem)
    setMaterials(classItem.materials || '')
    setShowUploadModal(true)
  }

  function openDeleteModalForClass(classItem) {
    setClassToDelete(classItem)
    setShowDeleteModal(true)
  }

  async function handleCreateClass(e) {
    e.preventDefault()
    if (!user) return
    if (!newClassName.trim()) return

    setIsCreating(true)
    await new Promise((r) => setTimeout(r, 200))

    const created = createClass(user.id, newClassName.trim(), newClassSubject.trim())
    refreshClasses()

    setIsCreating(false)
    setShowCreateModal(false)
    setNewClassName('')
    setNewClassSubject('')

    showToast('Class created')
    if (created) openUploadModalForClass(created)
  }

  async function handleSaveMaterials(e) {
    e.preventDefault()
    if (!selectedClass) return

    if (!materials.trim()) {
      showToast('Add some materials first', 'error')
      return
    }

    setIsSavingMaterials(true)
    await new Promise((r) => setTimeout(r, 200))

    updateClassMaterials(selectedClass.code, materials.trim())
    refreshClasses()

    setIsSavingMaterials(false)
    setShowUploadModal(false)
    setSelectedClass(null)
    setMaterials('')

    showToast('Materials saved')
  }

  async function handleConfirmDelete() {
    if (!user || !classToDelete) return

    setIsDeleting(true)
    await new Promise((r) => setTimeout(r, 200))

    const ok = deleteClass(user.id, classToDelete.code)
    refreshClasses()

    setIsDeleting(false)
    setShowDeleteModal(false)
    setClassToDelete(null)

    if (ok) showToast('Class deleted')
    else showToast('Delete failed', 'error')
  }

  function handleChooseFile() {
    if (isParsingFile) return
    fileInputRef.current?.click()
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const name = (file.name || '').toLowerCase()
    const isPdf = name.endsWith('.pdf') || file.type === 'application/pdf'
    const isDocx =
      name.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    const isTextLike = name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || name.endsWith('.json')

    if (!isPdf && !isDocx && !isTextLike) {
      showToast('Upload PDF, DOCX, TXT, MD, CSV, or JSON', 'error')
      return
    }

    const sizeMB = file.size / (1024 * 1024)
    if ((isPdf || isDocx) && sizeMB > UI_LIMITS.MAX_PDF_DOCX_MB) {
      showToast('File too large (max 10MB)', 'error')
      return
    }
    if (isTextLike && sizeMB > UI_LIMITS.MAX_TEXT_FILE_MB) {
      showToast('File too large (max 1MB)', 'error')
      return
    }

    setIsParsingFile(true)
    try {
      const raw = await extractTextFromFile(file)
      if (!raw || !raw.trim()) {
        showToast('Could not extract text from that file', 'error')
        setIsParsingFile(false)
        return
      }

      const block = normalizeForMaterialsAppend(file.name, raw, UI_LIMITS.APPEND_FILE_MAX_CHARS)

      setMaterials((prev) => {
        const base = (prev || '').trim()
        const next = base ? `${base}\n\n${block}` : block
        return next.length > UI_LIMITS.MATERIALS_MAX_UI_CHARS ? next.slice(0, UI_LIMITS.MATERIALS_MAX_UI_CHARS) : next
      })

      showToast('File added to materials')
    } catch (err) {
      showToast('File parse failed', 'error')
    } finally {
      setIsParsingFile(false)
    }
  }

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
            alignItems: 'center'
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <img src="/Logo.jpg" alt="ClassAI Logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <span style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>ClassAI</span>
          </Link>
          <UserMenu />
        </div>
      </nav>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 18,
            right: 18,
            zIndex: 9999,
            padding: '10px 12px',
            borderRadius: 12,
            fontWeight: 900,
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

      <div style={{ padding: '40px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#111827', marginBottom: 8 }}>Teacher Dashboard</h1>
            <p style={{ color: '#6B7280' }}>Create classes and upload materials for your AI tutors</p>
          </div>

          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            Create New Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="feature-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 24 }}>No classes yet</h3>
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              Create Your First Class
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
            {classes.map((c) => {
              const hasMaterials = !!(c.materials && c.materials.trim().length > 0)
              return (
                <div key={c.code} className="feature-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 900,
                          background: hasMaterials ? '#DEF7EC' : '#FEF3C7',
                          color: hasMaterials ? '#059669' : '#D97706'
                        }}
                      >
                        {hasMaterials ? 'Active' : 'Setup Needed'}
                      </span>

                      <button
                        type="button"
                        onClick={() => openDeleteModalForClass(c)}
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

                    <h3 style={{ fontSize: 20, fontWeight: 900, color: '#111827', marginBottom: 4 }}>{c.name}</h3>
                    {!!c.subject && <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 16 }}>{c.subject}</p>}

                    <div style={{ padding: 12, background: '#F9FAFB', borderRadius: 12, marginBottom: 16, border: '1px solid #EEF2F7' }}>
                      <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: 800 }}>Class Code</p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: '#111827', fontFamily: 'monospace' }}>{c.code}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(c.code)}
                          style={{
                            padding: '6px 10px',
                            background: 'white',
                            border: '1px solid #D1D5DB',
                            borderRadius: 12,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 900,
                            color: '#374151'
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>

                  <button className="btn-secondary" style={{ width: '100%' }} onClick={() => openUploadModalForClass(c)}>
                    {hasMaterials ? 'Update Materials' : 'Upload Materials'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/json,text/csv"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      {/* Create Class Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          style={{ backdropFilter: 'blur(2px)' }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return
            setShowCreateModal(false)
            setNewClassName('')
            setNewClassSubject('')
          }}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-md w-full"
            style={{ borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'modalIn 140ms ease-out' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Class</h2>

            <form onSubmit={handleCreateClass}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 900, color: '#374151', marginBottom: 8 }}>
                  Class Name *
                </label>
                <input
                  ref={createNameRef}
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g., Biology 101"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: 12,
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 900, color: '#374151', marginBottom: 8 }}>
                  Subject (Optional)
                </label>
                <input
                  value={newClassSubject}
                  onChange={(e) => setNewClassSubject(e.target.value)}
                  placeholder="e.g., Life Sciences"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: 12,
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewClassName('')
                    setNewClassSubject('')
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    flex: 1,
                    opacity: !newClassName.trim() || isCreating ? 0.55 : 1,
                    cursor: !newClassName.trim() || isCreating ? 'not-allowed' : 'pointer'
                  }}
                  disabled={!newClassName.trim() || isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Materials Modal */}
      {showUploadModal && selectedClass && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          style={{ overflowY: 'auto', backdropFilter: 'blur(2px)' }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return
            setShowUploadModal(false)
            setSelectedClass(null)
            setMaterials('')
          }}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-2xl w-full"
            style={{ margin: 20, borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'modalIn 140ms ease-out' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Class Materials</h2>
                <p style={{ color: '#6B7280' }}>
                  {selectedClass.name} — Code: <strong>{selectedClass.code}</strong>
                </p>
              </div>

              <button type="button" className="btn-secondary" onClick={handleChooseFile} disabled={isParsingFile}>
                {isParsingFile ? 'Reading...' : 'Add File'}
              </button>
            </div>

            <form onSubmit={handleSaveMaterials}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 900, color: '#374151', marginBottom: 8 }}>
                  Materials
                </label>

                <textarea
                  ref={uploadTextRef}
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="Paste notes… or click Add File (PDF/DOCX/TXT/MD/CSV/JSON)"
                  rows={12}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: 12,
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                  required
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 12, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                    Tip: the AI automatically uses only the most relevant parts to control tokens.
                  </p>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: 0, fontWeight: 900 }}>
                    {Math.min(materials.length, UI_LIMITS.MATERIALS_MAX_UI_CHARS).toLocaleString()} / {UI_LIMITS.MATERIALS_MAX_UI_CHARS.toLocaleString()}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowUploadModal(false)
                    setSelectedClass(null)
                    setMaterials('')
                  }}
                  disabled={isSavingMaterials}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    flex: 1,
                    opacity: !materials.trim() || isSavingMaterials ? 0.55 : 1,
                    cursor: !materials.trim() || isSavingMaterials ? 'not-allowed' : 'pointer'
                  }}
                  disabled={!materials.trim() || isSavingMaterials}
                >
                  {isSavingMaterials ? 'Saving...' : 'Save Materials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteModal && classToDelete && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          style={{ backdropFilter: 'blur(2px)' }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return
            setShowDeleteModal(false)
            setClassToDelete(null)
          }}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-md w-full"
            style={{ borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'modalIn 140ms ease-out' }}
            onMouseDown={(e) => e.stopPropagation()}
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
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowDeleteModal(false)
                  setClassToDelete(null)
                }}
                disabled={isDeleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary"
                style={{
                  flex: 1,
                  background: '#EF4444',
                  opacity: isDeleting ? 0.75 : 1,
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
                onClick={handleConfirmDelete}
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
