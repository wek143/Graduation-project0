<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import { api, downloadFile } from '@/api'
import { formatDateTime, translateStatus, statusClass, generateSemesters, normalizeDateTime } from '@/utils'
import PortalLayout from '@/components/common/PortalLayout.vue'

const auth = useAuthStore()
const { show: toast } = useToast()

const activeModule = ref('teacher-home')
const clock = ref('')
const assignments = ref([])
const courses = ref([])
const courseStats = ref([])
const assignmentStats = ref([])
const homeDue = ref([])
const homeActivity = ref([])
const teacherSubmissions = ref([])
const selectedSubmissionDetail = ref(null)
const aiDiagnosisResult = ref(null)
const aiDiagnosisLoading = ref(false)
const joinCourseCache = ref([])
const joinTermFilter = ref('')
const joinSearch = ref('')
const semesters = generateSemesters()

const statFilters = ref({ keyword: '', courseId: '', status: '' })
const submissionAssignmentId = ref('')
let pollTimer = null
let pollAttempts = 0

const DEFAULT_CODE = `public class Main {
    public static void main(String[] args) {
        java.util.Scanner scanner = new java.util.Scanner(System.in);
        int a = scanner.nextInt();
        int b = scanner.nextInt();
        System.out.println(a + b);
    }
}`

const assignmentForm = ref({
  title: '', description: '', deadline: '', courseId: '', status: 'PUBLISHED',
  maxSubmissions: 5, lateSubmissionAllowed: false, gradingPolicy: 'LATEST', testCases: []
})

const profileForm = ref({ fullName: '', oldPassword: '', newPassword: '' })
const profileMsg = ref('')

const importForms = ref({ users: '', courses: '', enrollments: '' })

const navItems = computed(() => [
  { key: 'teacher-home', label: '工作台', active: activeModule.value === 'teacher-home' },
  { key: 'teacher-join', label: '加入班级', active: activeModule.value === 'teacher-join' },
  { key: 'teacher-create', label: '发布作业', active: activeModule.value === 'teacher-create' },
  { key: 'teacher-library', label: '作业管理', active: activeModule.value === 'teacher-library' },
  { key: 'teacher-submissions', label: '提交记录', active: activeModule.value === 'teacher-submissions' },
  { key: 'teacher-statistics', label: '统计分析', active: activeModule.value === 'teacher-statistics' },
  { key: 'teacher-import', label: '批量导入', active: activeModule.value === 'teacher-import' },
  { key: 'teacher-profile', label: '信息修改', active: activeModule.value === 'teacher-profile' }
])

onMounted(() => {
  updateClock(); setInterval(updateClock, 1000)
  loadDashboard()
  loadProfile()
  ensureDefaultTestCases()
})

function updateClock() {
  clock.value = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date())
}

async function loadDashboard() {
  try {
    const [ov, asgns, aStats, cStats, crs] = await Promise.all([
      api('/api/users/overview'),
      api('/api/assignments'),
      api('/api/assignments/statistics/overview'),
      api('/api/courses/statistics/overview'),
      api('/api/courses')
    ])
    assignments.value = asgns
    courses.value = crs
    assignmentStats.value = aStats
    courseStats.value = cStats
    const now = Date.now()
    homeDue.value = asgns
      .filter(a => a.status === 'PUBLISHED' && a.deadline && new Date(a.deadline).getTime() > now)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 6)
    homeActivity.value = [...aStats]
      .filter(i => i.totalSubmissions > 0)
      .sort((a, b) => (b.lastSubmittedAt ? new Date(b.lastSubmittedAt) : 0) - (a.lastSubmittedAt ? new Date(a.lastSubmittedAt) : 0))
      .slice(0, 6)
  } catch (e) { toast(e.message, 'error', '加载失败') }
}

async function loadProfile() {
  try {
    const p = await api('/api/users/me')
    profileForm.value.fullName = p.fullName || ''
  } catch {}
}

function onNav(key) {
  activeModule.value = key
  if (key === 'teacher-join') loadJoinCourses()
}

function ensureDefaultTestCases() {
  if (!assignmentForm.value.testCases.length) {
    assignmentForm.value.testCases.push({ inputData: '1 2', expectedOutput: '3' })
    assignmentForm.value.testCases.push({ inputData: '6 9', expectedOutput: '15' })
  }
}

function addTestCase() {
  assignmentForm.value.testCases.push({ inputData: '', expectedOutput: '' })
  toast('已新增一个测试用例。', 'info', '操作完成')
}

function removeTestCase(index) {
  assignmentForm.value.testCases.splice(index, 1)
}

async function onCreateAssignment() {
  try {
    const f = assignmentForm.value
    await api('/api/assignments', {
      method: 'POST',
      body: JSON.stringify({
        title: f.title, description: f.description,
        deadline: normalizeDateTime(f.deadline),
        courseId: f.courseId ? Number(f.courseId) : null,
        status: f.status, maxSubmissions: Number(f.maxSubmissions),
        lateSubmissionAllowed: f.lateSubmissionAllowed,
        gradingPolicy: f.gradingPolicy,
        testCases: f.testCases.filter(tc => tc.inputData || tc.expectedOutput)
      })
    })
    assignmentForm.value = {
      title: '', description: '', deadline: '', courseId: '', status: 'PUBLISHED',
      maxSubmissions: 5, lateSubmissionAllowed: false, gradingPolicy: 'LATEST', testCases: []
    }
    ensureDefaultTestCases()
    await loadDashboard()
    toast('作业已创建并刷新到列表中。', 'success', '发布成功')
  } catch (e) { toast(e.message, 'error', '发布失败') }
}

async function onToggleAssignmentStatus(item) {
  const next = item.status === 'PUBLISHED' ? 'CLOSED' : item.status === 'CLOSED' ? 'DRAFT' : 'PUBLISHED'
  try {
    await api(`/api/assignments/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: item.title, description: item.description, deadline: item.deadline, status: next, courseId: item.courseId, maxSubmissions: item.maxSubmissions, lateSubmissionAllowed: item.lateSubmissionAllowed, gradingPolicy: item.gradingPolicy })
    })
    await loadDashboard()
    toast('作业状态已更新。', 'success', '更新成功')
  } catch (e) { toast(e.message, 'error', '更新失败') }
}

async function onDeleteAssignment(id) {
  if (!confirm('删除后无法恢复，确认继续吗？')) return
  try {
    await api(`/api/assignments/${id}`, { method: 'DELETE' })
    await loadDashboard()
    toast('作业已删除。', 'success', '删除成功')
  } catch (e) { toast(e.message, 'error', '删除失败') }
}

async function loadTeacherSubmissions() {
  if (!submissionAssignmentId.value) { toast('请先选择一个作业。', 'error', '操作失败'); return }
  try {
    const data = await api(`/api/submissions/assignment/${submissionAssignmentId.value}`)
    teacherSubmissions.value = data
    toast(`已加载 ${data.length} 条提交记录。`, 'success', '加载成功')
  } catch (e) { toast(e.message, 'error', '加载失败') }
}

async function viewSubmissionDetail(id, isTeacher = true) {
  try {
    const sub = await api(`/api/submissions/${id}`)
    selectedSubmissionDetail.value = sub
    aiDiagnosisResult.value = null
    if (sub.status === 'PENDING') startPolling(id, isTeacher)
    toast('已加载提交详情。', 'info', '查看成功')
  } catch (e) { toast(e.message, 'error', '加载失败') }
}

async function onRejudge(id) {
  if (!confirm('确定重新判题这条提交记录吗？')) return
  try {
    const sub = await api(`/api/submissions/${id}/rejudge`, { method: 'POST' })
    selectedSubmissionDetail.value = sub
    await loadTeacherSubmissions()
    startPolling(id, true)
    toast('提交已重新加入评测队列。', 'success', '重新判题成功')
  } catch (e) { toast(e.message, 'error', '重新判题失败') }
}

function startPolling(submissionId, isTeacher) {
  if (pollTimer) clearInterval(pollTimer)
  pollAttempts = 0
  pollTimer = setInterval(async () => {
    pollAttempts++
    try {
      const sub = await api(`/api/submissions/${submissionId}`)
      selectedSubmissionDetail.value = sub
      if (sub.status !== 'PENDING') {
        clearInterval(pollTimer); pollTimer = null
        await loadDashboard()
        if (isTeacher && submissionAssignmentId.value) await loadTeacherSubmissions()
        toast('后台评测已完成。', 'success', '评测完成')
      } else if (pollAttempts >= 40) {
        clearInterval(pollTimer); pollTimer = null
        toast('评测超时，请手动刷新查看结果。', 'error', '评测超时')
      }
    } catch { clearInterval(pollTimer); pollTimer = null }
  }, 3000)
}

async function loadAiDiagnosis(submissionId) {
  aiDiagnosisLoading.value = true
  aiDiagnosisResult.value = null
  try {
    const result = await api(`/api/submissions/${submissionId}/ai-diagnosis`, { method: 'POST' })
    aiDiagnosisResult.value = result
    toast('AI 辅助分析已生成。', 'success', '分析完成')
  } catch (e) {
    toast(e.message || 'AI 分析暂时不可用，请稍后重试。', 'error', '分析失败')
  } finally { aiDiagnosisLoading.value = false }
}

async function loadJoinCourses() {
  try {
    const url = joinTermFilter.value ? `/api/courses/available?term=${encodeURIComponent(joinTermFilter.value)}` : '/api/courses/available'
    joinCourseCache.value = await api(url)
  } catch (e) { toast(e.message, 'error', '加载失败') }
}

const filteredJoinCourses = computed(() => {
  const kw = joinSearch.value.toLowerCase()
  return kw ? joinCourseCache.value.filter(c => c.name.toLowerCase().includes(kw) || (c.code || '').toLowerCase().includes(kw)) : joinCourseCache.value
})

const myCourseIds = computed(() => new Set(courses.value.map(c => String(c.id))))

async function joinCourse(id) {
  try {
    await api(`/api/courses/${id}/join`, { method: 'POST' })
    toast('已成功加入课程班级。', 'success', '加入成功')
    await loadDashboard(); loadJoinCourses()
  } catch (e) { toast(e.message, 'error', '加入失败') }
}

async function leaveCourse(id) {
  if (!confirm('确认退出该课程班级？')) return
  try {
    await api(`/api/courses/${id}/leave`, { method: 'DELETE' })
    toast('已退出课程班级。', 'success', '退出成功')
    await loadDashboard(); loadJoinCourses()
  } catch (e) { toast(e.message, 'error', '退出失败') }
}

async function onSaveProfile() {
  const body = {}
  if (profileForm.value.fullName !== null) body.fullName = profileForm.value.fullName
  if (profileForm.value.newPassword) { body.oldPassword = profileForm.value.oldPassword; body.newPassword = profileForm.value.newPassword }
  try {
    await api('/api/users/me', { method: 'PUT', body: JSON.stringify(body) })
    profileMsg.value = '信息已更新。'
    profileForm.value.oldPassword = ''; profileForm.value.newPassword = ''
    toast('信息已更新。', 'success', '保存成功')
  } catch (e) { profileMsg.value = e.message; toast(e.message, 'error', '保存失败') }
}

async function onImport(type) {
  const csvContent = importForms.value[type]
  try {
    const result = await api(`/api/import/${type}`, { method: 'POST', body: JSON.stringify({ csvContent }) })
    importForms.value[type] = ''
    await loadDashboard()
    toast(`导入完成：新增 ${result.createdCount}，跳过 ${result.skippedCount}。`, 'success', '导入成功')
  } catch (e) { toast(e.message, 'error', '导入失败') }
}

async function onExportGrades(assignmentId) {
  try {
    await downloadFile(`/api/assignments/${assignmentId}/grades/export`)
    toast('成绩导出已开始。', 'success', '导出成功')
  } catch (e) { toast(e.message, 'error', '导出失败') }
}

const filteredCourseStats = computed(() => {
  const kw = statFilters.value.keyword.toLowerCase()
  return courseStats.value.filter(item => {
    if (statFilters.value.courseId && String(item.courseId) !== String(statFilters.value.courseId)) return false
    if (!kw) return true
    return [item.courseCode, item.courseName, item.term].some(v => String(v || '').toLowerCase().includes(kw))
  })
})

const filteredAssignmentStats = computed(() => {
  const kw = statFilters.value.keyword.toLowerCase()
  const aMap = new Map(assignments.value.map(a => [String(a.id), a]))
  return assignmentStats.value.filter(item => {
    const a = aMap.get(String(item.assignmentId))
    if (statFilters.value.courseId && String(a?.courseId || '') !== String(statFilters.value.courseId)) return false
    if (statFilters.value.status && String(item.assignmentStatus) !== String(statFilters.value.status)) return false
    if (!kw) return true
    return [item.assignmentTitle, a?.courseCode, a?.courseName].some(v => String(v || '').toLowerCase().includes(kw))
  })
})

const statSummary = computed(() => ({
  courseCount: filteredCourseStats.value.length,
  assignmentCount: filteredAssignmentStats.value.length,
  totalSubmissions: filteredAssignmentStats.value.reduce((s, i) => s + (i.totalSubmissions || 0), 0),
  averageScore: filteredAssignmentStats.value.length
    ? filteredAssignmentStats.value.reduce((s, i) => s + (i.averageScore || 0), 0) / filteredAssignmentStats.value.length : 0
}))

function urgencyClass(deadline) {
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  return days <= 1 ? 'danger' : days <= 3 ? 'warning' : 'info'
}
function urgencyLabel(deadline) {
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  return days <= 1 ? '今日截止' : `${days} 天后`
}
function scoreColor(score) {
  return score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)'
}
</script>

<template>
  <PortalLayout sidebar-title="教师工作台" :nav-items="navItems" :username="auth.profile?.username" role-label="教师" @nav="onNav" @refresh="loadDashboard">

    <!-- 工作台首页 -->
    <section v-show="activeModule === 'teacher-home'" class="portal-panel">
      <div class="portal-home-card">
        <div class="portal-home-copy"><h3>教师工作台</h3><p>查看课程与作业的最新动态。</p></div>
        <div class="portal-home-clock">{{ clock }}</div>
      </div>
      <div class="teacher-dashboard-grid">
        <div class="portal-panel-card">
          <div class="portal-panel-head"><h3>待截止作业</h3><span class="panel-kicker">近期截止</span></div>
          <div class="stack-list">
            <div v-if="!homeDue.length" class="empty-state">暂无即将截止的作业。</div>
            <article v-for="a in homeDue" :key="a.id" class="stack-item">
              <div class="inline-header">
                <h4>{{ a.title }}</h4>
                <span :class="['badge', 'badge-' + urgencyClass(a.deadline)]">{{ urgencyLabel(a.deadline) }}</span>
              </div>
              <div class="stack-meta"><span>截止：{{ formatDateTime(a.deadline) }}</span><span>最多提交 {{ a.maxSubmissions }} 次</span></div>
            </article>
          </div>
        </div>
        <div class="portal-panel-card">
          <div class="portal-panel-head"><h3>最近提交</h3><span class="panel-kicker">按时间排序</span></div>
          <div class="stack-list">
            <div v-if="!homeActivity.length" class="empty-state">暂无提交记录。</div>
            <article v-for="item in homeActivity" :key="item.assignmentId" class="stack-item">
              <div class="inline-header">
                <h4>{{ item.assignmentTitle }}</h4>
                <span :class="['pill', statusClass(item.assignmentStatus)]">{{ translateStatus(item.assignmentStatus) }}</span>
              </div>
              <div class="stack-meta">
                <span>提交：{{ item.totalSubmissions }}</span>
                <span>参与学生：{{ item.distinctStudentCount }}</span>
                <span>平均分：{{ item.averageScore.toFixed(1) }}</span>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>

    <!-- 加入班级 -->
    <section v-show="activeModule === 'teacher-join'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>加入班级</h3></div>
        <div class="join-filter-bar">
          <select v-model="joinTermFilter" class="stat-filter-select" @change="loadJoinCourses">
            <option value="">全部学期</option>
            <option v-for="s in semesters" :key="s" :value="s">{{ s }}</option>
          </select>
          <div class="stat-filter-search" style="flex:1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input v-model="joinSearch" type="search" placeholder="搜索课程班级名称">
          </div>
          <button class="btn btn-small btn-ghost" @click="loadJoinCourses">刷新</button>
        </div>
        <div class="join-course-grid">
          <div v-if="!filteredJoinCourses.length" class="empty-state">暂无可加入的课程班级。</div>
          <div v-for="c in filteredJoinCourses" :key="c.id" class="join-course-card">
            <div class="join-course-top">
              <div><strong>{{ c.name }}</strong><small v-if="c.code" class="muted"> · {{ c.code }}</small></div>
              <span v-if="myCourseIds.has(String(c.id))" class="pill status-published">已加入</span>
              <span v-else-if="c.teacherName" class="pill status-closed">已有教师</span>
            </div>
            <div class="join-course-meta">
              <span>{{ c.term }}</span><span>{{ c.className || '' }}</span>
              <span>教师：{{ c.teacherName || '待认领' }}</span>
            </div>
            <div class="join-course-action">
              <button v-if="myCourseIds.has(String(c.id))" class="btn btn-small btn-ghost" @click="leaveCourse(c.id)">退出</button>
              <button v-else-if="!c.teacherName" class="btn btn-small btn-primary" @click="joinCourse(c.id)">加入</button>
              <button v-else class="btn btn-small btn-ghost" disabled>无法加入</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 发布作业 -->
    <section v-show="activeModule === 'teacher-create'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>创建新作业</h3></div>
        <form class="form-stack" @submit.prevent="onCreateAssignment">
          <label><span>作业标题</span><input type="text" v-model="assignmentForm.title" placeholder="例如：冒泡排序实验" required></label>
          <label><span>作业说明</span><textarea v-model="assignmentForm.description" rows="4" placeholder="描述实验要求、输入输出格式和评分标准" required></textarea></label>
          <label><span>截止时间</span><input type="datetime-local" v-model="assignmentForm.deadline" required></label>
          <label><span>所属课程</span>
            <select v-model="assignmentForm.courseId">
              <option value="">请选择课程</option>
              <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.code ? c.code + ' · ' : '' }}{{ c.name }}</option>
            </select>
          </label>
          <label><span>作业状态</span>
            <select v-model="assignmentForm.status">
              <option value="PUBLISHED">已发布</option>
              <option value="DRAFT">草稿</option>
              <option value="CLOSED">已关闭</option>
            </select>
          </label>
          <div class="split-grid">
            <label><span>最多提交次数</span><input type="number" v-model="assignmentForm.maxSubmissions" min="1" max="100" required></label>
            <label><span>评分策略</span>
              <select v-model="assignmentForm.gradingPolicy">
                <option value="LATEST">按最后一次提交</option>
                <option value="HIGHEST">按最高分提交</option>
              </select>
            </label>
          </div>
          <label class="toggle-field"><input type="checkbox" v-model="assignmentForm.lateSubmissionAllowed"><span>允许截止后提交</span></label>
          <div class="test-case-builder">
            <div class="inline-header">
              <h4>测试用例</h4>
              <button type="button" class="btn btn-small btn-ghost" @click="addTestCase">新增用例</button>
            </div>
            <p class="form-hint">建议至少准备两组输入输出，以便更准确地区分通过、部分通过与失败。</p>
            <div class="test-case-list">
              <div v-for="(tc, i) in assignmentForm.testCases" :key="i" class="test-case-item">
                <div class="case-header">
                  <strong class="case-title">测试用例 {{ i + 1 }}</strong>
                  <button type="button" class="btn btn-small btn-ghost" @click="removeTestCase(i)">删除</button>
                </div>
                <label><span>输入</span><textarea v-model="tc.inputData" rows="3" placeholder="例如：1 2"></textarea></label>
                <label><span>期望输出</span><textarea v-model="tc.expectedOutput" rows="3" placeholder="例如：3"></textarea></label>
              </div>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block">发布作业</button>
        </form>
      </div>
    </section>

    <!-- 作业管理 -->
    <section v-show="activeModule === 'teacher-library'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>作业与用例管理</h3></div>
        <div class="stack-list">
          <div v-if="!assignments.length" class="empty-state">当前还没有作业，先创建一个新的作业吧。</div>
          <article v-for="item in assignments" :key="item.id" class="stack-item">
            <div class="inline-header">
              <h4>{{ item.title }}</h4>
              <span :class="['pill', statusClass(item.status)]">{{ translateStatus(item.status) }}</span>
            </div>
            <div class="stack-meta">
              <span v-if="item.courseName">课程：{{ item.courseName }}</span>
              <span>截止时间：{{ formatDateTime(item.deadline) }}</span>
              <span>测试用例：{{ item.testCases.length }} 条</span>
              <span>最多提交：{{ item.maxSubmissions ?? 5 }} 次</span>
            </div>
            <p style="font-size:13px;color:var(--text-mid);margin-top:4px">{{ item.description }}</p>
            <div class="stack-meta" style="margin-top:4px">
              <span>{{ item.gradingPolicy === 'HIGHEST' ? '按最高分计入' : '按最后一次计入' }}</span>
              <span>{{ item.lateSubmissionAllowed ? '允许逾期提交' : '不允许逾期提交' }}</span>
            </div>
            <div class="stack-actions">
              <button class="btn btn-small btn-secondary" @click="onToggleAssignmentStatus(item)">切换状态</button>
              <button class="btn btn-small btn-ghost" @click="onDeleteAssignment(item.id)">删除</button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- 提交记录 -->
    <section v-show="activeModule === 'teacher-submissions'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>查看提交</h3></div>
        <div class="inline-form">
          <label class="grow"><span>选择作业</span>
            <select v-model="submissionAssignmentId">
              <option value="">选择作业查看提交</option>
              <option v-for="a in assignments" :key="a.id" :value="a.id">{{ a.title }}</option>
            </select>
          </label>
          <button class="btn btn-secondary" @click="loadTeacherSubmissions">加载提交列表</button>
        </div>
        <div class="stack-list" style="margin-top:14px">
          <div v-if="!teacherSubmissions.length" class="empty-state">当前作业还没有学生提交。</div>
          <article v-for="item in teacherSubmissions" :key="item.id" class="stack-item">
            <div class="inline-header">
              <h4>{{ item.studentName }} 的提交</h4>
              <span :class="['pill', statusClass(item.status)]">{{ translateStatus(item.status) }}</span>
            </div>
            <div class="stack-meta">
              <span>成绩：{{ item.score ?? 0 }}</span>
              <span>班级：{{ item.className || '-' }}</span>
              <span>提交时间：{{ formatDateTime(item.submittedAt) }}</span>
            </div>
            <div class="stack-actions">
              <button class="btn btn-small btn-secondary" @click="viewSubmissionDetail(item.id, true)">查看详情</button>
              <button class="btn btn-small btn-ghost" :disabled="item.status === 'PENDING'" @click="onRejudge(item.id)">{{ item.status === 'PENDING' ? '评测中' : '重新判题' }}</button>
            </div>
          </article>
        </div>
        <div v-if="selectedSubmissionDetail" class="detail-panel" style="margin-top:14px">
          <article class="detail-block">
            <div class="inline-header">
              <h4>{{ selectedSubmissionDetail.assignmentTitle }}</h4>
              <span :class="['pill', statusClass(selectedSubmissionDetail.status)]">{{ translateStatus(selectedSubmissionDetail.status) }}</span>
            </div>
            <div class="stack-meta">
              <span>学生：{{ selectedSubmissionDetail.studentName }}</span>
              <span>班级：{{ selectedSubmissionDetail.className || '-' }}</span>
              <span>分数：{{ selectedSubmissionDetail.score ?? 0 }}</span>
              <span>提交时间：{{ formatDateTime(selectedSubmissionDetail.submittedAt) }}</span>
            </div>
          </article>
          <article class="detail-block"><strong>编译信息</strong><pre>{{ selectedSubmissionDetail.compileMessage || '' }}</pre></article>
          <article class="detail-block"><strong>运行信息</strong><pre>{{ selectedSubmissionDetail.runtimeMessage || '' }}</pre></article>
          <article class="detail-block"><strong>提交源码</strong><pre>{{ selectedSubmissionDetail.sourceCode || '' }}</pre></article>
          <div v-if="!selectedSubmissionDetail.caseResults?.length" class="empty-state">{{ selectedSubmissionDetail.status === 'PENDING' ? '评测正在后台执行，请稍候自动刷新。' : '该提交当前没有测试用例评测明细。' }}</div>
          <article v-for="item in selectedSubmissionDetail.caseResults" :key="item.caseOrder" class="case-result-card" style="margin-bottom:8px">
            <div class="inline-header">
              <strong>测试用例 {{ item.caseOrder }}</strong>
              <span :class="['pill', item.passed ? 'status-accepted' : 'status-failed']">{{ item.passed ? '通过' : '未通过' }}</span>
            </div>
            <div class="detail-block"><strong>输入</strong><pre>{{ item.inputData }}</pre></div>
            <div class="detail-block"><strong>期望输出</strong><pre>{{ item.expectedOutput }}</pre></div>
            <div class="detail-block"><strong>实际输出</strong><pre>{{ item.actualOutput || '' }}</pre></div>
            <div v-if="item.errorMessage" class="detail-block"><strong>错误信息</strong><pre>{{ item.errorMessage }}</pre></div>
          </article>
        </div>
      </div>
    </section>

    <!-- 统计分析 -->
    <section v-show="activeModule === 'teacher-statistics'" class="portal-panel">
      <div class="stat-page-header">
        <div class="stat-filter-bar">
          <div class="stat-filter-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input v-model="statFilters.keyword" type="search" placeholder="搜索课程或作业">
          </div>
          <select v-model="statFilters.courseId" class="stat-filter-select">
            <option value="">全部课程</option>
            <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.code }} · {{ c.name }}</option>
          </select>
          <select v-model="statFilters.status" class="stat-filter-select">
            <option value="">全部状态</option>
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已发布</option>
            <option value="CLOSED">已关闭</option>
          </select>
          <button type="button" class="btn btn-small btn-ghost" @click="statFilters.keyword=''; statFilters.courseId=''; statFilters.status=''">清空</button>
        </div>
        <div class="stat-kpi-row">
          <div class="stat-kpi-card stat-kpi-blue"><div><strong>{{ statSummary.courseCount }}</strong><span>课程数</span></div></div>
          <div class="stat-kpi-card stat-kpi-purple"><div><strong>{{ statSummary.assignmentCount }}</strong><span>作业数</span></div></div>
          <div class="stat-kpi-card stat-kpi-teal"><div><strong>{{ statSummary.totalSubmissions }}</strong><span>提交总量</span></div></div>
          <div class="stat-kpi-card stat-kpi-orange"><div><strong>{{ statSummary.averageScore.toFixed(1) }}</strong><span>平均分</span></div></div>
        </div>
      </div>
      <div v-if="filteredCourseStats.length" class="stat-section">
        <div class="stat-section-head"><h4>课程统计</h4><span>共 {{ filteredCourseStats.length }} 门</span></div>
        <div class="stat-course-grid">
          <div v-for="item in filteredCourseStats" :key="item.courseId" class="stat-course-card">
            <div class="stat-course-card-top">
              <div class="stat-course-title"><strong>{{ item.courseCode }}</strong><span>{{ item.courseName }}</span></div>
              <span :class="['pill', item.active ? 'status-published' : 'status-closed']">{{ item.active ? '进行中' : '已停用' }}</span>
            </div>
            <div class="stat-course-meta"><span>{{ item.term }}</span><span v-if="item.className">{{ item.className }}</span></div>
            <div class="stat-course-nums">
              <div class="stat-course-num"><strong>{{ item.enrollmentCount }}</strong><span>选课人数</span></div>
              <div class="stat-course-num"><strong>{{ item.publishedAssignmentCount }}<small>/{{ item.assignmentCount }}</small></strong><span>已发布作业</span></div>
              <div class="stat-course-num"><strong>{{ item.totalSubmissions }}</strong><span>提交总量</span></div>
              <div class="stat-course-num stat-course-num-score"><strong>{{ item.averageScore.toFixed(1) }}</strong><span>平均分</span></div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="filteredAssignmentStats.length" class="stat-section">
        <div class="stat-section-head"><h4>作业统计</h4><span>共 {{ filteredAssignmentStats.length }} 个</span></div>
        <div class="stat-assignment-list">
          <div v-for="item in filteredAssignmentStats" :key="item.assignmentId" class="stat-assignment-card">
            <div class="stat-assignment-top">
              <div class="stat-assignment-title">
                <h4>{{ item.assignmentTitle }}</h4>
                <span class="stat-assignment-course">{{ assignments.find(a => String(a.id) === String(item.assignmentId))?.courseCode || '-' }}</span>
              </div>
              <span :class="['pill', statusClass(item.assignmentStatus)]">{{ translateStatus(item.assignmentStatus) }}</span>
            </div>
            <div class="stat-assignment-nums">
              <div class="stat-num-item"><span>提交次数</span><strong>{{ item.totalSubmissions }}</strong></div>
              <div class="stat-num-item"><span>参与学生</span><strong>{{ item.distinctStudentCount }}</strong></div>
              <div class="stat-num-item"><span>平均分</span><strong :style="{ color: scoreColor(item.averageScore) }">{{ item.averageScore.toFixed(1) }}</strong></div>
            </div>
            <div class="stat-score-bar-wrap">
              <div class="stat-score-bar-track"><div class="stat-score-bar-fill" :style="{ width: Math.min(100, Math.round(item.averageScore)) + '%', background: scoreColor(item.averageScore) }"></div></div>
              <span class="stat-score-bar-label">{{ item.averageScore.toFixed(1) }} / 100</span>
            </div>
            <div class="stat-assignment-actions">
              <button class="btn btn-small btn-primary" @click="submissionAssignmentId = item.assignmentId; activeModule = 'teacher-submissions'; loadTeacherSubmissions()">查看提交</button>
              <button class="btn btn-small btn-secondary" @click="onExportGrades(item.assignmentId)">导出成绩 CSV</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!filteredCourseStats.length && !filteredAssignmentStats.length" class="empty-state">暂无统计数据。</div>
    </section>

    <!-- 批量导入 -->
    <section v-show="activeModule === 'teacher-import'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>批量导入</h3></div>
        <div class="import-stack">
          <form class="form-stack import-card" @submit.prevent="onImport('users')">
            <label><span>导入用户 CSV</span><textarea v-model="importForms.users" rows="4" placeholder="username,password,role,fullName,className"></textarea></label>
            <button type="submit" class="btn btn-ghost btn-block">导入用户</button>
          </form>
          <form class="form-stack import-card" @submit.prevent="onImport('courses')">
            <label><span>导入课程 CSV</span><textarea v-model="importForms.courses" rows="4" placeholder="code,name,term"></textarea></label>
            <button type="submit" class="btn btn-ghost btn-block">导入课程</button>
          </form>
          <form class="form-stack import-card" @submit.prevent="onImport('enrollments')">
            <label><span>导入选课 CSV</span><textarea v-model="importForms.enrollments" rows="4" placeholder="courseCode,studentUsername"></textarea></label>
            <button type="submit" class="btn btn-ghost btn-block">导入选课</button>
          </form>
        </div>
      </div>
    </section>

    <!-- 信息修改 -->
    <section v-show="activeModule === 'teacher-profile'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>信息修改</h3></div>
        <form class="form-stack profile-form" @submit.prevent="onSaveProfile">
          <label><span>姓名</span><input type="text" v-model="profileForm.fullName" placeholder="请输入姓名"></label>
          <label><span>旧密码</span><input type="password" v-model="profileForm.oldPassword" placeholder="修改密码时填写"></label>
          <label><span>新密码</span><input type="password" v-model="profileForm.newPassword" placeholder="留空则不修改密码"></label>
          <button type="submit" class="btn btn-primary">保存修改</button>
        </form>
        <div v-if="profileMsg" class="message-box info" style="display:block;margin-top:12px">{{ profileMsg }}</div>
      </div>
    </section>

  </PortalLayout>
</template>
