// ---- 导入依赖 ----
var initSqlJs = require('sql.js')   
var fs = require('fs')             

// ---- 模块级变量 ----
var db = null
var dbPath = './data.db'           

// ---- 导入表模块 ----
var allTables = [
  require('./table_data'),       // 主数据表 YYGL_DATA_TABLE
  require('./table_location'),   // 经纬度表 DW_LOCATION_TABLE
  require('./table_jx_base'),    // 指标关联表 JX_BASE_TABLE
  require('./table_jx_mx'),      // 指标明细表 JX_MX_TABLE
  require('./table_zd')          // 字典表 YYGL_ZD_TABLE
]

// ---- 参数标准化函数 ----
function normalizeParams(params) {// 将 JS 中的各种"空值"（undefined / null）统一转为 null
  if (!params) return []
  return params.map(function (p) { return p == null ? null : p })
}

// ---- 初始化数据库 ----
function initDB(callback) {
  return initSqlJs().then(function (SQL) {
    if (fs.existsSync(dbPath)) {
      var buf = fs.readFileSync(dbPath)
      db = new SQL.Database(buf)  // sql.js 接受 Uint8Array 或 Buffer
    } else {
      db = new SQL.Database()
    }
    // 依次调用每张表模块的 init 方法
    allTables.forEach(function (t) { t.init(db) })
    saveDB()

  }).catch(function (err) {
    console.error('数据库初始化失败：', err)
    throw err
  })
}
// ---- 保存数据库到文件 ----
function saveDB() {
  var data = db.export()
  var buf = Buffer.from(data)
  fs.writeFileSync(dbPath, buf)
}

// ---- 初始化单张表 ----
function initTable(db, createSQL, tableName, seedFn) {
  db.run(createSQL)
  var result = db.exec('SELECT COUNT(*) FROM ' + tableName)
  if (result[0].values[0][0] > 0) return
  seedFn(db)
}

// ---- 查询（返回对象数组） ----
function queryAll(sql, params) {// 返回：[{ id: 123, name: 'xxx' }, ...]
  if (!db) throw new Error('数据库尚未初始化，请先调用 initDB()')
  var stmt = db.prepare(sql)// 把 SQL 字符串编译成一条预处理语句（支持参数绑定，防止SQL注入）
  if (params) stmt.bind(normalizeParams(params))// 绑定参数
  var rows = []
  while (stmt.step()) {// step() 逐行遍历结果集，getAsObject() 将当前行转为 { 列名: 值 } 的对象
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

// ---- 执行（INSERT / UPDATE / DELETE） ----
function run(sql, params) {// 返回：{ lastInsertRowid: 5, changes: 1 }
  if (!db) throw new Error('数据库尚未初始化，请先调用 initDB()')
  db.run(sql, normalizeParams(params))
  var changes = db.getRowsModified()// getRowsModified() 返回本次操作影响的行数
  // 只有 INSERT 操作需要获取自增主键（last_insert_rowid）
  // 用正则判断 SQL 语句类型：^\s* 允许前面有空白，/i 忽略大小写
  var isInsert = /^\s*INSERT/i.test(sql)
  var lastInsertRowid = isInsert
    ? db.exec('SELECT last_insert_rowid()')[0].values[0][0]
    : null

  saveDB()
  return { lastInsertRowid: lastInsertRowid, changes: changes }
}

// ---- 导出 ----
module.exports = { initDB: initDB, queryAll: queryAll, run: run, initTable: initTable }