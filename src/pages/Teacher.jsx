import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import UserMenu from '../components/UserMenu'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { ocrImageToNotes } from '../utils/ocr'
import {
  getTeacherClasses,
  createClass,
  updateClassMaterials,
  createMaterial,
  getClassMaterials,
  deleteMaterial,
  saveClassMaterials,
  syncClassMaterials
} from '../utils/storage'

function Teacher() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const [classes, setClasses] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedClass, setSelectedClass] = useState(null)
  const [newClassName, setNewClassName] = useState('')
  const [newClassSubject, setNewClassSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [classMaterials, setClassMaterials] = useState([])
  const [uploadError, setUploadError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)

  const LIMITS = {
    MAX_FILE_CHARS: 20000,
    MAX_PAGE_CHARS: 1500,
    MAX_PAGES: 30
  }

  useEffect(() => {
    const load = async () => {
      if (!user) return
      const token = await getToken()
      const teacherClasses = await getTeacherClasses(token)
      setClasses(teacherClasses || [])
    }
    load()
  }, [user])

  const ensurePdfWorker = () => {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString()
      } catch {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
      }
    }
  }

  const compressText = (text, maxChars) => {
    const cleaned = String(text || '')
      .replace(/\r/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned.length <= maxChars) return cleaned
    return cleaned.slice(0, maxChars) + '…'
  }

  const extractTextFromPdf = async (file) => {
    ensurePdfWorker()
    const buffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: buffer })
    const pdf = await loadingTask.promise
    const maxPages = Math.min(pdf.numPages, LIMITS.MAX_PAGES)
    const pageMetadata = []
    let fullText = ''

    for (let i = 1; i <= maxPages; i += 1) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = (textContent.items || [])
        .map(item => (item && typeof item.str === 'string') ? item.str : '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (pageText) {
        const trimmed = compressText(pageText, LIMITS.MAX_PAGE_CHARS)
        pageMetadata.push({ pageNumber: i, text: trimmed })
        fullText += trimmed + '\n\n'
      }
    }

    if (!fullText.trim()) {
      return {
        text: '[PDF EXTRACTION WARNING: 0 characters extracted]',
        pageMetadata: []
      }
    }

    return {
      text: compressText(fullText, LIMITS.MAX_FILE_CHARS),
      pageMetadata
    }
  }

  const extractTextFromFile = async (file) => {
    const name = (file.name || '').toLowerCase()
    const type = (file.type || '').toLowerCase()

    if (type.startsWith('video/')) {
      return { error: 'Video files are not supported for AI materials.' }
    }

    if (name.endsWith('.pdf')) {
      return extractTextFromPdf(file)
    }

    if (name.endsWith('.docx')) {
      const buffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer: buffer })
      return { text: compressText(result?.value || '', LIMITS.MAX_FILE_CHARS), pageMetadata: null }
    }

    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const csv = XLSX.utils.sheet_to_csv(firstSheet)
      return { text: compressText(csv, LIMITS.MAX_FILE_CHARS), pageMetadata: null }
    }

    if (/\.(txt|md|html|htm|json|rtf|ppt|pptx)$/i.test(name) || type.startsWith('text/')) {
      const text = await file.text()
      return { text: compressText(text, LIMITS.MAX_FILE_CHARS), pageMetadata: null }
    }

    if (type.startsWith('image/')) {
      const ocr = await ocrImageToNotes(file)
      const combined = [ocr?.summary, ocr?.raw_text].filter(Boolean).join('\n')
      return { text: compressText(combined || `Image file (${file.name})`, LIMITS.MAX_FILE_CHARS), pageMetadata: null }
    }

    try {
      const text = await file.text()
      return { text: compressText(text, LIMITS.MAX_FILE_CHARS), pageMetadata: null }
    } catch {
      return { text: `Uploaded file: ${file.name}. Content could not be extracted.`, pageMetadata: null }
    }
  }

  const handleCreateClass = async (e) => {
    e.preventDefault()
    if (!newClassName.trim() || !user) return
    setIsCreating(true)
    await new Promise(r => setTimeout(r, 500))
    const token = await getToken()
    const newClass = await createClass(token, newClassName, newClassSubject)
    setClasses([...classes, newClass].filter(Boolean))
    setNewClassName('')
    setNewClassSubject('')
    setShowCreateModal(false)
    setIsCreating(false)
  }

  const handleUploadMaterials = async (e) => {
    e.preventDefault()
    if (!selectedClass) return
    setIsUploading(true)
    await new Promise(r => setTimeout(r, 500))
    if (notes.trim()) updateClassMaterials(selectedClass.code, notes)
    const token = await getToken()
    await saveClassMaterials(token, selectedClass.code)
    const updatedClasses = await getTeacherClasses(token)
    setClasses(updatedClasses || [])
    setShowUploadModal(false)
    setSelectedClass(null)
    setNotes('')
    setClassMaterials([])
    setIsUploading(false)
  }

  const openUploadModal = (classItem) => {
    const open = async () => {
      setSelectedClass(classItem)
      const token = await getToken()
      await syncClassMaterials(token, classItem.code)
      const mats = getClassMaterials(classItem.code)
      const notesMat = mats.find(m => m.id === `notes_${classItem.code}` || m.type === 'text/notes')
      setNotes(notesMat?.content || '')
      setClassMaterials(mats)
      setUploadError('')
      setShowUploadModal(true)
    }
    open()
  }

  const handleChooseFiles = () => {
    fileInputRef.current?.click()
  }

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!selectedClass || files.length === 0) return

    setUploadError('')
    setIsUploading(true)

    for (const file of files) {
      const { text, pageMetadata, error } = await extractTextFromFile(file)
      if (error) {
        setUploadError(error)
        continue
      }

      createMaterial(selectedClass.code, user?.id, {
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        content: text || '',
        pageMetadata
      })
    }

    setClassMaterials(getClassMaterials(selectedClass.code))
    const token = await getToken()
    await saveClassMaterials(token, selectedClass.code)
    setIsUploading(false)
  }

  const handleDeleteMaterial = (materialId) => {
    deleteMaterial(materialId)
    if (selectedClass) {
      setClassMaterials(getClassMaterials(selectedClass.code))
    }
    const sync = async () => {
      if (!selectedClass) return
      const token = await getToken()
      await saveClassMaterials(token, selectedClass.code)
    }
    sync()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* Navigation */}
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <img src="/Logo.jpg" alt="ClassAI Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            <span style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}>ClassAI</span>
          </Link>
          <UserMenu />
        </div>
      </nav>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>My Classes</h1>
            <p style={{ color: '#6B7280' }}>Manage your classes and AI assistants</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="feature-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
            <div style={{ width: '64px', height: '64px', background: '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg style={{ width: '32px', height: '32px', color: '#9CA3AF' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '24px' }}>No classes yet</h3>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">Create Your First Class</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {classes.map((classItem) => {
              const materialCount = getClassMaterials(classItem.code).length
              const hasMaterials = materialCount > 0
              return (
              <div key={classItem.code} className="feature-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <span style={{ padding: '4px 12px', background: hasMaterials ? '#DEF7EC' : '#FEF3C7', color: hasMaterials ? '#059669' : '#D97706', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>
                      {hasMaterials ? `Active (${materialCount})` : 'Setup Needed'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>{classItem.name}</h3>
                  {classItem.subject && <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px' }}>{classItem.subject}</p>}

                  <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '8px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>Class Code</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: '#111827', fontFamily: 'monospace' }}>{classItem.code}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(classItem.code) }}
                        style={{ padding: '4px 8px', background: 'white', border: '1px solid #D1D5DB', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#6B7280' }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                <button onClick={() => openUploadModal(classItem)} className="btn-secondary" style={{ width: '100%' }}>
                  {hasMaterials ? 'Manage Materials' : 'Upload Materials'}
                </button>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Create Class Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Class</h2>
            <form onSubmit={handleCreateClass}>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="className" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Class Name *
                </label>
                <input
                  type="text"
                  id="className"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g., Biology 101"
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label htmlFor="classSubject" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  id="classSubject"
                  value={newClassSubject}
                  onChange={(e) => setNewClassSubject(e.target.value)}
                  placeholder="e.g., Life Sciences"
                  style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box' }}
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
                  style={{ 
                    flex: 1,
                    opacity: (!newClassName.trim() || isCreating) ? '0.5' : '1',
                    cursor: (!newClassName.trim() || isCreating) ? 'not-allowed' : 'pointer'
                  }}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ overflowY: 'auto' }}>
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full" style={{ margin: '20px' }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Upload Class Materials
            </h2>
            <p style={{ color: '#6B7280', marginBottom: '24px' }}>
              {selectedClass.name} - Code: <strong>{selectedClass.code}</strong>
            </p>
            
            <form onSubmit={handleUploadMaterials}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Upload Files (all types except videos)
                </label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={handleChooseFiles} className="btn-secondary">
                    Add Files
                  </button>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                    PDFs, DOCX, TXT/MD, CSV/XLSX, JSON, Images, and more
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFilesSelected}
                  style={{ display: 'none' }}
                />
                {uploadError && (
                  <p style={{ fontSize: '12px', color: '#DC2626', marginTop: '8px' }}>{uploadError}</p>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="notes" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Teacher Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add quick notes or a syllabus summary to guide the AI..."
                  rows="6"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '8px' }}>
                  We compress files to reduce token use while keeping key content searchable.
                </p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Uploaded Materials
                </label>
                {classMaterials.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#6B7280' }}>No materials uploaded yet.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {classMaterials.map((mat) => (
                      <div key={mat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '6px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{mat.name}</div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>{mat.type || 'file'}</div>
                        </div>
                        <button type="button" onClick={() => handleDeleteMaterial(mat.id)} className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false)
                    setSelectedClass(null)
                    setNotes('')
                    setClassMaterials([])
                  }}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="btn-primary"
                  style={{ 
                    flex: 1,
                    opacity: isUploading ? '0.5' : '1',
                    cursor: isUploading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isUploading ? 'Saving...' : 'Save Materials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Teacher
