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
// Use legacy build for better browser/environment compatibility
// Use legacy build for better browser/environment compatibility
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

// Helper to ensure worker is always configured before use
function ensurePdfWorker() {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      // Try to construct a local URL first - this handles the Vite dev/prod path issues better
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()
    } catch (e) {
      // Fallback if import.meta.url fails or other issues
      console.warn('Worker URL construction failed, falling back to CDN as last resort', e)
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
    }
  }
}

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
        setSelectedClass(null)
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

  // Body scroll lock when any modal is open
  useEffect(() => {
    if (showCreateModal || showUploadModal || showDeleteModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
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

  // Ensure PDF.js worker is set up
  const ensurePdfWorker = () => {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }
  };

  const extractTextFromPdf = async (file, progressCallback) => {
    ensurePdfWorker()

    const debug = {
      pagesDetected: 0,
      extractedTextLength: 0,
      workerLoaded: !!pdfjsLib.GlobalWorkerOptions.workerSrc,
      workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc,
      first200Chars: '',
      isLikelyScanned: false
    }

    console.log('[PDF_PARSE_START]', { fileName: file.name, size: file.size, workerSrc: debug.workerSrc })

    try {
      const buffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: buffer })
      const pdf = await loadingTask.promise
      const pageMetadata = []
      let fullText = ''

      const totalPages = pdf.numPages
      debug.pagesDetected = totalPages

      const maxPages = Math.min(totalPages, 25)

      for (let i = 1; i <= maxPages; i++) {
        if (progressCallback) {
          progressCallback(`Processing page ${i} of ${maxPages}...`)
        }

        try {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()

          // Safer text joining strategy
          const pageText = (textContent.items || [])
            .map(item => (item && typeof item.str === 'string') ? item.str : '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()

          if (pageText.length > 0) {
            pageMetadata.push({
              pageNumber: i,
              text: pageText
            })
            fullText += pageText + '\n\n'
          }
        } catch (pageErr) {
          console.warn(`[PDF_PAGE_ERROR] page ${i}`, pageErr)
        }

        if (fullText.length > 500000) {
          if (progressCallback) {
            progressCallback(`Extracted ${i} pages (size limit reached)`)
          }
          break
        }
      }

      fullText = fullText.replace(/\r/g, '').trim()

      debug.extractedTextLength = fullText.length
      debug.first200Chars = fullText.slice(0, 200)

      if (fullText.length === 0) {
        debug.isLikelyScanned = true
        console.warn('[PDF_PARSE_WARN] 0 characters extracted', debug)
        fullText = `[PDF EXTRACTION WARNING: 0 characters extracted]\n` +
          `Debug Info: ${JSON.stringify({ file: file.name, pages: totalPages, workerSrc: debug.workerSrc })}`
      } else {
        console.log('[PDF_PARSE_SUCCESS]', {
          pages: totalPages,
          extractedChars: fullText.length
        })
      }

      if (progressCallback) {
        progressCallback('Finalizing...')
      }

      return { text: fullText, pageMetadata, debug }
    } catch (err) {
      console.error('[PDF_PARSE_FAILURE]', {
        errorMessage: err?.message,
        stack: err?.stack,
        workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc
      })
      return {
        text: `[PDF EXTRACTION ERROR: ${String(err?.message || err)}]\n` +
          `Debug Info: ${JSON.stringify({ file: file.name, workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc })}`,
        pageMetadata: [],
        debug: { ...debug, error: String(err?.message || err) }
      }
    }
  }

  const handleChooseFile = () => {
    if (isBusy) return
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
        let pageMetadata = null
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
        } else if (isPdf) {
          // Pass progress callback for PDF extraction
          const progressCallback = (status) => {
            setActiveUploads(prev => ({ ...prev, [fileId]: { name: file.name, progress: 50, status } }))
          }

          const pdfResult = await extractTextFromPdf(file, progressCallback)
          // Always use results, even if empty/error message is set
          content = pdfResult.text
          pageMetadata = pdfResult.pageMetadata
          console.log('PDF Result Debug:', pdfResult.debug)

          console.log('[PDF_STORE]', {
            file: file.name,
            contentLen: (content || '').length,
            pages: pdfResult?.debug?.pagesDetected,
            workerSrc: pdfResult?.debug?.workerSrc
          })
        } else if (isExcel) {
          const buffer = await file.arrayBuffer()
          const workbook = XLSX.read(buffer, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          content = XLSX.utils.sheet_to_csv(firstSheet)
        } else if (isJson) {
          const text = await file.text()
          content = text
        } else if (isText) {
          content = await file.text().catch(() => '(Text extraction failed for this file)')
        } else {
          content = `(Uploaded ${file.name}. AI grounding limited for this format.)`
        }

        createMaterial(selectedClass.code, user.id, {
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          content: content.slice(0, 1000000),
          pageMetadata
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

  const isBusy = isUploading || Object.keys(activeUploads).length > 0

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: '#111827', marginBottom: 8, letterSpacing: '-0.025em' }}>Dashboard</h1>
            <p style={{ color: '#6B7280', fontSize: 16 }}>Manage your classes and AI teaching resources</p>
          </div>

          <button onClick={() => setShowCreateModal(true)} className="btn-primary" style={{ padding: '12px 24px', fontSize: 15 }}>
            <span style={{ marginRight: 8 }}>+</span> Create New Class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="feature-card" style={{ textAlign: 'center', padding: '80px 32px', background: '#F9FAFB', border: '2px dashed #E5E7EB' }}>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 12 }}>No classes yet</h3>
            <p style={{ color: '#6B7280', marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>Start by creating your first class. You'll be able to upload materials and invite students.</p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              Create Your First Class
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 32 }}>
            {classes.slice(0, displayLimit).map((classItem) => {
              const classMats = getClassMaterials(classItem.code)
              const hasMaterials = classMats.length > 0

              return (
                <div key={classItem.code} className="feature-card" style={{ display: 'flex', flexDirection: 'column', padding: 28, transition: 'transform 0.2s, box-shadow 0.2s', border: '1px solid #E5E7EB' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <span
                        style={{
                          padding: '4px 12px',
                          background: hasMaterials ? '#ECFDF5' : '#FFF7ED',
                          color: hasMaterials ? '#059669' : '#C2410C',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.025em'
                        }}
                      >
                        {hasMaterials ? '● Active' : '○ Pending Setup'}
                      </span>

                      <button
                        type="button"
                        onClick={() => openDeleteModal(classItem)}
                        className="btn-secondary"
                        style={{
                          padding: '6px 12px',
                          border: 'none',
                          background: '#FEF2F2',
                          color: '#DC2626',
                          fontSize: 11,
                          fontWeight: 700
                        }}
                      >
                        DELETE
                      </button>
                    </div>

                    <h3 style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 6 }}>{classItem.name}</h3>
                    {!!classItem.subject && (
                      <p style={{ color: '#6B7280', fontSize: 15, marginBottom: 20, fontWeight: 500 }}>{classItem.subject}</p>
                    )}

                    <div style={{ padding: 16, background: '#F8FAFC', borderRadius: 12, border: '1px solid #F1F5F9', marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Join Code</span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{classItem.code}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(classItem.code)}
                        className="btn-secondary"
                        style={{ width: '100%', fontSize: 12, fontWeight: 700, background: 'white' }}
                      >
                        Copy Invitation Code
                      </button>
                    </div>

                    {/* Material Preview Section */}
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Class Repository</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>{classMats.length} items</span>
                      </div>

                      {classMats.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {classMats.slice(0, 5).map(m => (
                            <div key={m.id} style={{ padding: '10px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                  <span style={{ fontSize: 16 }}>
                                    {m.type.includes('pdf') ? '📄' : m.type.includes('sheet') ? '📊' : m.name.endsWith('docx') ? '📝' : 'ૂ'}
                                  </span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }} title={m.name}>
                                    {m.name}
                                  </span>
                                </div>

                                {/* Status Badge */}
                                {m.textLength === 0 && !m.name.endsWith('.docx') && !m.type.includes('image') ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: '#FEF2F2', color: '#DC2626', padding: '2px 6px', borderRadius: 4, border: '1px solid #FECACA' }}>
                                    SCANNED / EMPTY
                                  </span>
                                ) : m.status === 'Processing...' ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: 4 }}>
                                    PROCESSING
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 10, fontWeight: 700, background: '#ECFDF5', color: '#059669', padding: '2px 6px', borderRadius: 4 }}>
                                    READY ({Math.round(m.size / 1024)}KB)
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: '#64748B' }}>
                                  {new Date(m.uploadedAt).toLocaleDateString()}
                                </span>
                                <button
                                  onClick={() => handleDeleteMaterial(m.id)}
                                  style={{ border: 'none', background: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 14, padding: 4 }}
                                  title="Delete file"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                          {classMats.length > 5 && (
                            <button onClick={() => openUploadModal(classItem)} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, fontWeight: 600, padding: '4px 0', cursor: 'pointer', textAlign: 'left' }}>
                              + {classMats.length - 5} more files...
                            </button>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: 8, border: '1px dashed #E5E7EB', textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>
                          No materials uploaded yet
                        </div>
                      )}
                    </div>

                    {/* Class Size Gauge */}
                    <div style={{ marginBottom: 24, padding: '16px 0', borderTop: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Enrollment</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>
                          {getEnrolledCount(classItem.code)} / {classItem.capacity || 30}
                        </span>
                      </div>
                      <div style={{ height: 10, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, (getEnrolledCount(classItem.code) / (classItem.capacity || 30)) * 100)}%`,
                            background: (getEnrolledCount(classItem.code) / (classItem.capacity || 30)) >= 0.9 ? '#F43F5E' : '#3B82F6',
                            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                        />
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Set Capacity:</span>
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
                            width: 60,
                            fontSize: 12,
                            padding: '4px 8px',
                            border: '1px solid #E2E8F0',
                            borderRadius: 6,
                            outline: 'none',
                            fontWeight: 700,
                            color: '#1E293B'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => openUploadModal(classItem)}
                    className="btn-primary"
                    style={{
                      width: '100%',
                      background: 'white',
                      color: '#3B82F6',
                      border: '2px solid #3B82F6',
                      fontWeight: 700,
                      padding: '12px'
                    }}
                  >
                    Manage Materials
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {classes.length > displayLimit && (
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <button
              onClick={() => setDisplayLimit(prev => prev + 6)}
              className="btn-secondary"
              style={{ padding: '12px 32px' }}
            >
              Load More Classes
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
          style={{ backdropFilter: 'blur(4px)' }}
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
          style={{ overflowY: 'auto', backdropFilter: 'blur(4px)' }}
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
          style={{ backdropFilter: 'blur(4px)' }}
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
