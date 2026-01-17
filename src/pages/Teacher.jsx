import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import UserMenu from '../components/UserMenu'
import { createClass, getTeacherClasses, updateClassMaterials, deleteClass } from '../utils/storage'
import { ROLES } from '../utils/roles'

function Teacher() {
  const { user, isLoaded } = useUser()
  const navigate = useNavigate()

  const createModalRef = useRef(null)
  const uploadModalRef = useRef(null)

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

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [materials, setMaterials] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [classToDelete, setClassToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [copiedCode, setCopiedCode] = useState(null)

  useEffect(() => {
    if (user) setClasses(getTeacherClasses(user.id))
  }, [user])

  const refreshClasses = () => {
    if (!user) return
    setClasses(getTeacherClasses(user.id))
  }

  // ESC closes modals
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
        setUploadError('')
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
    await new Promise((r) => setTimeout(r, 300))

    const newClass = createClass(user.id, newClassName.trim(), newClassSubject.trim())
    refreshClasses()

    setNewClassName('')
    setNewClassSubject('')
    setShowCreateModal(false)
    setIsCreating(false)

    if (newClass) openUploadModal(newClass)
  }

  const openUploadModal = (classItem) => {
    setSelectedClass(classItem)
    setMaterials(classItem.materials || '')
    setUploadError('')
    setShowUploadModal(true)
  }

  const safeAppend = (existing, extra) => {
    const a = (existing || '').trim()
    const b = (extra || '').trim()
    if (!a) return b
    if (!b) return a
    return `${a}\n\n${b}`
  }

  const handleMaterialsFile = async (file) => {
    setUploadError('')

    if (!file) return

    const name = (file.name || '').toLowerCase()

    const allowed = ['.txt', '.md', '.csv', '.json']
    const ok = allowed.some(ext => name.endsWith(ext))
    if (!ok) {
      setUploadError('Upload a .txt, .md, .csv, or .json file (PDFs need a backend parser).')
      return
    }

    if (file.size > 2_000_000) {
      setUploadError('That file is too large. Please upload a smaller file (under ~2MB).')
      return
    }

    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result || '')
      reader.onerror = () => reject(new Error('Failed to read file.'))
      reader.readAsText(file)
    })

    const header = `--- Imported from ${file.name} ---`
    setMaterials(prev => safeAppend(prev, `${header}\n${text}`))
  }

  const handleUploadMaterials = async (e) => {
    e.preventDefault()
    if (!materials.trim() || !selectedClass || !user) return

    setIsUploading(true)
    await new Promise((r) => setTimeout(r, 350))

    //Critical fix: correct signature is (classCode, materials)
    updateClassMaterials(selectedClass.code, materials.trim())
    refreshClasses()

    setShowUploadModal(false)
    setMaterials('')
    setSelectedClass(null)
    setUploadError('')
    setIsUploading(false)
  }

  const openDeleteModal = (classItem) => {
    setClassToDelete(classItem)
    setShowDeleteModal(true)
  }

  const handleDeleteClass = async () => {
    if (!user || !classToDelete) return

    setIsDeleting(true)
    await new Promise((r) => setTimeout(r, 350))

    deleteClass(user.id, classToDelete.code)
    refreshClasses()

    setIsDeleting(false)
    setShowDeleteModal(false)
    setClassToDelete(null)
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (e) {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        return ok
      } catch (err) {
        return false
      }
    }
  }

  const handleCopy = async (code) => {
    const ok = await copyToClipboard(code)
    if (!ok) return
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 900)
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

      <div style={{ padding: '40px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>Teacher Dashboard</h1>
            <p style={{ color: '#6B7280' }}>Create classes and upload materials for your AI tutors</p>
          </div>

          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            Create New Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="feature-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '24px' }}>No classes yet</h3>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              Create Your First Class
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {classes.map((classItem) => {
              const needsSetup = !classItem.materials || !classItem.materials.trim()
              const badgeBg = needsSetup ? '#FEF3C7' : '#DEF7EC'
              const badgeColor = needsSetup ? '#D97706' : '#059669'
              const badgeText = needsSetup ? 'Setup Needed' : 'Active'
              const isCopied = copiedCode === classItem.code

              return (
                <div key={classItem.code} className="feature-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <span style={{ padding: '4px 12px', background: badgeBg, color: badgeColor, borderRadius: '12px', fontSize: '12px', fontWeight: '700' }}>
                        {badgeText}
                      </span>

                      <button
                        type="button"
                        onClick={() => openDeleteModal(classItem)}
                        style={{
                          padding: '6px 10px',
                          background: 'white',
                          border: '1px solid #FCA5A5',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '800',
                          color: '#B91C1C',
                          lineHeight: 1,
                        }}
                        title="Delete class"
                      >
                        Delete
                      </button>
                    </div>

                    <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#111827', marginBottom: '4px' }}>
                      {classItem.name}
                    </h3>
                    {classItem.subject && <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px' }}>{classItem.subject}</p>}

                    <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '12px', marginBottom: '16px', border: '1px solid #EEF2F7' }}>
                      <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px', fontWeight: '700' }}>Class Code</p noting="true" />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <span style={{ fontSize: '18px', fontWeight: '800', color: '#111827', fontFamily: 'monospace' }}>
                          {classItem.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(classItem.code)}
                          style={{
                            padding: '6px 10px',
                            background: isCopied ? '#ECFDF5' : 'white',
                            border: isCopied ? '1px solid #6EE7B7' : '1px solid #D1D5DB',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: isCopied ? '#047857' : '#6B7280',
                            whiteSpace: 'nowrap',
                            fontWeight: '800'
                          }}
                        >
                          {isCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button onClick={() => openUploadModal(classItem)} className="btn-secondary" style={{ width: '100%' }}>
                    {needsSetup ? 'Upload Materials' : 'Update Materials'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Class Modal */}
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
            style={{ borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'modalIn 140ms ease-out' }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Class</h2>
            <form onSubmit={handleCreateClass}>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="className" style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
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
                    borderRadius: '12px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'box-shadow 0.15s, border-color 0.15s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3B82F6'
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label htmlFor="classSubject" style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
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
                    borderRadius: '12px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'box-shadow 0.15s, border-color 0.15s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3B82F6'
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
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
                  style={{ flex: 1, opacity: !newClassName.trim() || isCreating ? '0.5' : '1', cursor: !newClassName.trim() || isCreating ? 'not-allowed' : 'pointer' }}
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
            setMaterials('')
            setSelectedClass(null)
            setUploadError('')
          }}
        >
          <div
            className="bg-white rounded-lg p-8 max-w-2xl w-full"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ margin: '20px', borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'modalIn 140ms ease-out' }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Class Materials</h2>
            <p style={{ color: '#6B7280', marginBottom: '16px' }}>
              {selectedClass.name} - Code: <strong>{selectedClass.code}</strong>
            </p>

            {/* File Upload (optional) */}
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  border: '1px dashed #D1D5DB',
                  borderRadius: '14px',
                  padding: '14px',
                  background: '#FAFAFB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>Import a file (optional)</div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                    Supports .txt, .md, .csv, .json (we’ll append it into materials).
                  </div>
                </div>

                <label
                  style={{
                    padding: '8px 12px',
                    borderRadius: '12px',
                    background: 'white',
                    border: '1px solid #E5E7EB',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '800',
                    color: '#111827'
                  }}
                >
                  Choose File
                  <input
                    type="file"
                    accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (f) handleMaterialsFile(f)
                    }}
                  />
                </label>
              </div>

              {uploadError && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#B91C1C', fontWeight: '800' }}>
                  {uploadError}
                </div>
              )}
            </div>

            <form onSubmit={handleUploadMaterials}>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="materials" style={{ display: 'block', fontSize: '14px', fontWeight: '800', color: '#374151', marginBottom: '8px' }}>
                  Course Materials and Information
                </label>

                <textarea
                  id="materials"
                  ref={uploadModalRef}
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  placeholder="Paste syllabus, lecture notes, study guides, key topics, allowed resources, grading rules, etc."
                  rows="12"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'box-shadow 0.15s, border-color 0.15s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3B82F6'
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#E5E7EB'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  required
                />

                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px' }}>
                  Tip: keep it focused. Huge dumps can reduce quality and increase token usage.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false)
                    setMaterials('')
                    setSelectedClass(null)
                    setUploadError('')
                  }}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!materials.trim() || isUploading}
                  className="btn-primary"
                  style={{ flex: 1, opacity: !materials.trim() || isUploading ? '0.5' : '1', cursor: !materials.trim() || isUploading ? 'not-allowed' : 'pointer' }}
                >
                  {isUploading ? 'Saving...' : 'Save Materials'}
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
            style={{ borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', animation: 'modalIn 140ms ease-out' }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Delete Class?</h2>
            <p style={{ color: '#6B7280', marginBottom: '18px', lineHeight: 1.6 }}>
              This will permanently delete <strong>{classToDelete.name}</strong> and remove it from all students’ dashboards.
            </p>

            <div style={{ padding: '12px', background: '#FEF2F2', borderRadius: '12px', border: '1px solid #FECACA', marginBottom: '22px' }}>
              <div style={{ fontSize: '12px', color: '#991B1B', fontWeight: '900', marginBottom: '4px' }}>
                This action cannot be undone.
              </div>
              <div style={{ fontSize: '12px', color: '#991B1B' }}>
                Class code: <span style={{ fontFamily: 'monospace', fontWeight: '900' }}>{classToDelete.code}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
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
                style={{ flex: 1, background: isDeleting ? '#FCA5A5' : '#EF4444', opacity: isDeleting ? '0.8' : '1', cursor: isDeleting ? 'not-allowed' : 'pointer' }}
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
