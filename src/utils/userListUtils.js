// 组织单元名称列表（弹窗下拉用）
var ORG_NAMES = [
  '成都总部', '技术部', '产品部', '前端组', '后端组', '运维组', '产品组', '设计组',
  '重庆分部', '运营部', '客服部', '策划组', '执行组', '售前组', '售后组',
  '绵阳分部', '研发部', '移动组', '平台组',
  '上海分部', '市场部', '推广组', '调研组',
  '广州分部', '销售部', '演示组', '渠道组'
]

// 用户字段配置（弹窗表单）
var FIELDS = [
  { key: 'ZZDWNM',   label: '组织编码',     modes: ['detail'] },
  { key: 'ZZDWMC',   label: '单位名称',     modes: ['edit', 'detail', 'add'], options: ORG_NAMES },
  { key: 'ND',       label: '年度',         modes: ['edit', 'detail', 'add'], options: ['2020','2021','2022','2023','2024','2025'] },
  { key: 'GLJGMC',   label: '管理机构',     modes: ['edit', 'detail', 'add'], options: ['集团总部'] },
  { key: 'RWMC',     label: '任务名称',     modes: ['edit', 'detail', 'add'], options: ['年度绩效考核','专项技能评估'] },
  { key: 'XMMC',     label: '项目名称',     modes: ['edit', 'detail', 'add'], options: ['项目A','项目B','项目C'] },
  { key: 'RYLBMC',   label: '人员类别',     modes: ['edit', 'detail', 'add'], options: [] },
  { key: 'DWGS',     label: '考核单位数',   modes: ['edit', 'detail', 'add'] },
  { key: 'RYZS',     label: '员工总数',     modes: ['edit', 'detail'] },
  { key: 'JXZF',     label: '绩效总分',     modes: ['edit', 'detail'] },
  { key: 'HYRS',     label: '活跃人数',     modes: ['edit', 'detail'] },
  { key: 'HYJXZF',   label: '活跃绩效总分', modes: ['edit', 'detail'] },
  { key: 'WJHRS',    label: '未激活人数',   modes: ['edit', 'detail'] },
  { key: 'YFBRS',    label: '已封禁人数',   modes: ['edit', 'detail'] },
  { key: 'DCRS',     label: '待评估人数',   modes: ['edit', 'detail'] },
  { key: 'HYL',      label: '活跃率%',      modes: ['edit', 'detail'] },
  { key: 'JXPJFL',   label: '绩效达标率%',  modes: ['edit', 'detail'] },
  { key: 'PARENTID', label: '上级编码',     modes: ['detail'] }
]

// 分析维度
var DIM_OPTS = [
  { label: '年度', value: 'ND' },
  { label: '单位', value: 'ZZDWMC' },
  { label: '项目', value: 'XMMC' },
  { label: '任务', value: 'RWMC' }
]

// 维度钻取链
var DP_MAP = {
  ND:     ['ND',     'ZZDWMC', 'ZZDWMC', 'ZZDWMC', 'RYLBMC'],
  ZZDWMC: ['ZZDWMC', 'ZZDWMC', 'ZZDWMC', 'RYLBMC'],
  XMMC:   ['XMMC',   'ZZDWMC', 'ZZDWMC', 'ZZDWMC', 'RYLBMC'],
  RWMC:   ['RWMC',   'ZZDWMC', 'ZZDWMC', 'ZZDWMC', 'RYLBMC']
}

// 不支持维度切换的图表类型
var DNS = ['wordcloud', 'sankey', 'boxplot', 'nestedpie', 'funnel']

// 支持指标切换的图表类型
var MYS = ['pie', 'rose', 'funnel']

// ---- 组织层级 ----
var LEVEL_ORDER = ['一级单位', '二级单位', '三级单位']

function getOrgLevel(zzdwnm) {
  if (!zzdwnm) return '未知'
  var len = String(zzdwnm).length
  if (len <= 3) return '一级单位'
  if (len <= 6) return '二级单位'
  return '三级单位'
}

// 表格列配置
var TABLECOLS = [
  { label: '单位名称',   prop: 'ZZDWMC',  width: 120 },
  { label: '年度',       prop: 'ND',      width: 70 },
  { label: '管理机构',   prop: 'GLJGMC',  width: 100 },
  { label: '任务名称',   prop: 'RWMC',    width: 120 },
  { label: '项目名称',   prop: 'XMMC',    width: 90 },
  { label: '人员类别',   prop: 'RYLBMC',  width: 80 },
  { label: '员工总数',   prop: 'RYZS',    width: 80 },
  { label: '绩效总分',   prop: 'JXZF',    width: 80 },
  { label: '活跃率',     prop: 'HYL',     width: 80 },
  { label: '绩效达标率', prop: 'JXPJFL',  width: 90 }
]

export {
  FIELDS, ORG_NAMES, DIM_OPTS, DP_MAP, DNS, MYS,
  LEVEL_ORDER, getOrgLevel, TABLECOLS
}