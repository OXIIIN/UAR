// ----导入依赖----
const cors = require('cors')
const fetch = require('node-fetch')
const dbModule = require('./db')
const express = require('express')
const { buildReportSQL } = require('../src/utils/reportUtils')

const app = express()
app.use(cors())
app.use(express.json())

const API_KEY = process.env.DASHSCOPE_API_KEY
console.log('API Key:', API_KEY ?
     '已读取（前5位：' + API_KEY.slice(0, 5) + '）' : '未读取到')

// ----提示词----
const SCHEMA = `共5张表：

1. 主数据表 YYGL_DATA_TABLE：
ZZDWNM(组织单元内码,层级编码如'001','001001','001001001'),
ZZDWMC(组织单元名称), ZZDWXH(组织单元序号),
ND(年度,整数,取值2020-2025),
GLJG(合作机构编码), GLJGMC(合作机构名称,取值:集团总部/战略投资部/区域管理中心), GLJGXH(合作机构序号),
RWID(任务ID), RWMC(任务名称), RWLXNM(任务类型编码),
XMID(项目ID), XMMC(项目名称),
RYLBMC(人员类别,取值:普通/骨干/核心), DWGS(涉及考核单位数,文本),
RYZS(员工总数,数值), JXZF(绩效总分,数值),
HYRS(活跃人数), HYJXZF(活跃绩效总分),
WJHRS(未激活人数), WJHJXZF(未激活绩效总分),
YFBRS(已封禁人数), YFBJXZF(已封禁绩效总分),
DCRS(待评估人数), DCJXZF(待评估绩效总分),
HYL(活跃率%,数值), JXPJFL(绩效达标率%,数值),
PARENTID(上级组织单元内码)

2. 经纬度表 DW_LOCATION_TABLE：
NM(主键,组织单元内码), JD(经度), WD(纬度), DMMC(地区名称), DMNM(单位名称)
与主表通过 NM = ZZDWNM 关联

3. 指标关联表 JX_BASE_TABLE：
ZZDWNM(组织单元内码), RWID(任务ID), XMID(项目ID), ND(年度), RYLBMC(人员类别), JXKEY(指标主键)
与主表通过 ZZDWNM 关联，与明细表通过 JXKEY 关联

4. 指标明细表 JX_MX_TABLE：
JXKEY(指标主键), TYPE(类型:jxlx=指标类型/title=指标名称/value=数值/jldw=计量单位), VALUE(值)
KV结构，一条指标对应4行（jxlx/title/value/jldw）

5. 字典表 YYGL_ZD_TABLE：
SSLX(所属类型:RYLBMC=人员类别/GLJG=合作机构/JXSJ=绩效目标), MC(名称或值), NM(关联编码), XH(序号)`

const SYSTEM_PROMPT = `你是一个数据分析助手。用户会用自然语言提问数据相关问题。
请根据问题生成 SQLite 语法的 SQL 查询语句。
返回格式必须严格为以下 JSON，不要包含任何其他文字或代码块标记：
{"sql":"SELECT ...","chart_type":"bar","title":"图表标题"}
chart_type 只能是：bar, line, pie, radar, scatter
SQL 规则：
1. 员工总数汇总用 SUM(RYZS)，绩效总分汇总用 SUM(JXZF)
2. 平均绩效分：ROUND(SUM(JXZF*1.0)/NULLIF(SUM(RYZS),0),1)
3. 活跃率：ROUND(100.0*SUM(HYRS)/NULLIF(SUM(RYZS),0),1)
4. 绩效达标率：ROUND(100.0*SUM(JXZF)/NULLIF(SUM(RYZS*100.0),0),1)
5. 查询结果第一列是分组维度（图表分类轴），第二列是统计结果（图表数值轴）
6. 按组织名称查询用 ZZDWMC，按年度查询用 ND
数据表结构：${SCHEMA}`

// ----AI 分析-----
app.post('/api/ask', async (req, res) => {
  const question = req.body.question
  if (!question || !question.trim()) {
    return res.json({ success: false, error: '请输入问题' })
  }
  try {
    const resp = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: 'qwen3.7-flash-2026-07-15',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: question }
          ],
          temperature: 0.2
        })
      }
    )
    const data = await resp.json()
    console.log('API 响应：', JSON.stringify(data, null, 2))
    if (data.error) {
      return res.json({ success: false, error: data.error.message || JSON.stringify(data.error) })
    }
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.json({ success: false, error: 'API返回格式异常：' + JSON.stringify(data) })
    }
    const content = data.choices[0].message.content
    console.log('大模型原始返回：', content)
    const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const result = JSON.parse(jsonStr)
    res.json({ success: true, data: result })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// 执行SQL
app.post('/api/query', (req, res) => {
  try {
    const sql = req.body.sql
    if (!sql || !sql.trim().toUpperCase().startsWith('SELECT')) {
      return res.json({ success: false, error: '只允许查询操作' })
    }
    res.json({ success: true, data: dbModule.queryAll(sql) })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// 查询数据列表（支持搜索）
app.get('/api/users', (req, res) => {
  const search = req.query.search || ''
  let data
  if (search) {
    const fields = [
      'ZZDWNM', 'ZZDWMC', 'CAST(ND AS TEXT)', 'GLJGMC', 'RWID', 'RWMC',
      'XMID', 'XMMC', 'RYLBMC', 'DWGS'
    ]
    const sql = 'SELECT rowid as id, * FROM YYGL_DATA_TABLE WHERE ' +
      fields.map(f => f + ' LIKE ?').join(' OR ') +
      ' ORDER BY ZZDWNM, ND DESC'
    const params = fields.map(() => '%' + search + '%')
    data = dbModule.queryAll(sql, params)
  } else {
    data = dbModule.queryAll(
      'SELECT rowid as id, * FROM YYGL_DATA_TABLE ORDER BY ZZDWNM, ND DESC'
    )
  }
  res.json({ success: true, data: data })
})

// 新增数据
app.post('/api/users', (req, res) => {
  const u = req.body
  const result = dbModule.run(
    'INSERT INTO YYGL_DATA_TABLE (ZZDWNM,ZZDWMC,ZZDWXH,ND,GLJG,GLJGMC,GLJGXH,RWID,RWMC,RWLXNM,XMID,XMMC,RYLBMC,DWGS,RYZS,JXZF,HYRS,HYJXZF,WJHRS,WJHJXZF,YFBRS,YFBJXZF,DCRS,DCJXZF,HYL,JXPJFL,PARENTID) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [u.ZZDWNM, u.ZZDWMC, u.ZZDWXH, u.ND, u.GLJG, u.GLJGMC, u.GLJGXH,
     u.RWID, u.RWMC, u.RWLXNM, u.XMID, u.XMMC, u.RYLBMC, u.DWGS,
     u.RYZS||0, u.JXZF||0, u.HYRS||0, u.HYJXZF||0,
     u.WJHRS||0, u.WJHJXZF||0, u.YFBRS||0, u.YFBJXZF||0,
     u.DCRS||0, u.DCJXZF||0, u.HYL||0, u.JXPJFL||0, u.PARENTID]
  )
  if (result.changes === 0) return res.json({ success: false, error: '新增失败' })
  res.json({ success: true, id: result.lastInsertRowid })
})

// 编辑数据
app.put('/api/users/:id', (req, res) => {
  const u = req.body
  dbModule.run(
    'UPDATE YYGL_DATA_TABLE SET ZZDWNM=?,ZZDWMC=?,ZZDWXH=?,ND=?,GLJG=?,GLJGMC=?,GLJGXH=?,RWID=?,RWMC=?,RWLXNM=?,XMID=?,XMMC=?,RYLBMC=?,DWGS=?,RYZS=?,JXZF=?,HYRS=?,HYJXZF=?,WJHRS=?,WJHJXZF=?,YFBRS=?,YFBJXZF=?,DCRS=?,DCJXZF=?,HYL=?,JXPJFL=?,PARENTID=? WHERE rowid=?',
    [u.ZZDWNM, u.ZZDWMC, u.ZZDWXH, u.ND, u.GLJG, u.GLJGMC, u.GLJGXH,
     u.RWID, u.RWMC, u.RWLXNM, u.XMID, u.XMMC, u.RYLBMC, u.DWGS,
     u.RYZS, u.JXZF, u.HYRS, u.HYJXZF,
     u.WJHRS, u.WJHJXZF, u.YFBRS, u.YFBJXZF,
     u.DCRS, u.DCJXZF, u.HYL, u.JXPJFL, u.PARENTID,
     Number(req.params.id)]
  )
  res.json({ success: true })
})

// 删除数据
app.delete('/api/users/:id', (req, res) => {
  dbModule.run('DELETE FROM YYGL_DATA_TABLE WHERE rowid=?', [Number(req.params.id)])
  res.json({ success: true })
})

// 批量删除
app.post('/api/users/batch-delete', (req, res) => {
  const ids = req.body.ids
  const placeholders = ids.map(() => '?').join(',')
  const result = dbModule.run(
    'DELETE FROM YYGL_DATA_TABLE WHERE rowid IN (' + placeholders + ')', ids
  )
  res.json({ success: true, deleted: result.changes })
})

// ----报表聚合查询----
app.post('/api/report', (req, res) => {
  try {
    const { dims, selectedGroups } = req.body
    const sql = buildReportSQL(dims, selectedGroups || [])
    console.log('报表SQL：', sql)
    const rows = dbModule.queryAll(sql)
    res.json({ success: true, data: rows, sql: sql })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// 查询经纬度数据（供热力图使用）
app.get('/api/locations', (req, res) => {
  try {
    var rows = dbModule.queryAll('SELECT * FROM DW_LOCATION_TABLE')
    res.json({ success: true, data: rows })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ----字典查询----
app.get('/api/dict/:type', (req, res) => {
  try {
    var rows = dbModule.queryAll(
      'SELECT MC, NM, XH FROM YYGL_ZD_TABLE WHERE SSLX = ? ORDER BY XH',
      [req.params.type]
    )
    res.json({ success: true, data: rows })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})
// 更新字典
app.put('/api/dict/:type', (req, res) => {
  try {
    var mc = req.body.MC
    if (mc == null) return res.json({ success: false, error: '缺少 MC 参数' })
    dbModule.run('UPDATE YYGL_ZD_TABLE SET MC = ? WHERE SSLX = ?', [mc, req.params.type])
    res.json({ success: true })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ----指标查询----
app.get('/api/indicators', (req, res) => {
  try {
    var zzdwnm = req.query.zzdwnm || ''
    if (!zzdwnm) return res.json({ success: true, data: [] })
    var rows = dbModule.queryAll(
      'SELECT b.ZZDWNM, b.RWID, b.XMID, b.ND, b.RYLBMC, b.JXKEY, m.TYPE, m.VALUE FROM JX_BASE_TABLE b LEFT JOIN JX_MX_TABLE m ON b.JXKEY = m.JXKEY WHERE b.ZZDWNM = ? ORDER BY b.JXKEY, m.TYPE',
      [zzdwnm]
    )
    res.json({ success: true, data: rows })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ----启动服务器----
dbModule.initDB(() => {
  app.listen(3001, function () {
    console.log('AI 分析服务已启动，端口 3001')
  })
})