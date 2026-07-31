<template>
  <div class="main-page" :style="{ zoom: pageZoom }">
    <!-- 顶部栏 -->
    <div class="top-bar">
      <div>
        <h1>数据管理</h1>
        <span>欢迎回来，{{ username }}</span>
      </div>
      <div>
        <el-button type="danger" plain @click="exportCSV">导出Excel</el-button>
        <el-button type="danger" plain @click="$router.push('/report')">统计报表</el-button>
        <el-button type="danger" plain @click="logout">退出登录</el-button>
      </div>
    </div>

    <!-- 维度与图表选择 -->
    <div class="dimension-bar">
      <template v-if="usesDimension">
        <span>分析维度：</span>
        <el-radio-group v-model="currentDim" size="small">
          <el-radio-button v-for="d in dimOptions" :key="d.value" :label="d.value">{{ d.label }}</el-radio-button>
        </el-radio-group>
      </template>
      <template v-if="usesMetric">
        <span style="margin-left:40px;">分析指标：</span>
        <el-radio-group v-model="currentMetric" size="small">
          <el-radio-button label="count">员工数</el-radio-button>
          <el-radio-button label="avg">人均绩效</el-radio-button>
          <el-radio-button label="hyl">活跃率</el-radio-button>
        </el-radio-group>
      </template>
      <span style="margin-left:auto;">图表类型：</span>
      <el-select v-model="chartType" size="small" style="width:200px;">
        <el-option-group v-for="g in chartGroups" :key="g.label" :label="g.label">
          <el-option v-for="c in g.children" :key="c.value" :label="c.label" :value="c.value" />
        </el-option-group>
      </el-select>
    </div>

    <!-- 面包屑 -->
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
            <div class="kpi-metric">人均绩效</div>
          </div>
        </div>
        <div v-else id="mainChart" :style="{ width:'100%', height:'500px', zoom: 1/pageZoom }"></div>
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="search-bar">
      <el-input placeholder="搜索" v-model="search" @input="drillPath=[];currentPage=1;loadUsers(search)" clearable></el-input>
      <el-button type="danger" plain @click="openPopup('add')">添加记录</el-button>
    </div>

    <!-- 批量删除 -->
    <div v-if="selectedIds.length" class="batch-bar">
      <span>已选 {{ selectedIds.length }} 项</span>
      <el-button size="mini" type="danger" plain @click="batchDelete" style="margin-left:auto;">删除</el-button>
      <el-button size="mini" @click="$refs.userTable.clearSelection()">取消</el-button>
    </div>

    <!-- 表格 -->
    <el-table :data="pageUsers" style="width:100%" @selection-change="onSelect" ref="userTable">
      <el-table-column type="selection" width="45"></el-table-column>
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
          <el-select v-else v-model="popupData[f.key]" style="width:100%;">
            <el-option v-for="o in getOptions(f)" :key="o" :value="o" :label="o"></el-option>
          </el-select>
        </div>
      </div>

      <!-- 关联指标 -->
      <div v-if="popupMode==='detail'" class="indicator-section">
        <div class="indicator-title">关联指标</div>
        <div v-if="indicatorLoading" class="indicator-empty">加载中...</div>
        <div v-else-if="!indicatorData.length" class="indicator-empty">暂无关联指标</div>
        <div v-else class="indicator-grid">
          <div class="indicator-card" v-for="ind in indicatorData" :key="ind.jxkey"
            :class="{'type-mgmt': ind.jxlx === '管理类'}">
            <div class="ind-type">{{ ind.jxlx }}</div>
            <div class="ind-title">{{ ind.title }}</div>
            <div class="ind-value">{{ ind.value }}<span class="ind-unit">{{ ind.jldw }}</span></div>
          </div>
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
import { FIELDS, DIM_OPTS, DP_MAP, DNS, MYS, TABLECOLS, getOrgLevel, LEVEL_ORDER } from '../utils/userListUtils'
import { getChartOption, CG } from '../utils/chartUtils'
import { exportCSV } from '../utils/exportUtils'
import * as echarts from 'echarts'
import 'echarts-wordcloud'

var ORG_CODE_MAP = {
  '成都总部':'001','技术部':'001001','产品部':'001002',
  '前端组':'001001001','后端组':'001001002','运维组':'001001003',
  '产品组':'001002001','设计组':'001002002',
  '重庆分部':'002','运营部':'002001','客服部':'002002',
  '策划组':'002001001','执行组':'002001002',
  '售前组':'002002001','售后组':'002002002',
  '绵阳分部':'003','研发部':'003001',
  '移动组':'003001001','平台组':'003001002',
  '上海分部':'004','市场部':'004001',
  '推广组':'004001001','调研组':'004001002',
  '广州分部':'005','销售部':'005001',
  '演示组':'005001001','渠道组':'005001002'
}
var RW_MAP = { '年度绩效考核':'RWLX001','专项技能评估':'RWLX002' }
var XM_MAP = { '项目A':'XM001','项目B':'XM002','项目C':'XM003' }

export default {
  name: 'UserListPage',
  data: function () {
    return {
      pageZoom: 0.8,
      username: localStorage.getItem('username') || 'admin',
      users: [], selectedIds: [], drillPath: [],
      mainChart: null, currentDim: 'ZZDWMC', currentMetric: 'count', chartType: 'heatmap', kpiData: null,
      search: '', currentPage: 1, pageSize: 5,
      dialogVisible: false, popupMode: null, popupData: {},
      popupTitles: { detail: '详情', add: '添加记录', edit: '编辑记录' },
      fields: FIELDS, chartGroups: CG, dimOptions: DIM_OPTS, tableCols: TABLECOLS,
      locations: [], orgTargets: {},
      indicatorData: [], indicatorLoading: false,
      forceChartType: null
    }
  },

  computed: {
    filteredUsers: function () { return this.getDrillRows() },
    totalPages: function () { return Math.ceil(this.filteredUsers.length / this.pageSize) || 1 },
    pageUsers: function () {
      var start = (this.currentPage - 1) * this.pageSize
      return this.filteredUsers.slice(start, start + this.pageSize)
    },
    visibleFields: function () {
      var mode = this.popupMode
      return this.fields.filter(function (f) { return f.modes.indexOf(mode) !== -1 })
    },
    usesDimension: function () {
      return this.drillPath.length === 0 && DNS.indexOf(this.chartType) === -1
    },
    usesMetric: function () {
      return this.drillPath.length === 0 && MYS.indexOf(this.chartType) !== -1
    }
  },

  watch: {
    users: { handler: function () { this.renderChart() }, deep: true },
    currentDim: function () { this.drillPath = []; this.forceChartType = null; this.renderChart() },
    currentMetric: function () { this.renderChart() },
    chartType: function () { this.forceChartType = null; this.drillPath = []; this.renderChart() }
  },

  mounted: function () {
    var self = this
    fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
      .then(function (res) { return res.json() })
      .then(function (json) {
        echarts.registerMap('china', json)
        self.loadUsers(); self.loadLocations(); self.loadDict()
        self.$nextTick(function () { self.initChart() })
      })
      .catch(function () {
        self.loadUsers(); self.loadLocations(); self.loadDict()
        self.$nextTick(function () { self.initChart() })
      })
  },

  beforeDestroy: function () {
    if (this.mainChart) { this.mainChart.dispose(); this.mainChart = null }
    window.removeEventListener('resize', this.handleResize)
  },

  methods: {
    // ==================== 数据加载 ====================
    loadUsers: function (search) {
      var self = this
      var url = '/api/users'
      if (search) url += '?search=' + encodeURIComponent(search)
      fetch(url).then(function (res) { return res.json() })
        .then(function (json) { if (json.success) self.users = json.data })
        .catch(function (e) { self.$message.error('加载失败：' + e.message) })
    },
    loadLocations: function () {
      var self = this
      fetch('/api/locations')
        .then(function (res) { return res.json() })
        .then(function (json) { if (json.success) self.locations = json.data })
        .catch(function () {})
    },
    loadDict: function () {
      var self = this
      fetch('/api/dict/RYLBMC').then(function (r) { return r.json() })
        .then(function (j) {
          var opts = (j.success && j.data.length) ? j.data.map(function (d) { return d.MC }) : ['普通','骨干','核心']
          var f = self.fields.find(function (f) { return f.key === 'RYLBMC' })
          if (f) self.$set(f, 'options', opts)
        }).catch(function () {})
      fetch('/api/dict/GLJG').then(function (r) { return r.json() })
        .then(function (j) {
          var opts = (j.success && j.data.length) ? j.data.map(function (d) { return d.MC }) : ['集团总部','战略投资部','区域管理中心']
          var f = self.fields.find(function (f) { return f.key === 'GLJGMC' })
          if (f) self.$set(f, 'options', opts)
        }).catch(function () {})
      fetch('/api/dict/JXSJ').then(function (r) { return r.json() })
        .then(function (j) {
          if (j.success) {
            var t = {}
            j.data.forEach(function (d) { if (d.NM) t[d.NM] = Number(d.MC) })
            self.orgTargets = t
          }
        }).catch(function () {})
    },
    loadIndicators: function (zzdwnm) {
      var self = this
      if (!zzdwnm) { self.indicatorData = []; return }
      self.indicatorLoading = true; self.indicatorData = []
      fetch('/api/indicators?zzdwnm=' + encodeURIComponent(zzdwnm))
        .then(function (r) { return r.json() })
        .then(function (j) {
          self.indicatorLoading = false
          if (!j.success || !j.data || !j.data.length) return
          var grouped = {}
          j.data.forEach(function (row) {
            if (!row.JXKEY) return
            if (!grouped[row.JXKEY]) grouped[row.JXKEY] = {}
            if (row.TYPE) grouped[row.JXKEY][row.TYPE] = row.VALUE
          })
          self.indicatorData = Object.keys(grouped).map(function (key) {
            var g = grouped[key]
            return { jxkey: key, jxlx: g.jxlx || '', title: g.title || '', value: g.value || '-', jldw: g.jldw || '' }
          })
        }).catch(function () { self.indicatorLoading = false })
    },

    // ==================== 顶部栏 ====================
    exportCSV: function () {
      var headers = this.fields.map(function (f) { return f.label })
      var keys = this.fields.map(function (f) { return f.key })
      var rows = this.filteredUsers.map(function (r) {
        return keys.map(function (key) { return r[key] == null ? '' : r[key] })
      })
      exportCSV(headers, rows, '数据导出_' + new Date().toLocaleDateString() + '.csv')
    },
    logout: function () {
      localStorage.removeItem('token'); localStorage.removeItem('username')
      this.$router.push('/login')
    },

    // ==================== 图表与钻取 ====================

    // 获取下一个钻取维度（智能判断：最深层组织 → RYLBMC）
    getDrillKey: function () {
      var chain = DP_MAP[this.currentDim]
      var idx = Math.min(this.drillPath.length, chain.length - 1)
      if (this.drillPath.length > 0) {
        var last = this.drillPath[this.drillPath.length - 1]
        if (last.dim === 'ZZDWMC' && last.zzdwnm) {
          var prefix = last.zzdwnm
          var childLen = prefix.length + 3
          var hasChildren = this.users.some(function (r) {
            return r.ZZDWNM && String(r.ZZDWNM).indexOf(prefix) === 0 && String(r.ZZDWNM).length === childLen
          })
          if (!hasChildren) return 'RYLBMC'
        }
      }
      return chain[idx]
    },

    // 图表点击 → 钻取
    onChartClick: function (params) {
  if (!params.name) return
  var self = this
  var effType = self.forceChartType || self.chartType

  // 热力图：点击后进入组织钻取
  if (effType === 'heatmap') {
    var topRow = self.users.find(function (r) {
      return r.ZZDWMC === params.name && r.ZZDWNM && String(r.ZZDWNM).length <= 3
    })
    if (!topRow) return
    self.drillPath = [{ dim: 'ZZDWMC', value: params.name, zzdwnm: topRow.ZZDWNM }]
    self.currentPage = 1
    self.forceChartType = 'pie'
    self.renderChart()
    return
  }

  // 不支持钻取的图表类型
  if (['funnel', 'bar', 'line'].indexOf(effType) !== -1) return

  var chain = DP_MAP[self.currentDim]
  if (self.drillPath.length >= chain.length - 1) return

  var nextDim = self.getDrillKey()

  if (nextDim === 'ZZDWMC') {
    // 组织钻取：需要找到被点击行的 ZZDWNM 用于子级匹配
    var currentRows = self.getDrillRows()
    var clicked = currentRows.find(function (r) { return r.ZZDWMC === params.name })
    if (!clicked || !clicked.ZZDWNM) return
    self.drillPath.push({ dim: 'ZZDWMC', value: params.name, zzdwnm: clicked.ZZDWNM })
  } else {
    // 其他维度（ND / XMMC / RWMC / RYLBMC）：直接用点击值过滤
    self.drillPath.push({ dim: nextDim, value: params.name })
  }

  self.currentPage = 1
  self.renderChart()
},

    // 根据钻取路径过滤数据行
    // 规则：组织钻取用编码前缀匹配子级，无子级时回退到本级
    getDrillRows: function () {
      var rows = this.users
      var orgDrill = null
      this.drillPath.forEach(function (step) {
        if (step.dim === 'ZZDWMC' && step.zzdwnm) {
          orgDrill = step
        } else {
          rows = rows.filter(function (r) { return String(r[step.dim] || '') === step.value })
        }
      })
      if (orgDrill) {
        var prefix = orgDrill.zzdwnm
        var childLen = prefix.length + 3
        var children = rows.filter(function (r) {
          return r.ZZDWNM && String(r.ZZDWNM).indexOf(prefix) === 0 && String(r.ZZDWNM).length === childLen
        })
        if (children.length > 0) return children
        // 无子级 → 返回本级数据（用于 RYLBMC 展示）
        return rows.filter(function (r) { return r.ZZDWNM && String(r.ZZDWNM) === prefix })
      }
      return rows
    },

    getData: function (rows, dim) {
      var grouped = {}
      var useRows = rows
      var hasOrgDrill = this.drillPath.some(function (s) { return s.dim === 'ZZDWMC' && s.zzdwnm })
      if (dim === 'ZZDWMC' && !hasOrgDrill) {
        useRows = rows.filter(function (r) { return r.ZZDWNM && String(r.ZZDWNM).length <= 3 })
      }
      useRows.forEach(function (r) {
        var d
        if (dim === 'orgLevel') d = getOrgLevel(r.ZZDWNM)
        else if (dim === 'RYLBMC') d = String(r.RYLBMC || '未知')
        else d = String(r[dim] || '未知')
        grouped[d] = (grouped[d] || 0) + Number(r.RYZS || 0)
      })
      if (dim === 'orgLevel') {
        var ordered = {}
        LEVEL_ORDER.forEach(function (l) { if (grouped[l] !== undefined) ordered[l] = grouped[l] })
        return ordered
      }
      return grouped
    },

    buildOption: function () {
      var rows = this.getDrillRows()
      var dim = this.drillPath.length ? this.getDrillKey() : this.currentDim
      var chartType = this.forceChartType || this.chartType
      if (chartType === 'funnel') dim = 'orgLevel'
      if (chartType === 'kpi') {
        rows = rows.filter(function (r) { return r.ZZDWNM && String(r.ZZDWNM).length <= 3 })
        dim = 'ZZDWMC'
      }
      var data = this.getData(rows, dim)
      var cats = Object.keys(data), vals = Object.values(data)
      return getChartOption(chartType, cats, vals, rows, dim, this.currentMetric, this.locations)
    },

    renderChart: function () {
      var self = this
      var opt = self.buildOption()
      if (opt.cards) {
        self.kpiData = opt
        if (self.mainChart) { self.mainChart.dispose(); self.mainChart = null }
        return
      }
      self.kpiData = null
      var render = function () {
        var el = document.getElementById('mainChart')
        if (!el) return
        if (self.mainChart) { self.mainChart.dispose(); self.mainChart = null }
        self.mainChart = echarts.init(el)
        self.mainChart.on('click', function (p) { self.onChartClick(p) })
        self.mainChart.setOption(opt)
      }
      self.mainChart ? render() : self.$nextTick(render)
    },

    initChart: function () {
      var self = this
      self.renderChart()
      self.handleResize = function () { if (self.mainChart) self.mainChart.resize() }
      window.addEventListener('resize', self.handleResize)
    },

    drillUp: function (index) {
      this.drillPath = this.drillPath.slice(0, index)
      if (index === 0) this.forceChartType = null
      this.renderChart()
    },

    // ==================== 批量操作 ====================
    onSelect: function (rows) { this.selectedIds = rows.map(function (r) { return r.id }) },
    batchDelete: function () {
      var self = this
      self.$confirm('确定删除选中的' + self.selectedIds.length + '条记录？', '提示', { type: 'warning' })
        .then(function () {
          fetch('/api/users/batch-delete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: self.selectedIds })
          }).then(function (res) { return res.json() })
            .then(function (json) {
              if (json.success) {
                self.selectedIds = []; self.loadUsers()
                self.$nextTick(function () { if (self.currentPage > self.totalPages) self.currentPage = self.totalPages })
                self.$message.success('删除成功')
              }
            })
        }).catch(function () {})
    },

    // ==================== 弹窗 ====================
    openPopup: function (mode, row) {
      this.popupMode = mode; this.dialogVisible = true
      if (mode === 'add') {
        this.popupData = { ND: 2025, GLJGMC: '集团总部', RWMC: '年度绩效考核', XMMC: '项目A', RYLBMC: '普通', DWGS: '0',
          RYZS: 0, JXZF: 0, HYRS: 0, HYJXZF: 0, WJHRS: 0, WJHJXZF: 0, YFBRS: 0, YFBJXZF: 0, DCRS: 0, DCJXZF: 0, HYL: 0, JXPJFL: 0 }
        this.indicatorData = []
      } else {
        this.popupData = Object.assign({}, row)
        if (mode === 'detail') this.loadIndicators(row.ZZDWNM)
      }
    },
    getOptions: function (f) { return f.options || [] },
    savePopup: function () {
      var self = this
      if (!self.popupData.ZZDWMC) { self.$message.warning('请选择单位名称'); return }
      var code = ORG_CODE_MAP[self.popupData.ZZDWMC]
      if (code) {
        self.popupData.ZZDWNM = code; self.popupData.ZZDWXH = code
        self.popupData.PARENTID = code.length > 3 ? code.substring(0, code.length - 3) : null
      }
      var GLJG_MAP = { '集团总部':'GLJG001', '战略投资部':'GLJG002', '区域管理中心':'GLJG003' }
      self.popupData.GLJG = GLJG_MAP[self.popupData.GLJGMC] || 'GLJG001'
      self.popupData.GLJGXH = self.popupData.GLJG
      self.popupData.RWLXNM = RW_MAP[self.popupData.RWMC] || ''
      self.popupData.XMID = XM_MAP[self.popupData.XMMC] || ''
      if (self.popupMode === 'add') {
        fetch('/api/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(self.popupData)
        }).then(function (res) { return res.json() })
          .then(function (json) {
            if (json.success) { self.popupData.id = json.id; self.users.unshift(Object.assign({}, self.popupData)); self.$message.success('添加成功'); self.dialogVisible = false }
          })
      } else {
        fetch('/api/users/' + self.popupData.id, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(self.popupData)
        }).then(function (res) { return res.json() })
          .then(function (json) { if (json.success) { self.loadUsers(); self.$message.success('保存成功'); self.dialogVisible = false } })
      }
    },
    deleteUser: function (row) {
      var self = this
      self.$confirm('删除「' + row.ZZDWMC + '」（' + row.ND + '）？', '提示', { type: 'warning' })
        .then(function () {
          fetch('/api/users/' + row.id, { method: 'DELETE' })
            .then(function (res) { return res.json() })
            .then(function (json) { if (json.success) { self.loadUsers(); self.$message.success('删除成功') } })
        }).catch(function () {})
    }
  }
}
</script>

<style scoped>
.main-page { width: 1500px; margin: 30px auto; background: #16213e; border-radius: 12px; padding: 30px; }
.top-bar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid #2a2a4a; margin-bottom: 24px; }
.top-bar h1 { color: #e2e2e2; font-size: 24px; margin: 0; }
.top-bar span { color: #999; font-size: 13px; }
.dimension-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 15px; color: #999; font-size: 14px; flex-wrap: wrap; }
.drill-bar { margin-bottom: 15px; padding: 10px 15px; background: #0f3460; border-radius: 8px; font-size: 14px; }
.drill-link { color: #38bdf8; cursor: pointer; }
.drill-link:hover { text-decoration: underline; }
.drill-sep { color: #666; margin: 0 5px; }
.charts { margin-bottom: 20px; }
.chart-box { background: #0f3460; padding: 20px; border-radius: 10px; }
.kpi-grid { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; padding: 30px 10px; }
.kpi-card { flex: 1; min-width: 130px; max-width: 200px; background: #16213e; border-radius: 10px; padding: 20px 10px; text-align: center; border: 1px solid #2a2a4a; cursor: pointer; transition: border-color 0.2s, transform 0.2s; }
.kpi-card:hover { border-color: #38bdf8; transform: translateY(-3px); }
.kpi-value { color: #e94560; font-size: 36px; font-weight: bold; font-family: 'Cormorant Garamond', serif; }
.kpi-label { color: #d1d1d1; font-size: 14px; margin-top: 8px; }
.kpi-pct { color: #38bdf8; font-size: 12px; margin-top: 4px; }
.kpi-metric { color: #666; font-size: 11px; margin-top: 6px; }
.search-bar { display: flex; gap: 10px; margin-bottom: 15px; padding-right: 50px; }
.batch-bar { display: flex; align-items: center; gap: 10px; padding: 12px 16px; margin-bottom: 12px; border-radius: 8px; background: #0f3460; }
.batch-bar span { color: #e2e2e2; font-size: 14px; }
.pagination-bar { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 15px; color: #666; font-size: 14px; }
.popup-label { color: #888; font-size: 14px; margin-bottom: 5px; }
.popup-value { color: #e2e2e2; background: #0f3460; padding: 5px 15px; border-radius: 5px; }
.popup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; }
.indicator-section { margin-top: 20px; padding-top: 16px; border-top: 1px solid #2a2a4a; }
.indicator-title { color: #38bdf8; font-size: 14px; font-weight: bold; margin-bottom: 12px; }
.indicator-grid { display: flex; gap: 12px; flex-wrap: wrap; }
.indicator-card { flex: 1; min-width: 140px; background: #0d1b2e; border-radius: 8px; padding: 12px; border-left: 3px solid #38bdf8; }
.indicator-card.type-mgmt { border-left-color: #4ecb71; }
.ind-type { color: #888; font-size: 11px; margin-bottom: 4px; }
.ind-title { color: #d1d1d1; font-size: 13px; margin-bottom: 8px; }
.ind-value { color: #e94560; font-size: 24px; font-weight: bold; }
.ind-unit { color: #888; font-size: 12px; margin-left: 4px; font-weight: normal; }
.indicator-empty { color: #666; font-size: 13px; padding: 10px 0; }
</style>

<style>
.el-message-box { background: #16213e; border: 1px solid #2a2a4a; }
.el-message-box__title { color: #e2e2e2; }
.el-message-box__content { color: #d1d1d1; }
.el-message-box__headerbtn .el-message-box__close { color: #999; }
.el-message-box__headerbtn:hover .el-message-box__close { color: #e2e2e2; }
.el-message-box__btns .el-button--default { background: #0f3460; border-color: #2a2a4a; color: #e2e2e2; }
.el-message-box__btns .el-button--default:hover { background: #1a4a8a; border-color: #38bdf8; color: #e2e2e2; }
.el-message-box__btns .el-button--primary { background: #e94560; border-color: #e94560; color: #fff; }
.el-message-box__btns .el-button--primary:hover { background: #ff5a7a; border-color: #ff5a7a; }
.el-message-box__status.el-icon-warning { color: #f0c040; }
</style>