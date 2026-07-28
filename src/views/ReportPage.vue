<template>
  <div class="report-page" id="reportPage" :style="{ zoom: pageZoom }">
    <!-- 顶部栏 -->
    <div class="top-bar no-print">
      <div><h1>统计报表</h1><span>多维度数据汇总分析</span></div>
      <div>
        <el-button type="danger" plain @click="exportFile('csv')">导出 Excel</el-button>
        <el-button type="danger" plain @click="exportFile('doc')">导出 Word</el-button>
        <el-button type="danger" plain @click="exportFile('pdf')">导出 PDF</el-button>
        <el-button type="danger" plain @click="isPrint=true">打印设置</el-button>
        <el-button type="danger" plain @click="$router.push('/')">返回管理页</el-button>
      </div>
    </div>
    <!-- 封面页 -->
    <div class="cover-page" v-if="printSettings.showCover">
      <div class="cover-title">{{ printSettings.coverTitle }}</div>
      <div class="cover-subtitle">{{ printSettings.coverSubtitle }}</div>
    </div>
    <!-- 智能分析 -->
    <div class="ai-panel no-print">
      <div class="ai-header">智能分析</div>
      <div class="ai-input-row">
        <el-input v-model="aiQuestion" placeholder="输入问题："
          @keyup.enter.native="askAI" clearable style="flex:1;"></el-input>
        <el-button type="danger" :loading="aiLoading" @click="askAI">分析</el-button>
      </div>
      <div v-if="aiResult" class="ai-result">
        <div class="ai-section">
          <div class="ai-section-title">{{ aiResult.title }}</div>
          <div id="aiChart" :style="{ width:'100%', height:'500px', zoom: 1/pageZoom }"></div>
        </div>
        <div class="ai-section" v-if="aiSqlRows && aiSqlRows.length">
          <div class="ai-section-title">查询结果（{{ aiSqlRows.length }} 条）</div>
          <pre class="ai-sql">{{ aiResult.sql }}</pre>
          <el-table :data="aiSqlRows" border size="mini" style="width:100%"
            :header-cell-style="{background:'#1a2745',color:'#e2e2e2',fontWeight:'bold'}">
            <el-table-column v-for="col in Object.keys(aiSqlRows[0])" :key="col"
              :prop="col" :label="col" align="center"></el-table-column>
          </el-table>
        </div>
      </div>
    </div>
    <!-- 表格区域 -->
    <div class="table-section" :class="{'edit-active': isEdit}" style="position:relative;">
      <div class="section-header no-print">
        <div class="header-left">
          <span class="ctrl-label">统计维度：</span>
          <el-checkbox-group v-model="selectedDims" size="small">
            <el-checkbox-button v-for="d in dimOptions" :key="d.value" :label="d.value">{{ d.label }}</el-checkbox-button>
          </el-checkbox-group>
        </div>
        <div class="table-tools">
          <el-button size="mini" @click="isEdit=!isEdit">{{ isEdit ? '完成编辑' : '编辑表格' }}</el-button>
          <el-button size="mini" @click="resetEdit">重置</el-button>
          <el-button size="mini" type="danger" plain @click="openHeaderSets">设置表头</el-button>
        </div>
      </div>
      <input v-if="editingCell" ref="floatInput" class="floating-input" :style="floatStyle"
        @blur="finishEdit()" @keyup.enter="finishEdit()" />
      <!-- 数据表格 -->
      <el-table :data="reportRows" border style="width:100%" size="medium"
        :span-method="mergeSpan"
        :header-cell-style="{background:'#1a2745',color:'#e2e2e2',fontWeight:'bold'}">
        <!-- 统计维度列 -->
        <el-table-column v-for="dim in selectedDims" :key="'dim_'+dim"
          :label="getLabel(dim)" min-width="100" align="center">
          <template slot="header">
            <span class="header-text" :class="{editable: isEdit}"
              @dblclick="isEdit && startEdit('dim', dim, $event)">{{ getLabel(dim) }}</span>
          </template>
          <template slot-scope="s">
            <span>{{ s.row[dim] || '未知' }}</span>
          </template>
        </el-table-column>
        <!-- 固定信息列 -->
        <el-table-column v-for="gc in fixedCols" :key="'gc_'+gc.key"
          :prop="gc.key" :min-width="gc.key==='count'?70:100" align="center">
          <template slot="header">
            <span class="header-text" :class="{editable: isEdit}"
              @dblclick="isEdit && startEdit('group', gc.key, $event)">{{ getLabel(gc.key) }}</span>
          </template>
        </el-table-column>
        <!-- 三层表头渲染 -->
        <template v-for="group in visibleCols">// 第一层
          <el-table-column :key="'grp_'+group.key" align="center">
            <template slot="header">
              <span class="header-text" :class="{editable: isEdit}" @dblclick="isEdit && startEdit('headerGroup', group.key, $event)">
                {{ getLabel(group.key) }}
              </span>
            </template>
            <template v-for="child in group.children">// 第二层
              <el-table-column v-if="!child.children" 
              :key="'leaf_'+group.key+'_'+child.key" :prop="child.key" align="center" min-width="90">// 若无第三层则直接渲染数据列
                <template slot="header">
                  <span class="header-text" :class="{editable: isEdit}" @dblclick="isEdit && startEdit('leaf', child.key, $event)">
                    {{ getLabel(child.key) }}
                  </span>
                </template>
                <template slot-scope="s">
                  <span>{{ formatVal(s.row[child.key], child.key) }}</span>
                </template>
              </el-table-column>
              <el-table-column v-else :key="'brch_'+group.key+'_'+child.key" align="center">// 第二层（存在第三层的情况）
                <template slot="header">
                  <span class="header-text" :class="{editable: isEdit}" @dblclick="isEdit && startEdit('leaf', child.key, $event)">
                    {{ getLabel(child.key) }}
                  </span>
                </template>
                <el-table-column v-for="leaf in child.children" 
                :key="'lf_'+group.key+'_'+child.key+'_'+leaf.key" :prop="leaf.key" align="center" min-width="80">
                  <template slot="header">
                    <span class="header-text" :class="{editable: isEdit}" @dblclick="isEdit && startEdit('leaf', leaf.key, $event)">
                      {{ getLabel(leaf.key) }}
                    </span>
                  </template>
                  <template slot-scope="s">
                    <span>{{ formatVal(s.row[leaf.key], leaf.key) }}</span>
                  </template>
                </el-table-column>
              </el-table-column>
            </template>
          </el-table-column>
        </template>
      </el-table>
    </div>
    <!-- 封底 -->
    <div class="cover-page" v-if="printSettings.showBackCover">
      <div class="cover-title">{{ printSettings.backCoverTitle }}</div>
      <div class="cover-subtitle">{{ printSettings.backCoverSubtitle }}</div>
    </div>
    <!-- 设置表头弹窗 -->
    <el-dialog title="设置表头" :visible.sync="headerSettingsVis" width="400px" top="40vh">
      <div v-for="group in allMovGroups" :key="'cfg_'+group.key" style="margin-bottom:20px;">
        <el-checkbox v-model="headerChecked[group.key]">
          {{ group.label }}
        </el-checkbox>
      </div>
      <span slot="footer">
        <el-button type="danger" @click="finishHeaderSets">确定</el-button>
        <el-button @click="headerSettingsVis=false">关闭</el-button>
      </span>
    </el-dialog>
    <!-- 打印设置弹窗 -->
    <el-dialog title="打印设置" :visible.sync="isPrint" width="520px">
      <div class="ps-item"><div class="popup-label">页边距</div>
        <el-radio-group v-model="printSettings.margin">
          <el-radio label="narrow">窄 (10mm)</el-radio>
          <el-radio label="normal">正常 (15mm)</el-radio>
          <el-radio label="wide">宽 (20mm)</el-radio>
        </el-radio-group>
      </div>
      <div class="ps-item"><div class="popup-label">纸张大小</div>
        <el-radio-group v-model="printSettings.paperSize">
          <el-radio v-for="p in ['A4','A3','Letter','B5']" :key="p" :label="p">{{ p }}</el-radio>
        </el-radio-group>
      </div>
      <div class="ps-item"><div class="popup-label">打印方向</div>
        <el-radio-group v-model="printSettings.orientation">
          <el-radio label="portrait">纵向</el-radio>
          <el-radio label="landscape">横向</el-radio>
        </el-radio-group>
      </div>
      <div class="ps-item" v-for="c in covers" :key="c.label"
        style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="popup-label" style="margin-bottom:0;">{{ c.label }}</div>
          <el-switch v-model="printSettings[c.show]"></el-switch>
        </div>
        <template v-if="printSettings[c.show]">
          <el-input v-model="printSettings[c.title]" :placeholder="c.label+'标题：'" style="width:160px;"></el-input>
          <el-input v-model="printSettings[c.subtitle]" placeholder="副标题：" style="width:160px;"></el-input>
        </template>
      </div>
      <span slot="footer">
        <el-button type="danger" @click="doPrint">打印</el-button>
        <el-button @click="isPrint=false">关闭</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { exportCSV, exportWord, exportPDF } from '../utils/exportUtils'
import { getChartOption } from '../utils/chartUtils'
import { MARGIN_MAP, DIM_OPTIONS,FIXED_COLUMNS, MOV_GROUPS, LABEL_FLAT, DEFAULT_COLUMNS,movColumns, MET_LABELS } from '../utils/reportUtils'
import * as echarts from 'echarts'

export default {
  name: 'ReportPage',
  data: function () {
    return {
      pageZoom:0.8,
      // AI智能分析
      aiQuestion: '', aiLoading: false, aiResult: null, aiChart: null, aiSqlRows: null,
      // 用户数据
      users: [],reportRows: [],
      dimOptions: DIM_OPTIONS, selectedDims: ['company'],
      fixedCols: FIXED_COLUMNS,allMovGroups: MOV_GROUPS,
      headerSettingsVis: false,
      // 表格整理
      isEdit: false, editingCell: null, floatStyle: {},cusLabels: {},
      selectedCols: DEFAULT_COLUMNS.slice(),
      headerChecked: MOV_GROUPS.reduce(function (o, g) {// 初始状态勾选默认活动信息列
        o[g.key] = DEFAULT_COLUMNS.indexOf(g.key) !== -1; return o
      }, {}),
      // 打印设置
      isPrint: false,
      covers: [// 封面与封底配置数据
        { show: 'showCover', title: 'coverTitle', subtitle: 'coverSubtitle', label: '封面' },
        { show: 'showBackCover', title: 'backCoverTitle', subtitle: 'backCoverSubtitle', label: '封底' }
      ],
      printSettings: {
        paperSize: 'A4', orientation: 'landscape', margin: 'narrow',
        showCover: true, coverTitle: '', coverSubtitle: '',
        showBackCover: true, backCoverTitle: '', backCoverSubtitle: ''
      }
    }
  },

  computed: {
    visibleCols: function () {// 当前需渲染的列
      return movColumns(this.selectedCols)
    }
  },

  watch: {
    selectedDims: function (val) {
      if (!val.length) { this.selectedDims = ['company']; return }
      this.loadReportData()
    },
    selectedCols: function () {
      this.loadReportData()
    }
  },

  mounted: function () {
    this.loadUsers()
    this.loadReportData()
  },

  beforeDestroy: function () {
    if (this.aiChart) { this.aiChart.dispose(); this.aiChart = null }
  },

  methods: {
    // ---- 获取数据库中的数据 ----
    loadUsers: function () {//加载用户数据
      var self = this
      fetch('/api/users')
        .then(function (res) { return res.json() })
        .then(function (json) { if (json.success) { self.users = json.data } })
        .catch(function (e) { self.$message.error('用户数据加载失败：' + e.message) })
    },
    loadReportData: function () {// 获取报表数据
      var self = this
      fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dims: self.selectedDims, selectedGroups: self.selectedCols })
      })
        .then(function (res) { return res.json() })
        .then(function (json) {
          if (json.success) { self.reportRows = json.data || [] }
          else { self.$message.error(json.error || '报表数据加载失败') }
        })
        .catch(function (e) { self.$message.error('请求失败：' + e.message) })
    },
    // ---- 导出文件 ----
    getTableData: function () {// 获取表格数据（供vsc/word使用）
      var self = this
      var headers = [], props = []
      self.selectedDims.forEach(function (dim) {// 把选中的维度列加入表头
        headers.push(self.getLabel(dim)); props.push(dim)
      })
      FIXED_COLUMNS.forEach(function (gc) {// 把固定基础列加入表头
        headers.push(self.getLabel(gc.key)); props.push(gc.key)
      })
      self.visibleCols.forEach(function (group) {// 遍历动态列组，把每个叶子节点加入表头
        group.children.forEach(function (child) {
          if (!child.children) {// 存在二层
            headers.push(self.getLabel(group.key) + '-' + self.getLabel(child.key))
            props.push(child.key)
          } else {// 存在三层
            child.children.forEach(function (leaf) {
              headers.push(self.getLabel(child.key) + '-' + self.getLabel(leaf.key))
              props.push(leaf.key)
            })
          }
        })
      })
      return {// 把 reportRows 中的数据按 props 顺序提取，组装成二维数组
        headers: headers,
        rows: self.reportRows.map(function (r) {
          return props.map(function (p) { return r[p] == null ? '-' : String(r[p]) })
        })
      }
    },
    exportFile: function (format) {// 导出配置分发
      var data = this.getTableData()
      var name = '统计报表_' + new Date().toLocaleDateString()
      if (format === 'pdf') {
        exportPDF(this.$el, name + '.pdf', this.printSettings.paperSize, this.printSettings.orientation)
      } else if (format === 'csv') {
        exportCSV(data.headers, data.rows, name + '.csv')
      } else {
        exportWord(data.headers, data.rows, name + '.doc', '统计报表')
      }
    },
    doPrint: function () {// 执行打印
      var ps = this.printSettings, margin = MARGIN_MAP[ps.margin] || '15mm'
      var style = document.createElement('style')
      style.id = 'print-dynamic-style'
      style.textContent = '@page{size:' + ps.paperSize + ' ' + ps.orientation + ';margin:' + margin + '}'
      var old = document.getElementById('print-dynamic-style')
      if (old) old.remove()// 追加前先清理旧元素
      document.head.appendChild(style)
      window.onafterprint = function () {// 注册打印完成后的清理函数
        var el = document.getElementById('print-dynamic-style')
        if (el) el.remove()
        window.onafterprint = null
      }
      this.$nextTick(function () { window.print() })
    },
    // ---- 智能分析 ----
    askAI: async function () {
      if (!this.aiQuestion.trim()) return
      var self = this
      self.aiLoading = true; self.aiResult = null; self.aiSqlRows = null
      try {// 发送问题给后端
        var res1 = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: self.aiQuestion })
        })
        var json = await res1.json()// 接收返回结果（sql语句）
        self.aiLoading = false
        if (!json.success) { self.$message.error(json.error); return }
        if (!json.data || !json.data.sql) return
        self.aiResult = json.data
        var res2 = await fetch('/api/query', {// 发送sql语句给后端执行
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql: json.data.sql })
        })
        var qRes = await res2.json()
        if (!qRes.success) { self.$message.error('SQL执行失败：' + qRes.error); return }
        self.aiSqlRows = qRes.data
        if (qRes.data && qRes.data.length) {
          var keys = Object.keys(qRes.data[0])
          var categories = qRes.data.map(function (r) { return String(r[keys[0]] || '未知') })
          var values = qRes.data.map(function (r) { return r[keys[1]] != null ? r[keys[1]] : 0 })
          var chart = {
            type: json.data.chart_type || 'bar',
            title: json.data.title || '统计结果',
            categories: categories,
            series: [{ name: MET_LABELS[keys[1]] || keys[1], data: values }],
            dimension: keys[0],
            metric: keys[1]
          }
          self.$nextTick(function () { self.renderAIChart(chart) })
        }
      } catch (e) {
        self.aiLoading = false
        self.$message.error('请求失败：' + e.message)
      }
    },
    renderAIChart: function (chart) {// 渲染ai图表
      var el = document.getElementById('aiChart')
      if (!el || !chart || !chart.categories || !chart.series) return
      if (this.aiChart) this.aiChart.dispose()
      this.aiChart = echarts.init(el)
      this.aiChart.setOption(getChartOption(
        chart.type, chart.categories, chart.series[0].data,
        this.users, chart.dimension, chart.metric
      ), true)
    },
    // ---- 数据表格 ----
    mergeSpan: function (param) {// 行合并
      if (param.columnIndex !== 0) return
      if (!this.selectedDims.length || !this.reportRows.length) return
      var firstDim = this.selectedDims[0], rows = this.reportRows
      var val = rows[param.rowIndex][firstDim]// 取出当前行在第一维度列上的值。
      if (param.rowIndex > 0 && rows[param.rowIndex - 1][firstDim] === val) {// 检查当前行与上一行的第一维度值是否相同。如果相同，当前行被合并
        return { rowspan: 0, colspan: 0 }
      }
      var count = 1
      for (var i = param.rowIndex + 1; i < rows.length; i++) {// 从当前行向下统计有多少连续行与当前行的维度值相同，返回合并的行数
        if (rows[i][firstDim] === val) count++; else break
      }
      return { rowspan: count, colspan: 1 }
    },
    getLabel: function (key) {// 获取标签
      return this.cusLabels[key] || LABEL_FLAT[key] || key
    },
    formatVal: function (val, key) {// 数值规范
      if (val == null || val === '') return '-'
      if (key === 'pass_rate') return val + '%'
      return String(val)
    },
    // ---- 编辑表格 ----
    startEdit: function (type, key, event) {// 开始编辑
      if (!this.isEdit) return
      if (this.editingCell) this.finishEdit()
      this.editingCell = { type: type, key: key }
      this._editBuf = this.getLabel(key)// 保存当前文字到缓冲区
      var target = event.target.closest('.cell') || event.target
      var cRect = this.$el.querySelector('.table-section').getBoundingClientRect()
      var rect = target.getBoundingClientRect()// 获取元素位置信息
      var zoom = parseFloat(window.getComputedStyle(this.$el).zoom) || 1//读取 .report-page 元素上生效的 zoom 值
      this.floatStyle = {// 浮动输入框的定位样式
        position: 'absolute', zIndex: 100,
        left: (rect.left - cRect.left) / zoom + 'px',    
        top: (rect.top - cRect.top) / zoom + 'px',        
        width: Math.max(rect.width, 100) / zoom + 'px',
        height: Math.max(rect.height, 30) / zoom + 'px'
      }
      var self = this
      this.$nextTick(function () {// 在 DOM 更新后，操作输入框。
        if (self.$refs.floatInput) {
          self.$refs.floatInput.value = self._editBuf
          self.$refs.floatInput.focus()
          self.$refs.floatInput.select()
        }
      })
    },
    finishEdit: function () {// 完成编辑
      if (!this.editingCell) return
      var val = this.$refs.floatInput.value.trim()// 取出输入框的值
      var key = this.editingCell.key
      if (val && val !== this.getLabel(key)) {// 保存编辑结果；例：cusLabels = { company: '单位' }
        this.$set(this.cusLabels, key, val)
      }
      this.editingCell = null; this.floatStyle = {}
    },
    resetEdit: function () {// 重置所有编辑内容
      this.cusLabels = {}
      this.editingCell = null
      this.floatStyle = {}
    },
    // ---- 设置表头 ----
    openHeaderSets: function () {// 打开设置表头弹窗
      var sel = this.selectedCols
      this.headerChecked = MOV_GROUPS.reduce(function (o, g) {
        o[g.key] = sel.indexOf(g.key) !== -1; return o
      }, {})
      this.headerSettingsVis = true
    },
    finishHeaderSets: function () {// 确认设置表头修改
      var selected = []
      var checked = this.headerChecked
      Object.keys(checked).forEach(function (k) {
        if (checked[k]) selected.push(k)
      })
      if (!selected.length) { this.$message.warning('请至少选择一个列组'); return }
      this.selectedCols = selected
      this.headerSettingsVis = false
    }
  }
}
</script>

<style scoped>
.report-page { width: 1500px; zoom: 0.8; margin: 30px auto; background: #16213e; border-radius: 12px; padding: 30px; }
.top-bar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid #2a2a4a; margin-bottom: 24px; }
.top-bar h1 { color: #e2e2e2; font-size: 24px; margin: 0; }
.top-bar span { color: #999; font-size: 13px; }
.cover-page { display: none; }
.cover-title { font-size: 36px; font-weight: bold; color: #333; margin-bottom: 20px; }
.cover-subtitle { font-size: 18px; color: #666; margin-bottom: 40px; }
.ai-panel { background: #0f3460; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
.ai-header { color: #e2e2e2; font-size: 16px; font-weight: bold; margin-bottom: 12px; }
.ai-input-row { display: flex; gap: 10px; margin-bottom: 16px; }
.ai-result { border-top: 1px solid #2a2a4a; padding-top: 16px; }
.ai-section { margin-bottom: 16px; }
.ai-section-title { color: #38bdf8; font-size: 14px; margin-bottom: 8px; }
.ai-sql { background: #0d1117; color: #4ecb71; padding: 12px 16px; border-radius: 6px; font-family: 'DM Mono', monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap; }
.table-section { background: #0f3460; padding: 20px; border-radius: 10px; margin-bottom: 20px; overflow-x: auto; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.header-left { display: flex; align-items: center; gap: 10px; }
.ctrl-label { color: #d1d1d1; font-size: 12px; white-space: nowrap; }
.table-tools { display: flex; gap: 5px; }
.header-text { cursor: default; }
.header-text.editable { cursor: pointer; border-bottom: 1px dashed #38bdf8; padding: 2px 4px; }
.floating-input { background: #16213e; border: 1px solid #e94560; border-radius: 3px; color: #e2e2e2; padding: 4px 8px; font-size: 12px; text-align: center; outline: none; box-sizing: border-box; }
.edit-active .el-table th .cell > span,
.edit-active .el-table th .cell > div > span { cursor: pointer; }
.popup-label { color: #888; font-size: 14px; margin-bottom: 8px; }
.ps-item { margin-bottom: 16px; }
@media print {
  .no-print { display: none !important; }
  .report-page { width: fit-content; min-width: 100%; max-width: none; margin: 0; padding: 0; background: #fff; border-radius: 0; overflow: visible; }
  .table-section { page-break-inside: avoid; page-break-after: always; background: #fff; padding: 10px; overflow: visible !important; min-width: fit-content !important; }
  .cover-page { display: block; text-align: center; page-break-after: always; padding: 200px 20px 20px 20px; }
}
</style>

<style>
@media print {
  .el-table th { background: #f5f5f5 !important; color: #333 !important; }
  .el-table td { color: #333 !important; background: #fff !important; }
  .el-table td, .el-table th { border-color: #ccc !important; word-break: break-all; font-size: 11px; padding: 4px 6px; }
  .el-table--border { border: 1px solid #ccc !important; }
  .el-table__gutter { display: none !important; }
  .el-table { width: max-content !important; min-width: 100% !important; }
  .el-table__body-wrapper { height: auto !important; overflow: visible !important; }
  .el-dialog__wrapper, .v-modal { display: none !important; }
}
</style>