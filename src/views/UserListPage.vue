<template>
  <div class="main-page" :style="{ zoom: pageZoom }">
    <!-- 顶部栏 -->
    <div class="top-bar">
      <div>
        <h1>用户管理</h1>
        <span>欢迎回来，{{ username }}</span>
      </div>
      <div>
        <el-button type="danger" plain @click="exportCSV">导出Excel</el-button>
        <el-button type="danger" plain @click="$router.push('/report')">统计报表</el-button>
        <el-button type="danger" plain @click="logout">退出登录</el-button>
      </div>
    </div>
    <!-- 统计卡片 -->
    <div class="stats">
      <div class="stat-card" v-for="s in statsCards" :key="s.label">
        <div class="number">{{ s.count }}</div>
        <div class="label">{{ s.label }}</div>
      </div>
    </div>
    <!-- 维度与图表选择 -->
    <div class="dimension-bar">
      <!-- 维度选择 -->
      <template v-if="usesDimension">
        <span>分析维度：</span>
        <el-radio-group v-model="currentDim" size="small">
          <el-radio-button v-for="d in dimOptions" :key="d.value" :label="d.value">{{ d.label }}</el-radio-button>
        </el-radio-group>
      </template>
      <!-- 指标选择 -->
      <template v-if="usesMetric">
        <span style="margin-left:40px;">分析指标：</span>
        <el-radio-group v-model="currentMetric" size="small">
          <el-radio-button label="count">人数</el-radio-button>
          <el-radio-button label="avg">绩效分</el-radio-button>
          <el-radio-button label="avg_attendance">考勤分</el-radio-button>
          <el-radio-button label="edu" v-show="chartType==='funnel'">学历</el-radio-button>
        </el-radio-group>
      </template>
      <!-- 图表类型选择 -->
      <span style="margin-left:auto;">图表类型：</span>
      <el-select v-model="chartType" size="small" style="width:200px;">
        <el-option-group v-for="g in chartGroups" :key="g.label" :label="g.label">
          <el-option v-for="c in g.children" :key="c.value" :label="c.label" :value="c.value" />
        </el-option-group>
      </el-select>
    </div>
    <!-- 面包屑（上卷） -->
    <div v-if="drillPath.length" class="drill-bar">
      <span class="drill-link" @click="drillUp(0)">全部</span>
      <span v-for="(step, i) in drillPath" :key="i">
        <span class="drill-sep"> &gt; </span>
        <span class="drill-link" @click="drillUp(i+1)">{{ step.value }}</span>
      </span>
    </div>
    <!-- 图表 -->
    <div class="charts">
      <div class="chart-box">
        <div v-if="kpiData" class="kpi-grid">
          <div class="kpi-card" v-for="card in kpiData.cards" :key="card.name"
            @click="onChartClick({name:card.name})">
            <div class="kpi-value">{{ card.value }}</div>
            <div class="kpi-label">{{ card.name }}</div>
            <div class="kpi-pct">{{ card.pct }}</div>
            <div class="kpi-metric"> 平均分 </div>
          </div>
        </div>
       <div v-else id="mainChart" :style="{ width:'100%', height:'500px', zoom: 1/pageZoom }"></div>
      </div>
    </div>
    <!-- 搜索框 -->
    <div class="search-bar">
      <el-input placeholder="搜索" v-model="search" @input="drillPath=[];currentPage=1;loadUsers(search)" clearable></el-input>
      <el-button type="danger" plain @click="openPopup('add')">添加用户</el-button>
    </div>
    <!-- 批量删除 -->
    <div v-if="selectedIds.length" class="batch-bar">
      <span>已选 {{ selectedIds.length }} 项</span>
      <el-button size="mini" type="danger" plain @click="batchDelete" style="margin-left:auto;">删除</el-button>
      <el-button size="mini" @click="$refs.userTable.clearSelection()" >取消</el-button>
    </div>
    <!-- 当前页用户 -->
    <el-table :data="pageUsers" style="width:100%" @selection-change="onSelect" ref="userTable">
      <el-table-column type="selection" width="45"></el-table-column>
      <el-table-column label="状态" width="100">
        <template slot-scope="s">
          <el-tag :type="statusTagMap[s.row.status ]">{{ s.row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-for="col in tableCols" :key="col.prop" :prop="col.prop" :label="col.label" :width="col.width"></el-table-column>
      <el-table-column label="操作" width="220">
        <template slot-scope="s">
          <el-button size="mini" type="danger" plain @click="openPopup('detail',s.row)">详情</el-button>
          <el-button size="mini" type="danger" plain @click="openPopup('edit',s.row)">编辑</el-button>
          <el-button size="mini" type="danger" plain @click="deleteUser(s.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页 -->
    <div class="pagination-bar">
      <el-button size="mini" :disabled="currentPage<=1" @click="currentPage=1">首页</el-button>
      <el-button size="mini" :disabled="currentPage<=1" @click="currentPage--">上一页</el-button>
      <span>共 {{ filteredUsers.length }} 条，第 {{ currentPage }}/{{ totalPages }} 页</span>
      <el-button size="mini" :disabled="currentPage>=totalPages" @click="currentPage++">下一页</el-button>
      <el-button size="mini" :disabled="currentPage>=totalPages" @click="currentPage=totalPages">末页</el-button>
    </div>
    <!-- 弹窗 -->
    <el-dialog :title="popupTitles[popupMode]" :visible.sync="dialogVisible" width="500px">
      <div class="popup-grid">
        <div v-for="f in visibleFields" :key="f.key" class="popup-item">
          <div class="popup-label">{{ f.label }}</div>
          <div v-if="popupMode==='detail'" class="popup-value">{{ popupData[f.key] }}</div>
          <el-input v-else-if="!f.options" v-model="popupData[f.key]"></el-input>
          <el-select v-else v-model="popupData[f.key]" style="width:100%;"
            @change="f.key==='department' && (popupData.group = '')">
            <el-option v-for="o in getOptions(f)" :key="o" :value="o" :label="o"></el-option>
          </el-select>
        </div>
      </div>
      <span slot="footer">
        <el-button v-if="popupMode!=='detail'" type="danger" @click="savePopup">{{ popupMode==='add'?'添加':'保存' }}</el-button>
        <el-button @click="dialogVisible=false">关闭</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { FIELDS, DEPTS, GROUPS, DIM_OPTS, DP_MAP, DNS, MYS, TABLECOLS, getLevel, LEVEL_ORDER } from '../utils/userListUtils'
import { getChartOption, CG } from '../utils/chartUtils'
import { exportCSV } from '../utils/exportUtils'
import * as echarts from 'echarts'
import 'echarts-wordcloud'


export default {
  name: 'UserListPage',
  data: function () {
    return {
    pageZoom: 0.8, 
    username: localStorage.getItem('username') || 'admin',
    // 用户数据
    users: [], selectedIds: [], statsCards: [], drillPath: [],
    // 图表
    mainChart: null, currentDim: 'year', currentMetric: 'count', chartType: 'heatmap', kpiData: null,
    // 搜索与分页
    search: '', currentPage: 1, pageSize: 5,
    // 弹窗
    dialogVisible: false, popupMode: null, popupData: {},popupTitles: { detail: '详情', add: '添加用户', edit: '编辑用户' },
    // 配置项（只读）
    fields: FIELDS, chartGroups: CG, dimOptions: DIM_OPTS, tableCols: TABLECOLS,
    statusTagMap: { '活跃': 'success', '未激活': 'info', '已封禁': 'danger' }
  }},

  computed: {
    filteredUsers: function () {// 钻取过滤
      var self = this, result = self.users
      var dp = self.drillPath
      if (dp.length) {
        dp.forEach(function (step) {
          result = result.filter(function (u) {
            return (step.dim === 'level' ? getLevel(u.score) : String(u[step.dim] || '')) === step.value
          })
        })
      }
      return result
    },
    totalPages: function () {// 计算总页数
      return Math.ceil(this.filteredUsers.length / this.pageSize) || 1
    },
    pageUsers: function () {// 当前页用户
      var start = (this.currentPage - 1) * this.pageSize
      return this.filteredUsers.slice(start, start + this.pageSize)
    },
    visibleFields: function () {// 字段显示
      var mode = this.popupMode
      return this.fields.filter(function (f) { return f.modes.indexOf(mode) !== -1 })
    },
    usesDimension: function () {// 显示维度选择器 
      return this.drillPath.length === 0 && DNS.indexOf(this.chartType) === -1// 未钻取 + 图表不在 DNS(不支持维度切换) 列表中 
    },
    usesMetric: function () {// 显示指标选择器 
      return this.drillPath.length === 0 && MYS.indexOf(this.chartType) !== -1// 未钻取 + 图表在 MYS（支持指标切换） 列表中
    }
  },

  watch: {
    users: {
      handler: function () {
        this.updateStats()
        this.renderChart()
      },
      deep: true
    },
    currentDim: function () {// 当前维度改变时，清空钻取，并基于当前的图表类型重新渲染图表
     this.drillPath = []; this.renderChart() 
    },
    currentMetric: function () { // 当前指标改变时，基于当前的图表类型重新渲染图表
     this.renderChart() 
    },
    chartType: function () {// 当前图表类型改变时，基于图表类型重新渲染图表
      if (this.chartType !== 'funnel' && this.currentMetric === 'edu') this.currentMetric = 'count'
      this.drillPath = [] 
      this.renderChart()
    }
  },

  mounted: function () {
  var self = this
  fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
    .then(function (res) { return res.json() })
    .then(function (json) {
      echarts.registerMap('china', json)
      self.loadUsers()
      self.$nextTick(function () { self.initChart() })
    })
    .catch(function () {
      self.loadUsers()
      self.$nextTick(function () { self.initChart() })
    })
},
  beforeDestroy: function () {                       
    if (this.mainChart) {
      this.mainChart.dispose()// 销毁图表实例，释放内存
      this.mainChart = null
    }
    window.removeEventListener('resize', this.handleResize)  // 移除监听
  },

  methods: {
    loadUsers: function (search) {// 加载用户数据（支持过滤）
      var self = this
      var url = '/api/users'
      if (search) url += '?search=' + encodeURIComponent(search)
      fetch(url)
        .then(function (res) { return res.json() })
        .then(function (json) { if (json.success) { self.users = json.data } })
        .catch(function (e) { self.$message.error('加载失败：' + e.message) })
    },

    // ----顶部栏----
    exportCSV: function () {// 导出CSV
      var headers = this.fields.map(function (f) { return f.label })
      var keys = this.fields.map(function (f) { return f.key })
      var rows = this.filteredUsers.map(function (u) {
        return keys.map(function (key) { return u[key] == null ? '' : u[key] })
      })
      exportCSV(headers, rows, '用户数据_' + new Date().toLocaleDateString() + '.csv')
    },
    logout: function () {// 退出登陆
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      this.$router.push('/login')
    },
    // ----统计卡片----
    updateStats: function () {// 更新统计卡片
      var all = this.users
      this.statsCards = [
        { label: '用户总数', count: all.length },
        { label: '活跃用户', count: all.filter(function (u) { return u.status === '活跃' }).length },
        { label: '已封禁用户', count: all.filter(function (u) { return u.status === '已封禁' }).length }
      ]
    },
    // ----图表----
    getDrillKey: function () {// 获取当前维度的下一个钻取层级
      var chain = DP_MAP[this.currentDim]
      return chain[Math.min(this.drillPath.length, chain.length - 1)]
    },
    onChartClick: function (params) {// 图表点击后触发下钻
      if (this.chartType === 'heatmap') {
        var CITY_COMPANY = {
          '成都': '成都总部', '绵阳': '绵阳分部', '重庆': '重庆分部',
          '上海': '上海分部',
          '广州': '广州分部'
        }
        var company = CITY_COMPANY[params.name]
        if (!company) return
        this.drillPath = [{ dim: 'company', value: company }]
        this.currentPage = 1
        return  // 不调用 renderChart → 图表不变
      }
      if (
        this.chartType === 'heatmap'  || this.chartType === 'funnel'||
        this.chartType === 'bar' || this.chartType === 'line'
      ) return // 不支持钻取
      var chain = DP_MAP[this.currentDim]
      if (this.drillPath.length >= chain.length - 1 || !params.name) { return }
      this.drillPath.push({ dim: this.getDrillKey(), value: params.name })
      this.renderChart()
    },
    getDrillUsers: function () {
      var users = this.users
      this.drillPath.forEach(function (step) {
        users = users.filter(function (u) {
          return (step.dim === 'level' ? getLevel(u.score) : String(u[step.dim] || '')) === step.value
        })
      })
      return users
    },
    getData: function (users, dim) {
      var grouped = {}
      users.forEach(function (u) {
        var d = dim === 'level' ? getLevel(u.score) : String(u[dim] || '未知')
        grouped[d] = (grouped[d] || 0) + 1
      })
      if (dim === 'level') {
        var ordered = {}
        LEVEL_ORDER.forEach(function (l) { if (grouped[l] !== undefined) ordered[l] = grouped[l] })
        return ordered
      }
      return grouped
    },
    buildOption: function () {// 配置分发器
      var users = this.getDrillUsers()
      var dim = this.drillPath.length ? this.getDrillKey() : this.currentDim
      if (this.chartType === 'funnel') dim = 'level' // 漏斗强制锁定
      var data = this.getData(users, dim)
      var cats = Object.keys(data), vals = Object.values(data)
      return getChartOption(this.chartType, cats, vals, users, dim, this.currentMetric)
    },
    renderChart: function () {// 渲染图表
      var self = this
      var opt = self.buildOption()
      if (opt.cards) {// KPI指标卡
        self.kpiData = opt
        if (self.mainChart) { self.mainChart.dispose(); self.mainChart = null }
        return
      }
      self.kpiData = null
      var render = function () {
        var el = document.getElementById('mainChart')
        if (!el) return
        if (self.mainChart) { self.mainChart.dispose(); self.mainChart = null }// 销毁旧图表
        self.mainChart = echarts.init(el)// 创建新实例
        self.mainChart.on('click', function (p) { self.onChartClick(p) })// 绑定钻取
        self.mainChart.setOption(opt)
      }
      self.mainChart ? render() : self.$nextTick(render)
    },
    initChart: function () {
      var self = this
      self.renderChart()
      self.handleResize = function () {
        if (self.mainChart) { self.mainChart.resize() }
      }
      window.addEventListener('resize', self.handleResize)
    },
    drillUp: function (index) {// 上卷
      this.drillPath = this.drillPath.slice(0, index)
      this.renderChart()
    },
    // ----批量操作----
    onSelect: function (rows) {// 更新selectedIds数组
      this.selectedIds = rows.map(function (r) { return r.id })
    },
    batchDelete: function () {// 批量删除
      var self = this
      self.$confirm('确定删除选中的' + self.selectedIds.length + '个用户？', '提示', { type: 'warning' })
        .then(function () {
          fetch('/api/users/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: self.selectedIds })
          }).then(function (res) { return res.json() })
            .then(function (json) {
              if (json.success) {
                self.selectedIds = []; self.loadUsers(); 
                self.$nextTick(function () {
                  if (self.currentPage > self.totalPages) self.currentPage = self.totalPages
                })
                self.$message.success('删除成功') 
              }
            })
        }).catch(function () {})
    },
    // ----弹窗----
    openPopup: function (mode, user) {// 打开弹窗
      this.popupMode = mode
      this.dialogVisible = true
      if (mode === 'add') {// 添加用户
        this.popupData = { status: '未激活', role: '员工', address:'绵阳市' }
      } else {
        this.popupData = Object.assign({}, user)
      }
    },
    getOptions: function (f) {// 获取下拉框选项
      if (f.key === 'company')    return f.options
      if (f.key === 'department') return DEPTS[this.popupData.company] || []
      if (f.key === 'group')      return GROUPS[this.popupData.department] || []
      return f.options
    },
    savePopup: function () {// 保存弹窗数据
      var self = this
      if (!self.popupData.name || !self.popupData.email) {
        self.$message.warning('请填写姓名和邮箱')
        return
      }
      if (self.popupMode === 'add') {// 新增用户
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(self.popupData)// 由JavaScript对象 转为 JSON字符串（因为HTTP 请求只能传输文本）
        }).then(function (res) { return res.json() })// res.json是把JSON字符串 转为 JavaScript对象
          .then(function (json) {// json就是res.json（）；前一个 .then 的 return 值，会自动传给下一个 .then 的参数。
            if (json.success) {
              //用后端返回的 id 更新 popupData
              self.popupData.id = json.id
              // 把新用户加入本地数组，避免重新加载
              self.users.unshift(Object.assign({}, self.popupData))
              self.$message.success('添加成功')
              self.dialogVisible = false
            }
          })
      } else {
        fetch('/api/users/' + self.popupData.id, {// 编辑用户
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(self.popupData)
        }).then(function (res) { return res.json() })
          .then(function (json) {
            if (json.success) {
              self.loadUsers();
              self.$message.success('保存成功'); 
              self.dialogVisible = false }
          })
      }
    },
    deleteUser: function (user) {// 删除用户
      var self = this
      self.$confirm('删除「' + user.name + '」？', '提示', { type: 'warning' })
        .then(function () {
          fetch('/api/users/' + user.id, {
             method: 'DELETE' 
          }).then(function (res) { return res.json() })
            .then(function (json) {
              if (json.success) {
                self.loadUsers();
                self.$message.success('删除成功') 
              } 
            })
        }).catch(function () {})
    }
  }
}
</script>

<style scoped>
/* 页面整体 */
.main-page { width: 1500px; margin: 30px auto; background: #16213e; border-radius: 12px; padding: 30px; }
/* 顶部栏 */
.top-bar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid #2a2a4a; margin-bottom: 24px; }
.top-bar h1 { color: #e2e2e2; font-size: 24px; margin: 0; }
.top-bar span { color: #999; font-size: 13px; }
/* 统计卡片 */
.stats { display: flex; gap: 20px; margin-bottom: 20px; }
.stat-card { flex: 1; background: #0f3460; padding: 20px; border-radius: 10px; text-align: center; }
.stat-card .number { color: #e94560; font-size: 30px; font-weight: bold; }
.stat-card .label { color: #d1d1d1; font-size: 15px; margin-top: 5px; }
/* 维度选择 */
.dimension-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 15px; color: #999; font-size: 14px; flex-wrap: wrap; }
/* 面包屑 */
.drill-bar { margin-bottom: 15px; padding: 10px 15px; background: #0f3460; border-radius: 8px; font-size: 14px; }
.drill-link { color: #38bdf8; cursor: pointer; }
.drill-link:hover { text-decoration: underline; }
.drill-sep { color: #666; margin: 0 5px; }
/* 图表 */
.charts { margin-bottom: 20px; }
.chart-box { background: #0f3460; padding: 20px; border-radius: 10px; }
/* KPI指标卡 */
.kpi-grid { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; padding: 30px 10px; }
.kpi-card { flex: 1; min-width: 130px; max-width: 200px; background: #16213e; border-radius: 10px; padding: 20px 10px; text-align: center; border: 1px solid #2a2a4a; cursor: pointer; transition: border-color 0.2s, transform 0.2s; }
.kpi-card:hover { border-color: #38bdf8; transform: translateY(-3px); }
.kpi-value { color: #e94560; font-size: 36px; font-weight: bold; font-family: 'Cormorant Garamond', serif; }
.kpi-label { color: #d1d1d1; font-size: 14px; margin-top: 8px; }
.kpi-pct { color: #38bdf8; font-size: 12px; margin-top: 4px; }
.kpi-metric { color: #666; font-size: 11px; margin-top: 6px; }
/* 搜索与批量 */
.search-bar { display: flex; gap: 10px; margin-bottom: 15px; padding-right: 50px; }
.batch-bar {display: flex;align-items: center;gap: 10px;padding: 12px 16px;margin-bottom: 12px;border-radius: 8px;background: #0f3460;}
.batch-bar span { color: #e2e2e2; font-size: 14px; }
/* 分页 */
.pagination-bar { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 15px; color: #666; font-size: 14px; }
/* 弹窗 */
.popup-label { color: #888; font-size: 14px; margin-bottom: 5px; }
.popup-value { color: #e2e2e2; background: #0f3460; padding: 5px 15px; border-radius: 5px; }
/* 两列网格 */
.popup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; }
.popup-item { margin-bottom: 0; }
/* 邮箱、地址独占一行 */
.popup-full { grid-column: 1 / -1; }
</style>

<style>
/* 确认弹框 */
.el-message-box { background: #16213e; border: 1px solid #2a2a4a; }
.el-message-box__title { color: #e2e2e2; }
.el-message-box__title::before { color: #f0c040; }
.el-message-box__content { color: #d1d1d1; }
.el-message-box__headerbtn .el-message-box__close { color: #999; }
.el-message-box__headerbtn:hover .el-message-box__close { color: #e2e2e2; }
.el-message-box__btns .el-button--default { background: #0f3460; border-color: #2a2a4a; color: #e2e2e2; }
.el-message-box__btns .el-button--default:hover { background: #1a4a8a; border-color: #38bdf8; color: #e2e2e2; }
.el-message-box__btns .el-button--primary { background: #e94560; border-color: #e94560; color: #fff; }
.el-message-box__btns .el-button--primary:hover { background: #ff5a7a; border-color: #ff5a7a; }
.el-message-box__status.el-icon-warning { color: #f0c040; }
.el-message-box__status.el-icon-success { color: #4ecb71; }
.el-message-box__status.el-icon-error { color: #e94560; }
</style>

