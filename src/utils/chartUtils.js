// 图表配色方案
var CC = ['#e94560','#4ecb71','#38bdf8','#f0c040','#ff7849','#6c5ce7','#888','#00cec9']
// 状态颜色
var C=['#888','#4ecb71','#e94560']
// 用户状态
var STS = ['未激活','活跃','已封禁']
// 图例通用配置
var LEG = {bottom:0,textStyle:{color:'#999'}}
// ---- 绩效等级 ----
function getLevel(score) {
  var s = Number(score) || 0
  if (s === 0) return '待评估'
  if (s < 60) return '不合格'
  if (s < 80) return '合格'
  if (s < 90) return '良好'
  return '优秀'
}
function dimVal(u, dim) {
  return dim === 'level' ? getLevel(u.score) : u[dim]
}
// 按状态统计人数
function cnt(u,d,c,s){return c.map(function(x){
  return u.filter(function(u2){return dimVal(u2,d)===x&&u2.status===s}).length
})}
// 平均分
function avgD(cats,users,dim,metric){
  var field = metric === 'avg_attendance' ? 'attendance' : 'score'
  return cats.map(function(cat){
    var grp=users.filter(function(u){
      return dim==='level' ? getLevel(u[field])===cat : dimVal(u,dim)===cat
    })
    if(!grp.length)return{name:cat,value:0}
    var sum=grp.reduce(function(a,u){return a+Number(u[field]||0)},0)
    return{name:cat,value:+(sum/grp.length).toFixed(1)}
  })
}
// 公共图表配置（适用于直角坐标系）
function stdOpt(cats,S,withLegend,trigger){// （分类轴 + 数值轴 + 图例 + 提示框）
  var o={
    tooltip:{trigger:trigger||'axis'},// 提示框，悬停显示
    grid:{left:60,right:20,bottom:40,top:20},// 绘图区域边距
    xAxis:{type:'category',data:cats,axisLabel:{color:'#999'}},
    yAxis:{type:'value',axisLabel:{color:'#999'},
    splitLine:{lineStyle:{color:'#2a2a4a'}}},// 网格线
    series:S}
  if(withLegend)o.legend=LEG// 图例
  return o
}
// KPI指标卡
function kpiOpt(cats, vals, users, dim) {
  var data = avgD(cats, users, dim)
  var total = data.reduce(function (a, d) { return a + d.value }, 0)
  return { cards: data.map(function (d) {
    return { name: d.name, value: d.value, pct: total ? (d.value / total * 100).toFixed(1) + '%' : '-' }
  })}
}
// 热力区域图
var CITY_GEO = {// 建立城市名 → 经纬度的映射表
  '成都': [104.06, 30.67], '上海': [121.48, 31.22], '广州': [113.23, 23.16],
  '绵阳': [104.73, 31.47], '重庆': [106.54, 29.59],
  // '杭州': [120.19, 30.26],  '南京': [118.78, 32.04],
  // '北京': [116.46, 39.92], '天津': [117.20, 39.13],  
  // '苏州': [120.62, 31.32], '深圳': [114.07, 22.62],  '武汉': [114.31, 30.52],
  // '长沙': [112.98, 28.19],  '西安': [108.95, 34.27], '郑州': [113.65, 34.76],  '济南': [117.00, 36.65],
  // '青岛': [120.33, 36.07],  '大连': [121.62, 38.92], '昆明': [102.73, 25.04]
}
function getCity(address) {// 通过用户地址获取城市
  if (!address) return null
  for (var city in CITY_GEO) {
    if (address.indexOf(city) !== -1) return city
  }
  return null
}
function heatmapOpt(users, dim) {// 热力区域图
  var cd = {}// 城市聚合数据 例：{'成都': { total: 25, dimMap: { '2022': 3, '2023': 5, '2024': 3 } }}
  users.forEach(function (u) {
    var c = getCity(u.address)
    if (!c) return
    if (!cd[c]) 
    cd[c] = { total: 0, dimMap: {} }// 惰性初始化：如果该城市第一次出现，先创建空对象
    cd[c].total++
    var dv = dimVal(u, dim) || '未知'
    cd[c].dimMap[dv] = (cd[c].dimMap[dv] || 0) + 1// 累加该维度值的计数
  })
  var data = Object.keys(cd).map(function (c) {// 将聚合数据转为 ECharts 需要的格式：{城市名，[经度, 纬度, 人数]}
    return { name: c, value: [CITY_GEO[c][0], CITY_GEO[c][1], cd[c].total] }
  })
  return {
    tooltip: {
      trigger: 'item',
      formatter: function (p) {
        var d = cd[p.data && p.data.name]// 取出城市名
        if (!d) return ''
        var lines = Object.keys(d.dimMap).map(function (k) {// 转为可读的文本行
          return k + ': ' + d.dimMap[k] + '人'
        })
        return p.data.name + '（' + d.total + '人）<br/>' + lines.join('<br/>')
      }
    },
    visualMap: {//  视觉映射
      min: 0, max: data.length ? Math.max.apply(null, data.map(function (d) { return d.value[2] })) : 1,
      inRange: { color: ['#33b8cc', '#66ccb8','#ff4f38', '#e62828'] }// 颜色映射区间
    },
    geo: {// 地理坐标系
      map: 'china', 
      center: [104, 36], zoom: 1.5, aspectScale: 0.75,
      layoutCenter: ['50%', '50%'], layoutSize: '100%',
      itemStyle: { areaColor: '#0d1b2e', borderColor: '#1a3a5c', borderWidth: 1 },
      emphasis: { label: { show: true, color: '#e2e2e2', fontSize: 11 }, itemStyle: { areaColor: '#1a2745' } }
    },
    series: [
      { type: 'heatmap', coordinateSystem: 'geo', data: data, pointSize: 20, blurSize: 34},
      { type: 'scatter', coordinateSystem: 'geo', data: data, symbolSize: 12,
        label: { show: true, formatter: function (p) { return p.data.name }, position: 'right', color: '#e2e2e2', fontSize: 10 },
        itemStyle: { color: '#e94560', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 2 } }
    ]
  }
}
// ----柱状图----
function barOpt(type,cats,vals,users,dim){
  var S=[]
  if(type==='bar'){// 分区柱状图
    var dimColors=['#38bdf8','#f0c040','#e94560','#4ecb71','#6c5ce7','#ff7849','#00cec9','#888']
    S=cats.map(function(cat,i){
      return{
        name:cat,type:'bar',
        data:STS.map(function(s){
          return users.filter(function(u){return dimVal(u,dim)===cat&&u.status===s}).length
        }),
        itemStyle:{color:dimColors[i%dimColors.length]},barWidth:'15%'
      }
    })
    return stdOpt(STS,S,true,'axis')// X轴为状态
  }
  else if(type==='stacked'||type==='multibar'){// 堆积柱状图与多系列柱状图
    S=STS.map(function(s,i){
    var r={name:s,type:'bar',data:cnt(users,dim,cats,s),itemStyle:{color:C[i]}};
    if(type==='stacked')r.stack='t';return r})// r.stack='t'，表示堆积在一起
    }
  else if(type==='contrast'){// 对比柱状图
    var avg=+(users.reduce(function(a,u){return a+Number(u.score||0)},0)/users.length).toFixed(1)
    S=[{name:'偏离均值',type:'bar',
      data:avgD(cats,users,dim).map(function(d){
        var v=+(d.value-avg).toFixed(1);
        return{name:d.name,value:v,itemStyle:{color:v>=0?'#4ecb71':'#e94560'}}}),
      label:{show:true,position:'top',color:'#e2e2e2',formatter:function(p){return(p.value>=0?'+':'')+p.value}}}]
  }
  return stdOpt(cats,S,type!=='bar','axis')
}
function waterfallOpt(cats,vals){// 瀑布图
  var sum=vals.reduce(function(a,b){return a+b},0)
  var newcats=['合计'].concat(cats),bv=[sum].concat(vals)
  var cum=[0],rem=sum
  for(var i=1;i<bv.length;i++){rem-=bv[i];cum.push(rem)}
  return stdOpt(newcats,[
    {type:'bar',stack:'w',data:cum,itemStyle:{color:'transparent'},emphasis:{itemStyle:{color:'transparent'}}},// 透明底座
    {type:'bar',stack:'w',data:bv,itemStyle:{color:'#38bdf8'},label:{show:true,position:'inside',color:'#e2e2e2'}}
  ])
}
function comboOpt(cats,vals,users,dim){// 组合图
  var avgs=avgD(cats,users,dim).map(function(d){return d.value})
  return{
    tooltip:{trigger:'axis'},legend:LEG,grid:{left:60,right:60,bottom:40,top:40},
    xAxis:{type:'category',data:cats,axisLabel:{color:'#999'}},
    yAxis:[
      {type:'value',name:'人数',axisLabel:{color:'#999'},splitLine:{lineStyle:{color:'#2a2a4a'}}},
      {type:'value',name:'平均分',axisLabel:{color:'#999'},splitLine:{show:false}}],
      series:[
        {name:'人数',type:'bar',data:vals,itemStyle:{color:'#38bdf8'},barWidth:'40%'},
        {name:'平均分',type:'line',yAxisIndex:1,data:avgs,smooth:true,itemStyle:{color:'#e94560'},lineStyle:{color:'#e94560',width:2}}]}
}
// ----折线图----
function lineOpt(type,cats,vals,users,dim){
  var S=[]
  if(type==='line'){// 分区折线图
    S=cats.map(function(cat,i){
      return{
        name:cat,type:'line',smooth:true,
        data:STS.map(function(s){
          return users.filter(function(u){return dimVal(u,dim)===cat&&u.status===s}).length
        }),
        lineStyle:{color:CC[i%CC.length]},
        itemStyle:{color:CC[i%CC.length]},
        areaStyle:{color:'rgba(56,189,248,0.1)'}
      }
    })
    return stdOpt(STS,S,true,'axis')
  }
  else if(type==='multiline'){// 多系列折线图
    S=STS.map(function(s,i){
    return{
      name:s,type:'line',smooth:true,
      data:cnt(users,dim,cats,s),
      lineStyle:{color:C[i]},
      itemStyle:{color:C[i]}
    }
  })}
  else if(type==='rangearea'){// 范围面积图
    var areaAlpha=['rgba(136,136,136,0.2)','rgba(78,203,113,0.2)','rgba(233,69,96,0.2)']
    S=STS.map(function(s,i){
      return{
        name:s,type:'line',smooth:true,
        data:cnt(users,dim,cats,s),
        lineStyle:{color:C[i],width:2},
        itemStyle:{color:C[i]},
        areaStyle:{color:areaAlpha[i]}
      }
    })
     S.push({
      name:'合计',type:'line',smooth:true,
      data:vals,
      lineStyle:{color:'#f0c040',width:3},
      itemStyle:{color:'#f0c040'},
      areaStyle:{color:'rgba(240,192,64,0.15)'}
    })
  }
  return stdOpt(cats,S,type!=='line')
}
// function radarOpt(cats,vals){// 折线雷达图
//   var max=Math.max.apply(null,vals.concat([1]))
//   return{
//     tooltip:{},
//     radar:{
//       indicator:cats.map(function(c){return{name:c,max:max+1}}), shape:'polygon',
//       splitArea:{areaStyle:{color:['#16213e','#1a2745']}},splitLine:{lineStyle:{color:'#2a2a4a'}},
//       axisName:{color:'#999'},axisLine:{lineStyle:{color:'#2a2a4a'}}
//     },
//     series:[{
//       type:'radar',
//       data:[{value:vals,name:'人数',
//         areaStyle:{color:'rgba(56,189,248,0.3)'},
//         lineStyle:{color:'#38bdf8',width:1},
//         itemStyle:{color:'#38bdf8',borderWidth:0}}]
//       }]}
// }
// 折线雷达图
function radarOpt(cats, vals, users, dim) {
  var catMetrics = cats.map(function (cat) {// 提取所有分类
    var grp = users.filter(function (u) {
      return dim === 'level' ? getLevel(u.score) === cat : dimVal(u, dim) === cat
    })
    var n = grp.length || 1
    return {
      count: grp.length,// 该分类人数
      avgScore: +(grp.reduce(function (a, u) { return a + Number(u.score || 0) }, 0) / n).toFixed(1),// 该分类平均绩效分
      avgAtt: +(grp.reduce(function (a, u) { return a + Number(u.attendance || 0) }, 0) / n).toFixed(1)// 该分类平均考勤分
    }
  })
  var maxCount = Math.max.apply(null, catMetrics.map(function (m) { return m.count }).concat([1]))
  var indicator = cats.map(function (c) { return { name: c, max: 100 } })
  var seriesData = [
    { name: '人数占比', value: catMetrics.map(function (m) { return +(m.count / maxCount * 100).toFixed(1) }),
      lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.15 } },
    { name: '平均绩效', value: catMetrics.map(function (m) { return m.avgScore }),
      lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.15 } },
    { name: '平均考勤', value: catMetrics.map(function (m) { return m.avgAtt }),
      lineStyle: { width: 1.5 }, areaStyle: { opacity: 0.15 } }
  ]
  return {
    tooltip: { trigger: 'item' }, legend: LEG,
    radar: {
      indicator: indicator, shape: 'polygon',
      splitArea: { areaStyle: { color: ['#16213e', '#1a2745'] } },
      splitLine: { lineStyle: { color: '#2a2a4a' } },
      axisName: { color: '#999' }, axisLine: { lineStyle: { color: '#2a2a4a' } }
    },
    series: [{ type: 'radar', data: seriesData }]
  }
}
// 散点图
function scatterOpt(type,cats,vals,users,dim){
  var isB=type==='bubble'
  var data=isB
    ?avgD(cats,users,dim).map(function(d,i){return[i+1,vals[i],d.value,d.name]})
    :cats.map(function(c,i){return[i+1,vals[i]]})
  return{
    tooltip:{formatter:function(p){
      return isB
      ?p.data[3]+'<br/>人数: '+p.data[1]+'<br/>平均分: '+p.data[2]
      :cats[p.data[0]-1]+'<br/>人数:'+p.data[1]}},
    grid:{left:60,right:20,bottom:40,top:40},
    xAxis:{type:'value',min:0,max:cats.length+1,interval:1,
      axisLabel:{color:'#999',formatter:function(x){return cats[x-1]||''}},
      splitLine:{lineStyle:{color:'#2a2a4a'}}},
    yAxis:{type:'value',
      axisLabel:{color:'#999'},
      splitLine:{lineStyle:{color:'#2a2a4a'}}},
    series:[{type:'scatter',data:data,
      symbolSize:isB?function(p){return Math.max(p[2],20)}:20,
      itemStyle:{color:'#38bdf8',borderColor:'transparent',borderWidth:0}}]
  }
}
// ----饼图----
function pieOpt(type,cats,vals,users,dim,metric){
  var useAvg = metric==='avg'||metric==='avg_attendance'
  var d = useAvg ? avgD(cats,users,dim,metric) : cats.map(function(x,i){
    return{name:x,value:vals[i],itemStyle:{color:CC[i%CC.length]}}
  })
  var S=[]
  if(type==='pie'){
    S=[{type:'pie',radius:['40%','70%'],data:d,label:{color:'#e2e2e2'}}]
  }
  else if(type==='rose'){
    S=[{type:'pie',radius:['20%','70%'],roseType:'area',data:d,label:{color:'#e2e2e2'}}]
  }
  else if(type==='nestedpie'){
    var ds={};
    users.forEach(function(u){
      var k=dimVal(u,dim);if(!k)k='未知'
      if(!ds[k])ds[k]={};
      ds[k][u.status]=(ds[k][u.status]||0)+1
    });
    var inn=Object.keys(ds).map(function(d2){
      return{name:d2,value:Object.values(ds[d2]).reduce(function(a,b){return a+b},0)}
    }),out=[];
    Object.keys(ds).forEach(function(d2){
      Object.keys(ds[d2]).forEach(function(s){out.push({name:d2+'-'+s,value:ds[d2][s]})})
    });
    S=[{type:'pie',radius:['0%','40%'],data:inn,label:{color:'#e2e2e2'}},
    {type:'pie',radius:['50%','70%'],data:out,label:{color:'#e2e2e2'}}]
  }
  var opt={tooltip:{trigger:'item'},series:S}
  if(type!=='nestedpie'){opt.legend=LEG}
  return opt
}
// 矩形树图
function treemapOpt(cats, vals) {
  return {
   tooltip: {}, 
   series: [
    {
     type:'treemap',label:{ color:'#111010',fontSize: 15 },
     data: cats.map(function(c, i){return {name: c,value:vals[i] } }), 
     levels: [{itemStyle:{borderColor:'#16213e', borderWidth: 3, gapWidth: 3 }}],
     breadcrumb: { show: false }
    }
  ]}
}
// 词云图
function wordcloudOpt(users){
  var wm={}
  users.forEach(function(u){
    wm[u.name]=(wm[u.name]||0)+1;
    wm[u.department]=(wm[u.department]||0)+1;
    wm[u.role]=(wm[u.role]||0)+1})
  return{
    series:[
      {
        type:'wordCloud',shape:'circle',sizeRange:[14,60],rotationRange:[-30,30],gridSize:8,width:'90%',height:'80%',
        textStyle:{
          fontFamily:'Microsoft YaHei',fontWeight:'bold',
          color:function(){
            return'rgb('+Math.round(Math.random()*150+100)+','+Math.round(Math.random()*150+100)+','+Math.round(Math.random()*200+55)+')'
          }
        },
        data:Object.keys(wm).map(function(n){return{name:n,value:wm[n]}})
      }
    ]
  }
}
// 漏斗图
function funnelOpt(cats,vals,users,dim,metric){
  var d
  if(metric==='edu'){
    var eduOrder=['博士','硕士','本科','大专'],eduMap={}
    users.forEach(function(u){eduMap[u.education]=(eduMap[u.education]||0)+1})
    var cum=0
    d=eduOrder.map(function(e){cum+=(eduMap[e]||0);return{name:e+'及以上',value:cum}})
  }else{
    var field=metric==='avg_attendance'?'attendance':'score'
    var thresholds=[
      {label:'≥0分(已评估)',min:1},
      {label:'≥60分(合格)',min:60},
      {label:'≥80分(良好)',min:80},
      {label:'≥90分(优秀)',min:90}
    ]
    d=thresholds.map(function(t){
      return{name:t.label,value:users.filter(function(u){return Number(u[field]||0)>=t.min}).length}
    })
  }
  return{
    tooltip:{trigger:'item'},legend:LEG,
    series:[{
      type:'funnel',left:'10%',top:60,bottom:60,width:'80%',
      sort:'descending',gap:2,data:d,
      label:{color:'#e2e2e2'},
      itemStyle:{borderColor:'#1a1a2e',borderWidth:2}
    }]
  }
}
// 桑基图
function sankeyOpt(users){
  var ns=[],nsS={},lm={}
  users.forEach(function(u){
    if(!nsS[u.status]){ns.push(u.status);nsS[u.status]=1}
    if(!nsS[u.role]){ns.push(u.role);nsS[u.role]=1}
    if(!nsS[u.department]){ns.push(u.department);nsS[u.department]=1}
    var k1=u.status+'->'+u.role;lm[k1]=(lm[k1]||0)+1
    var k2=u.role+'->'+u.department;lm[k2]=(lm[k2]||0)+1
  })
  return{
    tooltip:{trigger:'item'},
    series:[
      {
        type:'sankey',left:'10%',right:'10%',
        data:ns.map(function(n){return{name:n}}),
        links:Object.keys(lm).map(function(k){
          var p=k.split('->');
          return{source:p[0],target:p[1],value:lm[k]}
        }),
        emphasis:{focus:'adjacency'},
        lineStyle:{color:'gradient',curveness:0.5},
        label:{color:'#e2e2e2'}
      }
    ]
  }
}
// 箱型图
function boxplotOpt(users,dim){
  var bg={},bc
  users.forEach(function(u){
    var k=dimVal(u,dim);if(!k)k='未知'
    if(!bg[k])bg[k]=[];
    bg[k].push(Number(u.score)||0)
  })
  bc=Object.keys(bg)
  var bd=bc.map(function(d){
    var a=bg[d].slice().sort(function(x,y){return x-y}),n=a.length
    return[a[0],a[Math.floor(n*0.25)],a[Math.floor(n*0.5)],a[Math.floor(n*0.75)],a[n-1]]
  })
  return stdOpt(bc,[{
    type:'boxplot',data:bd,
    label:{show:true,color:'#e2e2e2'},
    itemStyle:{color:'#38bdf8',borderColor:'#38bdf8'},
    emphasis:{itemStyle:{color:'#e94560',borderColor:'#e94560'}}
  }],false,'item')
}
// 统一分发器
function getChartOption(type, cats, vals, users, dim, metric) { 
  if (type==='kpi') return kpiOpt(cats,vals,users,dim)
    if (type==='heatmap') return heatmapOpt(users,dim)
  // 柱状图
  if (['bar','stacked','multibar','contrast'].indexOf(type)!==-1) return barOpt(type,cats,vals,users,dim)
  if (type==='waterfall') return waterfallOpt(cats,vals)
  if (type==='combo') return comboOpt(cats,vals,users,dim)
  // 折线图
  if (['line','multiline','rangearea'].indexOf(type)!==-1) return lineOpt(type,cats,vals,users,dim)
  if (type==='lineradar') return radarOpt(cats, vals, users, dim)
  // 散点图
  if (['scatter','bubble'].indexOf(type)!==-1) return scatterOpt(type,cats,vals,users,dim)
  // 饼图
  if (['pie','rose','nestedpie'].indexOf(type)!==-1) return pieOpt(type,cats,vals,users,dim,metric)
  // 其他
  if (type==='treemap') return treemapOpt(cats,vals)
  if (type==='wordcloud') return wordcloudOpt(users)
  if (type==='funnel') return funnelOpt(cats,vals,users,dim,metric)
  if (type==='sankey') return sankeyOpt(users)
  if (type==='boxplot') return boxplotOpt(users,dim)
  return barOpt('bar',cats,vals,users,dim)
}
// 导出
export { getChartOption }
export const CG = [
  {
    label:'',
    children:[
      {label:'KPI指标卡',value:'kpi'},{label:'热力区域图',value:'heatmap'}
    ]
  },
  {
    label:'柱状图',
    children:[
      {label:'分区柱状图',value:'bar'},{label:'堆积柱状图',value:'stacked'},{label:'多系列柱状图',value:'multibar'},
      {label:'对比柱状图',value:'contrast'},{label:'瀑布图',value:'waterfall'}
    ]
  },
  {
    label:'折线图',
    children:[
      {label:'分区折线图',value:'line'},{label:'多系列折线图',value:'multiline'},{label:'折线雷达图',value:'lineradar'},
      {label:'范围面积图',value:'rangearea'},{label:'组合图',value:'combo'}
    ]
  },
  {
    label:'散点图',
    children:[{label:'散点图',value:'scatter'},{label:'聚合气泡图',value:'bubble'}]
  },
  {
    label:'饼图',
    children:[{label:'饼图',value:'pie'},{label:'多层饼图',value:'nestedpie'},{label:'玫瑰图',value:'rose'}]
  },
  {
    label:'其他',
    children:[
      {label:'矩形树图',value:'treemap'},{label:'词云图',value:'wordcloud'},{label:'漏斗图',value:'funnel'},
      {label:'桑基图',value:'sankey'},{label:'箱型图',value:'boxplot'}]
    }
]
