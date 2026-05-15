<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import { api } from '@/api'
import { formatDateTime, translateStatus, translateRole, statusClass, generateSemesters } from '@/utils'
import PortalLayout from '@/components/common/PortalLayout.vue'

const auth = useAuthStore()
const { show: toast } = useToast()

const activeModule = ref('admin-home')
const clock = ref('')
const overview = ref({})
const aiSettings = ref({})

const PAGE_SIZE = 6
const lists = ref({
  users: { data: null, page: 0, keyword: '', role: '' },
  courses: { data: null, page: 0, keyword: '' },
  assignments: { data: null, page: 0, keyword: '' },
  auditLogs: { data: null, page: 0, keyword: '' }
})

const courseForm = ref({ show: false, editId: null, name: '', code: '', term: '', className: '' })
const aiForm = ref({ enabled: false, baseUrl: '', model: '', apiKey: '', timeoutSeconds: 20 })
const aiMsg = ref('')
const resetPwdDialog = ref({ show: false, userId: null, password: '' })
const confirmDialog = ref({ show: false, title: '', message: '', resolve: null })

const semesters = generateSemesters()

const navItems = computed(() => [
  { key: 'admin-home', label: '首页', active: activeModule.value === 'admin-home' },
  { key: 'admin-users', label: '用户管理', active: activeModule.value === 'admin-users' },
  { key: 'admin-courses', label: '课程班级管理', active: activeModule.value === 'admin-courses' },
  { key: 'admin-assignments', label: '作业总览', active: activeModule.value === 'admin-assignments' },
  { key: 'admin-ai', label: 'AI 配置', active: activeModule.value === 'admin-ai' },
  { key: 'admin-audit', label: '操作日志', active: activeModule.value === 'admin-audit' }
])

onMounted(() => {
  updateClock()
  setInterval(updateClock, 1000)
  loadDashboard()
})

function updateClock() {
  clock.value = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date())
}

async function loadDashboard() {
  try {
    const [ov, ai] = await Promise.all([
      api('/api/users/overview'),
      api('/api/admin/ai-settings'),
      ...Object.keys(lists.value).map(k => loadList(k))
    ])
    overview.value = ov
    aiSettings.value = ai
    aiForm.value = {
      enabled: !!ai.enabled, baseUrl: ai.baseUrl || '',
      model: ai.model || '', apiKey: '', timeoutSeconds: ai.timeoutSeconds || 20
    }
    aiMsg.value = ai.apiKeyConfigured
      ? '当前已配置 API Key，可直接使用 AI 辅助分析。'
      : '当前未配置 API Key，学生端无法调用 AI 分析。'
  } catch (e) { toast(e.message, 'error', '加载失败') }
}

async function loadList(key) {
  const s = lists.value[key]
  const params = new URLSearchParams({ page: String(s.page), size: String(PAGE_SIZE) })
  if (s.keyword) params.set('keyword', s.keyword)
  if (key === 'users' && s.role) params.set('role', s.role)
  const endpoints = {
    users: '/api/admin/users', courses: '/api/admin/courses',
    assignments: '/api/admin/assignments', auditLogs: '/api/admin/audit-logs'
  }
  const data = await api(`${endpoints[key]}?${params}`)
  if (data.totalPages > 0 && s.page >= data.totalPages) {
    s.page = data.totalPages - 1
    return loadList(key)
  }
  s.page = data.page
  s.data = data
}

async function onSaveAi() {
  try {
    const payload = {
      enabled: aiForm.value.enabled, baseUrl: aiForm.value.baseUrl,
      model: aiForm.value.model, timeoutSeconds: Number(aiForm.value.timeoutSeconds)
    }
    if (aiForm.value.apiKey.trim()) payload.apiKey = aiForm.value.apiKey.trim()
    const result = await api('/api/admin/ai-settings', { method: 'POST', body: JSON.stringify(payload) })
    aiSettings.value = result
    aiMsg.value = result.apiKeyConfigured ? '当前已配置 API Key，可直接使用 AI 辅助分析。' : '当前未配置 API Key，学生端无法调用 AI 分析。'
    toast('AI 配置已保存并立即生效。', 'success', '保存成功')
  } catch (e) { toast(e.message, 'error', '保存失败') }
}

async function onResetPassword(userId) {
  resetPwdDialog.value = { show: true, userId, password: '' }
}

async function confirmResetPassword() {
  const { userId, password } = resetPwdDialog.value
  if (!password.trim()) { toast('新密码不能为空。', 'error', '重置失败'); return }
  try {
    await api(`/api/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: password.trim() }) })
    toast('用户密码已重置。', 'success', '重置成功')
    resetPwdDialog.value.show = false
    loadList('users')
  } catch (e) { toast(e.message, 'error', '重置失败') }
}

async function onToggleUser(userId, currentActive) {
  const nextActive = !currentActive
  const action = nextActive ? '启用' : '禁用'
  if (!confirm(`确定要${action}该账号吗？`)) return
  try {
    await api(`/api/users/${userId}/status`, { method: 'PUT', body: JSON.stringify({ active: nextActive }) })
    toast(`账号已${action}。`, 'success', '操作成功')
    loadList('users')
  } catch (e) { toast(e.message, 'error', '操作失败') }
}

function openCourseCreate() {
  courseForm.value = { show: true, editId: null, name: '', code: '', term: semesters[0], className: '' }
}

function openCourseEdit(item) {
  courseForm.value = { show: true, editId: item.id, name: item.name, code: item.code || '', term: item.term, className: item.className || '' }
}

async function onSubmitCourse() {
  const { editId, name, code, term, className } = courseForm.value
  const body = { name, code: code || null, term, className }
  try {
    if (editId) {
      await api(`/api/admin/courses/${editId}`, { method: 'PUT', body: JSON.stringify({ ...body, active: true }) })
      toast('课程班级已更新。', 'success', '保存成功')
    } else {
      await api('/api/admin/courses', { method: 'POST', body: JSON.stringify(body) })
      toast('课程班级已创建。', 'success', '创建成功')
    }
    courseForm.value.show = false
    loadList('courses')
  } catch (e) { toast(e.message, 'error', '操作失败') }
}

async function onDeleteCourse(id) {
  if (!confirm('确认删除该课程班级？此操作不可撤销。')) return
  try {
    await api(`/api/admin/courses/${id}`, { method: 'DELETE' })
    toast('课程班级已删除。', 'success', '删除成功')
    loadList('courses')
  } catch (e) { toast(e.message, 'error', '删除失败') }
}

function onNav(key) { activeModule.value = key }
</script>

<template>
  <PortalLayout
    sidebar-title="管理员功能"
    :nav-items="navItems"
    :username="auth.profile?.username"
    role-label="管理员"
    @nav="onNav"
    @refresh="loadDashboard"
  >
    <!-- 首页 -->
    <section v-show="activeModule === 'admin-home'" class="portal-panel">
      <div class="portal-home-card">
        <div class="portal-home-copy">
          <h3>XX大学欢迎您</h3>
          <p>当前为管理员工作台，请从左侧选择模块。</p>
        </div>
        <div class="portal-home-clock">{{ clock }}</div>
      </div>
      <div class="stats-grid">
        <article class="stat-card"><span class="muted">教师人数</span><strong>{{ overview.teacherCount ?? '-' }}</strong><small>系统用户</small></article>
        <article class="stat-card"><span class="muted">学生人数</span><strong>{{ overview.studentCount ?? '-' }}</strong><small>系统用户</small></article>
        <article class="stat-card"><span class="muted">作业总数</span><strong>{{ overview.assignmentCount ?? '-' }}</strong><small>全局作业</small></article>
        <article class="stat-card"><span class="muted">已发布作业</span><strong>{{ overview.publishedAssignmentCount ?? '-' }}</strong><small>当前开放</small></article>
        <article class="stat-card"><span class="muted">提交总量</span><strong>{{ overview.submissionCount ?? '-' }}</strong><small>全局记录</small></article>
      </div>
    </section>

    <!-- 用户管理 -->
    <section v-show="activeModule === 'admin-users'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>用户管理</h3></div>
        <div class="admin-list-toolbar">
          <form class="admin-search-form" @submit.prevent="lists.users.page=0; loadList('users')">
            <input type="search" v-model="lists.users.keyword" placeholder="搜索账号、姓名或班级" autocomplete="off">
            <select v-model="lists.users.role">
              <option value="">全部角色</option>
              <option value="ADMIN">管理员</option>
              <option value="TEACHER">教师</option>
              <option value="STUDENT">学生</option>
            </select>
            <button type="submit" class="btn btn-small btn-primary">搜索</button>
            <button type="button" class="btn btn-small btn-ghost" @click="lists.users.keyword=''; lists.users.role=''; lists.users.page=0; loadList('users')">清空</button>
          </form>
          <div class="admin-list-pagination" v-if="lists.users.data">
            <span>共 {{ lists.users.data.totalElements }} 条</span>
            <button class="btn btn-small btn-secondary" :disabled="lists.users.data.first" @click="lists.users.page--; loadList('users')">上一页</button>
            <span>{{ lists.users.data.totalElements === 0 ? 0 : lists.users.data.page + 1 }} / {{ Math.max(lists.users.data.totalPages, 1) }}</span>
            <button class="btn btn-small btn-secondary" :disabled="lists.users.data.last" @click="lists.users.page++; loadList('users')">下一页</button>
          </div>
        </div>
        <div class="stack-list">
          <div v-if="!lists.users.data" class="empty-state">正在加载用户列表...</div>
          <div v-else-if="!lists.users.data.content.length" class="empty-state">暂无用户数据。</div>
          <article v-for="item in lists.users.data?.content" :key="item.id" class="stack-item">
            <div class="inline-header">
              <h4>{{ item.fullName || item.username }}</h4>
              <span :class="['pill', item.role === 'ADMIN' ? 'status-published' : item.role === 'TEACHER' ? 'status-draft' : 'status-pending']">{{ translateRole(item.role) }}</span>
            </div>
            <div class="stack-meta">
              <span>账号：{{ item.username }}</span>
              <span>班级：{{ item.className || '-' }}</span>
              <span>{{ item.active ? '状态：启用' : '状态：禁用' }}</span>
            </div>
            <div class="stack-actions">
              <button class="btn btn-small btn-secondary" @click="onResetPassword(item.id)">重置密码</button>
              <button class="btn btn-small btn-ghost" @click="onToggleUser(item.id, item.active)">{{ item.active ? '禁用账号' : '启用账号' }}</button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- 课程班级管理 -->
    <section v-show="activeModule === 'admin-courses'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head">
          <h3>课程班级管理</h3>
          <button class="btn btn-primary btn-small" @click="openCourseCreate">+ 新建课程班级</button>
        </div>
        <div v-if="courseForm.show" class="admin-course-form">
          <form class="form-stack" @submit.prevent="onSubmitCourse">
            <div class="split-grid">
              <label><span>课程班级名称</span><input type="text" v-model="courseForm.name" placeholder="例如：Java程序设计-1班" required></label>
              <label><span>课程代码（选填）</span><input type="text" v-model="courseForm.code" placeholder="例如：CS101"></label>
            </div>
            <div class="split-grid">
              <label><span>学期</span>
                <select v-model="courseForm.term" required>
                  <option v-for="s in semesters" :key="s" :value="s">{{ s }}</option>
                </select>
              </label>
              <label><span>班级</span><input type="text" v-model="courseForm.className" placeholder="例如：软件工程1班" required></label>
            </div>
            <div class="split-grid">
              <button type="submit" class="btn btn-primary">{{ courseForm.editId ? '保存修改' : '创建课程班级' }}</button>
              <button type="button" class="btn btn-ghost" @click="courseForm.show = false">取消</button>
            </div>
          </form>
        </div>
        <div class="admin-list-toolbar">
          <form class="admin-search-form" @submit.prevent="lists.courses.page=0; loadList('courses')">
            <input type="search" v-model="lists.courses.keyword" placeholder="搜索课程代码、名称、学期或教师" autocomplete="off">
            <button type="submit" class="btn btn-small btn-primary">搜索</button>
            <button type="button" class="btn btn-small btn-ghost" @click="lists.courses.keyword=''; lists.courses.page=0; loadList('courses')">清空</button>
          </form>
          <div class="admin-list-pagination" v-if="lists.courses.data">
            <span>共 {{ lists.courses.data.totalElements }} 条</span>
            <button class="btn btn-small btn-secondary" :disabled="lists.courses.data.first" @click="lists.courses.page--; loadList('courses')">上一页</button>
            <span>{{ lists.courses.data.totalElements === 0 ? 0 : lists.courses.data.page + 1 }} / {{ Math.max(lists.courses.data.totalPages, 1) }}</span>
            <button class="btn btn-small btn-secondary" :disabled="lists.courses.data.last" @click="lists.courses.page++; loadList('courses')">下一页</button>
          </div>
        </div>
        <div class="stack-list">
          <div v-if="!lists.courses.data" class="empty-state">正在加载课程列表...</div>
          <div v-else-if="!lists.courses.data.content.length" class="empty-state">暂无课程班级数据。</div>
          <article v-for="item in lists.courses.data?.content" :key="item.id" class="stack-item">
            <div class="inline-header">
              <h4>{{ item.name }}<small v-if="item.code" class="muted"> ({{ item.code }})</small></h4>
              <span :class="['pill', item.active ? 'status-published' : 'status-closed']">{{ item.active ? '进行中' : '已停用' }}</span>
            </div>
            <div class="stack-meta">
              <span>学期：{{ item.term }}</span>
              <span>班级：{{ item.className || '-' }}</span>
              <span>任课教师：{{ item.teacherName || '待认领' }}</span>
            </div>
            <div class="stack-actions">
              <button class="btn btn-small btn-secondary" @click="openCourseEdit(item)">编辑</button>
              <button class="btn btn-small btn-danger" @click="onDeleteCourse(item.id)">删除</button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- 作业总览 -->
    <section v-show="activeModule === 'admin-assignments'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>作业总览</h3></div>
        <div class="admin-list-toolbar">
          <form class="admin-search-form" @submit.prevent="lists.assignments.page=0; loadList('assignments')">
            <input type="search" v-model="lists.assignments.keyword" placeholder="搜索作业标题、课程或教师" autocomplete="off">
            <button type="submit" class="btn btn-small btn-primary">搜索</button>
            <button type="button" class="btn btn-small btn-ghost" @click="lists.assignments.keyword=''; lists.assignments.page=0; loadList('assignments')">清空</button>
          </form>
          <div class="admin-list-pagination" v-if="lists.assignments.data">
            <span>共 {{ lists.assignments.data.totalElements }} 条</span>
            <button class="btn btn-small btn-secondary" :disabled="lists.assignments.data.first" @click="lists.assignments.page--; loadList('assignments')">上一页</button>
            <span>{{ lists.assignments.data.totalElements === 0 ? 0 : lists.assignments.data.page + 1 }} / {{ Math.max(lists.assignments.data.totalPages, 1) }}</span>
            <button class="btn btn-small btn-secondary" :disabled="lists.assignments.data.last" @click="lists.assignments.page++; loadList('assignments')">下一页</button>
          </div>
        </div>
        <div class="stack-list">
          <div v-if="!lists.assignments.data" class="empty-state">正在加载作业列表...</div>
          <div v-else-if="!lists.assignments.data.content.length" class="empty-state">暂无作业数据。</div>
          <article v-for="item in lists.assignments.data?.content" :key="item.id" class="stack-item">
            <div class="inline-header">
              <h4>{{ item.title }}</h4>
              <span :class="['pill', statusClass(item.status)]">{{ translateStatus(item.status) }}</span>
            </div>
            <div class="stack-meta">
              <span>教师：{{ item.teacherName }}</span>
              <span>课程：{{ item.courseName || '-' }}</span>
              <span>截止时间：{{ formatDateTime(item.deadline) }}</span>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- AI 配置 -->
    <section v-show="activeModule === 'admin-ai'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>AI 配置</h3></div>
        <form class="form-stack" @submit.prevent="onSaveAi">
          <label class="toggle-field">
            <input type="checkbox" v-model="aiForm.enabled">
            <span>启用 AI 辅助分析</span>
          </label>
          <label><span>Base URL</span><input type="text" v-model="aiForm.baseUrl" placeholder="https://api.deepseek.com"></label>
          <label><span>模型名称</span><input type="text" v-model="aiForm.model" placeholder="deepseek-chat"></label>
          <label><span>API Key</span><input type="password" v-model="aiForm.apiKey" placeholder="留空则保持当前，填写新值则覆盖"></label>
          <label><span>超时秒数</span><input type="number" v-model="aiForm.timeoutSeconds" min="1"></label>
          <button type="submit" class="btn btn-primary">保存 AI 配置</button>
        </form>
        <div v-if="aiMsg" class="message-box info" style="display:block;margin-top:12px">{{ aiMsg }}</div>
      </div>
    </section>

    <!-- 操作日志 -->
    <section v-show="activeModule === 'admin-audit'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>操作日志</h3></div>
        <div class="admin-list-toolbar">
          <form class="admin-search-form" @submit.prevent="lists.auditLogs.page=0; loadList('auditLogs')">
            <input type="search" v-model="lists.auditLogs.keyword" placeholder="搜索动作、对象、操作人或摘要" autocomplete="off">
            <button type="submit" class="btn btn-small btn-primary">搜索</button>
            <button type="button" class="btn btn-small btn-ghost" @click="lists.auditLogs.keyword=''; lists.auditLogs.page=0; loadList('auditLogs')">清空</button>
          </form>
          <div class="admin-list-pagination" v-if="lists.auditLogs.data">
            <span>共 {{ lists.auditLogs.data.totalElements }} 条</span>
            <button class="btn btn-small btn-secondary" :disabled="lists.auditLogs.data.first" @click="lists.auditLogs.page--; loadList('auditLogs')">上一页</button>
            <span>{{ lists.auditLogs.data.totalElements === 0 ? 0 : lists.auditLogs.data.page + 1 }} / {{ Math.max(lists.auditLogs.data.totalPages, 1) }}</span>
            <button class="btn btn-small btn-secondary" :disabled="lists.auditLogs.data.last" @click="lists.auditLogs.page++; loadList('auditLogs')">下一页</button>
          </div>
        </div>
        <div class="stack-list">
          <div v-if="!lists.auditLogs.data" class="empty-state">正在加载日志...</div>
          <div v-else-if="!lists.auditLogs.data.content.length" class="empty-state">暂无操作日志。</div>
          <article v-for="item in lists.auditLogs.data?.content" :key="item.id" class="stack-item">
            <div class="inline-header">
              <h4>{{ item.action }}</h4>
              <span class="pill status-published">{{ formatDateTime(item.createdAt) }}</span>
            </div>
            <p>{{ item.summary }}</p>
            <div class="stack-meta">
              <span>操作人：{{ item.actorUsername || '-' }}</span>
              <span>对象：{{ item.targetType || '-' }}</span>
              <span>ID：{{ item.targetId || '-' }}</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  </PortalLayout>

  <!-- 重置密码对话框 -->
  <dialog :open="resetPwdDialog.show" @close="resetPwdDialog.show = false">
    <form method="dialog" class="form-stack" @submit.prevent="confirmResetPassword">
      <div class="panel-heading compact-heading"><h3>重置用户密码</h3></div>
      <label><span>新密码</span><input type="password" v-model="resetPwdDialog.password" placeholder="请输入新密码" required></label>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" class="btn btn-ghost" @click="resetPwdDialog.show = false">取消</button>
        <button type="submit" class="btn btn-primary">确认重置</button>
      </div>
    </form>
  </dialog>
</template>
