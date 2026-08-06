// ---- 导入依赖 ----
const cors = require('cors')                              
const fetch = require('node-fetch')                     
const dbModule = require('./db')                       
const express = require('express')                       
const { buildReportSQL } = require('../src/utils/reportUtils') 
const { SYSTEM_PROMPT } = require('./prompt') 

const app = express()
app.use(cors())                                          
app.use(express.json())                                   

// ---- API Key ----
const API_KEY = process.env.DASHSCOPE_API_KEY
console.log('API Key:', API_KEY
  ? '已读取（前5位：' + API_KEY.slice(0, 5) + '）'
  : '未读取到')

// ============ AI 分析 ============
app.post('/api/ask', async function (req, res) {// 提问AI返回sql
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
          'Authorization': 'Bearer ' + API_KEY
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

    // 提取 AI 返回的文本内容
    const content = data.choices[0].message.content
    console.log('大模型原始返回：', content)

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return res.json({ success: false, error: 'AI未返回有效JSON：' + content })
    }

    const result = JSON.parse(jsonMatch[0])
    
    res.json({ success: true, data: result })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

app.post('/api/query', function (req, res) {// 执行 AI 生成的 SQL 
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

// ============ 用户 ============
app.get('/api/users', function (req, res) {// 查询数据列表（支持搜索） 
  try {
    const search = req.query.search || ''
    let data

    if (search) {
      const fields = [// 搜索字段
        'ZZDWNM', 'ZZDWMC', 'CAST(ND AS TEXT)', 'GLJGMC', 'RWID', 'RWMC',
        'XMID', 'XMMC', 'RYLBMC', 'DWGS'
      ]
      const sql = 'SELECT rowid as id, * FROM YYGL_DATA_TABLE WHERE ' +
        fields.map(function (f) { return f + ' LIKE ?' }).join(' OR ') +
        ' ORDER BY ZZDWNM, ND DESC'
      const params = fields.map(function () { return '%' + search + '%' })
      data = dbModule.queryAll(sql, params)
    } else {
      data = dbModule.queryAll(
        'SELECT rowid as id, * FROM YYGL_DATA_TABLE ORDER BY ZZDWNM, ND DESC'
      )
    }

    res.json({ success: true, data: data })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

app.post('/api/users', function (req, res) {// 接收前端表单数据，插入主数据表
  try {
    const u = req.body
    if (!u || !u.ZZDWMC) {
      return res.json({ success: false, error: '缺少必填字段' })
    }

    const result = dbModule.run(
      'INSERT INTO YYGL_DATA_TABLE (ZZDWNM,ZZDWMC,ZZDWXH,ND,GLJG,GLJGMC,GLJGXH,RWID,RWMC,RWLXNM,XMID,XMMC,RYLBMC,DWGS,RYZS,JXZF,HYRS,HYJXZF,WJHRS,WJHJXZF,YFBRS,YFBJXZF,DCRS,DCJXZF,HYL,JXPJFL,PARENTID) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [u.ZZDWNM, u.ZZDWMC, u.ZZDWXH, u.ND, u.GLJG, u.GLJGMC, u.GLJGXH,
       u.RWID, u.RWMC, u.RWLXNM, u.XMID, u.XMMC, u.RYLBMC, u.DWGS,
       u.RYZS || 0, u.JXZF || 0, u.HYRS || 0, u.HYJXZF || 0,
       u.WJHRS || 0, u.WJHJXZF || 0, u.YFBRS || 0, u.YFBJXZF || 0,
       u.DCRS || 0, u.DCJXZF || 0, u.HYL || 0, u.JXPJFL || 0, u.PARENTID]
    )

    if (result.changes === 0) {
      return res.json({ success: false, error: '新增失败' })
    }
    res.json({ success: true, id: result.lastInsertRowid })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

app.put('/api/users/:id', function (req, res) {// 编辑数据 
  try {
    const id = Number(req.params.id)
    if (!id || id <= 0) {
      return res.json({ success: false, error: '无效的记录ID' })
    }

    const u = req.body
    dbModule.run(
      'UPDATE YYGL_DATA_TABLE SET ZZDWNM=?,ZZDWMC=?,ZZDWXH=?,ND=?,GLJG=?,GLJGMC=?,GLJGXH=?,RWID=?,RWMC=?,RWLXNM=?,XMID=?,XMMC=?,RYLBMC=?,DWGS=?,RYZS=?,JXZF=?,HYRS=?,HYJXZF=?,WJHRS=?,WJHJXZF=?,YFBRS=?,YFBJXZF=?,DCRS=?,DCJXZF=?,HYL=?,JXPJFL=?,PARENTID=? WHERE rowid=?',
      [u.ZZDWNM, u.ZZDWMC, u.ZZDWXH, u.ND, u.GLJG, u.GLJGMC, u.GLJGXH,
       u.RWID, u.RWMC, u.RWLXNM, u.XMID, u.XMMC, u.RYLBMC, u.DWGS,
       u.RYZS, u.JXZF, u.HYRS, u.HYJXZF,
       u.WJHRS, u.WJHJXZF, u.YFBRS, u.YFBJXZF,
       u.DCRS, u.DCJXZF, u.HYL, u.JXPJFL, u.PARENTID,
       id]
    )
    res.json({ success: true })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

app.delete('/api/users/:id', function (req, res) {// 删除
  try {
    dbModule.run('DELETE FROM YYGL_DATA_TABLE WHERE rowid=?', [Number(req.params.id)])
    res.json({ success: true })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

app.post('/api/users/batch-delete', function (req, res) {// 批量删除
  try {
    const ids = req.body.ids

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: false, error: '请选择要删除的记录' })
    }

    const placeholders = ids.map(function () { return '?' }).join(',')
    const result = dbModule.run(
      'DELETE FROM YYGL_DATA_TABLE WHERE rowid IN (' + placeholders + ')', ids
    )
    res.json({ success: true, deleted: result.changes })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ============ 报表 & 字典 ============
app.post('/api/report', function (req, res) {// 接收维度和列组配置，调用 buildReportSQL 生成 SQL 后执行
  try {
    const dims = req.body.dims
    const selectedGroups = req.body.selectedGroups || []
    const sql = buildReportSQL(dims, selectedGroups)
    console.log('报表SQL：', sql)
    const rows = dbModule.queryAll(sql)
    res.json({ success: true, data: rows, sql: sql })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

app.get('/api/locations', function (req, res) {// 经纬度数据（热力图使用） 
  try {
    const rows = dbModule.queryAll('SELECT * FROM DW_LOCATION_TABLE')
    res.json({ success: true, data: rows })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

app.get('/api/dict/:type', function (req, res) {// 按 SSLX（所属类型）查询字典项，返回名称、编码、序号
  try {
    const rows = dbModule.queryAll(
      'SELECT MC, NM, XH FROM YYGL_ZD_TABLE WHERE SSLX = ? ORDER BY XH',
      [req.params.type]
    )
    res.json({ success: true, data: rows })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

app.put('/api/dict/:type', function (req, res) {//更新该类型下所有行（适用于 HEADER / INITHEADER 等单行类型）
  try {
    const mc = req.body.MC
    if (mc == null) {
      return res.json({ success: false, error: '缺少 MC 参数' })
    }
    const result = dbModule.run(
      'UPDATE YYGL_ZD_TABLE SET MC = ? WHERE SSLX = ?',
      [mc, req.params.type]
    )
    res.json({ success: true, changes: result.changes })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

app.get('/api/indicators', function (req, res) {// 通过 JXKEY 关联 JX_BASE_TABLE 和 JX_MX_TABLE，返回指定组织单元的所有指标及其 KV 明细
  try {
    const zzdwnm = req.query.zzdwnm || ''
    if (!zzdwnm) {
      return res.json({ success: true, data: [] })
    }

    const rows = dbModule.queryAll(
      'SELECT b.ZZDWNM, b.RWID, b.XMID, b.ND, b.RYLBMC, b.JXKEY, m.TYPE, m.VALUE ' +
      'FROM JX_BASE_TABLE b LEFT JOIN JX_MX_TABLE m ON b.JXKEY = m.JXKEY ' +
      'WHERE b.ZZDWNM = ? ORDER BY b.JXKEY, m.TYPE',
      [zzdwnm]
    )
    res.json({ success: true, data: rows })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ---- 启动服务器 ----
dbModule.initDB().then(function () {
  app.listen(3001, function () {
    console.log('AI 分析服务已启动，端口 3001')
  })
}).catch(function (err) {
  console.error('启动失败：', err)
  process.exit(1)  
})