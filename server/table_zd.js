// YYGL_ZD_TABLE — 字典表（对应原 ZD_TABLE）
// 存储人员类别枚举、表头JSON配置、绩效目标数据等

function init(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS YYGL_ZD_TABLE (
      SSLX TEXT,
      MC   TEXT,
      NM   TEXT,
      XH   INTEGER
    )
  `)

  var result = db.exec('SELECT COUNT(*) FROM YYGL_ZD_TABLE')
  if (result[0].values[0][0] > 0) return

  var stmt = db.prepare(
    'INSERT INTO YYGL_ZD_TABLE (SSLX,MC,NM,XH) VALUES (?,?,?,?)'
  )

  // ============ 字段说明 ============
  // SSLX 所属类型（RYLBMC=人员类别枚举 / HEADER=表头JSON / INITHEADER=初始表头 / JXMB=绩效数据）
  // MC   名称或值（枚举时为枚举值，HEADER时为JSON字符串，JXMB时为数值）
  // NM   关联编码（JXMB时为组织单元内码）
  // XH   序号

  // 表头配置 JSON（可动态编辑的多层表头结构）
  var headerJSON = JSON.stringify([
    {"id":"f-zzdwmc","type":"field","label":"单位名称","fieldKey":"zzdwmc","align":"left"},
    {"id":"f-nd","type":"field","label":"年度","fieldKey":"nd","align":"left"},
    {"id":"f-rwmc","type":"field","label":"任务名称","fieldKey":"rwmc","align":"left"},
    {"id":"f-xmmc","type":"field","label":"项目名称","fieldKey":"xmmc","align":"left"},
    {"id":"f-gljgmc","type":"field","label":"管理机构","fieldKey":"gljgmc","align":"left"},
    {"id":"f-rylbmc","type":"field","label":"人员类别","fieldKey":"rylbmc","align":"left"},
    {"id":"f-dwgs","type":"field","label":"考核单位数","fieldKey":"dwgs","align":"right"},
    {"id":"f-ryzs","type":"field","label":"员工总数","fieldKey":"ryzs","align":"right"},
    {"id":"f-jxzf","type":"field","label":"绩效总分","fieldKey":"jxzf","align":"right"},
    {"id":"g-jxStats","type":"group","label":"绩效统计","align":"center","children":[
      {"id":"f-jx_avg","type":"field","label":"平均绩效分","fieldKey":"jx_avg","align":"right"},
      {"id":"f-jx_min","type":"field","label":"最低绩效分","fieldKey":"jx_min","align":"right"},
      {"id":"f-jx_max","type":"field","label":"最高绩效分","fieldKey":"jx_max","align":"right"}
    ]},
    {"id":"g-ryzt","type":"group","label":"人员状态分布","align":"center","children":[
      {"id":"g-hy","type":"group","label":"活跃","align":"center","children":[
        {"id":"f-hyrs","type":"field","label":"人数","fieldKey":"hyrs","align":"right"},
        {"id":"f-hyjxzf","type":"field","label":"绩效总分","fieldKey":"hyjxzf","align":"right"}
      ]},
      {"id":"g-wjh","type":"group","label":"未激活","align":"center","children":[
        {"id":"f-wjhrs","type":"field","label":"人数","fieldKey":"wjhrs","align":"right"},
        {"id":"f-wjhjxzf","type":"field","label":"绩效总分","fieldKey":"wjhjxzf","align":"right"}
      ]},
      {"id":"g-yfb","type":"group","label":"已封禁","align":"center","children":[
        {"id":"f-yfbrs","type":"field","label":"人数","fieldKey":"yfbrs","align":"right"},
        {"id":"f-yfbjxzf","type":"field","label":"绩效总分","fieldKey":"yfbjxzf","align":"right"}
      ]},
      {"id":"g-dcp","type":"group","label":"待评估","align":"center","children":[
        {"id":"f-dcrs","type":"field","label":"人数","fieldKey":"dcrs","align":"right"},
        {"id":"f-dcjxzf","type":"field","label":"绩效总分","fieldKey":"dcjxzf","align":"right"}
      ]}
    ]},
    {"id":"g-dbl","type":"group","label":"达标率","align":"center","children":[
      {"id":"f-hyl","type":"field","label":"活跃率%","fieldKey":"hyl","align":"right"},
      {"id":"f-jxpjfl","type":"field","label":"绩效达标率%","fieldKey":"jxpjfl","align":"right"}
    ]}
  ])

  var rows = [
    // ---- 人员类别枚举 ----
    ['RYLBMC',    '普通',        null,      1],
    ['RYLBMC',    '骨干',        null,      2],
    ['RYLBMC',    '核心',        null,      3],
        // ---- 管理机构枚举 ----
    ['GLJG',     '集团总部',        'GLJG001', 1],
    ['GLJG',     '战略投资部',      'GLJG002', 2],
    ['GLJG',     '区域管理部',      'GLJG003', 3],
    // ---- 表头配置 ----
    ['HEADER',    headerJSON,    null,      1],
    // ---- 初始表头状态 ----
    ['INITHEADER',null,          null,      1],
    // ---- 各单位绩效目标值 ----
    ['JXMB',      '75',          '001',     1],
    ['JXMB',      '72',          '002',     1],
    ['JXMB',      '70',          '003',     1],
    ['JXMB',      '73',          '004',     1],
    ['JXMB',      '74',          '005',     1]
  ]

  rows.forEach(function (r) { stmt.run(r) })
  stmt.free()
  console.log('已插入 ' + rows.length + ' 条 YYGL_ZD_TABLE 初始数据')
}

module.exports = { init: init }