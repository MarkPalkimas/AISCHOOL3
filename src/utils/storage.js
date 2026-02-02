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
  const code = generateClassCode()

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
  return classes[code] || null
}

// Update class materials
export function updateClassMaterials(classCode, materials) {
  const classes = getAllClasses()
  if (classes[classCode]) {
    classes[classCode].materials = materials
    classes[classCode].updatedAt = new Date().toISOString()
    saveAllClasses(classes)
    return true
  }
  return false
}

// Student joins a class
export function joinClass(studentId, classCode) {
  const classes = getAllClasses()
  const enrollments = getAllEnrollments()

  // Check if class exists and has materials
  if (!classes[classCode] || !classes[classCode].materials) {
    return false
  }

  // Initialize student's enrollments if needed
  if (!enrollments[studentId]) {
    enrollments[studentId] = []
  }

  // Check if already enrolled
  if (enrollments[studentId].includes(classCode)) {
    return false
  }

  // Add enrollment
  enrollments[studentId].push(classCode)
  saveAllEnrollments(enrollments)

  return true
}

// Get all classes a student is enrolled in
export function getStudentClasses(studentId) {
  const enrollments = getAllEnrollments()
  const classes = getAllClasses()

  const studentEnrollments = enrollments[studentId] || []

  return studentEnrollments
    .map(code => classes[code])
    .filter(c => c !== undefined)
}

// Check if a student is enrolled in a class
export function isStudentEnrolled(studentId, classCode) {
  const enrollments = getAllEnrollments()
  const studentEnrollments = enrollments[studentId] || []
  return studentEnrollments.includes(classCode)
}
