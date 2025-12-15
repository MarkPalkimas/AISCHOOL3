// src/pages/Teacher.jsx
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, useUser, useClerk } from '@clerk/clerk-react'
import { getTeacherClasses, createClass, updateClassMaterials } from '../utils/storage'
import UserMenu from '../components/UserMenu'

const BASE = import.meta.env.BASE_URL
const abs = (path = '') => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/')
  const rel = String(path).replace(/^\/+/, '')
  return `${window.location.origin}${base}${rel}`
}

export default function Teacher() {
  const { user, isLoaded } = useUser()
  const { redirectToSignIn } = useClerk()

  const [classes, setClasses] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const [selected, setSelected] = useState(null)
  const [newName, setNewName] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [materials, setMaterials] = useState('')
  const [uploadedNames, setUploadedNames] = useState([])
  const [editName, setEditName] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [busy, setBusy] = useState(false)

  // Auto-assign role if missing
  useEffect(() => {
    if (isLoaded && user && !user.publicMetadata.role) {
      user.update({ publicMetadata: { role: 'teacher' } })
        .then(() => window.location.reload())
        .catch(err => console.error('Failed to set role', err))
    }
  }, [isLoaded, user])

  useEffect(() => {
    if (!isLoaded || !user) return
    setClasses(getTeacherClasses(user.id))
  }, [isLoaded, user])

  const create = async (e) => {
    e.preventDefault()
    if (!newName.trim() || !user) return

    setBusy(true)
    await new Promise(r => setTimeout(r, 200))

    const cls = createClass(user.id, newName.trim(), newSubject.trim())
    setClasses([cls, ...getTeacherClasses(user.id)])
    setNewName('')
    setNewSubject('')
    setShowCreate(false)
    setBusy(false)
  }

  const startUpload = (cls) => {
    setSelected(cls)
    setMaterials(cls.materials || '')
    setUploadedNames([])
    setShowUpload(true)
  }

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        setMaterials(prev => {
          const prefix = prev ? `${prev}\n\n` : ''
          return `${prefix}--- File: ${file.name} ---\n\n${text}`
        })
        setUploadedNames(prev => [...prev, file.name])
      }
      reader.readAsText(file)
    })

    if (event.target) event.target.value = ''
  }

  const saveMaterials = async (e) => {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    await new Promise(r => setTimeout(r, 200))

    updateClassMaterials(selected.code, materials)
    if (user) setClasses(getTeacherClasses(user.id))

    setMaterials('')
    setSelected(null)
    setUploadedNames([])
    setShowUpload(false)
    setBusy(false)
  }

  const startEdit = (cls) => {
    setSelected(cls)
    setEditName(cls.name || '')
    setEditSubject(cls.subject || '')
    setShowEdit(true)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!selected || !user) return

    const name = editName.trim()
    const subject = editSubject.trim()
    if (!name) return

    setBusy(true)
    await new Promise(r => setTimeout(r, 200))

    try {
      const raw = localStorage.getItem('classai_classes')
      const classesObj = raw ? JSON.parse(raw) : {}
      const cls = classesObj[selected.code]
      if (cls) {
        cls.name = name
        cls.subject = subject
        cls.updatedAt = new Date().toISOString()
        localStorage.setItem('classai_classes', JSON.stringify(classesObj))
      }
      setClasses(getTeacherClasses(user.id))
    } catch (err) {
      console.error('Failed to update class details', err)
    }

    setShowEdit(false)
    setSelected(null)
    setBusy(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      <nav style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '12px 0' }}>
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <img src={`${BASE}Logo.jpg`} alt="StudyGuideAI Logo" style={{ width: 32, height: 32 }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>StudyGuideAI</span>
          </Link>
          <SignedIn>
            <UserMenu />
          </SignedIn>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <SignedOut>
          <div className="feature-card" style={{ textAlign: 'center', padding: 48 }}>
            <h1 className="hero-title">Teacher Dashboard</h1>
            <p className="hero-subtitle">Sign in to manage classes.</p>
            <button
              className="btn-primary"
              style={{ width: '100%', maxWidth: 200, marginTop: 24 }}
              onClick={() =>
                redirectToSignIn({
                  redirectUrl: abs('teacher'),
                  signUpUrl: abs('teacher'),
                })
              }
            >
              Sign In
            </button>
          </div>
        </SignedOut>

        <SignedIn>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Your Classes</h2>
            <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Create Class</button>
          </div>

          {classes.length === 0 ? (
            <div className="feature-card" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ marginBottom: 16, fontSize: 48 }}>📚</div>
              <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>No classes yet</h3>
              <p style={{ color: '#6B7280', marginBottom: 24 }}>Create your first class to get started.</p>
              <button className="btn-primary" onClick={() => setShowCreate(true)}>
                Create Your First Class
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: 24,
              }}
            >
              {classes.map(c => (
                <div key={c.code} className="feature-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 16 }}>
                    <h4 style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{c.name}</h4>
                    {c.subject && <p style={{ color: '#6B7280', fontSize: 14 }}>{c.subject}</p>}
                  </div>

                  <div style={{ background: '#F3F4F6', padding: '8px 12px', borderRadius: 8, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>CLASS CODE</span>
                    <code style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{c.code}</code>
                  </div>

                  <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button className="btn-secondary" onClick={() => startUpload(c)}>
                      Materials
                    </button>
                    <button className="btn-secondary" onClick={() => startEdit(c)}>
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SignedIn>
      </div>

      {/* Modals */}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Create Class</h3>
            <form onSubmit={create} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Class Name</label>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. AP Physics 1" autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Subject</label>
                <input className="input" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="e.g. Science" />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn-primary" style={{ flex: 1 }} disabled={busy}>{busy ? 'Creating…' : 'Create Class'}</button>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="modal-backdrop" onClick={() => setShowUpload(false)}>
          <div className="modal-card" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>Class Materials</h3>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: '#9CA3AF' }}>&times;</button>
            </div>

            <p style={{ color: '#6B7280', marginBottom: 20 }}>
              Upload text files (notes, syllabus, etc.) or paste content directly. The AI will use this to answer student questions.
            </p>

            <form onSubmit={saveMaterials} style={{ display: 'grid', gap: 16 }}>
              <div style={{ border: '2px dashed #E5E7EB', borderRadius: 12, padding: 24, textAlign: 'center', background: '#F9FAFB' }}>
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 40, height: 40, background: '#DBEAFE', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                    <svg style={{ width: 24, height: 24 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <span style={{ color: '#2563EB', fontWeight: 600 }}>Click to upload files</span>
                  <span style={{ fontSize: 12, color: '#6B7280' }}>.txt, .md, .csv supported</span>
                </label>
              </div>

              {uploadedNames.length > 0 && (
                <div style={{ background: '#ECFDF5', padding: '12px', borderRadius: 8, border: '1px solid #A7F3D0' }}>
                  <p style={{ fontSize: 14, color: '#047857', fontWeight: 500 }}>Files ready to add:</p>
                  <ul style={{ margin: '4px 0 0 20px', fontSize: 13, color: '#065F46' }}>
                    {uploadedNames.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Edit / Paste Content</label>
                <textarea
                  className="input"
                  rows={12}
                  value={materials}
                  onChange={e => setMaterials(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.5 }}
                  placeholder="Paste text content here..."
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn-primary" style={{ flex: 1 }} disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowUpload(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="modal-backdrop" onClick={() => setShowEdit(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Edit Class</h3>
            <form onSubmit={saveEdit} style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Class Name</label>
                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Subject</label>
                <input className="input" value={editSubject} onChange={e => setEditSubject(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn-primary" style={{ flex: 1 }} disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowEdit(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
