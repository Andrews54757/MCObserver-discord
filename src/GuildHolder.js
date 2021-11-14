const TrackedServer = require('./track/TrackedServer')
const fs = require('fs/promises')
const Path = require('path')
class GuildHolder {
  constructor (guild, bot) {
    this.guild = guild
    this.bot = bot

    this.watchedServers = new Map()

    this.loadData().catch(e => {
      console.error(e)
    })
  }

  async getChannels (list) {
    const channels = await Promise.allSettled(list.map((channelId) => this.guild.channels.fetch(channelId)))
    return channels.filter((o) => o.status === 'fulfilled').map((o) => o.value)
  }

  async loadData () {
    const str = await fs.readFile(Path.join(__dirname, '..', 'config', this.guild.id + '.json'), 'utf8')
    const data = JSON.parse(str)
    data.servers.forEach((server) => {
      const tracker = this.bot.getTracker(server.hostname, server.port) || this.bot.createTracker(server.hostname, server.port)
      const trackedServer = new TrackedServer(server.name, server.hostname, server.port, server.options, tracker, this)
      trackedServer.watchedBy = server.watchedBy || []
      trackedServer.accessedBy = server.accessedBy || []
      trackedServer.channelSettings = server.channelSettings || {}
      this.watchedServers.set(server.name, trackedServer)
    })
    console.log(`loaded ${data.servers.length} servers for guild ${this.guild.name}`)
  }

  markChanged () {
    this.changed = true
  }

  async saveDataIfNeeded () {
    if (this.changed) {
      this.changed = false
      const data = {
        name: this.guild.name,
        id: this.guild.id,
        timestamp: Date.now(),
        servers: []
      }
      this.watchedServers.forEach((server) => {
        data.servers.push(server.toObject())
      })

      await fs.writeFile(Path.join(__dirname, '..', 'config', this.guild.id + '.json'), JSON.stringify(data, null, 2))
    }
  }

  getServer (name) {
    return this.watchedServers.get(name)
  }

  getServers () {
    return this.watchedServers
  }

  addServer (name, hostname, port, options) {
    const tracker = this.bot.getTracker(hostname, port) || this.bot.createTracker(hostname, port)
    const trackedServer = new TrackedServer(name, hostname, port, options, tracker, this)
    this.watchedServers.set(name, trackedServer)
    this.markChanged()
    return trackedServer
  }

  removeServer (name) {
    const server = this.watchedServers.get(name)
    if (!server) {
      throw new Error("Server doesn't exist!")
    }

    server.onRemove()

    this.watchedServers.delete(name)
    this.markChanged()
  }
}
module.exports = GuildHolder
