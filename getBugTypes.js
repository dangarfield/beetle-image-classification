const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const path = require('path')

let beetleListUrl = 'https://www.insectidentification.org/beetles.asp'

const getBeetleNames = async () => {
  let res = await axios.get(beetleListUrl)
  let $ = cheerio.load(res.data)
  let beetleList = []
  $('.rsContainer .textLarge').each((i, elm) => {
    let beetleName = $(elm).first().text()
    if (!beetleList.some(beetle => beetle.name === beetleName)) {
      beetleList.push({name: beetleName, path: beetleName.replace(/\s+/g, '-').toLowerCase()})
    }
  })
  fs.writeFileSync('bug-types.json', JSON.stringify(beetleList, null, 4))
}

const cleanBeetleList = async () => {
  let beetleList = JSON.parse(fs.readFileSync('bug-types.json'))
  let imageList = fs.readdirSync('images')
  let newBeetleList = []
  for (let i = 0; i < beetleList.length; ++i) {
    let beetle = beetleList[i]
    if (imageList.includes(beetle.path)) {
      newBeetleList.push(beetle)
    }
  }
  fs.writeFileSync('bug-types.json', JSON.stringify(newBeetleList, null, 4))
}

const downloadImage = async (url, imagePath) => {
  if (!fs.existsSync('images')) {
    fs.mkdirSync('images')
  }
  if (!fs.existsSync(path.dirname(imagePath))) {
    fs.mkdirSync(path.dirname(imagePath))
  }
  if (!fs.existsSync(imagePath)) {
    let res = await axios({ 'url': url, 'responseType': 'stream' })
    await res.data.pipe(fs.createWriteStream(imagePath))
  }
}

const getBeetleImages = async (beetle) => {
  console.log(beetle.name, 'Get images')
  let beetleSearchUrl = 'https://www.insectimages.org/search/action.cfm?q=' + beetle.name
  let res = await axios.get(beetleSearchUrl)
  let $ = await cheerio.load(res.data)
  await $('a').each(async function (i, link) {
    let href = $(link).attr('href')
    if (href && href.includes('subthumb')) {
      let beetleId = href.substring(href.lastIndexOf('=') + 1)
      let beetlePage = 'https://api.bugwood.org/rest/api/image/.json?include=descriptor,dateupdated,citation&fmt=datatable&order[0][column]=0&order[0][dir]=desc&columns[8][searchable]=false&columns[1][searchable]=false&columns[7][searchable]=false&columns[10][searchable]=false&columns[4][searchable]=false&columns[11][searchable]=false&page=1&length=24&systemid=2&sub=' + beetleId
      let res = await axios.get(beetlePage)
      console.log(beetle.name, 'Downloading ' + res.data.data.length + ' images')
      for (let i = 0; i < res.data.data.length; ++i) {
        let imageId = res.data.data[i][0]
        let imageProvider = res.data.data[i][7]
        if (imageProvider === '//bugwoodcloud.org/images/') {
          let imageUrl = 'http:' + imageProvider + '768x512/' + imageId + '.jpg'
          await downloadImage(imageUrl, path.join('images', beetle.path, imageId + '.jpg'))
        }
      }
    }
  })
}

const getBeetleImagesAll = async () => {
  let beetleList = JSON.parse(fs.readFileSync('bug-types.json'))
  for (let i = 0; i < beetleList.length; ++i) {
    let beetle = beetleList[i]
    console.log(beetle.name)
    await getBeetleImages(beetle)
  }
}

const init = async () => {
  await getBeetleNames()
  await getBeetleImagesAll()
  await cleanBeetleList()
}

init()
