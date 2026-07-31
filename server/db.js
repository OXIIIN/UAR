// ----导入依赖----
const initSqlJs = require('sql.js')
const fs = require('fs')

let db
const dbPath = './data.db'

// ----导入5张表模块----
const dataTable = require('./table_data')
const locationTable = require('./table_location')
const jxBaseTable = require('./table_jx_base')
const jxMxTable = require('./table_jx_mx')
const zdTable = require('./table_zd')

var allTables = [dataTable, locationTable, jxBaseTable, jxMxTable, zdTable]

// ----初始化数据库----
function initDB(callback) {
  initSqlJs().then(SQL => {
    if (fs.existsSync(dbPath)) {
      const dbData = fs.readFileSync(dbPath)
      db = new SQL.Database(dbData)
    } else {
      db = new SQL.Database()
    }
    // 清理旧表（兼容从旧版本迁移）
    db.run('DROP TABLE IF EXISTS users')
    // 依次初始化每张表
    allTables.forEach(function (t) { t.init(db) })
    saveDB()
    callback()
  })
}

// ----保存数据库到文件----
function saveDB() {
  const data = db.export()
  const dbData = Buffer.from(data)
  fs.writeFileSync(dbPath, dbData)
}

// ----查询（返回对象数组）----
function queryAll(sql, params) {
  const stmt = db.prepare(sql)
  if (params)
    stmt.bind(params.map(function (p) {
      return p == undefined ? null : p
    }))
  const rows = []
  while (stmt.step()) { rows.push(stmt.getAsObject()) }
  stmt.free()
  return rows
}

// ----执行（INSERT/UPDATE/DELETE）----
function run(sql, params) {
  db.run(sql, params && params.map(function (p) {
    return p == null ? null : p
  }))
  const changes = db.getRowsModified()
  const lastInsertRowid = /^\s*INSERT/i.test(sql)
    ? db.exec('SELECT last_insert_rowid()')[0].values[0][0]
    : null
  saveDB()
  return { lastInsertRowid, changes }
}

module.exports = { initDB, queryAll, run }