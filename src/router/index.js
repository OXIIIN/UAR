import Vue from 'vue'
import VueRouter from 'vue-router'
import LoginPage from '../views/LoginPage.vue'
import UserListPage from '../views/UserListPage.vue'
import ReportPage from '../views/ReportPage.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginPage,
    meta: { title: '登录' }
  },
  {
    path: '/',
    name: 'UserList',
    component: UserListPage,
    meta: { title: '用户管理', requiresAuth: true }     
  },
  {
    path: '/report',
    name: 'Report',
    component: ReportPage,
    meta: { title: '统计报表', requiresAuth: true }     
  }
]

const router = new VueRouter({
  mode: 'history',
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title || '用户管理系统'
  const isLoggedIn = !!localStorage.getItem('token')
  if (to.meta.requiresAuth && !isLoggedIn) {
    next('/login')          // 未登录 → 赶到登录页
  } else if (to.path === '/login' && isLoggedIn) {
    next('/')               // 已登录访问登录页 → 重定向主页
  } else {
    next()
  }
})

export default router