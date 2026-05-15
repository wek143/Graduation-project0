<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import { api } from '@/api'
import { roleHome } from '@/router'

const router = useRouter()
const auth = useAuthStore()
const { show: toast } = useToast()

const tab = ref('login')
const loginUsername = ref('')
const loginPassword = ref('')
const showPassword = ref(false)
const loginLoading = ref(false)
const loginMsg = ref({ text: '点击下方演示账号可快速填入。', type: '' })

const regFullName = ref('')
const regClassName = ref('')
const regUsername = ref('')
const regPassword = ref('')
const regRole = ref('STUDENT')
const regLoading = ref(false)

const DEMO = {
  admin: { username: 'admin1', password: '123456' },
  teacher: { username: 'teacher1', password: '123456' },
  student: { username: 'student1', password: '123456' }
}

function useDemoAccount(role) {
  tab.value = 'login'
  loginUsername.value = DEMO[role].username
  loginPassword.value = DEMO[role].password
  const label = { admin: '管理员', teacher: '教师', student: '学生' }[role]
  loginMsg.value = { text: `已填入${label}演示账号，点击登录即可进入。`, type: 'success' }
}

async function onLogin() {
  loginLoading.value = true
  loginMsg.value = { text: '正在登录，请稍候...', type: '' }
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: loginUsername.value, password: loginPassword.value })
    }, false)
    auth.acceptAuth(data)
    const profile = await api('/api/auth/me')
    auth.setProfile(profile)
    toast('登录成功，已进入工作台。', 'success', '登录成功')
    router.replace(roleHome(profile.role))
  } catch (e) {
    loginMsg.value = { text: e.message, type: 'error' }
    toast(e.message, 'error', '登录失败')
  } finally {
    loginLoading.value = false
  }
}

async function onRegister() {
  regLoading.value = true
  loginMsg.value = { text: '正在注册，请稍候...', type: '' }
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: regUsername.value, password: regPassword.value,
        role: regRole.value, fullName: regFullName.value, className: regClassName.value
      })
    }, false)
    auth.acceptAuth(data)
    const profile = await api('/api/auth/me')
    auth.setProfile(profile)
    toast('注册成功，已自动登录并进入工作台。', 'success', '注册成功')
    router.replace(roleHome(profile.role))
  } catch (e) {
    loginMsg.value = { text: e.message, type: 'error' }
    toast(e.message, 'error', '注册失败')
  } finally {
    regLoading.value = false
  }
}
</script>

<template>
  <div class="page-shell">
    <header class="topbar">
      <a class="brand" href="#/login">
        <span class="brand-mark">AG</span>
        <span class="brand-copy"><strong>XX大学编码作业自动批改平台</strong></span>
      </a>
      <div class="topbar-actions topbar-actions-public">
        <button class="btn btn-ghost" @click="tab = 'login'">登录</button>
        <button class="btn btn-primary" @click="tab = 'register'">进入系统</button>
      </div>
    </header>

    <main class="view-stack">
      <section class="view-section" style="display:flex">
        <div class="auth-layout">
          <div class="auth-illus-panel">
            <div class="auth-illus-content">
              <h1 class="auth-illus-title">作业自动评测与管理系统</h1>
              <p class="auth-illus-sub">高效评测 · 智能管理 · 助力教学</p>
              <div class="auth-illus-scene">
                <svg viewBox="0 0 420 300" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="30" y="240" width="360" height="14" rx="4" fill="#b8d4f8"/>
                  <rect x="110" y="200" width="200" height="44" rx="6" fill="#4a90d9"/>
                  <rect x="118" y="110" width="184" height="96" rx="6" fill="#1e3a6e"/>
                  <rect x="124" y="116" width="172" height="84" rx="4" fill="#0f2447"/>
                  <rect x="132" y="124" width="80" height="6" rx="3" fill="#3b82f6" opacity=".8"/>
                  <rect x="132" y="136" width="120" height="4" rx="2" fill="#60a5fa" opacity=".5"/>
                  <rect x="132" y="146" width="100" height="4" rx="2" fill="#60a5fa" opacity=".4"/>
                  <rect x="132" y="156" width="60" height="4" rx="2" fill="#34d399" opacity=".6"/>
                  <rect x="132" y="166" width="90" height="4" rx="2" fill="#60a5fa" opacity=".3"/>
                  <rect x="132" y="176" width="50" height="4" rx="2" fill="#f59e0b" opacity=".5"/>
                  <rect x="248" y="124" width="40" height="20" rx="4" fill="#22c55e" opacity=".9"/>
                  <text x="268" y="138" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">100</text>
                  <rect x="190" y="204" width="40" height="4" rx="2" fill="#3a7bc8"/>
                  <rect x="50" y="210" width="52" height="10" rx="3" fill="#f59e0b"/>
                  <rect x="54" y="200" width="44" height="12" rx="3" fill="#fbbf24"/>
                  <rect x="58" y="190" width="36" height="12" rx="3" fill="#fcd34d"/>
                  <rect x="318" y="215" width="52" height="8" rx="3" fill="#a78bfa"/>
                  <rect x="322" y="205" width="44" height="12" rx="3" fill="#c4b5fd"/>
                  <rect x="356" y="220" width="28" height="22" rx="4" fill="#d97706"/>
                  <ellipse cx="370" cy="220" rx="16" ry="6" fill="#b45309"/>
                  <path d="M370 218 Q358 200 352 185" stroke="#22c55e" stroke-width="3" stroke-linecap="round"/>
                  <ellipse cx="349" cy="182" rx="10" ry="7" fill="#4ade80" transform="rotate(-20 349 182)"/>
                  <path d="M370 215 Q382 198 388 183" stroke="#22c55e" stroke-width="3" stroke-linecap="round"/>
                  <ellipse cx="391" cy="180" rx="10" ry="7" fill="#4ade80" transform="rotate(20 391 180)"/>
                  <circle cx="68" cy="165" r="22" fill="#fff" stroke="#b8d4f8" stroke-width="3"/>
                  <circle cx="68" cy="165" r="2" fill="#1e3a6e"/>
                  <line x1="68" y1="165" x2="68" y2="148" stroke="#1e3a6e" stroke-width="2" stroke-linecap="round"/>
                  <line x1="68" y1="165" x2="80" y2="170" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
                  <circle cx="340" cy="80" r="18" fill="#22c55e"/>
                  <polyline points="331,80 338,87 350,72" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          <div class="auth-form-panel">
            <div class="auth-form-card">
              <div class="auth-logo-row">
                <span class="auth-cap-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                </span>
                <span class="auth-logo-text">作业自动评测与管理系统</span>
              </div>

              <template v-if="tab === 'login'">
                <h3 class="auth-form-title">欢迎回来</h3>
                <p class="auth-form-subtitle">登录后进入对应工作台</p>
                <form class="auth-form-body" @submit.prevent="onLogin">
                  <div class="auth-input-group">
                    <svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <input v-model="loginUsername" type="text" placeholder="用户名" required>
                  </div>
                  <div class="auth-input-group">
                    <svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <input v-model="loginPassword" :type="showPassword ? 'text' : 'password'" placeholder="密码" required>
                    <button type="button" class="auth-eye-btn" @click="showPassword = !showPassword" aria-label="显示/隐藏密码">
                      <svg v-if="!showPassword" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </button>
                  </div>
                  <p class="auth-hint">支持管理员、教师、学生登录</p>
                  <button type="submit" class="btn btn-primary btn-block btn-auth" :disabled="loginLoading">{{ loginLoading ? '登录中...' : '登录' }}</button>
                  <button type="button" class="btn btn-outline-primary btn-block btn-auth" @click="tab = 'register'">注册账号</button>
                </form>
              </template>

              <template v-else>
                <h3 class="auth-form-title">创建账号</h3>
                <p class="auth-form-subtitle">注册完成后自动登录</p>
                <form class="auth-form-body" @submit.prevent="onRegister">
                  <div class="split-grid">
                    <div class="auth-input-group">
                      <svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <input v-model="regFullName" type="text" placeholder="姓名">
                    </div>
                    <div class="auth-input-group">
                      <svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      <input v-model="regClassName" type="text" placeholder="班级">
                    </div>
                  </div>
                  <div class="auth-input-group">
                    <svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <input v-model="regUsername" type="text" placeholder="用户名" required>
                  </div>
                  <div class="auth-input-group">
                    <svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <input v-model="regPassword" type="password" placeholder="密码" required>
                  </div>
                  <div class="auth-input-group auth-input-group-select">
                    <svg class="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <select v-model="regRole">
                      <option value="STUDENT">学生</option>
                      <option value="TEACHER">教师</option>
                    </select>
                  </div>
                  <button type="submit" class="btn btn-primary btn-block btn-auth" :disabled="regLoading">{{ regLoading ? '注册中...' : '注册并自动登录' }}</button>
                  <button type="button" class="btn btn-outline-primary btn-block btn-auth" @click="tab = 'login'">返回登录</button>
                </form>
              </template>

              <div v-if="loginMsg.text" :class="['message-box', 'auth-message-box', loginMsg.type === 'error' ? 'error' : loginMsg.type === 'success' ? 'success' : 'info']" aria-live="polite">
                {{ loginMsg.text }}
              </div>

              <div class="auth-divider"><span>演示账号</span></div>
              <div class="auth-demo-row">
                <button class="btn btn-ghost btn-demo" @click="useDemoAccount('admin')">管理员</button>
                <button class="btn btn-ghost btn-demo" @click="useDemoAccount('teacher')">教师</button>
                <button class="btn btn-ghost btn-demo" @click="useDemoAccount('student')">学生</button>
              </div>
            </div>
            <p class="auth-footer">© 2026 作业自动评测与管理系统</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
