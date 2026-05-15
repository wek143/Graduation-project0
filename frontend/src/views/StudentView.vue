<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import { api } from '@/api'
import { formatDateTime, translateStatus, statusClass, generateSemesters } from '@/utils'
import PortalLayout from '@/components/common/PortalLayout.vue'

const auth = useAuthStore()
const { show: toast } = useToast()

const activeModule = ref('student-home')
const clock = ref('')
const assignments = ref([])
const courses = ref([])
const summaries = ref([])
const selectedSubmissionId = ref('')
const submissionDetail = ref(null)
const aiDiagnosisResult = ref(null)
const aiDiagnosisLoading = ref(false)
const joinCourseCache = ref([])
const joinTermFilter = ref('')
const joinSearch = ref('')
const semesters = generateSemesters()
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

const submitForm = ref({ assignmentId: '', sourceCode: DEFAULT_CODE })
const profileForm = ref({ fullName: '', className: '', oldPassword: '', newPassword: '' })
const profileMsg = ref('')

const navItems = computed(() => [
  { key: 'student-home', label: '首页', active: activeModule.value === 'student-home' },
  { key: 'student-join', label: '加入班级', active: activeModule.value === 'student-join' },
  { key: 'student-courses', label: '我的课程', active: activeModule.value === 'student-courses' },
  { key: 'student-assignments', label: '已发布作业', active: activeModule.value === 'student-assignments' },
  { key: 'student-submit', label: '代码提交', active: activeModule.value === 'student-submit' },
  { key: 'student-results', label: '最近提交', active: activeModule.value === 'student-results' },
  { key: 'student-detail', label: '评测详情', active: activeModule.value === 'student-detail' },
  { key: 'student-profile', label: '信息修改', active: activeModule.value === 'student-profile' }
])

onMounted(() => {
  updateClock(); setInterval(updateClock, 1000)
  loadDashboard()
  loadProfile()
})

function updateClock() {
  clock.value = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date())
}

async function loadDashboard() {
  try {
    const [asgns, sums, crs] = await Promise.all([
      api('/api/assignments/published'),
      api(`/api/submissions/student/${auth.profile.id}/latest`),
      api('/api/courses')
    ])
    assignments.value = asgns
    summaries.value = sums
    courses.value = crs
    if (!submitForm.value.assignmentId && asgns.length) {
      submitForm.value.assignmentId = String(asgns[0].id)
    }
  } catch (e) { toast(e.message, 'error', '加载失败') }
}

async function loadProfile() {
  try {
    const p = await api('/api/users/me')
    profileForm.value.fullName = p.fullName || ''
    profileForm.value.className = p.className || ''
  } catch {}
}

function onNav(key) {
  activeModule.value = key
  if (key === 'student-join') loadJoinCourses()
}

function selectAssignmentAndSubmit(id) {
  submitForm.value.assignmentId = String(id)
  activeModule.value = 'student-submit'
}

async function onSubmitCode() {
  try {
    const sub = await api('/api/submissions', {
      method: 'POST',
      body: JSON.stringify({ assignmentId: Number(submitForm.value.assignmentId), sourceCode: submitForm.value.sourceCode })
    })
    submissionDetail.value = sub
    aiDiagnosisResult.value = null
    activeModule.value = 'student-detail'
    if (sub.status === 'PENDING') startPolling(sub.id)
    await loadDashboard()
    toast('提交成功，已加入后台评测队列。', 'success', '提交成功')
  } catch (e) { toast(e.message, 'error', '提交失败') }
}

async function viewDetail(id) {
  try {
    const sub = await api(`/api/submissions/${id}`)
    submissionDetail.value = sub
    aiDiagnosisResult.value = null
    activeModule.value = 'student-detail'
    if (sub.status === 'PENDING') startPolling(id)
    toast('已加载评测详情。', 'info', '查看成功')
  } catch (e) { toast(e.message, 'error', '加载失败') }
}

function startPolling(submissionId) {
  if (pollTimer) clearInterval(pollTimer)
  pollAttempts = 0
  pollTimer = setInterval(async () => {
    pollAttempts++
    try {
      const sub = await api(`/api/submissions/${submissionId}`)
      submissionDetail.value = sub
      if (sub.status !== 'PENDING') {
        clearInterval(pollTimer); pollTimer = null
        await loadDashboard()
        toast('后台评测已完成。', 'success', '评测完成')
      } else if (pollAttempts >= 40) {
        clearInterval(pollTimer); pollTimer = null
        toast('评测超时，请手动刷新查看结果。', 'error', '评测超时')
      }
    } catch { clearInterval(pollTimer); pollTimer = null }
  }, 3000)
}

async function loadAiDiagnosis() {
  if (!submissionDetail.value) return
  aiDiagnosisLoading.value = true
  aiDiagnosisResult.value = null
  try {
    const result = await api(`/api/submissions/${submissionDetail.value.id}/ai-diagnosis`, { method: 'POST' })
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
  if (profileForm.value.className !== null) body.className = profileForm.value.className
  if (profileForm.value.newPassword) { body.oldPassword = profileForm.value.oldPassword; body.newPassword = profileForm.value.newPassword }
  try {
    await api('/api/users/me', { method: 'PUT', body: JSON.stringify(body) })
    profileMsg.value = '信息已更新。'
    profileForm.value.oldPassword = ''; profileForm.value.newPassword = ''
    toast('信息已更新。', 'success', '保存成功')
  } catch (e) { profileMsg.value = e.message; toast(e.message, 'error', '保存失败') }
}

function assignmentCountByCourse(courseId) {
  return assignments.value.filter(a => String(a.courseId || '') === String(courseId)).length
}

function nearestDeadline(courseId) {
  const deadlines = assignments.value.filter(a => String(a.courseId || '') === String(courseId) && a.deadline).map(a => a.deadline).sort()
  return deadlines[0] || null
}
</script>

<template>
  <PortalLayout sidebar-title="学生功能" :nav-items="navItems" :username="auth.profile?.username" role-label="学生" @nav="onNav" @refresh="loadDashboard">

    <!-- 首页 -->
    <section v-show="activeModule === 'student-home'" class="portal-panel">
      <div class="portal-home-card">
        <div class="portal-home-copy"><h3>XX大学欢迎您</h3><p>请选择左侧功能进入相应业务操作。</p></div>
        <div class="portal-home-clock">{{ clock }}</div>
      </div>
    </section>

    <!-- 加入班级 -->
    <section v-show="activeModule === 'student-join'" class="portal-panel">
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
            </div>
            <div class="join-course-meta">
              <span>{{ c.term }}</span><span>{{ c.className || '' }}</span>
              <span>教师：{{ c.teacherName || '待认领' }}</span>
            </div>
            <div class="join-course-action">
              <button v-if="myCourseIds.has(String(c.id))" class="btn btn-small btn-ghost" @click="leaveCourse(c.id)">退出</button>
              <button v-else class="btn btn-small btn-primary" @click="joinCourse(c.id)">加入</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 我的课程 -->
    <section v-show="activeModule === 'student-courses'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>课程选择</h3></div>
        <div class="assignment-board">
          <div v-if="!courses.length" class="empty-state">当前还没有已选课程，请联系教师为你加入课程。</div>
          <article v-for="course in courses" :key="course.id" class="assignment-card">
            <div class="inline-header">
              <h4>{{ course.code }} · {{ course.name }}</h4>
              <span :class="['pill', course.active ? 'status-published' : 'status-closed']">{{ course.active ? '已选课程' : '已停用' }}</span>
            </div>
            <p>教师：{{ course.teacherName }}{{ course.className ? ' · 班级：' + course.className : '' }}</p>
            <div class="card-meta">
              <span>学期：{{ course.term || '-' }}</span>
              <span>已发布作业：{{ assignmentCountByCourse(course.id) }}</span>
              <span>下次截止：{{ nearestDeadline(course.id) ? formatDateTime(nearestDeadline(course.id)) : '暂无' }}</span>
            </div>
            <div class="stack-actions">
              <button class="btn btn-small btn-primary" @click="activeModule = 'student-assignments'">查看课程作业</button>
              <button class="btn btn-small btn-secondary" :disabled="!assignmentCountByCourse(course.id)" @click="selectAssignmentAndSubmit(assignments.find(a => String(a.courseId || '') === String(course.id))?.id)">前往提交</button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- 已发布作业 -->
    <section v-show="activeModule === 'student-assignments'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>已发布作业</h3></div>
        <div class="assignment-board">
          <div v-if="!assignments.length" class="empty-state">当前暂无可提交的作业。</div>
          <article v-for="item in assignments" :key="item.id" class="assignment-card">
            <div class="inline-header">
              <h4>{{ item.title }}</h4>
              <span :class="['pill', statusClass(item.status)]">{{ translateStatus(item.status) }}</span>
            </div>
            <p>{{ item.description }}</p>
            <div class="card-meta">
              <span v-if="item.courseName">课程：{{ item.courseName }}</span>
              <span>教师：{{ item.teacherName }}</span>
              <span>截止时间：{{ formatDateTime(item.deadline) }}</span>
              <span>测试用例：{{ item.testCases.length }} 条</span>
            </div>
            <div class="stack-actions">
              <button class="btn btn-small btn-primary" @click="selectAssignmentAndSubmit(item.id)">选择并提交</button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- 代码提交 -->
    <section v-show="activeModule === 'student-submit'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>代码提交</h3></div>
        <form class="form-stack" @submit.prevent="onSubmitCode">
          <label><span>当前作业</span>
            <select v-model="submitForm.assignmentId" required>
              <option value="">请选择要提交的作业</option>
              <option v-for="a in assignments" :key="a.id" :value="a.id">{{ a.title }}</option>
            </select>
          </label>
          <div class="editor-shell">
            <div class="editor-toolbar"><strong>Main.java</strong><span>Java / UTF-8 / Judge Ready</span></div>
            <label class="editor-label">
              <span>Java 代码</span>
              <textarea v-model="submitForm.sourceCode" rows="16" spellcheck="false" required style="font-family:var(--font-code);font-size:13px;min-height:260px;background:#fafbff;border:none;border-radius:0"></textarea>
            </label>
          </div>
          <button type="submit" class="btn btn-primary btn-block">提交并评测</button>
        </form>
      </div>
    </section>

    <!-- 最近提交 -->
    <section v-show="activeModule === 'student-results'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>最近提交概览</h3></div>
        <div class="stack-list">
          <div v-if="!summaries.length" class="empty-state">你还没有任何提交记录。</div>
          <article v-for="item in summaries" :key="item.submissionId" class="stack-item">
            <div class="inline-header">
              <h4>{{ item.assignmentTitle }}</h4>
              <span :class="['pill', statusClass(item.status)]">{{ translateStatus(item.status) }}</span>
            </div>
            <div class="stack-meta">
              <span>得分：{{ item.score ?? 0 }}</span>
              <span>提交时间：{{ formatDateTime(item.submittedAt) }}</span>
            </div>
            <div class="stack-actions">
              <button class="btn btn-small btn-secondary" @click="viewDetail(item.submissionId)">查看评测细节</button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- 评测详情 -->
    <section v-show="activeModule === 'student-detail'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>评测详情</h3></div>
        <div v-if="!submissionDetail" class="detail-panel empty-state">选择一条提交记录后，这里会显示编译结果、运行信息和每个测试用例的通过情况。</div>
        <template v-else>
          <div class="detail-panel">
            <article class="detail-block">
              <div class="inline-header">
                <h4>{{ submissionDetail.assignmentTitle }}</h4>
                <span :class="['pill', statusClass(submissionDetail.status)]">{{ translateStatus(submissionDetail.status) }}</span>
              </div>
              <div class="stack-meta">
                <span>学生：{{ submissionDetail.studentName }}</span>
                <span>班级：{{ submissionDetail.className || '-' }}</span>
                <span>分数：{{ submissionDetail.score ?? 0 }}</span>
                <span>提交时间：{{ formatDateTime(submissionDetail.submittedAt) }}</span>
              </div>
              <div class="stack-actions" style="margin-top:8px">
                <button class="btn btn-small btn-secondary" :disabled="submissionDetail.status === 'PENDING' || aiDiagnosisLoading" @click="loadAiDiagnosis">
                  {{ submissionDetail.status === 'PENDING' ? '评测中' : aiDiagnosisLoading ? '分析中...' : 'AI 辅助分析' }}
                </button>
              </div>
            </article>
            <article class="detail-block"><strong>编译信息</strong><pre>{{ submissionDetail.compileMessage || '' }}</pre></article>
            <article class="detail-block"><strong>运行信息</strong><pre>{{ submissionDetail.runtimeMessage || '' }}</pre></article>
            <article class="detail-block"><strong>提交源码</strong><pre>{{ submissionDetail.sourceCode || '' }}</pre></article>
            <div v-if="!submissionDetail.caseResults?.length" class="empty-state">{{ submissionDetail.status === 'PENDING' ? '评测正在后台执行，请稍候自动刷新。' : '该提交当前没有测试用例评测明细。' }}</div>
            <article v-for="item in submissionDetail.caseResults" :key="item.caseOrder" class="case-result-card" style="margin-bottom:8px">
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
          <div v-if="aiDiagnosisResult" class="detail-panel" style="margin-top:12px">
            <article class="detail-block">
              <div class="inline-header">
                <h4>AI 辅助分析</h4>
                <span :class="['pill', statusClass(aiDiagnosisResult.status)]">{{ translateStatus(aiDiagnosisResult.status) }}</span>
              </div>
              <p class="detail-copy">{{ aiDiagnosisResult.summary || '暂无分析摘要。' }}</p>
            </article>
            <article class="detail-block"><strong>可能原因</strong>
              <ul v-if="aiDiagnosisResult.possibleCauses?.length" class="detail-list"><li v-for="(item, i) in aiDiagnosisResult.possibleCauses" :key="i">{{ item }}</li></ul>
              <p v-else class="detail-copy">暂无明确原因分析。</p>
            </article>
            <article class="detail-block"><strong>修改建议</strong>
              <ul v-if="aiDiagnosisResult.fixSuggestions?.length" class="detail-list"><li v-for="(item, i) in aiDiagnosisResult.fixSuggestions" :key="i">{{ item }}</li></ul>
              <p v-else class="detail-copy">暂无修改建议。</p>
            </article>
            <article class="detail-block"><strong>相关知识点</strong>
              <ul v-if="aiDiagnosisResult.knowledgePoints?.length" class="detail-list"><li v-for="(item, i) in aiDiagnosisResult.knowledgePoints" :key="i">{{ item }}</li></ul>
              <p v-else class="detail-copy">暂无相关知识点提示。</p>
            </article>
            <article class="detail-block"><strong>说明</strong><p class="detail-copy">{{ aiDiagnosisResult.disclaimer || 'AI 分析仅供参考。' }}</p></article>
          </div>
          <div v-else-if="!aiDiagnosisLoading" class="detail-panel empty-state" style="margin-top:12px">发起 AI 辅助分析后，这里会显示问题概述、修改建议和知识点提示。</div>
        </template>
      </div>
    </section>

    <!-- 信息修改 -->
    <section v-show="activeModule === 'student-profile'" class="portal-panel">
      <div class="portal-panel-card">
        <div class="portal-panel-head"><h3>信息修改</h3></div>
        <form class="form-stack profile-form" @submit.prevent="onSaveProfile">
          <label><span>姓名</span><input type="text" v-model="profileForm.fullName" placeholder="请输入姓名"></label>
          <label><span>班级</span><input type="text" v-model="profileForm.className" placeholder="例如：软件工程1班"></label>
          <label><span>旧密码</span><input type="password" v-model="profileForm.oldPassword" placeholder="修改密码时填写"></label>
          <label><span>新密码</span><input type="password" v-model="profileForm.newPassword" placeholder="留空则不修改密码"></label>
          <button type="submit" class="btn btn-primary">保存修改</button>
        </form>
        <div v-if="profileMsg" class="message-box info" style="display:block;margin-top:12px">{{ profileMsg }}</div>
      </div>
    </section>

  </PortalLayout>
</template>
