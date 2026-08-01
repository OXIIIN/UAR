// ---- 打印边距 ----
var MARGIN_MAP = { narrow: '10mm', normal: '15mm', wide: '20mm' }

// ---- 维度选项 ----
var DIM_OPTIONS = [
  { label: '年度', value: 'nd' },
  { label: '单位', value: 'zzdwmc' },
  { label: '任务', value: 'rwmc' },
  { label: '项目', value: 'xmmc' }
]

// ---- 固定基础信息列 ----
var FIXED_COLUMNS = [
  { key: 'gljgmc', label: '管理机构' },
  { key: 'rylbmc', label: '人员类别' },
  { key: 'dwgs',   label: '考核单位数' },
  { key: 'ryzs',   label: '员工总数' },
  { key: 'jxzf',   label: '绩效总分' }
]

// ---- 活动信息列（表头树） ----
var MOV_GROUPS = [
  {
    key: 'jxStats', label: '绩效统计',
    children: [
      { key: 'jx_avg', label: '平均绩效分' },
      { key: 'jx_min', label: '最低绩效分' },
      { key: 'jx_max', label: '最高绩效分' }
    ]
  },
  {
    key: 'ryzt', label: '人员状态分布',
    children: [
      {
        key: 'hy', label: '活跃',
        children: [
          { key: 'hyrs', label: '人数' },
          { key: 'hyjxzf', label: '绩效总分' }
        ]
      },
      {
        key: 'wjh', label: '未激活',
        children: [
          { key: 'wjhrs', label: '人数' },
          { key: 'wjhjxzf', label: '绩效总分' }
        ]
      },
      {
        key: 'yfb', label: '已封禁',
        children: [
          { key: 'yfbrs', label: '人数' },
          { key: 'yfbjxzf', label: '绩效总分' }
        ]
      },
      {
        key: 'dcp', label: '待评估',
        children: [
          { key: 'dcrs', label: '人数' },
          { key: 'dcjxzf', label: '绩效总分' }
        ]
      }
    ]
  },
  {
    key: 'dbl', label: '达标率',
    children: [
      { key: 'hyl', label: '活跃率(%)' },
      { key: 'jxpjfl', label: '绩效达标率(%)' }
    ]
  }
]

// ---- 默认活动信息列 ----
var DEFAULT_COLUMNS = ['ryzt', 'dbl']

// ---- 活动信息列过滤 ----
function movColumns(selectedKeys) {// 根据用户勾选的 group key 列表，返回对应的 MOV_GROUPS 子集；前端模板用返回值渲染 <el-table-column> 多层表头
  return MOV_GROUPS.filter(function (g) {
    return selectedKeys.indexOf(g.key) !== -1
  })
}

// ---- 构建扁平标签查找表 ----
// 将所有可能的 key（维度、固定列、活动列组 + 子列）映射到中文标签
var LABEL_FLAT = {}
DIM_OPTIONS.forEach(function (d) { LABEL_FLAT[d.value] = d.label })
FIXED_COLUMNS.forEach(function (c) { LABEL_FLAT[c.key] = c.label })
MOV_GROUPS.forEach(function (g) {
  LABEL_FLAT[g.key] = g.label
  g.children.forEach(function (c) {
    LABEL_FLAT[c.key] = c.label
    if (c.children) {
      c.children.forEach(function (k) { LABEL_FLAT[k.key] = k.label })
    }
  })
})

// ---- SQL 列表达式映射 ----
var GROUP_SQL = {
  jxStats: [
    'ROUND(SUM(JXZF * 1.0) / NULLIF(SUM(RYZS), 0), 1) as jx_avg',
    'ROUND(MIN(CASE WHEN RYZS > 0 THEN JXZF * 1.0 / RYZS ELSE NULL END), 1) as jx_min',
    'ROUND(MAX(CASE WHEN RYZS > 0 THEN JXZF * 1.0 / RYZS ELSE NULL END), 1) as jx_max'
  ],
  ryzt: [
    'SUM(HYRS) as hyrs',
    'SUM(HYJXZF) as hyjxzf',
    'SUM(WJHRS) as wjhrs',
    'SUM(WJHJXZF) as wjhjxzf',
    'SUM(YFBRS) as yfbrs',
    'SUM(YFBJXZF) as yfbjxzf',
    'SUM(DCRS) as dcrs',
    'SUM(DCJXZF) as dcjxzf'
  ],
  dbl: [
    'ROUND(100.0 * SUM(HYRS) / NULLIF(SUM(RYZS), 0), 1) as hyl',
    'ROUND(100.0 * SUM(JXZF) / NULLIF(SUM(RYZS * 100.0), 0), 1) as jxpjfl'
  ]
}


// ---- SQL 构建器 ----
function buildReportSQL(dims, selectedGroups) {
  var groupByParts = dims.map(function (d) { return d.toUpperCase() }).concat(['RYLBMC', 'GLJGMC'])
  var selectParts = dims.map(function (d) { return d.toUpperCase() + ' as ' + d }).concat(['RYLBMC as rylbmc', 'GLJGMC as gljgmc'])

  var hasDwmc = dims.indexOf('zzdwmc') !== -1
  if (hasDwmc) {// 当维度包含单位名称时，额外查询 ZZDWNM（内码）
    selectParts.push('ZZDWNM as zzdwnm')
    groupByParts.push('ZZDWNM')
  }

  selectParts.push('COUNT(*) as count')
  selectParts.push('SUM(CAST(DWGS AS INTEGER)) as dwgs')
  selectParts.push('SUM(RYZS) as ryzs')
  selectParts.push('SUM(JXZF) as jxzf')
  
  selectedGroups.forEach(function (sg) {// 追加用户勾选的活动列组对应的 SQL 表达式
    if (GROUP_SQL[sg]) {
      GROUP_SQL[sg].forEach(function (s) { selectParts.push(s) })
    }
  })

  var orderParts = dims.map(function (dim) {
    if (dim === 'zzdwmc') return 'ZZDWNM'
    return dim.toUpperCase()
  }).concat(['RYLBMC', 'GLJGMC'])

  return 'SELECT ' + selectParts.join(', ') +
    ' FROM YYGL_DATA_TABLE' +
    ' GROUP BY ' + groupByParts.join(', ') +
    ' ORDER BY ' + orderParts.join(', ')
}


// ---- 指标标签 ----
var MET_LABELS = {
  ryzs: '员工总数', jxzf: '绩效总分', dwgs: '考核单位数', count: '记录数',
  hyrs: '活跃人数', hyjxzf: '活跃绩效总分',
  wjhrs: '未激活人数', wjhjxzf: '未激活绩效总分',
  yfbrs: '已封禁人数', yfbjxzf: '已封禁绩效总分',
  dcrs: '待评估人数', dcjxzf: '待评估绩效总分',
  hyl: '活跃率', jxpjfl: '绩效达标率',
  jx_avg: '平均绩效分', jx_min: '最低绩效分', jx_max: '最高绩效分',
  avg_score: '平均绩效分',
  // 单位内码（当 AI 查询涉及单位排序时可能出现）
  zzdwnm: '组织编码'
}


// ---- 表头树标签工具 ----
function extractLabels(nodes) {// 从 HEADER JSON 树中提取所有标签，返回扁平的 { key: label } 映射
  var map = {}
  function walk(list) {
    list.forEach(function (n) {
      if (n.type === 'field' && n.fieldKey) {
        map[n.fieldKey] = n.label
      }
      if (n.type === 'group') {
        map[n.id.replace(/^g-/, '')] = n.label
      }
      if (n.children) walk(n.children)
    })
  }
  walk(nodes)
  return map
}

function applyLabels(nodes, labels) {// 将编辑后的标签回写到表头树的对应节点
  function walk(list) {
    list.forEach(function (n) {
      if (n.type === 'field' && n.fieldKey && labels[n.fieldKey] !== undefined) {
        n.label = labels[n.fieldKey]
      }
      if (n.type === 'group') {
        var key = n.id.replace(/^g-/, '')
        if (labels[key] !== undefined) n.label = labels[key]
      }
      if (n.children) walk(n.children)
    })
  }
  walk(nodes)
  return nodes
}


module.exports = {
  MARGIN_MAP,
  DIM_OPTIONS, FIXED_COLUMNS, MOV_GROUPS, DEFAULT_COLUMNS,
  movColumns, LABEL_FLAT,
  GROUP_SQL, buildReportSQL,
  MET_LABELS,
  extractLabels, applyLabels
}