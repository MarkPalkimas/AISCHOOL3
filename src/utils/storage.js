// Storage utility functions for managing classes and students
//
// CROSS-DEVICE PERSISTENCE NOTE:
// This implementation uses localStorage which is browser-specific and does NOT sync across devices.
// All functions use Clerk user IDs (user.id) to associate data with user accounts, but the data
// is still stored locally in the browser's localStorage.
//
// For true cross-device persistence, this would need to be replaced with a backend database
// (e.g., Firebase, Supabase, PostgreSQL) that stores data server-side.
//
// Current behavior:
// - Users must rejoin classes on each new device/browser
// - Teachers must recreate classes on each new device/browser
// - Data is tied to the Clerk account but stored per-browser

const STORAGE_KEYS = {
  classes: 'classai_classes',
  enrollments: 'classai_enrollments',
  materials: 'classai_materials', // Structured file metadata
  chunks: 'classai_chunks'       // Extracted text chunks for AI
}

//Hard caps to prevent token spam + localStorage bloat
const LIMITS = {
  MATERIALS_MAX_CHARS: 50000,
  CLASS_NAME_MAX: 80,
  SUBJECT_MAX: 80,
  DEFAULT_CAPACITY: 30,
  CHUNK_SIZE: 1000,
  CHUNK_OVERLAP: 150,
  MAX_FILE_SIZE_MB: 25
}

// Generate a random class code
function generateClassCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function normalizeCode(code) {
  return (code || '').toUpperCase().trim()
}

function cleanText(str, maxChars) {
  const s = (str || '').toString().replace(/\r/g, '').trim()
  if (!maxChars) return s
  if (s.length <= maxChars) return s
  return s.slice(0, maxChars)
}

// Get all classes from storage
function getAllClasses() {
  const classes = localStorage.getItem(STORAGE_KEYS.classes)
  return classes ? JSON.parse(classes) : {}
}

// Save all classes to storage
function saveAllClasses(classes) {
  localStorage.setItem(STORAGE_KEYS.classes, JSON.stringify(classes))
}

// Get student enrollments from storage
function getAllEnrollments() {
  const enrollments = localStorage.getItem(STORAGE_KEYS.enrollments)
  return enrollments ? JSON.parse(enrollments) : {}
}

// Save student enrollments to storage
function saveAllEnrollments(enrollments) {
  localStorage.setItem(STORAGE_KEYS.enrollments, JSON.stringify(enrollments))
}

function getAllClassMaterials() {
  const m = localStorage.getItem(STORAGE_KEYS.materials)
  return m ? JSON.parse(m) : {}
}

function saveAllClassMaterials(materials) {
  localStorage.setItem(STORAGE_KEYS.materials, JSON.stringify(materials))
}

function getAllChunks() {
  const c = localStorage.getItem(STORAGE_KEYS.chunks)
  return c ? JSON.parse(c) : {}
}

function saveAllChunks(chunks) {
  localStorage.setItem(STORAGE_KEYS.chunks, JSON.stringify(chunks))
}

// Create a new class (teacher only)
export function createClass(teacherId, className, subject = '') {
  const classes = getAllClasses()
  const code = generateClassCode()

  const newClass = {
    code,
    name: cleanText(className, LIMITS.CLASS_NAME_MAX),
    subject: cleanText(subject, LIMITS.SUBJECT_MAX),
    teacherId,
    materials: '',
    capacity: LIMITS.DEFAULT_CAPACITY,
    createdAt: new Date().toISOString()
  }

  classes[code] = newClass
  saveAllClasses(classes)

  return newClass
}

// Get all classes for a specific teacher
export function getTeacherClasses(teacherId) {
  const classes = getAllClasses()
  return Object.values(classes).filter(c => c.teacherId === teacherId)
}

// Get a specific class by code
export function getClassByCode(code) {
  const classes = getAllClasses()
  const c = classes[normalizeCode(code)]
  if (!c) return null

  // Migration: If class has old 'materials' string, move it to Material/Chunk model
  if (typeof c.materials === 'string' && c.materials.trim().length > 0) {
    const legacyText = c.materials
    c.materials = [] // Clear old field (will be used for IDs list in future or just removed)
    saveAllClasses(classes)

    // Create a legacy material record
    createMaterial(c.code, 'teacher', {
      name: 'Legacy Class Notes',
      type: 'text/plain',
      size: legacyText.length,
      content: legacyText
    })
  }

  return c
}

// Update class materials
export function updateClassMaterials(classCode, materials) {
  const classes = getAllClasses()
  const code = normalizeCode(classCode)

  if (classes[code]) {
    const cleaned = cleanText(materials, LIMITS.MATERIALS_MAX_CHARS)
    classes[code].materials = cleaned
    classes[code].updatedAt = new Date().toISOString()
    saveAllClasses(classes)
    return true
  }
  return false
}

// Update class capacity
export function updateClassCapacity(classCode, capacity) {
  const classes = getAllClasses()
  const code = normalizeCode(classCode)

  if (classes[code]) {
    classes[code].capacity = parseInt(capacity) || LIMITS.DEFAULT_CAPACITY
    classes[code].updatedAt = new Date().toISOString()
    saveAllClasses(classes)
    return true
  }
  return false
}

// Get enrollment count for a class
export function getEnrolledCount(classCode) {
  const enrollments = getAllEnrollments()
  const code = normalizeCode(classCode)
  let count = 0

  Object.values(enrollments).forEach(studentEnrollments => {
    if (studentEnrollments.map(normalizeCode).includes(code)) {
      count++
    }
  })

  return count
}

// Material Management
export function createMaterial(classCode, teacherId, file) {
  const materials = getAllClassMaterials()
  const id = 'mat_' + Math.random().toString(36).substr(2, 9)

  const newMaterial = {
    id,
    classCode: normalizeCode(classCode),
    teacherId,
    name: file.name,
    type: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    status: 'ready', // ready, error, processing
    textLength: (file.content || '').length
  }

  materials[id] = newMaterial
  saveAllClassMaterials(materials)

  if (file.content) {
    processTextToChunks(classCode, id, file.name, file.content)
  }

  return newMaterial
}

export function getClassMaterials(classCode) {
  const materials = getAllClassMaterials()
  const normalized = normalizeCode(classCode)
  return Object.values(materials)
    .filter(m => m.classCode === normalized)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
}

export function deleteMaterial(materialId) {
  const materials = getAllClassMaterials()
  const chunks = getAllChunks()

  delete materials[materialId]
  saveAllClassMaterials(materials)

  // Clean up chunks
  const newChunks = {}
  Object.keys(chunks).forEach(cid => {
    if (chunks[cid].materialId !== materialId) {
      newChunks[cid] = chunks[cid]
    }
  })
  saveAllChunks(newChunks)

  return true
}

// Chunking Logic
function processTextToChunks(classCode, materialId, materialName, text) {
  const chunks = getAllChunks()
  const normalizedCode = normalizeCode(classCode)

  // Standard chunking with overlap
  let start = 0
  let index = 0
  while (start < text.length) {
    const end = Math.min(start + LIMITS.CHUNK_SIZE, text.length)
    let chunkText = text.slice(start, end)

    // If not at end, try to find last newline or space to avoid cutting words
    if (end < text.length) {
      const lastSpace = chunkText.lastIndexOf(' ')
      if (lastSpace > LIMITS.CHUNK_SIZE * 0.8) {
        chunkText = chunkText.slice(0, lastSpace)
      }
    }

    const chunkId = `${materialId}_${index}`
    chunks[chunkId] = {
      id: chunkId,
      materialId,
      materialName,
      classCode: normalizedCode,
      text: chunkText,
      index,
      createdAt: new Date().toISOString()
    }

    start += chunkText.length - LIMITS.CHUNK_OVERLAP
    if (start < 0) start = 0
    if (chunkText.length <= LIMITS.CHUNK_OVERLAP) break // Safety
    index++
  }

  saveAllChunks(chunks)
}

export function getRelevantChunks(query, classCode) {
  const allChunks = getAllChunks()
  const normalizedCode = normalizeCode(classCode)
  const q = (query || '').toLowerCase()

  const classChunks = Object.values(allChunks).filter(c => c.classCode === normalizedCode)

  // Simple keyword scoring for relevancy
  const queryWords = q.split(/\s+/).filter(w => w.length > 3)

  if (queryWords.length === 0) return classChunks.slice(0, 8)

  const scored = classChunks.map(chunk => {
    let score = 0
    const text = chunk.text.toLowerCase()
    queryWords.forEach(word => {
      if (text.includes(word)) score++
    })
    return { ...chunk, score }
  }).filter(c => c.score > 0)

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 10)
}

// Delete a class (teacher only) AND remove it from all student enrollments
export function deleteClass(teacherId, classCode) {
  const code = normalizeCode(classCode)
  const classes = getAllClasses()

  const target = classes[code]
  if (!target) return false
  if (target.teacherId !== teacherId) return false

  delete classes[code]
  saveAllClasses(classes)

  const enrollments = getAllEnrollments()
  let changed = false

  Object.keys(enrollments).forEach((studentId) => {
    const list = enrollments[studentId] || []
    const filtered = list.filter((c) => normalizeCode(c) !== code)
    if (filtered.length !== list.length) {
      enrollments[studentId] = filtered
      changed = true
    }
  })

  if (changed) saveAllEnrollments(enrollments)

  return true
}

// Student joins a class
export function joinClass(studentId, classCode) {
  const classes = getAllClasses()
  const enrollments = getAllEnrollments()
  const code = normalizeCode(classCode)

  // Check if class exists and has materials
  if (!classes[code] || !(classes[code].materials || '').trim()) {
    return false
  }

  if (!enrollments[studentId]) {
    enrollments[studentId] = []
  }

  if (enrollments[studentId].map(normalizeCode).includes(code)) {
    return false
  }

  enrollments[studentId].push(code)
  saveAllEnrollments(enrollments)

  return true
}

// Get all classes a student is enrolled in
export function getStudentClasses(studentId) {
  const enrollments = getAllEnrollments()
  const classes = getAllClasses()

  const studentEnrollments = enrollments[studentId] || []

  return studentEnrollments
    .map(code => classes[normalizeCode(code)])
    .filter(c => c !== undefined)
}

// Check if a student is enrolled in a class
export function isStudentEnrolled(studentId, classCode) {
  const enrollments = getAllEnrollments()
  const studentEnrollments = enrollments[studentId] || []
  return studentEnrollments.map(normalizeCode).includes(normalizeCode(classCode))
}
