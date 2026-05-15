import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
  { path: '/admin', component: () => import('@/views/AdminView.vue'), meta: { role: 'ADMIN' } },
  { path: '/teacher', component: () => import('@/views/TeacherView.vue'), meta: { role: 'TEACHER' } },
  { path: '/student', component: () => import('@/views/StudentView.vue'), meta: { role: 'STUDENT' } },
  { path: '/:pathMatch(.*)*', redirect: '/login' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.public) return true
  if (!auth.token) return '/login'
  if (to.meta.role && auth.role !== to.meta.role) {
    return roleHome(auth.role)
  }
  return true
})

export function roleHome(role) {
  if (role === 'ADMIN') return '/admin'
  if (role === 'TEACHER') return '/teacher'
  return '/student'
}

export default router
