import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useUser, useAuth } from '@clerk/clerk-react'
import UserMenu from '../components/UserMenu'
import AppModal from '../components/AppModal'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { ocrImageToNotes } from '../utils/ocr'
import {
  getTeacherClasses,
  createClass,
  deleteClass,
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
  const [createError, setCreateError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false)
  const [isDeletingClass, setIsDeletingClass] = useState(false)
  const [pendingDeleteClass, setPendingDeleteClass] = useState(null)
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
  }, [getToken, user])

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

  const summarizeText = (text, maxChars = 1200) => {
    const raw = String(text || '').replace(/\s+/g, ' ').trim()
    if (!raw) return ''
    if (raw.length <= maxChars) return raw

    const stop = new Set([
      'the','a','an','and','or','but','if','then','else','when','where','what','why','how','who',
      'is','are','was','were','be','been','being','do','does','did',
      'i','me','my','mine','you','your','yours','we','our','they','their',
      'to','of','in','on','at','for','with','about','as','by','from','into','over','under',
      'this','that','these','those','it','its','can','could','should','would','will','just'
    ])

    const words = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stop.has(w))

    const freq = new Map()
    for (const w of words) {
      freq.set(w, (freq.get(w) || 0) + 1)
    }

    const sentences = raw.split(/(?<=[.!?])\s+/)
    const scored = sentences.map((s, idx) => {
      const n = s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
      let score = 0
      for (const w of n.split(/\s+/)) {
        if (!w || stop.has(w)) continue
        score += freq.get(w) || 0
      }
      return { idx, s: s.trim(), score }
    }).filter(x => x.s.length > 0)

    scored.sort((a, b) => b.score - a.score)
    const picked = scored.slice(0, Math.min(8, scored.length)).sort((a, b) => a.idx - b.idx)
    const bullets = picked.map(p => `• ${p.s}`)
    const summary = bullets.join('\n')
    return summary.length <= maxChars ? summary : summary.slice(0, maxChars) + '…'
  }

  const extractTextFromPdf = async (file) => {
    try {
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
        const items = (textContent.items || []).filter(item => item && typeof item.str === 'string')
        const lines = new Map()
        for (const item of items) {
          const y = Math.round(item.transform?.[5] || 0)
          const line = lines.get(y) || []
          line.push(item.str)
          lines.set(y, line)
        }
        const pageText = Array.from(lines.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([, line]) => line.join(' '))
          .join('\n')
          .replace(/\s+\n/g, '\n')
          .replace(/[ \t]+/g, ' ')
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
          pageMetadata: [],
          summary: '',
          status: 'warning',
          errorMessage: 'No text could be extracted (possibly scanned).'
        }
      }

      return {
        text: compressText(fullText, LIMITS.MAX_FILE_CHARS),
        pageMetadata,
        summary: summarizeText(fullText),
        status: 'ok',
        errorMessage: ''
      }
    } catch (err) {
      return {
        text: `[PDF EXTRACTION ERROR: ${String(err?.message || err)}]`,
        pageMetadata: [],
        summary: '',
        status: 'error',
        errorMessage: String(err?.message || err)
      }
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
      const raw = result?.value || ''
      return {
        text: compressText(raw, LIMITS.MAX_FILE_CHARS),
        pageMetadata: null,
        summary: summarizeText(raw),
        status: raw ? 'ok' : 'warning',
        errorMessage: raw ? '' : 'No text extracted from DOCX.'
      }
    }

    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const csv = XLSX.utils.sheet_to_csv(firstSheet)
      return {
        text: compressText(csv, LIMITS.MAX_FILE_CHARS),
        pageMetadata: null,
        summary: summarizeText(csv),
        status: csv ? 'ok' : 'warning',
        errorMessage: csv ? '' : 'No text extracted from spreadsheet.'
      }
    }

    if (/\.(txt|md|html|htm|json|rtf|ppt|pptx)$/i.test(name) || type.startsWith('text/')) {
      const text = await file.text()
      return {
        text: compressText(text, LIMITS.MAX_FILE_CHARS),
        pageMetadata: null,
        summary: summarizeText(text),
        status: text ? 'ok' : 'warning',
        errorMessage: text ? '' : 'No text extracted from file.'
      }
    }

    if (type.startsWith('image/')) {
      const ocr = await ocrImageToNotes(file)
      const combined = [ocr?.summary, ocr?.raw_text].filter(Boolean).join('\n')
      return {
        text: compressText(combined || `Image file (${file.name})`, LIMITS.MAX_FILE_CHARS),
        pageMetadata: null,
        summary: ocr?.summary || summarizeText(combined),
        status: combined ? 'ok' : 'warning',
        errorMessage: combined ? '' : 'OCR returned no text.'
      }
    }

    try {
      const text = await file.text()
      return {
        text: compressText(text, LIMITS.MAX_FILE_CHARS),
        pageMetadata: null,
        summary: summarizeText(text),
        status: text ? 'ok' : 'warning',
        errorMessage: text ? '' : 'No text extracted from file.'
      }
    } catch {
      return {
        text: `Uploaded file: ${file.name}. Content could not be extracted.`,
        pageMetadata: null,
        summary: '',
        status: 'error',
        errorMessage: 'Content could not be extracted.'
      }
    }
  }

  const openCreateModal = () => {
    setCreateError('')
    setShowCreateModal(true)
  }

  const resetCreateModal = () => {
    setShowCreateModal(false)
    setCreateError('')
    setNewClassName('')
    setNewClassSubject('')
  }

  const closeCreateModal = () => {
    if (isCreating) return
    resetCreateModal()
  }

  const resetUploadModal = () => {
    setShowUploadModal(false)
    setSelectedClass(null)
    setNotes('')
    setClassMaterials([])
    setUploadError('')
  }

  const closeUploadModal = () => {
    if (isUploading || isLoadingMaterials || isDeletingClass) return
    resetUploadModal()
  }

  const handleCreateClass = async (event) => {
    event.preventDefault()
    if (!newClassName.trim() || !user) return

    setIsCreating(true)
    setCreateError('')

    try {
      const token = await getToken()
      const newClass = await createClass(token, newClassName, newClassSubject)
      setClasses((current) => [...current, newClass].filter(Boolean))
      resetCreateModal()
    } catch (error) {
      setCreateError(error?.message || 'Unable to create this class right now.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleUploadMaterials = async (event) => {
    event.preventDefault()
    if (!selectedClass) return

    setIsUploading(true)
    setUploadError('')

    try {
      if (notes.trim()) updateClassMaterials(selectedClass.code, notes)
      const token = await getToken()
      await saveClassMaterials(token, selectedClass.code)
      const updatedClasses = await getTeacherClasses(token)
      setClasses(updatedClasses || [])
      resetUploadModal()
    } catch (error) {
      setUploadError(error?.message || 'Unable to save class materials.')
    } finally {
      setIsUploading(false)
    }
  }

  const openUploadModal = async (classItem) => {
    setSelectedClass(classItem)
    setNotes('')
    setClassMaterials([])
    setUploadError('')
    setShowUploadModal(true)
    setIsLoadingMaterials(true)

    try {
      const token = await getToken()
      await syncClassMaterials(token, classItem.code)
      const materials = getClassMaterials(classItem.code)
      const notesMaterial = materials.find((material) => material.id === `notes_${classItem.code}` || material.type === 'text/notes')

      setNotes(notesMaterial?.content || '')
      setClassMaterials(materials)
    } catch (error) {
      setUploadError(error?.message || 'Unable to load existing class materials.')
    } finally {
      setIsLoadingMaterials(false)
    }
  }

  const handleChooseFiles = () => {
    fileInputRef.current?.click()
  }

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!selectedClass || files.length === 0) return

    setUploadError('')
    setIsUploading(true)

    try {
      for (const file of files) {
        const { text, pageMetadata, summary, status, errorMessage, error } = await extractTextFromFile(file)
        if (error) {
          setUploadError(error)
          continue
        }

        createMaterial(selectedClass.code, user?.id, {
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          content: text || '',
          pageMetadata,
          summary: summary || '',
          status: status || 'ok',
          errorMessage: errorMessage || ''
        })
      }

      setClassMaterials(getClassMaterials(selectedClass.code))
      const token = await getToken()
      await saveClassMaterials(token, selectedClass.code)
    } catch (error) {
      setUploadError(error?.message || 'Unable to process these files.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteMaterial = async (materialId) => {
    deleteMaterial(materialId)

    if (!selectedClass) return

    setClassMaterials(getClassMaterials(selectedClass.code))

    try {
      const token = await getToken()
      await saveClassMaterials(token, selectedClass.code)
    } catch (error) {
      setUploadError(error?.message || 'Unable to remove this material right now.')
    }
  }

  const handleDeleteClass = async () => {
    if (!pendingDeleteClass) return

    setIsDeletingClass(true)
    setDeleteError('')

    try {
      const token = await getToken()
      await deleteClass(token, pendingDeleteClass.code)
      setClasses((current) => current.filter((classItem) => classItem.code !== pendingDeleteClass.code))
      setPendingDeleteClass(null)
      resetUploadModal()
    } catch (error) {
      setDeleteError(error?.message || 'Unable to delete this class right now.')
    } finally {
      setIsDeletingClass(false)
    }
  }

  const totalMaterials = classes.reduce((sum, classItem) => {
    const serverCount = Array.isArray(classItem.materials) ? classItem.materials.length : 0
    const localCount = getClassMaterials(classItem.code).length
    return sum + (serverCount || localCount)
  }, 0)

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <Link to="/" className="workspace-brand__link">
            <img src="/Logo.jpg" alt="StudyGuide AI Logo" className="workspace-brand__logo" />
            <div>
              <span className="workspace-brand__title">StudyGuide AI</span>
              <span className="workspace-brand__subtitle">Teacher Workspace</span>
            </div>
          </Link>
          <UserMenu />
        </div>

        <div className="workspace-sidebar__section">
          <p className="workspace-sidebar__eyebrow">Create</p>
          <button type="button" onClick={openCreateModal} className="btn-primary workspace-button-full">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Class
          </button>
          <div className="workspace-summary-list">
            <div className="workspace-summary-item">
              <span>Classes</span>
              <strong>{classes.length}</strong>
            </div>
            <div className="workspace-summary-item">
              <span>Materials</span>
              <strong>{totalMaterials}</strong>
            </div>
          </div>
        </div>

        <div className="workspace-sidebar__section workspace-sidebar__section--grow">
          <div className="workspace-sidebar__section-header">
            <div>
              <p className="workspace-sidebar__eyebrow">Library</p>
              <h2>Your classes</h2>
            </div>
            <span className="workspace-sidebar__count">{classes.length}</span>
          </div>

          <div className="workspace-nav-list">
            {classes.length === 0 ? (
              <div className="workspace-nav-empty">
                Create a class to start building material-grounded tutors.
              </div>
            ) : (
              classes.map((classItem) => {
                const serverCount = Array.isArray(classItem.materials) ? classItem.materials.length : 0
                const localCount = getClassMaterials(classItem.code).length
                const materialCount = serverCount || localCount

                return (
                  <button
                    key={classItem.code}
                    type="button"
                    className={`workspace-nav-item ${selectedClass?.code === classItem.code ? 'is-active' : ''}`}
                    onClick={() => openUploadModal(classItem)}
                  >
                    <div className="workspace-nav-item__icon is-accent">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div className="workspace-nav-item__body">
                      <span className="workspace-nav-item__title">{classItem.name}</span>
                      <span className="workspace-nav-item__meta">
                        {materialCount > 0 ? `${materialCount} materials` : 'Needs setup'}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-main__header workspace-main__header--compact">
          <h1>Classes</h1>
        </header>

        <section className="workspace-main__body">
          {classes.length === 0 ? (
            <div className="workspace-empty-state">
              <div className="workspace-empty-state__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2>No classes yet</h2>
              <p>Create your first class from the sidebar to start organizing materials and AI support.</p>
              <button type="button" onClick={openCreateModal} className="btn-primary">
                Create Your First Class
              </button>
            </div>
          ) : (
            <div className="workspace-card-grid">
              {classes.map((classItem) => {
                const serverCount = Array.isArray(classItem.materials) ? classItem.materials.length : 0
                const localCount = getClassMaterials(classItem.code).length
                const materialCount = serverCount || localCount
                const hasMaterials = materialCount > 0

                return (
                  <div key={classItem.code} className="workspace-card">
                    <div className="workspace-card__header">
                      <div className="workspace-card__icon is-accent">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <span className={`workspace-pill ${hasMaterials ? 'is-success' : 'is-warning'}`}>
                        {hasMaterials ? `${materialCount} materials` : 'Needs setup'}
                      </span>
                    </div>

                    <div className="workspace-card__content">
                      <h3>{classItem.name}</h3>
                      <p>{classItem.subject || 'Class workspace'}</p>
                    </div>

                    <div className="workspace-meta-block">
                      <span className="workspace-meta-block__label">Class Code</span>
                      <div className="workspace-inline-code">
                        <span className="workspace-meta-block__value">{classItem.code}</span>
                        <button
                          type="button"
                          className="workspace-inline-action"
                          onClick={() => navigator.clipboard.writeText(classItem.code)}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="workspace-card__actions">
                      <button
                        type="button"
                        className="workspace-icon-button workspace-icon-button--primary"
                        onClick={() => openUploadModal(classItem)}
                        aria-label={`${hasMaterials ? 'Manage materials for' : 'Upload materials to'} ${classItem.name}`}
                        title={hasMaterials ? 'Manage materials' : 'Upload materials'}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 16.5V9.75m0 0l-3 3m3-3l3 3M4.5 19.5h15A1.5 1.5 0 0021 18V6a1.5 1.5 0 00-1.5-1.5h-15A1.5 1.5 0 003 6v12a1.5 1.5 0 001.5 1.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {showCreateModal && (
        <AppModal
          title="Create New Class"
          description="Set up a class workspace and generate a code you can share with students."
          size="small"
          onClose={closeCreateModal}
          disableClose={isCreating}
        >
          <form onSubmit={handleCreateClass} className="modal-form">
            {createError && (
              <div className="status-banner is-error">
                <strong>Class creation failed</strong>
                <span>{createError}</span>
              </div>
            )}

            <div className="modal-field">
              <label htmlFor="className" className="modal-label">Class Name *</label>
              <input
                type="text"
                id="className"
                value={newClassName}
                onChange={(event) => setNewClassName(event.target.value)}
                placeholder="e.g., Biology 101"
                className="modal-input"
                required
              />
            </div>

            <div className="modal-field">
              <label htmlFor="classSubject" className="modal-label">Subject (optional)</label>
              <input
                type="text"
                id="classSubject"
                value={newClassSubject}
                onChange={(event) => setNewClassSubject(event.target.value)}
                placeholder="e.g., Life Sciences"
                className="modal-input"
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={closeCreateModal}
                className="btn-secondary"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newClassName.trim() || isCreating}
                className="btn-primary"
              >
                {isCreating ? 'Creating...' : 'Create Class'}
              </button>
            </div>
          </form>
        </AppModal>
      )}

      {showUploadModal && selectedClass && (
        <AppModal
          title="Manage Class Materials"
          description={`${selectedClass.name} • Code ${selectedClass.code}`}
          size="large"
          onClose={closeUploadModal}
          disableClose={isUploading || isLoadingMaterials || isDeletingClass}
        >
          <form onSubmit={handleUploadMaterials} className="modal-form">
            {uploadError && (
              <div className="status-banner is-error">
                <strong>Materials unavailable</strong>
                <span>{uploadError}</span>
              </div>
            )}

            <div className="modal-field">
              <label className="modal-label">Files</label>
              <div className="modal-inline-row">
                <button
                  type="button"
                  onClick={handleChooseFiles}
                  className="workspace-icon-button workspace-icon-button--soft"
                  disabled={isUploading || isLoadingMaterials}
                  aria-label="Add files"
                  title="Add files"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFilesSelected}
                style={{ display: 'none' }}
              />
            </div>

            <div className="modal-field">
              <label htmlFor="notes" className="modal-label">Teacher Notes (optional)</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add quick notes or a syllabus summary to guide the AI..."
                rows="5"
                className="modal-textarea"
              />
              <p className="modal-helper">
                We compress uploaded content to keep retrieval focused and token use under control.
              </p>
            </div>

            <div className="modal-field">
              <div className="modal-field-header">
                <label className="modal-label">Uploaded Materials</label>
                {isLoadingMaterials && <span className="modal-helper">Loading current materials…</span>}
              </div>

              {isLoadingMaterials ? (
                <div className="modal-empty-state">Loading saved materials for this class…</div>
              ) : classMaterials.length === 0 ? (
                <div className="modal-empty-state">No materials uploaded yet.</div>
              ) : (
                <div className="modal-material-list">
                  {classMaterials.map((material) => (
                    <div
                      key={material.id}
                      className={`modal-material-item ${material.status === 'error' ? 'is-error' : material.status === 'warning' ? 'is-warning' : ''}`}
                    >
                      <div className="modal-material-item__content">
                        <div className="modal-material-item__title-row">
                          <span className="modal-material-item__title">{material.name}</span>
                          {material.status && material.status !== 'ok' && (
                            <span className="modal-status-pill">
                              {material.status === 'error' ? 'Unreadable' : 'Warning'}
                            </span>
                          )}
                        </div>
                        <span className="modal-material-item__meta">{material.type || 'file'}</span>
                        {material.errorMessage && (
                          <span className="modal-material-item__error">{material.errorMessage}</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteMaterial(material.id)}
                        className="workspace-icon-button workspace-icon-button--danger"
                        disabled={isUploading}
                        aria-label={`Remove ${material.name}`}
                        title="Remove"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 19.673A2.25 2.25 0 0115.916 21H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .563c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setDeleteError('')
                  setPendingDeleteClass(selectedClass)
                }}
                className="workspace-icon-button workspace-icon-button--danger"
                disabled={isUploading || isLoadingMaterials || isDeletingClass}
                aria-label="Delete class"
                title="Delete class"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 19.673A2.25 2.25 0 0115.916 21H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .563c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
              <button
                type="button"
                onClick={closeUploadModal}
                className="btn-secondary"
                disabled={isUploading || isLoadingMaterials || isDeletingClass}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploading || isLoadingMaterials || isDeletingClass}
                className="btn-primary"
              >
                {isUploading ? 'Saving...' : 'Save Materials'}
              </button>
            </div>
          </form>
        </AppModal>
      )}

      {pendingDeleteClass && (
        <AppModal
          title="Delete Class"
          description={`Delete ${pendingDeleteClass.name} for everyone. This cannot be undone.`}
          size="small"
          onClose={() => {
            if (isDeletingClass) return
            setPendingDeleteClass(null)
            setDeleteError('')
          }}
          disableClose={isDeletingClass}
        >
          <div className="modal-form">
            {deleteError && (
              <div className="status-banner is-error">
                <strong>Unable to delete class</strong>
                <span>{deleteError}</span>
              </div>
            )}

            <p className="modal-helper">
              Students will lose access, uploaded materials will be removed with the class, and related class chat history will be cleared.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setPendingDeleteClass(null)
                  setDeleteError('')
                }}
                disabled={isDeletingClass}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-ghost-danger"
                onClick={handleDeleteClass}
                disabled={isDeletingClass}
              >
                {isDeletingClass ? 'Deleting...' : 'Delete Class'}
              </button>
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}

export default Teacher
