// JX_BASE_TABLE — 指标关联表

 // ============ 字段说明 ============
  // ZZDWNM 组织单元内码
  // RWID   任务ID
  // XMID   项目ID
  // ND     年度
  // RYLBMC 人员类别
  // JXKEY  指标关联主键（指向 JX_MX_TABLE.JXKEY）
function init(db) {
  var rows = [
    ['001',   'RW001','XM001','2025','普通','JX1001'],
    ['001',   'RW001','XM001','2025','普通','JX1002'],
    ['001',   'RW001','XM001','2025','普通','JX1003'],
    ['001001','RW001','XM001','2025','普通','JX1004'],
    ['001001','RW001','XM001','2025','普通','JX1005'],
    ['001001','RW001','XM001','2025','普通','JX1006']
  ]

  require('./db').initTable(db,
    `CREATE TABLE IF NOT EXISTS JX_BASE_TABLE (
      ZZDWNM TEXT,
      RWID   TEXT,
      XMID   TEXT,
      ND     TEXT,
      RYLBMC TEXT,
      JXKEY  TEXT
    )`,
    'JX_BASE_TABLE',
    function (db) {
      var stmt = db.prepare('INSERT INTO JX_BASE_TABLE (ZZDWNM,RWID,XMID,ND,RYLBMC,JXKEY) VALUES (?,?,?,?,?,?)')
      rows.forEach(function (r) { stmt.run(r) })
      stmt.free()
      console.log('已插入 ' + rows.length + ' 条 JX_BASE_TABLE 初始数据')
    }
  )
}

module.exports = { init: init }