
// 用户字段配置（弹窗表单） 
var FIELDS = [
  { key: 'status',     label: '状态',     modes: ['edit', 'detail'],         options: ['活跃', '未激活', '已封禁'] },
  { key: 'company',    label: '单位',     modes: ['edit', 'detail', 'add'], options: ['总部', '重庆分部', '绵阳分部', '上海分部', '广州分部'] },
  { key: 'department', label: '部门',     modes: ['edit', 'detail'], options: [] },
  { key: 'group',      label: '小组',     modes: ['edit', 'detail'],        options: [] },
  { key: 'role',       label: '角色',     modes: ['edit', 'detail', 'add'], options: ['部长', '组长', '员工'] },
  { key: 'name',       label: '姓名',     modes: ['edit', 'detail', 'add'] },
  { key: 'age',        label: '年龄',     modes: ['edit', 'detail', 'add'] },
  { key: 'education',  label: '学历',     modes: ['edit', 'detail', 'add'], options: ['大专', '本科', '硕士', '博士'] },
  { key: 'email',      label: '邮箱',     modes: ['edit', 'detail', 'add'] },
  { key: 'phone',      label: '手机号',   modes: ['edit', 'detail', 'add'] },
  { key: 'address',    label: '地址',     modes: ['edit', 'detail', 'add'] },
  { key: 'project',    label: '项目',     modes: ['edit', 'detail'], options: ['项目A', '项目B', '项目C', '项目D', '未分配'] },
  { key: 'year',       label: '年度',     modes: ['edit', 'detail'], options: ['2020', '2021', '2022', '2023', '2024'] },
  { key: 'quarter',    label: '季度',     modes: ['edit', 'detail'], options: ['Q1', 'Q2', 'Q3', 'Q4'] },
  { key: 'score',      label: '绩效分',   modes: ['edit', 'detail'] },
  { key: 'attendance', label: '考勤分',   modes: ['edit', 'detail'] }
]

// 单位-部门映射
var DEPTS = {
  '总部':    ['技术部', '产品部'],
  '重庆分部': ['运营部', '客服部'],
  '绵阳分部': ['研发部'],
  '上海分部': ['市场部'],
  '广州分部': ['销售部'] 
}

// 部门-小组映射
var GROUPS = {
  '技术部': ['前端组', '后端组', '运维组'],
  '市场部': ['推广组', '调研组'],
  '销售部': ['演示组', '渠道组'],
  '产品部': ['产品组', '设计组'],
  '研发部': ['移动组', '平台组'],
  '运营部': ['策划组', '执行组'],
  '客服部': ['售前组', '售后组']
}

// 分析维度  
var DIM_OPTS = [
  { label: '年度', value: 'year' },
  { label: '单位', value: 'company' },
  { label: '人员', value: 'role' },
  { label: '指标', value: 'level' }
]

// 维度钻取链  
var DP_MAP = {
  year:    ['year', 'company', 'department', 'group', 'name'],
  company: ['company', 'department', 'group', 'name'],
  role:    ['role', 'company', 'department', 'group', 'name'],
  level:   ['level', 'company', 'department', 'group', 'name']
}

// 不支持维度切换的图表类型
var DNS = [ 'wordcloud', 'sankey', 'boxplot', 'nestedpie', 'funnel']
// 支持指标切换的图表类型
var MYS = ['pie', 'rose', 'funnel']
// ---- 指标等级 ----
var LEVEL_ORDER = ['待评估', '不合格', '合格', '良好', '优秀']
function getLevel(score) {
  var s = Number(score) || 0
  if (s === 0) return '待评估'
  if (s < 60) return '不合格'
  if (s < 80) return '合格'
  if (s < 90) return '良好'
  return '优秀'
}

// 表格列配置  
var TABLECOLS = [
  { label: '单位',   prop: 'company', width: 100 },
  { label: '部门',   prop: 'department', width: 100 },
  { label: '小组',   prop: 'group', width: 100 },
  { label: '角色',   prop: 'role', width: 70 },
  { label: '姓名',   prop: 'name', width: 70 },
  { label: '年龄',   prop: 'age', width: 70 },
  { label: '学历',   prop: 'education', width: 70 },
  { label: '邮箱',   prop: 'email', width: 200},
  { label: '电话',   prop: 'phone' }
]

export {
  FIELDS, DEPTS, GROUPS, DIM_OPTS, DP_MAP, DNS, MYS, LEVEL_ORDER, getLevel, TABLECOLS 
}