// Local storage data helpers for ClassAI (client-side)

const LIMITS = {
  CLASS_NAME_MAX: 80,
  SUBJECT_MAX: 80,
  MAX_MATERIALS_CHARS_SENT: 6500,
  MAX_LOCAL_CHUNKS: 10
}

const STORAGE_KEYS = {
  classes: 'classai_classes_v1',
  enrollments: 'classai_enrollments_v1'
}

const memoryStore = {
  classes: [],
  enrollments: []
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
    if (key === STORAGE_KEYS.classes) memoryStore.classes = value
    if (key === STORAGE_KEYS.enrollments) memoryStore.enrollments = value
    return
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage failures (quota, disabled, etc.)
  }
}

function getAllClasses() {
  return getLocalJSON(STORAGE_KEYS.classes, memoryStore.classes)
}

function setAllClasses(next) {
  setLocalJSON(STORAGE_KEYS.classes, next)
}

function getAllEnrollments() {
  return getLocalJSON(STORAGE_KEYS.enrollments, memoryStore.enrollments)
}

function setAllEnrollments(next) {
  setLocalJSON(STORAGE_KEYS.enrollments, next)
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase()
}

function cleanText(value, maxLen) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!maxLen) return text
  return text.length > maxLen ? text.slice(0, maxLen) : text
}

function generateClassCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

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

// Create a new class (teacher only)
export function createClass(teacherId, className, subject = '') {
  const classes = getAllClasses()

  let code = ''
  for (let i = 0; i < 10; i += 1) {
    const candidate = generateClassCode()
    if (!classes.some(c => c.code === candidate)) {
      code = candidate
      break
    }
  }

  if (!code) return null

  const newClass = {
    code,
    name: cleanText(className, LIMITS.CLASS_NAME_MAX),
    subject: cleanText(subject, LIMITS.SUBJECT_MAX),
    teacherId,
    materials: '',
    createdAt: new Date().toISOString()
  }

  classes.push(newClass)
  setAllClasses(classes)
  return newClass
}

// Get all classes for the logged-in teacher
export function getTeacherClasses(teacherId) {
  return getAllClasses().filter(c => c.teacherId === teacherId)
}

// Get a specific class by code
export function getClassByCode(code) {
  const normalized = normalizeCode(code)
  return getAllClasses().find(c => c.code === normalized) || null
}

// Student joins a class
export function joinClass(studentId, classCode) {
  const code = normalizeCode(classCode)
  const enrollments = getAllEnrollments()
  const exists = enrollments.some(e => e.studentId === studentId && e.classCode === code)
  if (exists) return false
  enrollments.push({ studentId, classCode: code })
  setAllEnrollments(enrollments)
  return true
}

// Get all classes the logged-in student is enrolled in
export function getStudentClasses(studentId) {
  const enrollments = getAllEnrollments().filter(e => e.studentId === studentId)
  if (enrollments.length === 0) return []
  const classes = getAllClasses()
  return enrollments.map(e => classes.find(c => c.code === e.classCode)).filter(Boolean)
}

// Check if a student is enrolled in a class
export function isStudentEnrolled(studentId, classCode) {
  const code = normalizeCode(classCode)
  return getAllEnrollments().some(e => e.studentId === studentId && e.classCode === code)
}

// Update class materials (teacher only)
export function updateClassMaterials(classCode, materials) {
  const code = normalizeCode(classCode)
  const classes = getAllClasses()
  const idx = classes.findIndex(c => c.code === code)
  if (idx === -1) return false
  classes[idx] = { ...classes[idx], materials: String(materials || '').trim() }
  setAllClasses(classes)
  return true
}

// Material search helpers for AI grounding
export function getRelevantChunks(userMessage, classCode) {
  const classItem = getClassByCode(classCode)
  if (!classItem || !classItem.materials) return []

  const chunks = splitIntoChunks(classItem.materials)
    .map(text => ({ text, materialName: classItem.name || 'Class Materials' }))

  const scored = scoreChunks(userMessage, chunks)
  if (!scored.length) return []

  const limited = []
  let totalChars = 0

  for (const item of scored) {
    if (limited.length >= LIMITS.MAX_LOCAL_CHUNKS) break
    const text = String(item.text || '').trim()
    if (!text) continue
    if (totalChars + text.length > LIMITS.MAX_MATERIALS_CHARS_SENT) break
    limited.push({ text, materialName: item.materialName })
    totalChars += text.length
  }

  return limited
}

export function getPdfWarningsForClass(classCode) {
  const classItem = getClassByCode(classCode)
  if (!classItem || !classItem.materials) return []
  const content = String(classItem.materials)
  if (content.includes('[PDF EXTRACTION WARNING:') || content.includes('[PDF EXTRACTION ERROR:')) {
    return [{
      materialName: classItem.name || 'Class Materials',
      text: content.slice(0, 2000)
    }]
  }
  return []
}
