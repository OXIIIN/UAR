// JX_MX_TABLE — 指标明细表（对应原 ZB_MX_TABLE）

// ============ 字段说明 ============
  // JXKEY 关联主键（对应 JX_BASE_TABLE.JXKEY）
  // TYPE  类型：jxlx=指标类型 / title=指标名称 / value=数值 / jldw=计量单位
  // VALUE 值
function init(db) {
  var rows = [
    ['JX1001','jxlx',  '考核类'],
    ['JX1001','title', '人均绩效分'],
    ['JX1001','value', '74.5'],
    ['JX1001','jldw',  '分'],
    ['JX1002','jxlx',  '考核类'],
    ['JX1002','title', '活跃率'],
    ['JX1002','value', '81.8'],
    ['JX1002','jldw',  '%'],
    ['JX1003','jxlx',  '管理类'],
    ['JX1003','title', '部门覆盖率'],
    ['JX1003','value', '100'],
    ['JX1003','jldw',  '%'],
    ['JX1004','jxlx',  '考核类'],
    ['JX1004','title', '人均绩效分'],
    ['JX1004','value', '73.0'],
    ['JX1004','jldw',  '分'],
    ['JX1005','jxlx',  '考核类'],
    ['JX1005','title', '活跃率'],
    ['JX1005','value', '85.7'],
    ['JX1005','jldw',  '%'],
    ['JX1006','jxlx',  '管理类'],
    ['JX1006','title', '出勤达标率'],
    ['JX1006','value', '92.3'],
    ['JX1006','jldw',  '%']
  ]

  require('./db').initTable(db,
    `CREATE TABLE IF NOT EXISTS JX_MX_TABLE (
      JXKEY TEXT,
      TYPE  TEXT,
      VALUE TEXT
    )`,
    'JX_MX_TABLE',
    function (db) {
      var stmt = db.prepare('INSERT INTO JX_MX_TABLE (JXKEY,TYPE,VALUE) VALUES (?,?,?)')
      rows.forEach(function (r) { stmt.run(r) })
      stmt.free()
      console.log('已插入 ' + rows.length + ' 条 JX_MX_TABLE 初始数据')
    }
  )
}

module.exports = { init: init }