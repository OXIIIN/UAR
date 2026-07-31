// ============ 配色 ============
var CC = ['#e94560','#4ecb71','#38bdf8','#f0c040','#ff7849','#6c5ce7','#888','#00cec9']
var STS = ['活跃', '未激活', '已封禁', '待评估']
var STS_COLORS = ['#4ecb71', '#888', '#e94560', '#f0c040']
var STS_FIELDS = ['HYRS', 'WJHRS', 'YFBRS', 'DCRS']
var LEG = { bottom: 0, textStyle: { color: '#999' } }

function getOrgLevel(zzdwnm) {
  if (!zzdwnm) return '未知'
  var len = String(zzdwnm).length
  if (len <= 3) return '一级单位'
  if (len <= 6) return '二级单位'
  return '三级单位'
}

function dimVal(r, dim) {
  if (dim === 'orgLevel') return getOrgLevel(r.ZZDWNM)
  return r[dim]
}

function cntStatus(rows, dim, cats, statusIdx) {
  var field = STS_FIELDS[statusIdx]
  return cats.map(function (cat) {
    return rows.filter(function (r) { return dimVal(r, dim) === cat })
      .reduce(function (s, r) { return s + Number(r[field] || 0) }, 0)
  })
}

function avgD(cats, rows, dim, metric) {
  return cats.map(function (cat) {
    var grp = rows.filter(function (r) { return dimVal(r, dim) === cat })
    var totalRyzs = grp.reduce(function (a, r) { return a + Number(r.RYZS || 0) }, 0)
    if (totalRyzs === 0) return { name: cat, value: 0 }
    if (metric === 'avg_attendance' || metric === 'hyl') {
      var totalHyrs = grp.reduce(function (a, r) { return a + Number(r.HYRS || 0) }, 0)
      return { name: cat, value: +(totalHyrs / totalRyzs * 100).toFixed(1) }
    }
    var totalJxzf = grp.reduce(function (a, r) { return a + Number(r.JXZF || 0) }, 0)
    return { name: cat, value: +(totalJxzf / totalRyzs).toFixed(1) }
  })
}

// ============ 图表配置 ============

function stdOpt(cats, S, withLegend, trigger) {
  var o = {
    tooltip: { trigger: trigger || 'axis' },
    grid: { left: 60, right: 20, bottom: 40, top: 20 },
    xAxis: { type: 'category', data: cats, axisLabel: { color: '#999' } },
    yAxis: { type: 'value', axisLabel: { color: '#999' }, splitLine: { lineStyle: { color: '#2a2a4a' } } },
    series: S
  }
  if (withLegend) o.legend = LEG
  return o
}

// KPI 指标卡
function kpiOpt(cats, vals, rows, dim) {
  var data = avgD(cats, rows, dim)
  var total = data.reduce(function (a, d) { return a + d.value }, 0)
  return { cards: data.map(function (d) {
    return { name: d.name, value: d.value, pct: total ? (d.value / total * 100).toFixed(1) + '%' : '-' }
  })}
}

// ---- 热力区域图（从数据库 DW_LOCATION_TABLE 读取坐标，只显示顶级单位） ----
function heatmapOpt(rows, dim, locations) {
  // 1. 从 location 数据构建坐标查找表（DMNM → [经度, 纬度]）
  var locMap = {}
  if (locations && locations.length) {
    locations.forEach(function (loc) {
      locMap[loc.DMNM] = [parseFloat(loc.JD), parseFloat(loc.WD)]
    })
  }

  // 2. 只取顶级单位行（ZZDWNM 长度 <= 3），按单位聚合员工数
  var orgData = {}
  rows.forEach(function (r) {
    if (!r.ZZDWNM || String(r.ZZDWNM).length > 3) return
    var org = r.ZZDWMC
    if (!org || !locMap[org]) return
    if (!orgData[org]) orgData[org] = { total: 0, dimMap: {} }
    var ryzs = Number(r.RYZS || 0)
    orgData[org].total += ryzs
    var dv = dimVal(r, dim) || '未知'
    orgData[org].dimMap[dv] = (orgData[org].dimMap[dv] || 0) + ryzs
  })

  // 3. 转为 ECharts 散点格式
  var data = Object.keys(orgData).map(function (org) {
    return { name: org, value: [locMap[org][0], locMap[org][1], orgData[org].total] }
  })

  return {
    tooltip: {
      trigger: 'item',
      formatter: function (p) {
        var d = orgData[p.data && p.data.name]
        if (!d) return ''
        var lines = Object.keys(d.dimMap).map(function (k) { return k + ': ' + d.dimMap[k] + '人' })
        return p.data.name + '（' + d.total + '人）<br/>' + lines.join('<br/>')
      }
    },
    visualMap: {
      min: 0,
      max: data.length ? Math.max.apply(null, data.map(function (d) { return d.value[2] })) : 1,
      inRange: { color: ['#33b8cc', '#66ccb8', '#ff4f38', '#e62828'] }
    },
    geo: {
      map: 'china', center: [104, 36], zoom: 1.5, aspectScale: 0.75,
      layoutCenter: ['50%', '50%'], layoutSize: '100%',
      itemStyle: { areaColor: '#0d1b2e', borderColor: '#1a3a5c', borderWidth: 1 },
      emphasis: { label: { show: true, color: '#e2e2e2', fontSize: 11 }, itemStyle: { areaColor: '#1a2745' } }
    },
    series: [
      { type: 'heatmap', coordinateSystem: 'geo', data: data, pointSize: 20, blurSize: 34 },
      { type: 'scatter', coordinateSystem: 'geo', data: data, symbolSize: 12,
        label: { show: true, formatter: function (p) { return p.data.name }, position: 'right', color: '#e2e2e2', fontSize: 10 },
        itemStyle: { color: '#e94560', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 2 } }
    ]
  }
}

// ---- 柱状图 ----
function barOpt(type, cats, vals, rows, dim) {
  var S = []
  if (type === 'bar') {
    var dimColors = ['#38bdf8','#f0c040','#e94560','#4ecb71','#6c5ce7','#ff7849','#00cec9','#888']
    S = cats.map(function (cat, i) {
      return {
        name: cat, type: 'bar',
        data: STS.map(function (s, si) {
          return rows.filter(function (r) { return dimVal(r, dim) === cat })
            .reduce(function (sum, r) { return sum + Number(r[STS_FIELDS[si]] || 0) }, 0)
        }),
        itemStyle: { color: dimColors[i % dimColors.length] }, barWidth: '15%'
      }
    })
    return stdOpt(STS, S, true, 'axis')
  }
  if (type === 'stacked' || type === 'multibar') {
    S = STS.map(function (s, i) {
      var r = { name: s, type: 'bar', data: cntStatus(rows, dim, cats, i), itemStyle: { color: STS_COLORS[i] } }
      if (type === 'stacked') r.stack = 't'
      return r
    })
  }
  if (type === 'contrast') {
    var totalRyzs = rows.reduce(function (a, r) { return a + Number(r.RYZS || 0) }, 0)
    var totalJxzf = rows.reduce(function (a, r) { return a + Number(r.JXZF || 0) }, 0)
    var avg = totalRyzs > 0 ? +(totalJxzf / totalRyzs).toFixed(1) : 0
    S = [{ name: '偏离均值', type: 'bar',
      data: avgD(cats, rows, dim).map(function (d) {
        var v = +(d.value - avg).toFixed(1)
        return { name: d.name, value: v, itemStyle: { color: v >= 0 ? '#4ecb71' : '#e94560' } }
      }),
      label: { show: true, position: 'top', color: '#e2e2e2', formatter: function (p) { return (p.value >= 0 ? '+' : '') + p.value } }
    }]
  }
  return stdOpt(cats, S, type !== 'bar', 'axis')
}

function waterfallOpt(cats, vals) {
  var sum = vals.reduce(function (a, b) { return a + b }, 0)
  var newcats = ['合计'].concat(cats), bv = [sum].concat(vals)
  var cum = [0], rem = sum
  for (var i = 1; i < bv.length; i++) { rem -= bv[i]; cum.push(rem) }
  return stdOpt(newcats, [
    { type: 'bar', stack: 'w', data: cum, itemStyle: { color: 'transparent' }, emphasis: { itemStyle: { color: 'transparent' } } },
    { type: 'bar', stack: 'w', data: bv, itemStyle: { color: '#38bdf8' }, label: { show: true, position: 'inside', color: '#e2e2e2' } }
  ])
}

function comboOpt(cats, vals, rows, dim) {
  var avgs = avgD(cats, rows, dim).map(function (d) { return d.value })
  return {
    tooltip: { trigger: 'axis' }, legend: LEG,
    grid: { left: 60, right: 60, bottom: 40, top: 40 },
    xAxis: { type: 'category', data: cats, axisLabel: { color: '#999' } },
    yAxis: [
      { type: 'value', name: '员工数', axisLabel: { color: '#999' }, splitLine: { lineStyle: { color: '#2a2a4a' } } },
      { type: 'value', name: '人均绩效', axisLabel: { color: '#999' }, splitLine: { show: false } }
    ],
    series: [
      { name: '员工数', type: 'bar', data: vals, itemStyle: { color: '#38bdf8' }, barWidth: '40%' },
      { name: '人均绩效', type: 'line', yAxisIndex: 1, data: avgs, smooth: true, itemStyle: { color: '#e94560' }, lineStyle: { color: '#e94560', width: 2 } }
    ]
  }
}

// ---- 折线图 ----
function lineOpt(type, cats, vals, rows, dim) {
  var S = []
  if (type === 'line') {
    S = cats.map(function (cat, i) {
      return {
        name: cat, type: 'line', smooth: true,
        data: STS.map(function (s, si) {
          return rows.filter(function (r) { return dimVal(r, dim) === cat })
            .reduce(function (sum, r) { return sum + Number(r[STS_FIELDS[si]] || 0) }, 0)
        }),
        lineStyle: { color: CC[i % CC.length] }, itemStyle: { color: CC[i % CC.length] },
        areaStyle: { color: 'rgba(56,189,248,0.1)' }
      }
    })
    return stdOpt(STS, S, true, 'axis')
  }
  if (type === 'multiline') {
    S = STS.map(function (s, i) {
      return { name: s, type: 'line', smooth: true, data: cntStatus(rows, dim, cats, i),
        lineStyle: { color: STS_COLORS[i] }, itemStyle: { color: STS_COLORS[i] } }
    })
  }
  if (type === 'rangearea') {
    var areaAlpha = ['rgba(78,203,113,0.2)', 'rgba(136,136,136,0.2)', 'rgba(233,69,96,0.2)', 'rgba(240,192,64,0.2)']
    S = STS.map(function (s, i) {
      return { name: s, type: 'line', smooth: true, data: cntStatus(rows, dim, cats, i),
        lineStyle: { color: STS_COLORS[i], width: 2 }, itemStyle: { color: STS_COLORS[i] },
        areaStyle: { color: areaAlpha[i] } }
    })
    S.push({ name: '合计', type: 'line', smooth: true, data: vals,
      lineStyle: { color: '#f0c040', width: 3 }, itemStyle: { color: '#f0c040' },
      areaStyle: { color: 'rgba(240,192,64,0.15)' } })
  }
  return stdOpt(cats, S, type !== 'line')
}

function radarOpt(cats, vals, rows, dim) {
  var catMetrics = cats.map(function (cat) {
    var grp = rows.filter(function (r) { return dimVal(r, dim) === cat })
    var n = grp.reduce(function (a, r) { return a + Number(r.RYZS || 0) }, 0) || 1
    return {
      count: grp.reduce(function (a, r) { return a + Number(r.RYZS || 0) }, 0),
      avgScore: +(grp.reduce(function (a, r) { return a + Number(r.JXZF || 0) }, 0) / n).toFixed(1),
      avgHyl: +(grp.reduce(function (a, r) { return a + Number(r.HYRS || 0) }, 0) / n * 100).toFixed(1)
    }
  })
  var maxCount = Math.max.apply(null, catMetrics.map(function (m) { return m.count }).concat([1]))
  var indicator = cats.map(function (c) { return { name: c, max: 100 } })
  var seriesData = [
    { name: '员工占比', value: catMetrics.map(function (m) { return +(m.count / maxCount * 100).toFixed(1) }),
      lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.15 } },
    { name: '人均绩效', value: catMetrics.map(function (m) { return m.avgScore }),
      lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.15 } },
    { name: '活跃率', value: catMetrics.map(function (m) { return m.avgHyl }),
      lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.15 } }
  ]
  return {
    tooltip: { trigger: 'item' }, legend: LEG,
    radar: { indicator: indicator, shape: 'polygon',
      splitArea: { areaStyle: { color: ['#16213e', '#1a2745'] } },
      splitLine: { lineStyle: { color: '#2a2a4a' } },
      axisName: { color: '#999' }, axisLine: { lineStyle: { color: '#2a2a4a' } } },
    series: [{ type: 'radar', data: seriesData }]
  }
}

// ---- 散点图 ----
function scatterOpt(type, cats, vals, rows, dim) {
  var isB = type === 'bubble'
  var data = isB
    ? avgD(cats, rows, dim).map(function (d, i) { return [i + 1, vals[i], d.value, d.name] })
    : cats.map(function (c, i) { return [i + 1, vals[i]] })
  return {
    tooltip: { formatter: function (p) {
      return isB ? p.data[3] + '<br/>员工数: ' + p.data[1] + '<br/>人均绩效: ' + p.data[2]
        : cats[p.data[0] - 1] + '<br/>员工数: ' + p.data[1]
    }},
    grid: { left: 60, right: 20, bottom: 40, top: 40 },
    xAxis: { type: 'value', min: 0, max: cats.length + 1, interval: 1,
      axisLabel: { color: '#999', formatter: function (x) { return cats[x - 1] || '' } },
      splitLine: { lineStyle: { color: '#2a2a4a' } } },
    yAxis: { type: 'value', axisLabel: { color: '#999' }, splitLine: { lineStyle: { color: '#2a2a4a' } } },
    series: [{ type: 'scatter', data: data,
      symbolSize: isB ? function (p) { return Math.max(p[2], 20) } : 20,
      itemStyle: { color: '#38bdf8', borderColor: 'transparent', borderWidth: 0 } }]
  }
}

// ---- 饼图 ----
function pieOpt(type, cats, vals, rows, dim, metric) {
  var useAvg = metric === 'avg' || metric === 'avg_attendance' || metric === 'hyl'
  var d = useAvg ? avgD(cats, rows, dim, metric) : cats.map(function (x, i) {
    return { name: x, value: vals[i], itemStyle: { color: CC[i % CC.length] } }
  })
  var S = []
  if (type === 'pie') {
    S = [{ type: 'pie', radius: ['40%', '70%'], data: d, label: { color: '#e2e2e2' } }]
  } else if (type === 'rose') {
    S = [{ type: 'pie', radius: ['20%', '70%'], roseType: 'area', data: d, label: { color: '#e2e2e2' } }]
  } else if (type === 'nestedpie') {
    var ds = {}
    rows.forEach(function (r) {
      var k = dimVal(r, dim) || '未知'
      if (!ds[k]) ds[k] = { hy: 0, wjh: 0, yfb: 0, dcp: 0 }
      ds[k].hy  += Number(r.HYRS  || 0)
      ds[k].wjh += Number(r.WJHRS || 0)
      ds[k].yfb += Number(r.YFBRS || 0)
      ds[k].dcp += Number(r.DCRS  || 0)
    })
    var inn = Object.keys(ds).map(function (k) {
      return { name: k, value: ds[k].hy + ds[k].wjh + ds[k].yfb + ds[k].dcp }
    })
    var out = [], sk = ['hy','wjh','yfb','dcp']
    Object.keys(ds).forEach(function (k) {
      sk.forEach(function (s, si) {
        if (ds[k][s] > 0) out.push({ name: k + '-' + STS[si], value: ds[k][s] })
      })
    })
    S = [
      { type: 'pie', radius: ['0%', '40%'], data: inn, label: { color: '#e2e2e2' } },
      { type: 'pie', radius: ['50%', '70%'], data: out, label: { color: '#e2e2e2' } }
    ]
  }
  var opt = { tooltip: { trigger: 'item' }, series: S }
  if (type !== 'nestedpie') opt.legend = LEG
  return opt
}

function treemapOpt(cats, vals) {
  return { tooltip: {}, series: [{
    type: 'treemap', label: { color: '#111010', fontSize: 15 },
    data: cats.map(function (c, i) { return { name: c, value: vals[i] } }),
    levels: [{ itemStyle: { borderColor: '#16213e', borderWidth: 3, gapWidth: 3 } }],
    breadcrumb: { show: false }
  }]}
}

function wordcloudOpt(rows) {
  var wm = {}
  rows.forEach(function (r) {
    var n = Number(r.RYZS || 0)
    if (r.ZZDWMC) wm[r.ZZDWMC] = (wm[r.ZZDWMC] || 0) + n
    if (r.RYLBMC)  wm[r.RYLBMC]  = (wm[r.RYLBMC]  || 0) + n
    if (r.RWMC)    wm[r.RWMC]    = (wm[r.RWMC]    || 0) + n
    if (r.XMMC)    wm[r.XMMC]    = (wm[r.XMMC]    || 0) + n
  })
  return { series: [{
    type: 'wordCloud', shape: 'circle', sizeRange: [14, 60], rotationRange: [-30, 30],
    gridSize: 8, width: '90%', height: '80%',
    textStyle: { fontFamily: 'Microsoft YaHei', fontWeight: 'bold',
      color: function () { return 'rgb(' + Math.round(Math.random()*150+100) + ',' + Math.round(Math.random()*150+100) + ',' + Math.round(Math.random()*200+55) + ')' }
    },
    data: Object.keys(wm).map(function (n) { return { name: n, value: wm[n] } })
  }]}
}

function funnelOpt(cats, vals, rows, dim, metric) {
  var d
  if (metric === 'rylb' || metric === 'edu') {
    var lbOrder = ['核心', '骨干', '普通'], lbMap = {}
    rows.forEach(function (r) { var lb = r.RYLBMC || '未知'; lbMap[lb] = (lbMap[lb] || 0) + Number(r.RYZS || 0) })
    var cum = 0
    d = lbOrder.map(function (lb) { cum += (lbMap[lb] || 0); return { name: lb + '及以上', value: cum } })
  } else {
    var thresholds = [
      { label: '≥0分(已评估)', min: 0 }, { label: '≥60分(合格)', min: 60 },
      { label: '≥80分(良好)', min: 80 },  { label: '≥90分(优秀)', min: 90 }
    ]
    d = thresholds.map(function (t) {
      return { name: t.label, value: rows.filter(function (r) {
        var ryzs = Number(r.RYZS || 0)
        return ryzs > 0 && (Number(r.JXZF || 0) / ryzs) >= t.min
      }).reduce(function (sum, r) { return sum + Number(r.RYZS || 0) }, 0) }
    })
  }
  return { tooltip: { trigger: 'item' }, legend: LEG, series: [{
    type: 'funnel', left: '10%', top: 60, bottom: 60, width: '80%',
    sort: 'descending', gap: 2, data: d,
    label: { color: '#e2e2e2' }, itemStyle: { borderColor: '#1a1a2e', borderWidth: 2 }
  }]}
}

function sankeyOpt(rows) {
  var ns = [], nsS = {}, lm = {}
  rows.forEach(function (r) {
    var a = r.GLJGMC || '未知机构', b = r.ZZDWMC || '未知单位', c = r.RYLBMC || '未知类别'
    var n = Number(r.RYZS || 0)
    if (!nsS[a]) { ns.push(a); nsS[a] = 1 }
    if (!nsS[b]) { ns.push(b); nsS[b] = 1 }
    if (!nsS[c]) { ns.push(c); nsS[c] = 1 }
    var k1 = a + '->' + b; lm[k1] = (lm[k1] || 0) + n
    var k2 = b + '->' + c; lm[k2] = (lm[k2] || 0) + n
  })
  return { tooltip: { trigger: 'item' }, series: [{
    type: 'sankey', left: '10%', right: '10%',
    data: ns.map(function (n) { return { name: n } }),
    links: Object.keys(lm).map(function (k) { var p = k.split('->'); return { source: p[0], target: p[1], value: lm[k] } }),
    emphasis: { focus: 'adjacency' }, lineStyle: { color: 'gradient', curveness: 0.5 }, label: { color: '#e2e2e2' }
  }]}
}

function boxplotOpt(rows, dim) {
  var bg = {}
  rows.forEach(function (r) {
    var k = dimVal(r, dim) || '未知'
    if (!bg[k]) bg[k] = []
    var ryzs = Number(r.RYZS || 0)
    if (ryzs > 0) bg[k].push(+(Number(r.JXZF || 0) / ryzs).toFixed(1))
  })
  var bc = Object.keys(bg)
  var bd = bc.map(function (d) {
    var a = bg[d].slice().sort(function (x, y) { return x - y }), n = a.length
    if (!n) return [0, 0, 0, 0, 0]
    return [a[0], a[Math.floor(n*0.25)], a[Math.floor(n*0.5)], a[Math.floor(n*0.75)], a[n-1]]
  })
  return stdOpt(bc, [{
    type: 'boxplot', data: bd,
    label: { show: true, color: '#e2e2e2' },
    itemStyle: { color: '#38bdf8', borderColor: '#38bdf8' },
    emphasis: { itemStyle: { color: '#e94560', borderColor: '#e94560' } }
  }], false, 'item')
}

// ============ 统一分发器 ============
// locations: 从 DW_LOCATION_TABLE 查询的坐标数据（供热力图使用）
function getChartOption(type, cats, vals, rows, dim, metric, locations) {
  if (type === 'kpi') return kpiOpt(cats, vals, rows, dim)
  if (type === 'heatmap') return heatmapOpt(rows, dim, locations)
  if (['bar','stacked','multibar','contrast'].indexOf(type) !== -1) return barOpt(type, cats, vals, rows, dim)
  if (type === 'waterfall') return waterfallOpt(cats, vals)
  if (type === 'combo') return comboOpt(cats, vals, rows, dim)
  if (['line','multiline','rangearea'].indexOf(type) !== -1) return lineOpt(type, cats, vals, rows, dim)
  if (type === 'lineradar') return radarOpt(cats, vals, rows, dim)
  if (['scatter','bubble'].indexOf(type) !== -1) return scatterOpt(type, cats, vals, rows, dim)
  if (['pie','rose','nestedpie'].indexOf(type) !== -1) return pieOpt(type, cats, vals, rows, dim, metric)
  if (type === 'treemap') return treemapOpt(cats, vals)
  if (type === 'wordcloud') return wordcloudOpt(rows)
  if (type === 'funnel') return funnelOpt(cats, vals, rows, dim, metric)
  if (type === 'sankey') return sankeyOpt(rows)
  if (type === 'boxplot') return boxplotOpt(rows, dim)
  return barOpt('bar', cats, vals, rows, dim)
}

export { getChartOption }
export const CG = [
  { label: '', children: [{ label: 'KPI指标卡', value: 'kpi' }, { label: '热力区域图', value: 'heatmap' }] },
  { label: '柱状图', children: [
    { label: '分区柱状图', value: 'bar' }, { label: '堆积柱状图', value: 'stacked' },
    { label: '多系列柱状图', value: 'multibar' }, { label: '对比柱状图', value: 'contrast' },
    { label: '瀑布图', value: 'waterfall' }
  ]},
  { label: '折线图', children: [
    { label: '分区折线图', value: 'line' }, { label: '多系列折线图', value: 'multiline' },
    { label: '折线雷达图', value: 'lineradar' }, { label: '范围面积图', value: 'rangearea' },
    { label: '组合图', value: 'combo' }
  ]},
  { label: '散点图', children: [{ label: '散点图', value: 'scatter' }, { label: '聚合气泡图', value: 'bubble' }] },
  { label: '饼图', children: [{ label: '饼图', value: 'pie' }, { label: '多层饼图', value: 'nestedpie' }, { label: '玫瑰图', value: 'rose' }] },
  { label: '其他', children: [
    { label: '矩形树图', value: 'treemap' }, { label: '词云图', value: 'wordcloud' },
    { label: '漏斗图', value: 'funnel' }, { label: '桑基图', value: 'sankey' },
    { label: '箱型图', value: 'boxplot' }
  ]}
]