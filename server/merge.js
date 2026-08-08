// merge.js — 代码合并工具（仅用于记录归档）
// 用法：node merge.js

const fs = require('fs')
const path = require('path')

// ============================================================
//  配置：在这里指定要合并的文件路径
// ============================================================
const groups = [
  {
    name: '前端工具层',
    output: 'merged_utils.txt',
    files: [
      '../src/utils/userListUtils.js',
      '../src/utils/reportUtils.js',
      '../src/utils/chartUtils.js',
      '../src/utils/exportUtils.js'
    ]
  },
  {
    name: '后端服务',
    output: 'merged_server.txt',
    files: [
      './db.js',
      './prompt.js',
      './server.js',
      './table_data.js',
      './table_jx_base.js',
      './table_jx_mx.js',
      './table_location.js',
      './table_zd.js'
    ]
  },
  {
    name: '前端页面',
    output: 'merged_pages.txt',
    files: [
      '../src/views/UserListPage.vue',
      '../src/views/ReportPage.vue'
    ]
  }
]

// ============================================================
//  执行合并
// ============================================================
const separator = '\n' + '='.repeat(80) + '\n'

groups.forEach(function (group) {
  var parts = []

  parts.push('【' + group.name + '】合并时间：' + new Date().toLocaleString())
  parts.push('文件列表：' + group.files.join(', '))

  group.files.forEach(function (relPath) {
    var absPath = path.resolve(__dirname, relPath)
    try {
      var content = fs.readFileSync(absPath, 'utf-8')
      parts.push(separator)
      parts.push('📄 ' + relPath + '（' + content.split('\n').length + ' 行）')
      parts.push(separator)
      parts.push(content)
    } catch (e) {
      parts.push(separator)
      parts.push('❌ ' + relPath + ' — 读取失败：' + e.message)
    }
  })

  var outPath = path.resolve(__dirname, group.output)
  fs.writeFileSync(outPath, parts.join('\n'), 'utf-8')
  console.log('✓ 已生成：' + outPath)
})