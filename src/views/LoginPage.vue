<template>
  <div class="login-container">
    <div class="login-box">
      <h2>用户登录</h2>
      <p class="error-msg">{{ errorMsg }}</p>
      <el-input placeholder="请输入用户名" v-model="username" clearable></el-input>
      <el-input placeholder="请输入密码" v-model="password" show-password></el-input>
      <el-button type="danger" @click="login" style="width:100%;margin-top:10px;">登录</el-button>
      <p class="hint">提示：ad / 123456</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LoginPage',
  data() {
    return {
      username: '',
      password: '',
      errorMsg: ''
    }
  },
  methods: {
    login() {
      if (this.username === 'ad' && this.password === '123456') {
        this.errorMsg = ''
        localStorage.setItem('token', 'admin-token')
        localStorage.setItem('username', this.username) 
        this.$router.push('/')
      } else if (!this.username || !this.password) {
        this.errorMsg = '请输入用户名和密码'
      } else {
        this.errorMsg = '用户名或密码错误'
      }
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #1a1a2e;
}
.login-box {
  background: #16213e;
  width: 400px;
  padding: 30px;
  border-radius: 10px;
}
.login-box h2 {
  color: #e2e2e2;
  text-align: center;
  margin-bottom: 30px;
}
.error-msg {
  color: #e94560;
  font-size: 14px;
  text-align: center;
  margin-bottom: 10px;
  min-height: 20px;
}
.hint {
  text-align: center;
  color: #666;
  font-size: 12px;
  margin-top: 20px;
}
</style>
