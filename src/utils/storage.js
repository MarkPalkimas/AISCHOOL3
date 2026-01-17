// Storage utility functions for managing classes and students
//
// CROSS-DEVICE PERSISTENCE NOTE:
// This implementation uses localStorage which is browser-specific and does NOT sync across devices.
// All functions use Clerk user IDs (user.id) to associate data with user accounts, but the data
// is still stored locally in the browser's localStorage.
//
// For true cross-device persistence, this would need to be replaced with a backend database
// (e.g., Firebase, Supabase, PostgreSQL) that stores data server-side.

function normalizeCode(code) {
  return (code || '').toUpperCase().trim()
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

// Get all classes from storage
function getAllClasses() {
  const classes = localStorage.getItem('classai_classes')
  return classes ? JSON.parse(classes) : {}
}

// Save all classes to storage
function saveAllClasses(classes) {
  localStorage.setItem('classai_classes', JSON.stringify(classes))
}

// Get student enrollments from storage
function getAllEnrollments() {
  const enrollments = localStorage.getItem('classai_enrollments')
  return enrollments ? JSON.parse(enrollments) : {}
}

// Save student enrollments to storage
function saveAllEnrollments(enrollments) {
  localStorage.setItem('classai_enrollments', JSON.stringify(enrollments))
}

// Create a new class (teacher only)
export function createClass(teacherId, className, subject = '') {
  const classes = getAllClasses()

  //Ensure unique code (rare collision)
  let code = generateClassCode()
  while (classes[code]) code = generateClassCode()

  const newClass = {
    code,
    name: className,
    subject,
    teacherId,
    materials: '',
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
  return c || null
}

// Update class materials
export function updateClassMaterials(classCode, materials) {
  const classes = getAllClasses()
  const code = normalizeCode(classCode)

  if (classes[code]) {
    classes[code].materials = materials
    classes[code].updatedAt = new Date().toISOString()
    saveAllClasses(classes)
    return true
  }
  return false
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
  if (!classes[code] || !classes[code].materials) return false

  if (!enrollments[studentId]) enrollments[studentId] = []

  if (enrollments[studentId].some(c => normalizeCode(c) === code)) return false

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
  const code = normalizeCode(classCode)
  return studentEnrollments.some(c => normalizeCode(c) === code)
}
