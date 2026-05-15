export function formatDateTime(value) {
  if (!value) return '未提供'
  const date = new Date(value)
  if (isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(date)
}

export function translateStatus(status) {
  return {
    DRAFT: '草稿', PUBLISHED: '已发布', CLOSED: '已关闭',
    ACCEPTED: '通过', PARTIAL_ACCEPTED: '部分通过', FAILED: '未通过',
    COMPILE_ERROR: '编译错误', RUNTIME_ERROR: '运行错误',
    TIME_LIMIT_EXCEEDED: '超时', PENDING: '待评测'
  }[status] || status
}

export function translateRole(role) {
  return { ADMIN: '管理员', TEACHER: '教师', STUDENT: '学生' }[role] || role
}

export function statusClass(status) {
  return `status-${String(status || '').toLowerCase()}`
}

export function generateSemesters() {
  const list = []
  for (let y = 2026; y >= 2022; y--) {
    list.push(`${y}~${y + 1}第二学期`)
    list.push(`${y}~${y + 1}第一学期`)
  }
  return list
}

export function normalizeDateTime(value) {
  return value ? `${value}:00` : value
}
