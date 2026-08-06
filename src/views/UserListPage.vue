<template>
  <div class="main-page" :style="{ zoom: pageZoom }">
    <!-- 顶部栏 -->
    <div class="top-bar">
      <div>
        <h1>UAR</h1>
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
      <template v-if="visDim">
        <span>分析维度：</span>
        <el-radio-group v-model="currentDim" size="small">
          <el-radio-button v-for="d in dimOptions" :key="d.value" :label="d.value">{{ d.label }}</el-radio-button>
        </el-radio-group>
      </template>
      <template v-if="visMet">
        <span style="margin-left:40px;">分析指标：</span>
        <el-radio-group v-model="currentMet" size="small">
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
      <el-input placeholder="搜索" v-model="search" @input="onSearch" clearable></el-input>
      <el-button type="danger" plain @click="openPopup('add')">添加</el-button>
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
      <el-table-column v-for="col in tableCols" :key="col.prop" :prop="col.prop" :label="col.label" :width="col.width" :min-width="col.minWidth" :align="col.align || 'left'"></el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
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
      <span>共 {{ filteredRows.length }} 条，第 {{ currentPage }}/{{ totalPages }} 页</span>
      <el-button size="mini" :disabled="currentPage>=totalPages" @click="currentPage++">下一页</el-button>
      <el-button size="mini" :disabled="currentPage>=totalPages" @click="currentPage=totalPages">末页</el-button>
    </div>

    <!-- 弹窗 -->
    <el-dialog :title="popupTitles[popupMode]" :visible.sync="visPop" width="500px">
      <div class="popup-grid">
        <div v-for="f in visFields" :key="f.key" class="popup-item">
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
        <div v-if="jxLoading" class="indicator-empty">加载中...</div>
        <div v-else-if="!jxData.length" class="indicator-empty">暂无关联指标</div>
        <div v-else class="indicator-grid">
          <div class="indicator-card" v-for="ind in jxData" :key="ind.jxkey"
            :class="{'type-mgmt': ind.jxlx === '管理类'}">
            <div class="ind-type">{{ ind.jxlx }}</div>
            <div class="ind-title">{{ ind.title }}</div>
            <div class="ind-value">{{ ind.value }}<span class="ind-unit">{{ ind.jldw }}</span></div>
          </div>
        </div>
      </div>

      <span slot="footer">
        <el-button v-if="popupMode!=='detail'" type="danger" @click="savePopup">{{ popupMode==='add'?'确认添加':'确认保存' }}</el-button>
        <el-button @click="visPop=false">关闭</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { FIELDS,POP_TITLES, DIM_OPTS, DP_MAP, DNS, ND, MYS, TABLECOLS, LEVEL_ORDER,
       } from '../utils/userListUtils'
import { getChartOption, getOrgLevel, CG } from '../utils/chartUtils'
import { exportCSV } from '../utils/exportUtils'
import * as echarts from 'echarts'
import 'echarts-wordcloud'


export default {
  name: 'UserListPage',
  data: function () {
    return {
      // ---- 页面基础 ----
      searchTimer: null,
      pageZoom: 0.8,                  // 页面缩放比例
      username: localStorage.getItem('username') || 'admin',

      // ---- 数据源 ----
      users: [],                      // 全量数据行（从 /api/users 加载）
      locations: [],                  // 经纬度数据（从 /api/locations 加载，供热力图使用）
      orgTargets: {},                 // 绩效目标值（从 /api/dict/JXMB 加载，供组合图虚线使用）

      // ---- 图表相关 ----
      mainChart: null,                // ECharts 实例
      currentDim: 'ZZDWMC',           // 当前分析维度
      currentMet: 'count',            // 当前分析指标
      chartType: 'heatmap',           // 当前图表类型
      fChartType: null,           // 钻取时强制切换的图表类型（热力图点击后强制 pie）
      kpiData: null,                  // KPI 指标卡数据（非 null 时隐藏 ECharts，显示卡片）

      // ---- 钻取相关 ----
      drillPath: [],                  // 钻取路径，如 [{dim:'ZZDWMC', value:'成都总部', zzdwnm:'001'}]

      // ---- 搜索与分页 ----
      search: '',                     // 搜索关键词
      currentPage: 1,                 // 当前页码
      pageSize: 5,                    // 每页条数
      selectedIds: [],                // 表格中勾选的行 id 数组

      // ---- 弹窗相关 ----
      visPop: false,                  // 弹窗是否可见
      popupMode: null,                // 弹窗模式：'add' / 'edit' / 'detail'
      popupData: {},                  // 弹窗中编辑的行数据
      popupTitles: POP_TITLES,        // 弹窗标题
      jxData: [],                     // 关联指标数据（详情弹窗中展示）
      jxLoading: false,               // 关联指标加载状态
      codeMaps: { org: {}, rw: {}, xm: {}, gljg: {} },

      // ---- 配置（来自工具文件，不可变） ----
      fields: JSON.parse(JSON.stringify(FIELDS)),      // 弹窗表单字段配置
      chartGroups: CG,                // 图表类型下拉菜单分组
      dimOptions: DIM_OPTS,           // 维度选项
      tableCols: TABLECOLS            // 表格列配置
    }
  },

  computed: {
     filteredRows: function () {
    return this.getDrillRows()
  },
    totalPages: function () { // 总页数
      return Math.ceil(this.getDrillRows().length / this.pageSize) || 1
    },

    pageUsers: function () {// 当前页的数据
      var start = (this.currentPage - 1) * this.pageSize
      return this.getDrillRows().slice(start, start + this.pageSize)
    },

    visFields: function () {// 弹窗中可见的字段（根据 popupMode 过滤）
      var mode = this.popupMode
      return this.fields.filter(function (f) { return f.modes.indexOf(mode) !== -1 })
    },

    visDim: function () {// 是否显示"分析维度"选择器
      return this.drillPath.length === 0 && DNS.indexOf(this.chartType) === -1
    },
    
    visMet: function () {// 是否显示"分析指标"选择器
      return this.drillPath.length === 0 && MYS.indexOf(this.chartType) !== -1
    }
  },

  watch: {
    users: { handler: function () { // 数据变化时重绘图表
      this.renderChart() 
      },
    },

    currentDim: function () {// 维度切换时重置钻取路径，清除强制图表类型，重绘
      this.drillPath = []
      this.fChartType = null
      this.renderChart()
    },

    
    currentMet: function () {// 指标切换时重绘
      this.renderChart() 
    },

    chartType: function () {// 图表类型切换时重置钻取路径，清除强制图表类型，重绘
      this.fChartType = null
      this.drillPath = []
      this.renderChart()
    }
  },

  mounted: function () {// 加载中国地图 GeoJSON
    var self = this
    fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
      .then(function (res) { return res.json() })
      .then(function (json) { echarts.registerMap('china', json) })
      .catch(function () {})   // 地图加载失败不阻塞（热力图会降级为无底图）
      .then(function () {
        self.loadDict()
        return Promise.all([self.loadUsers(), self.loadLocations()])
      })
      .then(function () {
        self.buildCodeMaps() 
        self.$nextTick(function () { self.initChart() })
      })
  },

  beforeDestroy: function () { // 组件销毁前清理资源：释放 ECharts 实例、移除窗口 resize 监听
    if (this.mainChart) {
      this.mainChart.dispose()
      this.mainChart = null
    }
    window.removeEventListener('resize', this.handleResize)
  },


  methods: {

    // ================================================================
    //  数据加载
    // ================================================================
    onSearch: function () {
  var self = this
  self.drillPath = []
  self.currentPage = 1
  clearTimeout(self.searchTimer)
  self.searchTimer = setTimeout(function () {
    self.loadUsers(self.search)
  }, 300)
},
    buildCodeMaps: function () {
  var orgMap = {}, rwMap = {}, xmMap = {}, gljgMap = {}
  var ndSet = {}, orgSet = {}, rwSet = {}, xmSet = {}, rylbSet = {}, gljgSet = {}
  this.users.forEach(function (r) {
    if (r.ZZDWMC && r.ZZDWNM) { orgMap[r.ZZDWMC] = r.ZZDWNM; orgSet[r.ZZDWMC] = 1 }
    if (r.RWMC && r.RWLXNM)   { rwMap[r.RWMC] = r.RWLXNM;     rwSet[r.RWMC] = 1 }
    if (r.XMMC && r.XMID)     { xmMap[r.XMMC] = r.XMID;       xmSet[r.XMMC] = 1 }
    if (r.GLJGMC && r.GLJG)   { gljgMap[r.GLJGMC] = r.GLJG;   gljgSet[r.GLJGMC] = 1 }
    if (r.ND)    ndSet[r.ND] = 1
    if (r.RYLBMC) rylbSet[r.RYLBMC] = 1
  })
  this.codeMaps = { org: orgMap, rw: rwMap, xm: xmMap, gljg: gljgMap }

  // 动态更新所有下拉选项
  var self = this
  var fieldOpts = {
    'ZZDWMC': Object.keys(orgSet),
    'ND':     Object.keys(ndSet).sort(),
    'GLJGMC': Object.keys(gljgSet),
    'RWMC':   Object.keys(rwSet),
    'XMMC':   Object.keys(xmSet),
    'RYLBMC': Object.keys(rylbSet)
  }
  Object.keys(fieldOpts).forEach(function (key) {
    var f = self.fields.find(function (f) { return f.key === key })
    if (f && fieldOpts[key].length) self.$set(f, 'options', fieldOpts[key])
  })
},

    loadUsers: function (search) {// 加载主数据
      var self = this
      var url = '/api/users'
      if (search) url += '?search=' + encodeURIComponent(search)
      return fetch(url)
        .then(function (res) { return res.json() })
        .then(function (json) {
        if (json.success) {
          self.users = json.data
          if (!search) self.buildCodeMaps()
        }
      })
        .catch(function (e) { self.$message.error('加载失败：' + e.message) })
    },

    loadLocations: function () {// 加载经纬度数据
      var self = this
      return fetch('/api/locations')
        .then(function (res) { return res.json() })
        .then(function (json) { if (json.success) self.locations = json.data })
        .catch(function () {})
    },

    loadDict: function () {
  var self = this
  fetch('/api/dict/JXMB')
    .then(function (r) { return r.json() })
    .then(function (j) {
      if (j.success) {
        var t = {}
        j.data.forEach(function (d) {
          if (d.NM) t[d.NM] = Number(d.MC)
        })
        self.orgTargets = t
      }
    })
    .catch(function (e) { console.warn('JXMB 加载失败：', e.message) })
},

    loadIndicators: function (zzdwnm) {// 加载关联指标
      var self = this
      if (!zzdwnm) { self.jxData = []; return }
      self.jxLoading = true
      self.jxData = []

      fetch('/api/indicators?zzdwnm=' + encodeURIComponent(zzdwnm))
        .then(function (r) { return r.json() })
        .then(function (j) {
          self.jxLoading = false
          if (!j.success || !j.data || !j.data.length) return

          // 按 JXKEY 分组：将 KV 行转为 { JXKEY: { jxlx, title, value, jldw } }
          var grouped = {}
          j.data.forEach(function (row) {
            if (!row.JXKEY) return
            if (!grouped[row.JXKEY]) grouped[row.JXKEY] = {}
            if (row.TYPE) grouped[row.JXKEY][row.TYPE] = row.VALUE
          })

          // 分组结果转为数组，供模板 v-for 渲染指标卡片
          self.jxData = Object.keys(grouped).map(function (key) {
            var g = grouped[key]
            return {
              jxkey: key,
              jxlx: g.jxlx || '',       // 指标类型：考核类 / 管理类
              title: g.title || '',      // 指标名称：人均绩效分
              value: g.value || '-',     // 指标值：74.5
              jldw: g.jldw || ''         // 计量单位：分 / %
            }
          })
        })
        .catch(function () { self.jxLoading = false })
    },


    // ================================================================
    //  顶部栏操作
    // ================================================================
    exportCSV: function () {// 导出 CSV
      var headers = this.fields.map(function (f) { return f.label })
      var keys = this.fields.map(function (f) { return f.key })
      var rows = this.getDrillRows().map(function (r) {
        return keys.map(function (key) { return r[key] == null ? '' : r[key] })
      })
      exportCSV(headers, rows, '数据导出_' + new Date().toLocaleDateString() + '.csv')
    },

    logout: function () {// 退出登录
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      this.$router.push('/login')
    },


    // ================================================================
    //  图表渲染
    // ================================================================
    initChart: function () {// 初始化图表
      var self = this
      self.renderChart()
      self.handleResize = function () {
        if (self.mainChart) self.mainChart.resize()
      }
      window.addEventListener('resize', self.handleResize)
    },

    renderChart: function () {// 渲染图表
      var self = this
      var opt = self.buildOption()
      // KPI 指标卡模式：不需要 ECharts，直接用 Vue 模板渲染
      if (opt.cards) {
        self.kpiData = opt
        if (self.mainChart) { self.mainChart.dispose(); self.mainChart = null }
        return
      }
      // ECharts 模式
      self.kpiData = null
      self.$nextTick(function () {
        var el = document.getElementById('mainChart')
        if (!el) return
        // 销毁旧实例 → 创建新实例 → 绑定点击 → 设置配置
        if (self.mainChart) { self.mainChart.dispose(); self.mainChart = null }
        self.mainChart = echarts.init(el)
        self.mainChart.on('click', function (p) { self.onChartClick(p) })
        self.mainChart.setOption(opt)
      })
    },

    buildOption: function () {// 构建图表配置
      var rows = this.getDrillRows()
      var dim = this.drillPath.length ? this.getDrillKey() : this.currentDim
      var chartType = this.fChartType || this.chartType
      if (chartType === 'funnel') dim = 'orgLevel'
      if (chartType === 'kpi') {
        rows = rows.filter(function (r) { return r.ZZDWNM && String(r.ZZDWNM).length <= 3 })
        dim = 'ZZDWMC'
      }
      var data = this.getData(rows, dim)
      var cats = Object.keys(data)   
      var vals = Object.values(data) 
      var targets = null
      if (chartType === 'combo' && dim === 'ZZDWMC' && Object.keys(this.orgTargets).length) {
      var self = this
      targets = cats.map(function (name) {
        var code = self.codeMaps.org[name]
        return code && self.orgTargets[code] != null ? self.orgTargets[code] : null
      })
    }
      return getChartOption(chartType, cats, vals, rows, dim, this.currentMet, this.locations, targets)
    },

    getData: function (rows, dim) {// 按维度聚合数据
      var grouped = {}
      var useRows = rows
      // 未钻取时，单位维度只取顶级单位
      var hasOrgDrill = this.drillPath.some(function (s) { return s.dim === 'ZZDWMC' && s.zzdwnm })
      if (dim === 'ZZDWMC' && !hasOrgDrill) {
        useRows = rows.filter(function (r) { return r.ZZDWNM && String(r.ZZDWNM).length <= 3 })
      }
      // 按维度分组累加员工数
      useRows.forEach(function (r) {
        var d
        if (dim === 'orgLevel') d = getOrgLevel(r.ZZDWNM)
        else if (dim === 'RYLBMC') d = String(r.RYLBMC || '未知')
        else d = String(r[dim] || '未知')
        grouped[d] = (grouped[d] || 0) + Number(r.RYZS || 0)
      })
      // orgLevel 维度需要按固定顺序排列（一级→二级→三级）
      if (dim === 'orgLevel') {
        var ordered = {}
        LEVEL_ORDER.forEach(function (l) {
          if (grouped[l] !== undefined) ordered[l] = grouped[l]
        })
        return ordered
      }

      return grouped
    },


    // ================================================================
    //  钻取系统
    // ================================================================
    getDrillKey: function () {// 获取下一个钻取维度
      var chain = DP_MAP[this.currentDim]
      var idx = Math.min(this.drillPath.length, chain.length - 1)

      // 检查是否有子级
      if (this.drillPath.length > 0) {
        var last = this.drillPath[this.drillPath.length - 1]
        if (last.dim === 'ZZDWMC' && last.zzdwnm) {
          var prefix = last.zzdwnm
          var childLen = prefix.length + 3   // 子级内码比父级长 3 位
          var hasChildren = this.users.some(function (r) {
            return r.ZZDWNM && String(r.ZZDWNM).indexOf(prefix) === 0 && String(r.ZZDWNM).length === childLen
          })
          // 无子级 → 直接跳到 RYLBMC（人员类别维度）
          if (!hasChildren) return 'RYLBMC'
        }
      }

      return chain[idx]
    },

    onChartClick: function (params) {// 点击图表触发钻取
      if (!params.name) return
      var self = this
      var effType = self.fChartType || self.chartType
      // 热力图特殊处理：点击后强制进入饼图模式的组织钻取
      if (effType === 'heatmap') {
        var topRow = self.users.find(function (r) {
          return r.ZZDWMC === params.name && r.ZZDWNM && String(r.ZZDWNM).length <= 3
        })
        if (!topRow) return
        self.drillPath = [{ dim: 'ZZDWMC', value: params.name, zzdwnm: topRow.ZZDWNM }]
        self.currentPage = 1
        self.fChartType = 'pie'
        self.renderChart()
        return
      }
      // 不支持钻取的图表类型
      if (ND.indexOf(effType) !== -1) return

      // 已达到最大钻取深度
      var chain = DP_MAP[self.currentDim]
      if (self.drillPath.length >= chain.length - 1) return

      // 确定下一个钻取维度
      var nextDim = self.getDrillKey()

      if (nextDim === 'ZZDWMC') {
        // 组织钻取：记录被点击单位的内码
        var currentRows = self.getDrillRows()
        var clicked = currentRows.find(function (r) { return r.ZZDWMC === params.name })
        if (!clicked || !clicked.ZZDWNM) return
        self.drillPath.push({ dim: 'ZZDWMC', value: params.name, zzdwnm: clicked.ZZDWNM })
      } else {
        // 其他维度：直接用点击值作为过滤条件
        self.drillPath.push({ dim: nextDim, value: params.name })
      }

      self.currentPage = 1
      self.renderChart()
    },

    getDrillRows: function () {// 根据钻取路径过滤数据行（未钻取时，返回全量数据（搜索过滤后的））
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
        // 在过滤后的 rows 中找子级
        var children = rows.filter(function (r) {
          return r.ZZDWNM && String(r.ZZDWNM).indexOf(prefix) === 0 && String(r.ZZDWNM).length === childLen
        })
        if (children.length > 0) return children
        // 无子级 → 回退到本级
        return rows.filter(function (r) { return r.ZZDWNM && String(r.ZZDWNM) === prefix })
      }

      return rows
    },

    drillUp: function (index) {// 面包屑上钻
      this.drillPath = this.drillPath.slice(0, index)
      if (index === 0) this.fChartType = null
      this.currentPage = 1
      this.renderChart()
    },


    // ================================================================
    //  表格批量操作
    // ================================================================
    onSelect: function (rows) {// 记录已勾选表格
      this.selectedIds = rows.map(function (r) { return r.id })
    },

    batchDelete: function () {// 批量删除
      var self = this
      self.$confirm('确定删除选中的' + self.selectedIds.length + '条记录？', '提示', { type: 'warning' })
        .then(function () {
          fetch('/api/users/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: self.selectedIds })
          })
            .then(function (res) { return res.json() })
            .then(function (json) {
              if (json.success) {
                self.selectedIds = []
                self.loadUsers()
                // 如果删除后当前页超过总页数，回退到最后一页
                self.$nextTick(function () {
                  if (self.currentPage > self.totalPages) self.currentPage = self.totalPages
                })
                self.$message.success('删除成功')
              }
            })
        }).catch(function () {})
    },


    // ================================================================
    //  弹窗操作
    // ================================================================

    openPopup: function (mode, row) {// 打开弹窗
      this.popupMode = mode
      this.visPop = true

      if (mode === 'add') {
        this.popupData = {
          ND: 2025, GLJGMC: '集团总部', RWMC: '年度绩效考核', XMMC: '项目A',
          RYLBMC: '普通', DWGS: '0',
          RYZS: 0, JXZF: 0, HYRS: 0, HYJXZF: 0,
          WJHRS: 0, WJHJXZF: 0, YFBRS: 0, YFBJXZF: 0,
          DCRS: 0, DCJXZF: 0, HYL: 0, JXPJFL: 0
        }
        this.jxData = []
      } else {
        this.popupData = Object.assign({}, row)
        if (mode === 'detail') this.loadIndicators(row.ZZDWNM)
      }
    },

    getOptions: function (f) {// 获取下拉选项
      return f.options || [] 
    },

    savePopup: function () {
  var self = this
  if (!self.popupData.ZZDWMC) {
    self.$message.warning('请选择单位名称')
    return
  }
  var code = self.codeMaps.org[self.popupData.ZZDWMC]
  if (code) {
    self.popupData.ZZDWNM = code
    self.popupData.ZZDWXH = code
    self.popupData.PARENTID = code.length > 3 ? code.substring(0, code.length - 3) : null
  }
  self.popupData.GLJG   = self.codeMaps.gljg[self.popupData.GLJGMC] || 'GLJG001'
  self.popupData.GLJGXH = self.popupData.GLJG
  self.popupData.RWLXNM = self.codeMaps.rw[self.popupData.RWMC] || ''
  self.popupData.XMID   = self.codeMaps.xm[self.popupData.XMMC] || ''

  if (self.popupMode === 'add') {
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(self.popupData)
    })
      .then(function (res) { return res.json() })
      .then(function (json) {
        if (json.success) {
          self.popupData.id = json.id
          self.users.unshift(Object.assign({}, self.popupData))
          self.$message.success('添加成功')
          self.visPop = false
        } else {
          self.$message.error(json.error || '添加失败')
        }
      })
      .catch(function (e) { self.$message.error('请求失败：' + e.message) })
  } else {
    fetch('/api/users/' + self.popupData.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(self.popupData)
    })
      .then(function (res) { return res.json() })
      .then(function (json) {
        if (json.success) {
          self.loadUsers()
          self.$message.success('保存成功')
          self.visPop = false
        } else {
          self.$message.error(json.error || '保存失败')
        }
      })
      .catch(function (e) { self.$message.error('请求失败：' + e.message) })
  }
},
    deleteUser: function (row) {// 删除单条数据
      var self = this
      self.$confirm('删除「' + row.ZZDWMC + '」（' + row.ND + '）？', '提示', { type: 'warning' })
        .then(function () {
          fetch('/api/users/' + row.id, { method: 'DELETE' })
            .then(function (res) { return res.json() })
            .then(function (json) {
              if (json.success) {
                self.loadUsers()
                self.loadUsers().then(function () {
                  if (self.currentPage > self.totalPages) self.currentPage = self.totalPages
                })
                self.$message.success('删除成功')
              }
            })
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