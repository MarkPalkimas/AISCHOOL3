// Shared storage helpers for ClassAI (server + local cache)

const LIMITS = {
  CLASS_NAME_MAX: 80,
  SUBJECT_MAX: 80,
  MAX_MATERIALS_CHARS_SENT: 6500,
  MAX_LOCAL_CHUNKS: 10,
  MAX_CHUNK_CHARS: 800
}

const STORAGE_KEYS = {
  materials: 'classai_materials_v2'
}

const memoryStore = {
  materials: []
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function getLocalJSON(key, fallback) {
  if (!canUseStorage()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function setLocalJSON(key, value) {
  if (!canUseStorage()) {
    if (key === STORAGE_KEYS.materials) memoryStore.materials = value
    return
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage failures (quota, disabled, etc.)
  }
}

function getAllMaterials() {
  const data = getLocalJSON(STORAGE_KEYS.materials, memoryStore.materials)
  return Array.isArray(data) ? data : []
}

function setAllMaterials(next) {
  setLocalJSON(STORAGE_KEYS.materials, next)
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase()
}

function cleanText(value, maxLen) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!maxLen) return text
  return text.length > maxLen ? text.slice(0, maxLen) : text
}

async function authedFetch(token, url, options = {}) {
  const headers = {
    ...(options.headers || {}),
    'Content-Type': 'application/json'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(url, { ...options, headers })
}

// ----- SERVER-SIDE CLASS OPERATIONS -----

export async function createClass(token, className, subject = '') {
  const res = await authedFetch(token, '/api/classes/create', {
    method: 'POST',
    body: JSON.stringify({
      code: generateClassCode(),
      className: cleanText(className, LIMITS.CLASS_NAME_MAX),
      subject: cleanText(subject, LIMITS.SUBJECT_MAX)
    })
  })
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}))
    const errText = await res.text().catch(() => '')
    const msg = errJson?.error || errText || 'Failed to create class'
    throw new Error(msg)
  }
  return res.json()
}

export async function getTeacherClasses(token) {
  const res = await authedFetch(token, '/api/classes/teacher', { method: 'GET' })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(errText || 'Failed to load teacher classes')
  }
  return res.json()
}

export async function getClassByCode(token, code) {
  const normalized = normalizeCode(code)
  const res = await authedFetch(token, `/api/classes/by-code?code=${encodeURIComponent(normalized)}`, { method: 'GET' })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(errText || 'Failed to load class')
  }
  return res.json()
}

export async function joinClass(token, classCode) {
  const code = normalizeCode(classCode)
  const res = await authedFetch(token, '/api/classes/join', {
    method: 'POST',
    body: JSON.stringify({ code })
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(errText || 'Failed to join class')
  }
  return true
}

export async function getStudentClasses(token) {
  const res = await authedFetch(token, '/api/classes/student', { method: 'GET' })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(errText || 'Failed to load student classes')
  }
  return res.json()
}

export async function isStudentEnrolled(token, classCode) {
  const classes = await getStudentClasses(token)
  return classes.some(c => c.code === normalizeCode(classCode))
}

export async function getEnrolledCount(classCode) {
  const code = normalizeCode(classCode)
  const res = await fetch(`/api/classes/enrollment?code=${code}`)
  if (!res.ok) return 0
  const data = await res.json()
  return data.count || 0
}

// ----- MATERIALS: LOCAL CACHE + SERVER SYNC -----

export function createMaterial(classCode, userId, material) {
  const code = normalizeCode(classCode)
  const all = getAllMaterials()
  const item = {
    id: material?.id || `mat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    classCode: code,
    userId: userId || null,
    name: material?.name || 'Untitled',
    type: material?.type || 'application/octet-stream',
    size: material?.size || 0,
    content: material?.content || '',
    summary: material?.summary || '',
    pageMetadata: material?.pageMetadata || null,
    createdAt: new Date().toISOString()
  }
  all.push(item)
  setAllMaterials(all)
  return item
}

export function getClassMaterials(classCode) {
  const code = normalizeCode(classCode)
  return getAllMaterials().filter(m => normalizeCode(m.classCode) === code)
}

export function deleteMaterial(materialId) {
  const all = getAllMaterials()
  const next = all.filter(m => m.id !== materialId)
  setAllMaterials(next)
}

export function upsertClassNotes(classCode, text) {
  const code = normalizeCode(classCode)
  const all = getAllMaterials()
  const id = `notes_${code}`
  const idx = all.findIndex(m => m.id === id)
  const item = {
    id,
    classCode: code,
    userId: null,
    name: 'Teacher Notes',
    type: 'text/notes',
    size: text.length,
    content: text,
    summary: text.slice(0, 1200),
    pageMetadata: null,
    createdAt: new Date().toISOString()
  }
  if (idx >= 0) all[idx] = item
  else all.push(item)
  setAllMaterials(all)
  return true
}

export async function saveClassMaterials(token, classCode) {
  const code = normalizeCode(classCode)
  const materials = getClassMaterials(code)
  const res = await authedFetch(token, '/api/classes/materials', {
    method: 'POST',
    body: JSON.stringify({ code, materials })
  })
  return res.ok
}

export async function syncClassMaterials(token, classCode) {
  const code = normalizeCode(classCode)
  const res = await authedFetch(token, `/api/classes/materials?code=${encodeURIComponent(code)}`, { method: 'GET' })
  if (!res.ok) return []
  const data = await res.json()
  const materials = Array.isArray(data?.materials) ? data.materials : []
  const all = getAllMaterials().filter(m => normalizeCode(m.classCode) !== code)
  setAllMaterials([...all, ...materials])
  return materials
}

export function updateClassMaterials(classCode, materials) {
  const text = String(materials || '').trim()
  if (!text) return false
  return upsertClassNotes(classCode, text)
}

// ----- MATERIAL SEARCH FOR AI -----

function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getQueryKeywords(userMessage) {
  const stop = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'what', 'why', 'how', 'who',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
    'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'we', 'our', 'they', 'their',
    'to', 'of', 'in', 'on', 'at', 'for', 'with', 'about', 'as', 'by', 'from', 'into', 'over', 'under',
    'this', 'that', 'these', 'those', 'it', 'its', 'can', 'could', 'should', 'would', 'will', 'just',
    'please', 'give', 'answer', 'solve', 'help', 'explain'
  ])

  const words = normalizeText(userMessage).split(' ')
  const keywords = []
  for (const w of words) {
    if (!w) continue
    if (w.length < 3) continue
    if (stop.has(w)) continue
    keywords.push(w)
  }

  const seen = new Set()
  const uniq = []
  for (const k of keywords) {
    if (seen.has(k)) continue
    seen.add(k)
    uniq.push(k)
  }
  return uniq.slice(0, 12)
}

function splitIntoChunks(text) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const paras = raw.split(/\n\s*\n+/g).map(s => s.trim()).filter(Boolean)
  if (paras.length >= 4) return paras
  return raw.split('\n').map(s => s.trim()).filter(Boolean)
}

function scoreChunks(userMessage, chunks) {
  const keywords = getQueryKeywords(userMessage)
  if (!keywords.length || !chunks.length) return []

  const scored = chunks.map((chunk) => {
    const n = normalizeText(chunk.text || chunk)
    let hits = 0
    for (const k of keywords) {
      if (n.includes(k)) hits += 1
    }
    const bonus =
      /definition|example|formula|theorem|rule|step|procedure|concept|overview|lecture|chapter/i.test(chunk.text || chunk)
        ? 0.5
        : 0
    return { ...chunk, hits, score: hits + bonus }
  }).filter(x => x.hits > 0)

  scored.sort((a, b) => b.score - a.score)
  return scored
}

export function getRelevantChunks(userMessage, classCode) {
  const materials = getClassMaterials(classCode)
  if (!materials.length) return []

  const chunks = []

  for (const mat of materials) {
    if (mat.summary) {
      chunks.push({
        text: `Summary: ${mat.summary}`,
        materialName: mat.name,
        pageNumber: mat.pageNumber
      })
    }
    if (Array.isArray(mat.pageMetadata) && mat.pageMetadata.length > 0) {
      for (const page of mat.pageMetadata) {
        if (!page?.text) continue
        chunks.push({
          text: page.text,
          materialName: mat.name,
          pageNumber: page.pageNumber
        })
      }
      continue
    }

    const parts = splitIntoChunks(mat.content || '')
    for (const p of parts) {
      chunks.push({ text: p, materialName: mat.name })
    }
  }

  const scored = scoreChunks(userMessage, chunks)
  const fallback = chunks.filter(c => String(c.text || '').trim().length > 0)
  const ranked = scored.length ? scored : fallback

  const limited = []
  let totalChars = 0

  for (const item of ranked) {
    if (limited.length >= LIMITS.MAX_LOCAL_CHUNKS) break
    const raw = String(item.text || '').trim()
    if (!raw) continue
    const text = raw.length > LIMITS.MAX_CHUNK_CHARS ? raw.slice(0, LIMITS.MAX_CHUNK_CHARS) + '…' : raw
    if (totalChars + text.length > LIMITS.MAX_MATERIALS_CHARS_SENT) break
    limited.push({ text, materialName: item.materialName, pageNumber: item.pageNumber })
    totalChars += text.length
  }

  return limited
}

export function getPdfWarningsForClass(classCode) {
  const materials = getClassMaterials(classCode)
  if (!materials.length) return []
  const warnings = []
  for (const mat of materials) {
    const content = String(mat.content || '')
    if (content.includes('[PDF EXTRACTION WARNING:') || content.includes('[PDF EXTRACTION ERROR:')) {
      warnings.push({
        materialName: mat.name,
        text: content.slice(0, 2000)
      })
    }
  }
  return warnings
}

function generateClassCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}
