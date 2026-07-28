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
const SCHEMA = `数据表 users，字段如下：
id(整数,主键),
status(状态，取值：活跃/未激活/已封禁),
company(单位，取值：成都总部/重庆分部/绵阳分部/上海分部/广州分部),
department(部门), "group"(小组),
role(角色，取值：部长/组长/员工),
name(姓名), age(年龄，整数), education(学历，取值：大专/本科/硕士/博士),
email(邮箱), phone(电话), address(地址),
project(项目，取值：项目A/项目B/项目C/项目D/未分配),
year(年度，取值：2020/2021/2022/2023/2024),
quarter(季度，取值：Q1/Q2/Q3/Q4),
score(绩效分数，0-100), attendance(考勤分，0-100)

单位-部门映射：成都总部(技术部/产品部)、重庆分部(运营部/客服部)、绵阳分部(研发部)、上海分部(市场部)、广州分部(销售部)
各部门小组：技术部(前端组/后端组/运维组)、产品部(产品组/设计组)、运营部(策划组/执行组)、客服部(售前组/售后组)、研发部(移动组/平台组)、市场部(推广组/调研组)、销售部(演示组/渠道组)`

const SYSTEM_PROMPT = `你是一个数据分析助手。用户会用自然语言提问数据相关问题。

请根据问题生成 SQLite 语法的 SQL 查询语句。

返回格式必须严格为以下 JSON，不要包含任何其他文字、代码块标记或解释：
{
  "sql": "SELECT ... FROM users WHERE ... GROUP BY ...",
  "chart_type": "bar",
  "title": "图表标题"
}

chart_type 只能是：bar, line, pie, radar, scatter

SQL 规则：
1. "group" 是保留字，所有引用 group 字段的地方必须写成 "group"（双引号包裹）
   例如 SELECT "group", COUNT(*) ... GROUP BY "group"
2. 统计列必须使用以下固定别名（as 关键字）：
   - 统计人数：COUNT(*) as count
   - 平均分：ROUND(AVG(score), 1) as avg
   - 最高分：MAX(score) as max
   - 最低分：MIN(score) as min
   - 平均考勤分：ROUND(AVG(attendance), 1) as avg_attendance
3. 查询结果的第一列必须是分组维度（用于图表分类轴），第二列必须是统计结果（用于图表数值轴）
4. 不要使用 SUM 函数，本项目没有求和场景

数据表结构：
${SCHEMA}`

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
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: question }
          ],
          temperature: 0.2
        })
      }
    )
    const data = await resp.json()// 解析响应
    console.log('API 响应：', JSON.stringify(data, null, 2))
    if (data.error) {
      return res.json({ success: false, error: data.error.message || JSON.stringify(data.error) })
    }
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.json({ success: false, error: 'API返回格式异常：' + JSON.stringify(data) })
    }
    const content = data.choices[0].message.content// 提取并解析大模型的回答
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

// 查询用户列表（支持搜索）
app.get('/api/users', (req, res) => {
  const search = req.query.search || ''
  let users
  if (search) {
    const fields = [
      'status', 'company', 'department', '"group"', 'role',
      'name', 'age', 'education', 'email', 'phone', 'address',
      'project', 'year', 'quarter'
    ]
    const sql = 'SELECT * FROM users WHERE ' + fields.map(f => f + ' LIKE ?').join(' OR ')
    const params = fields.map(() => '%' + search + '%')
    users = dbModule.queryAll(sql + ' ORDER BY id DESC', params)
  } else {
    users = dbModule.queryAll('SELECT * FROM users ORDER BY id DESC')
  }
  res.json({ success: true, data: users })
})

// 新增用户
app.post('/api/users', (req, res) => {
  const u = req.body
  const result = dbModule.run(
    'INSERT INTO users (status, company, department, "group", role, name, age, education, email, phone, address, project, year, quarter, score, attendance) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    ['未激活', u.company, u.department, u.group, u.role || '员工', u.name, u.age || 25, u.education || '本科', u.email, u.phone || '未填写', u.address || '未填写', u.project || '未分配', u.year || '2024', u.quarter || 'Q1', 0, 0]
  )
  if (result.changes === 0) return res.json({ success: false, error: '新增失败' })
  res.json({ success: true, id: result.lastInsertRowid })
})

// 编辑用户
app.put('/api/users/:id', (req, res) => {
  const u = req.body
  dbModule.run(
    'UPDATE users SET status=?, company=?, department=?, "group"=?, role=?, name=?, age=?, education=?, email=?, phone=?, address=?, project=?, year=?, quarter=?, score=?, attendance=? WHERE id=?',
    [u.status, u.company, u.department, u.group, u.role, u.name, u.age, u.education, u.email, u.phone, u.address, u.project, u.year, u.quarter, u.score, u.attendance, Number(req.params.id)]
  )
  res.json({ success: true })
})

// 删除用户
app.delete('/api/users/:id', (req, res) => {
  dbModule.run('DELETE FROM users WHERE id=?', [Number(req.params.id)])
  res.json({ success: true })
})

// 批量删除
app.post('/api/users/batch-delete', (req, res) => {
  const ids = req.body.ids
  const placeholders = ids.map(() => '?').join(',')
  const result = dbModule.run(`DELETE FROM users WHERE id IN (${placeholders})`, ids)
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

// ----启动服务器----
dbModule.initDB(() => {
  app.listen(3001, function () {
    console.log('AI 分析服务已启动，端口 3001')
  })
})