import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'autograding-auth'

export const useAuthStore = defineStore('auth', () => {
  const auth = ref(loadStoredAuth())
  const profile = ref(null)

  const token = computed(() => auth.value?.token ?? null)
  const isLoggedIn = computed(() => !!token.value && !!profile.value)
  const role = computed(() => profile.value?.role ?? null)

  function acceptAuth(data) {
    auth.value = data
    profile.value = { id: data.id, username: data.username, role: data.role }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function logout() {
    auth.value = null
    profile.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  function setProfile(p) {
    profile.value = p
  }

  return { auth, profile, token, isLoggedIn, role, acceptAuth, logout, setProfile }
})

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data?.expiresAt) {
      const exp = new Date(data.expiresAt)
      if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }
    }
    return data
  } catch {
    return null
  }
}
