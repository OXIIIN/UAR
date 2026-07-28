import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/* ---- 通用下载 ---- */
function download(content, fileName, mime) {
  var a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: mime }))
  a.download = fileName
  a.click()
  URL.revokeObjectURL(a.href)
}

/* ---- CSV ---- */
function exportCSV(headers, rows, fileName) {
  var esc = function (v) {// csv字段转义
    var s = String(v == null ? '' : v)
    return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  var lines = [headers.map(esc).join(',')]// 处理表头
  rows.forEach(function (r) { lines.push(r.map(esc).join(',')) })
  download('\uFEFF' + lines.join('\n'), fileName, 'text/csv;charset=utf-8;')
}

/* ---- Word ---- */
function exportWord(headers, rows, fileName, title) {
  var h = '<html><head><meta charset="utf-8">'
  h += '<style>table{border-collapse:collapse;width:100%}'
  h += 'td,th{border:1px solid #999;padding:8px;text-align:center}'
  h += 'th{background:#f0f0f0;font-weight:bold}</style></head><body>'
  h += '<h2 style="text-align:center">' + (title || '') + '</h2>'
  h += '<table><tr>' + headers.map(function (t) { return '<th>' + t + '</th>' }).join('') + '</tr>'
  rows.forEach(function (r) {// 遍历每一行的数据
    h += '<tr>' + r.map(function (v) { return '<td>' + v + '</td>' }).join('') + '</tr>'
  })
  download(h + '</table></body></html>', fileName, 'application/msword;charset=utf-8;')
}

/* ---- PDF ---- */
var PAPER = { A4: [210, 297], A3: [297, 420], Letter: [215.9, 279.4], B5: [176, 250] }
var PDF_CSS = [
  '.pdf-exporting{position:fixed!important;left:-99999px!important;top:0!important;',
  'background:#fff!important;color:#333!important;border-radius:0!important;',
  'min-width:fit-content!important;margin:0!important;padding:10px!important}',
  '.pdf-exporting .no-print,',
  '.pdf-exporting .el-dialog__wrapper,',
  '.pdf-exporting .v-modal{display:none!important}',
  '.pdf-exporting .table-section{background:#fff!important}',
  '.pdf-exporting .el-table th{background:#f5f5f5!important;color:#333!important}',
  '.pdf-exporting .el-table td{background:#fff!important;color:#333!important}',
  '.pdf-exporting .el-table td,',
  '.pdf-exporting .el-table th{border-color:#ccc!important;word-break:break-all!important;font-size:11px!important}',
  '.pdf-exporting .el-table--border{border:1px solid #ccc!important}',
  '.pdf-exporting .el-table__gutter{display:none!important}'
].join('')

async function exportPDF(element, fileName, paperSize, orientation) {
  var tid = 'pdf-' + Date.now()
  element.setAttribute('data-pdf', tid)
  var canvas = await html2canvas(element, {
    scale: 2, backgroundColor: '#fff',
    onclone: function (doc) {// 克隆整个 DOM 到内存中
      var el = doc.querySelector('[data-pdf="' + tid + '"]')
      if (el) {
        el.style.zoom = '1'
        var s = doc.createElement('style');
        s.textContent = PDF_CSS; doc.head.appendChild(s); el.classList.add('pdf-exporting') }
    }
  })
  element.removeAttribute('data-pdf')
  var size = PAPER[paperSize] || PAPER.A4, isL = orientation === 'landscape'
  var pageW = isL ? size[1] : size[0], pageH = isL ? size[0] : size[1]
  var m = 10, cW = pageW - m * 2, cH = pageH - m * 2, ratio = canvas.width / cW
  var pdf = new jsPDF({ orientation: isL ? 'l' : 'p', unit: 'mm', format: paperSize.toLowerCase() })
  if (canvas.height / ratio <= cH) {
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', m, m, cW, canvas.height / ratio)
  } else {
    var srcH = cH * ratio, offset = 0
    while (offset < canvas.height) {
      if (offset > 0) pdf.addPage()
      var h = Math.min(srcH, canvas.height - offset)
      var tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = h
      tmp.getContext('2d').drawImage(canvas, 0, offset, canvas.width, h, 0, 0, canvas.width, h)
      pdf.addImage(tmp.toDataURL('image/png'), 'PNG', m, m, cW, h / ratio)
      offset += srcH
    }
  }
  pdf.save(fileName)
}

export { exportCSV, exportWord, exportPDF }