// ---- 打印边距 ----
var MARGIN_MAP = { narrow: '10mm', normal: '15mm', wide: '20mm' }

// ---- 维度选项 ----
var DIM_OPTIONS = [
  { label: '年度', value: 'nd' },
  { label: '单位', value: 'zzdwmc' },
  { label: '项目', value: 'xmmc' },
  { label: '任务', value: 'rwmc' }
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
function movColumns(selectedKeys) {
  return MOV_GROUPS.filter(function (g) {
    return selectedKeys.indexOf(g.key) !== -1
  })
}

// ---- 构建扁平标签查找表 ----
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
  //                          ↓ 加 'GLJGMC'
  var groupByParts = dims.map(function (d) { return d.toUpperCase() }).concat(['RYLBMC', 'GLJGMC'])
  //                                ↓ 加别名
  var selectParts = dims.map(function (d) { return d.toUpperCase() + ' as ' + d }).concat(['RYLBMC as rylbmc', 'GLJGMC as gljgmc'])

  selectParts.push('COUNT(*) as count')
  selectParts.push('SUM(CAST(DWGS AS INTEGER)) as dwgs')
  selectParts.push('SUM(RYZS) as ryzs')
  selectParts.push('SUM(JXZF) as jxzf')

  selectedGroups.forEach(function (sg) {
    if (GROUP_SQL[sg]) {
      GROUP_SQL[sg].forEach(function (s) { selectParts.push(s) })
    }
  })

  var orderParts = dims.map(function (dim) {
    if (dim === 'zzdwmc') {
      return "CASE ZZDWMC WHEN '成都总部' THEN 1 WHEN '重庆分部' THEN 2 WHEN '绵阳分部' THEN 3 WHEN '上海分部' THEN 4 WHEN '广州分部' THEN 5 ELSE 6 END"
    }
    return dim.toUpperCase()
  //              ↓ 加排序
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
  avg_score: '平均绩效分'
}

module.exports = {
  MARGIN_MAP,
  DIM_OPTIONS, FIXED_COLUMNS, MOV_GROUPS, DEFAULT_COLUMNS, movColumns, LABEL_FLAT,
  GROUP_SQL, buildReportSQL, MET_LABELS
}