import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

export function useToast() {
  function show(message, type = 'info', title = '') {
    const id = ++nextId
    toasts.value.push({ id, message, type, title: title || defaultTitle(type) })
    setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 3200)
  }
  return { toasts, show }
}

function defaultTitle(type) {
  return { success: '操作成功', error: '操作失败', info: '操作提示' }[type] || '操作提示'
}
