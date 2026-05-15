import { useAuthStore } from '@/stores/auth'

export async function api(url, options = {}, requiresAuth = true) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (requiresAuth) {
    const auth = useAuthStore()
    if (auth.token) headers.Authorization = `Bearer ${auth.token}`
  }
  const response = await fetch(url, { ...options, headers })
  if (response.status === 204) return null
  const text = await response.text()
  const data = text ? safeParseJson(text) : null
  if (!response.ok) throw new Error(data?.message || '请求失败，请稍后再试。')
  return data
}

export async function downloadFile(url) {
  const auth = useAuthStore()
  const headers = {}
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`
  const response = await fetch(url, { headers })
  if (!response.ok) {
    const text = await response.text()
    const data = text ? safeParseJson(text) : null
    throw new Error(data?.message || '导出失败，请稍后再试。')
  }
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  const cd = response.headers.get('Content-Disposition') || ''
  const match = cd.match(/filename="([^"]+)"/i)
  link.download = match ? match[1] : `export-${Date.now()}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

function safeParseJson(text) {
  try { return JSON.parse(text) } catch { return null }
}
