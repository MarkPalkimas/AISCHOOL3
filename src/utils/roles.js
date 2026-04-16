// Role management utilities

export const ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin'
}

export const normalizeRole = (value) => {
  const role = String(value || '').trim().toLowerCase()
  if (role === ROLES.STUDENT || role === ROLES.TEACHER || role === ROLES.ADMIN) {
    return role
  }
  return null
}

export const getUserRole = (user) => {
  if (!user) return null
  return (
    normalizeRole(user.publicMetadata?.role) ||
    normalizeRole(user.unsafeMetadata?.role) ||
    normalizeRole(user.role)
  )
}

export const hasRole = (user, role) => {
  const userRole = getUserRole(user)
  return userRole === role
}

export const isTeacher = (user) => {
  return hasRole(user, ROLES.TEACHER) || hasRole(user, ROLES.ADMIN)
}

export const isStudent = (user) => {
  return hasRole(user, ROLES.STUDENT)
}

export const isAdmin = (user) => {
  return hasRole(user, ROLES.ADMIN)
}

export const canAccessTeacherArea = (user) => {
  return isTeacher(user) || isAdmin(user)
}

export const canAccessStudentArea = (user) => {
  return isStudent(user) || isTeacher(user) || isAdmin(user)
}

export const canAccessAdminArea = (user) => {
  return isAdmin(user)
}
