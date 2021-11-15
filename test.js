const Bot = require('./index.js')

const fs = require('fs')
const path = require('path')

const secret = JSON.parse(fs.readFileSync(path.join(__dirname, 'secret.json'), 'utf8'))
const bot = new Bot(secret)

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});
