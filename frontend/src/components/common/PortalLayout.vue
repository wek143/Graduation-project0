<script setup>
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { useToast } from '@/stores/toast'
import { api } from '@/api'

const props = defineProps({
  sidebarTitle: String,
  navItems: Array,
  username: String,
  roleLabel: String
})
const emit = defineEmits(['logout', 'refresh'])

const auth = useAuthStore()
const router = useRouter()
const { show: toast } = useToast()

async function onLogout() {
  try { await api('/api/auth/logout', { method: 'POST' }) } catch {}
  auth.logout()
  toast('已退出登录。', 'success', '退出成功')
  router.replace('/login')
}
</script>

<template>
  <div class="page-shell">
    <header class="topbar">
      <a class="brand" href="#">
        <span class="brand-mark">AG</span>
        <span class="brand-copy"><strong>XX大学编码作业自动批改平台</strong></span>
      </a>
      <div class="topbar-actions">
        <div class="session-pill">
          <div class="session-pill-avatar">
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <span>{{ username }}</span>
          <small>{{ roleLabel }}</small>
        </div>
        <button class="btn btn-secondary" @click="$emit('refresh')">刷新数据</button>
        <button class="btn btn-ghost" @click="onLogout">退出登录</button>
      </div>
    </header>
    <main class="view-stack">
      <section class="view-section" style="display:flex;flex:1">
        <div class="portal-shell">
          <aside class="portal-sidebar">
            <div class="portal-sidebar-title">{{ sidebarTitle }}</div>
            <button
              v-for="item in navItems" :key="item.key"
              type="button"
              :class="['portal-nav-item', { 'is-active': item.active }]"
              @click="$emit('nav', item.key)"
            >
              <svg v-if="item.icon" v-html="item.icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>
              {{ item.label }}
            </button>
          </aside>
          <div class="portal-main">
            <slot />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
