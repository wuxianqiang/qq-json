const request = require('request');
const url = 'https://q.qq.com/wiki/develop/miniprogram/component/view-container/view.html'
const fs = require('fs')
var decode = require('parse-entities')

const keys = {
  'view-container/view': 'view',
  'view-container/scroll-view': 'scroll-view',
  'view-container/swiper': 'swiper',
  'view-container/movable-view': 'movable-view',
  'view-container/cover': 'cover-view',
  'basic-content/icon': 'icon',
  'basic-content/text': 'text',
  'basic-content/rich-text': 'rich-text',
  'basic-content/progress': 'progress',
  'form/button': 'button',
  'form/checkbox': 'checkbox',
  'form/form': 'form',
  'form/input': 'input',
  'form/label': 'label',
  'form/picker': 'picker',
  'form/picker-view': 'picker-view',
  'form/radio': 'radio',
  'form/slider': 'slider',
  'form/switch': 'switch',
  'form/textarea': 'textarea',
  'navigation/navigator': 'navigator',
  'media/image': 'image',
  'media/video': 'video',
  'media/camera': 'camera',
  'media/live-player': 'live-player',
  'media/live-pusher': 'live-pusher',
  'map/map': 'map/map',
  'canvas/canvas': 'canvas/canvas',
  'open-ability/open-data': 'open-data',
  'open-ability/web-view': 'web-view',
  'open-ability/ad': 'ad'
}

const cheerio = require('cheerio')

async function toJson () {
  let requestList = []
  for (const key in keys) {
    requestList.push(handleRequest(key, keys[key]))
  }
  let result = await Promise.all(requestList)
  fs.writeFileSync('qq.json', JSON.stringify(result))
  console.log('写入完成')
}

toJson()

function handleRequest (key, realKey) {
  return new Promise((resolve, reject) => {
    let url = formKeyToUrl(key)
    let item = {}
    request(url, (err, response, body) => {
      const $ = cheerio.load(body)
      let content = $('.content__default').html()
      content = decode(content)
      let [, t1, content1, t2, content2] = content.split(/<h2.*?>([\s\S]*?)<\/h2>/g)
      if (t1) {
        let temp = {}
        if (content1) {
          let res = handleContent(content1)
          temp[handleText(t1)] = res
        }
        if (content2) {
          let res = handleContent(content2)
          temp[handleText(t2)] = res
        }
        resolve(temp)
      } else {
        let res = handleContent(content)
        resolve({[realKey]: res})
      }
    })
  })
}

function formKeyToUrl (key) {
  return `https://q.qq.com/wiki/develop/miniprogram/component/${key}.html`
}

function formTableToJson (table) {
  let td = /<td.*?>([\s\S]*?)<\/td>/g
  let tr = /<tr.*?>([\s\S]*?)<\/tr>/g
  let link = /<a.*?>([\s\S]*?)<\/a>/
  let result = {}
  let title = []
  let flag = false
  table.replace(tr, (...args) => {
    let list = []
    args[1].replace(td, (...args) => {
      let val = args[1].replace('<span></span>', '')
      if (link.test(val)) {
        val = link.exec(val)[1]
      }
      list.push(val)
    })
    if (!flag) {
      title = list
      flag = true
      return
    }
    let [t1 = '属性', t2 = '类型', t3 = '默认值', t4 = '描述', t5 = '最低版本'] = title
    let [
      attr = '',
      type = '',
      defaultValue = '',
      reqired = '',
      explain = ''
    ] = list
    result[attr] = [
      `${t1}：${attr}`,
      `${t2}：${type}`,
      `${t3}：${handleText(defaultValue)}`,
      `${t4}：${handleText(reqired)}`,
      `${t5}：${handleText(explain)}`
    ]
  })
  return result
}

function formPtoJson (desc) {
  let p = /<p.*?>([\s\S]*?)<\/p>/g
  let descList = []
  desc.replace(p, (...args) => {
    let val = handleText(args[1])
    descList.push(val)
  })
  return descList
}

function handleText (text) {
  let link = /<a.*?>([\s\S]*?)<\/a>/g
  let code = /<code.*?>([\s\S]*?)<\/code>/g
  let strong = /<strong.*?>([\s\S]*?)<\/strong>/g
  let span = /<span.*?>([\s\S]*?)<\/span>/g
  text = text.replace(/&quot;/g, '') // 引号
  text = text.replace(/<svg.*?>([\s\S]*?)<\/svg>/g, '')
  text = text.replace(/<img.*?>/g, '')
  if (link.test(text)) {
    text = text.replace(link, (...args) => {
      return args[1]
    })
  }
  if (code.test(text)) {
    text = text.replace(code, (...args) => {
      return `\`${args[1]}\``
    })
  }
  if (strong.test(text)) {
    text = text.replace(strong, (...args) => {
      return `**${args[1]}**`
    })
  }
  if (span.test(text)) {
    text = text.replace(span, (...args) => {
      return `${args[1]}`
    })
  }
  text = text.replace(/# /g, '')
  return text
}


function handleContent (content) {
  const $ = cheerio.load(content)
  let item = {}
  let hasValue = false
  $('table').each((i, el) => {
    let table = decode($(el).html())
    if (table.includes('属性') && !hasValue) {
      let tableList = formTableToJson(table)
      item.tableList = tableList
      hasValue = true
    }
  })
  let desc = content.split('<table>')[0]
  let descriptList = formPtoJson(desc)
  item.descriptList = descriptList
  return item
}
