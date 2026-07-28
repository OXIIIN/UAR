// ---- 打印边距 ----
var MARGIN_MAP = { narrow: '10mm', normal: '15mm', wide: '20mm' }

// ---- 维度选项 ----
var DIM_OPTIONS = [
  { label: '年度', value: 'year' },{ label: '单位', value: 'company' },{ label: '项目', value: 'project' }
]
// ---- 固定基础信息列 ----
var FIXED_COLUMNS = [
  { key: 'department', label: '部门' },{ key: 'grp',        label: '小组' },
  { key: 'role',       label: '角色' },{ key: 'count',      label: '人数' }
]
// ---- 活动信息列（表头树） ----
var MOV_GROUPS = [
  {
    key: 'scoreStats', label: '绩效分统计',
    children: [
      { key: 'score_avg', label: '平均分' },{ key: 'score_min', label: '最低分' },{ key: 'score_max', label: '最高分' }
    ]
  },
  {
    key: 'attStats', label: '考勤分统计',
    children: [
      { key: 'att_avg', label: '平均分' },{ key: 'att_min', label: '最低分' },{ key: 'att_max', label: '最高分' }
    ]
  },
  {
    key: 'quarterly', label: '季度分布',
    children: [
      { key: 'Q1', label: 'Q1',
        children: [
          { key: 'q1_score', label: '绩效分' },{ key: 'q1_att', label: '考勤分' }
        ] 
      },
      { key: 'Q2', label: 'Q2',
         children: [
          { key: 'q2_score', label: '绩效分' },{ key: 'q2_att', label: '考勤分' }
        ] 
      },
      { key: 'Q3', label: 'Q3',
         children: [
          { key: 'q3_score', label: '绩效分' }, { key: 'q3_att', label: '考勤分' }
        ] 
      },
      { key: 'Q4', label: 'Q4', 
        children: [
          { key: 'q4_score', label: '绩效分' }, { key: 'q4_att', label: '考勤分' }
        ] 
      }
    ]
  },
  {
    key: 'passRate', label: '绩效合格率',
    children: [{ key: 'pass_rate', label: '合格率(%)' }]
  }
]
// ---- 默认活动信息列 ----
var DEFAULT_COLUMNS = ['quarterly', 'passRate']
// 活动信息列过滤
function movColumns(selectedKeys) {// 传入选中的表头key
  return MOV_GROUPS.filter(function (g) {
    return selectedKeys.indexOf(g.key) !== -1
  })
}
// 构建扁平标签查找表
var LABEL_FLAT = {}
DIM_OPTIONS.forEach(function (d) { LABEL_FLAT[d.value] = d.label })// 例：LABEL_FLAT = {year: '年度', company: '单位', project: '项目'}
FIXED_COLUMNS.forEach(function (c) { LABEL_FLAT[c.key] = c.label })
MOV_GROUPS.forEach(function (g) {
  LABEL_FLAT[g.key] = g.label
  g.children.forEach(function (c) {
    LABEL_FLAT[c.key] = c.label
    if (c.children) { c.children.forEach(function (k) { LABEL_FLAT[k.key] = k.label })}
  })
})

// ---- SQL列表达式映射 ----
var GROUP_SQL = {
  scoreStats: [// 绩效分统计
    'ROUND(AVG(score),1) as score_avg',
    'MIN(score) as score_min',
    'MAX(score) as score_max'
  ],
  attStats: [// 考勤分统计
    'ROUND(AVG(attendance),1) as att_avg',
    'MIN(attendance) as att_min',
    'MAX(attendance) as att_max'
  ],
  quarterly: [// 季度分布
    "ROUND(AVG(CASE WHEN quarter='Q1' THEN score END),1) as q1_score",
    "ROUND(AVG(CASE WHEN quarter='Q1' THEN attendance END),1) as q1_att",
    "ROUND(AVG(CASE WHEN quarter='Q2' THEN score END),1) as q2_score",
    "ROUND(AVG(CASE WHEN quarter='Q2' THEN attendance END),1) as q2_att",
    "ROUND(AVG(CASE WHEN quarter='Q3' THEN score END),1) as q3_score",
    "ROUND(AVG(CASE WHEN quarter='Q3' THEN attendance END),1) as q3_att",
    "ROUND(AVG(CASE WHEN quarter='Q4' THEN score END),1) as q4_score",
    "ROUND(AVG(CASE WHEN quarter='Q4' THEN attendance END),1) as q4_att"
  ],
  passRate: [// 合格率
    "ROUND(100.0*SUM(CASE WHEN score>=60 THEN 1 ELSE 0 END)/COUNT(*),1) as pass_rate"
  ]
}
// SQL构建器
function buildReportSQL(dims, selectedGroups) {
  var groupByParts = dims.concat(['department', '"group"', 'role'])// 分组依据
  var selectParts = dims.concat(['department', '"group" as grp', 'role'])// 获取其中的所有数据
  selectParts.push('COUNT(*) as count')

  selectedGroups.forEach(function (sg) {// 拼接sql表达式
    if (GROUP_SQL[sg]) {
      GROUP_SQL[sg].forEach(function (s) { selectParts.push(s) })// 固定列sql+活动列sql
    }
  })

  var orderParts = dims.map(function (dim) {// 控制结果排序
    if (dim === 'company') {
      return "CASE company WHEN '成都总部' THEN 1 WHEN '重庆分部' THEN 2 WHEN '绵阳分部' THEN 3 WHEN '上海分部' THEN 4 WHEN '广州分部' THEN 5 ELSE 6 END"
    }
    return dim === 'group' ? '"group"' : dim
  }).concat(['department', '"group"', 'role'])

  return 'SELECT ' + selectParts.join(', ') +' FROM users' +// 拼接完整sql
    ' GROUP BY ' + groupByParts.join(', ') +
    ' ORDER BY ' + orderParts.join(', ')
}
var MET_LABELS = {
  count: '人数', avg: '平均分', max: '最高分', min: '最低分',
  avg_attendance: '平均考勤分', score: '绩效分', attendance: '考勤分'
}


module.exports = {
  MARGIN_MAP, 
  DIM_OPTIONS,FIXED_COLUMNS, MOV_GROUPS, DEFAULT_COLUMNS, movColumns, LABEL_FLAT,
  GROUP_SQL, buildReportSQL, MET_LABELS, 
}