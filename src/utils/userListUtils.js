
// 用户字段配置（弹窗表单）
var FIELDS = [
  { key: 'ZZDWNM',   label: '组织编码',     modes: ['detail'] },
  { key: 'ZZDWMC',   label: '单位名称',     modes: ['edit', 'detail', 'add'], options: []  },
  { key: 'ND',       label: '年度',         modes: ['edit', 'detail', 'add'], options: [] },
  { key: 'GLJGMC',   label: '管理机构',     modes: ['edit', 'detail', 'add'], options: [] },
  { key: 'RWMC',     label: '任务名称',     modes: ['edit', 'detail', 'add'], options: [] },
  { key: 'XMMC',     label: '项目名称',     modes: ['edit', 'detail', 'add'], options: [] },
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
  { label: '任务', value: 'RWMC' },
  { label: '项目', value: 'XMMC' }
]

// 维度钻取链
var DP_MAP = {
  ND:     ['ND',     'ZZDWMC', 'ZZDWMC', 'ZZDWMC', 'RYLBMC'],
  ZZDWMC: ['ZZDWMC', 'ZZDWMC', 'ZZDWMC', 'RYLBMC'],
  XMMC:   ['XMMC',   'ZZDWMC', 'ZZDWMC', 'ZZDWMC', 'RYLBMC'],
  RWMC:   ['RWMC',   'ZZDWMC', 'ZZDWMC', 'ZZDWMC', 'RYLBMC']
}

var POP_TITLES = { detail: '详情', add: '添加', edit: '编辑' }

// 不支持维度切换的图表类型
var DNS = ['wordcloud', 'sankey', 'boxplot', 'nestedpie', 'funnel']

// 不支持钻取的图表类型
var ND = ['funnel', 'bar', 'line']

// 支持指标切换的图表类型
var MYS = ['pie', 'rose', 'funnel']

// ---- 组织层级 ----
var LEVEL_ORDER = ['一级单位', '二级单位', '三级单位']

// 表格列配置
var TABLECOLS = [
  { label: '单位名称',   prop: 'ZZDWMC',  width: 120 },
  { label: '年度',       prop: 'ND',      width: 100 },
  { label: '管理机构',   prop: 'GLJGMC',  width: 120 },
  { label: '任务名称',   prop: 'RWMC',    width: 150 },
  { label: '项目名称',   prop: 'XMMC',    width: 120 },
  { label: '人员类别',   prop: 'RYLBMC',  width: 100 },
  { label: '员工总数',   prop: 'RYZS',    width: 100 },
  { label: '绩效总分',   prop: 'JXZF',    width: 100 },
  { label: '活跃率',     prop: 'HYL',     width: 100 },
  { label: '绩效达标率', prop: 'JXPJFL',  width: 120 }
]

export {
  FIELDS, POP_TITLES, DIM_OPTS, DP_MAP, DNS, ND, MYS,
  LEVEL_ORDER, TABLECOLS,
  // ORG_CODE_MAP, RW_MAP, XM_MAP, GLJG_MAP    
}