// ---- 导入依赖 ----
const cors = require('cors')                              
const fetch = require('node-fetch')                     
const dbModule = require('./db')                       
const express = require('express')                       
const { buildReportSQL } = require('../src/utils/reportUtils') 

const app = express()
app.use(cors())                                          
app.use(express.json())                                   

// ---- API Key ----
const API_KEY = process.env.DASHSCOPE_API_KEY
console.log('API Key:', API_KEY
  ? '已读取（前5位：' + API_KEY.slice(0, 5) + '）'
  : '未读取到')

// ---- 提示词 ----
const SCHEMA = `共5张表：

1. 主数据表 YYGL_DATA_TABLE：
ZZDWNM(组织单元内码,层级编码如'001','001001','001001001'),
ZZDWMC(组织单元名称), ZZDWXH(组织单元序号),
ND(年度,整数,取值2020-2025),
GLJG(合作机构编码), GLJGMC(合作机构名称,取值:集团总部/战略投资部/区域管理部), GLJGXH(合作机构序号),
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

 组织层级规则（非常重要）：
 - ZZDWNM长度3位(如'001')=一级单位(总部/分部)，PARENTID为null
 - ZZDWNM长度6位(如'001001')=二级单位(部门)，PARENTID='001'
 - ZZDWNM长度9位(如'001001001')=三级单位(小组)，PARENTID='001001'
 - 查询某单位下所有子级：WHERE ZZDWNM LIKE '父编码%' AND ZZDWNM != '父编码'
 - 按层级过滤：WHERE LENGTH(ZZDWNM)=3只查一级，=6只查二级，=9只查三级

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
SSLX(所属类型:RYLBMC=人员类别/GLJG=合作机构/JXMB=绩效目标), MC(名称或值), NM(关联编码), XH(序号)`

const SYSTEM_PROMPT = `你是一个数据分析助手。用户会用自然语言提问数据相关问题。
请根据问题生成 SQLite 语法的 SQL 查询语句。
返回格式必须严格为以下 JSON，不要包含任何其他文字或代码块标记：
{"sql":"SELECT ...","chart_type":"bar","title":"图表标题"}
chart_type 只能是：pie, bar, line, radar, scatter
在未说明图表类型时，一律使用饼图（pie）
SQL 规则：
1. 员工总数汇总用 SUM(RYZS)，绩效总分汇总用 SUM(JXZF)
2. 平均绩效分：ROUND(SUM(JXZF*1.0)/NULLIF(SUM(RYZS),0),1)
3. 活跃率：ROUND(100.0*SUM(HYRS)/NULLIF(SUM(RYZS),0),1)
4. 绩效达标率：ROUND(100.0*SUM(JXZF)/NULLIF(SUM(RYZS*100.0),0),1)
5. 查询结果第一列是分组维度（图表分类轴），第二列是统计结果（图表数值轴）
6. 按组织名称查询用 ZZDWMC，按年度查询用 ND
组织层级查询规则：
7. 用户说"单位/总部/分部"→ WHERE LENGTH(ZZDWNM)=3（一级单位，如成都总部、重庆分部）
8. 用户说"部门"→ WHERE LENGTH(ZZDWNM)=6（二级单位，如技术部、产品部）
9. 用户说"小组/组"→ WHERE LENGTH(ZZDWNM)=9（三级单位，如前端组、后端组）
10. 用户说"成都总部的部门"→ WHERE ZZDWNM LIKE '001%' AND LENGTH(ZZDWNM)=6
11. 用户说"技术部的小组"→ WHERE ZZDWNM LIKE '001001%' AND LENGTH(ZZDWNM)=9
12. 不指定层级时，默认只查一级单位（LENGTH(ZZDWNM)=3）
数据表结构：${SCHEMA}`


// ---- POST /api/ask ---- AI 分析 ----
app.post('/api/ask', async function (req, res) {
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

// ---- POST /api/query ---- 
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

// ---- GET /api/users ---- 
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

// ---- POST /api/users ---- 
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

// ---- PUT /api/users/:id ---- 
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

// ---- DELETE /api/users/:id ---- 删除单条 ----
app.delete('/api/users/:id', function (req, res) {
  try {
    dbModule.run('DELETE FROM YYGL_DATA_TABLE WHERE rowid=?', [Number(req.params.id)])
    res.json({ success: true })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ---- POST /api/users/batch-delete ---- 批量删除 ----
app.post('/api/users/batch-delete', function (req, res) {
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

// ---- POST /api/report ----
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

// ---- GET /api/locations ---- 
app.get('/api/locations', function (req, res) {// 经纬度数据（热力图使用） 
  try {
    const rows = dbModule.queryAll('SELECT * FROM DW_LOCATION_TABLE')
    res.json({ success: true, data: rows })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
})

// ---- GET /api/dict/:type ---- 
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

// ---- PUT /api/dict/:type ---- 
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

// ---- GET /api/indicators ---- 
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