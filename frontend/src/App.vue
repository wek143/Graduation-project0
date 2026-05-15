<script setup>
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { onMounted } from 'vue'
import { api } from '@/api'
import { roleHome } from '@/router'
import ToastViewport from '@/components/common/ToastViewport.vue'

const auth = useAuthStore()
const router = useRouter()

onMounted(async () => {
  if (!auth.token) return
  try {
    const profile = await api('/api/auth/me')
    auth.setProfile(profile)
    router.replace(roleHome(profile.role))
  } catch {
    auth.logout()
    router.replace('/login')
  }
})
</script>

<template>
  <RouterView />
  <ToastViewport />
</template>
