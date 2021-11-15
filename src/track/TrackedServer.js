const { MessageAttachment, MessageEmbed } = require('discord.js')
const SampleSupport = require('../enum/SampleSupport')
const ServerStatus = require('../enum/ServerStatus')
const WatchOptions = require('../enum/WatchOptions')
const { formatTime } = require('../util/Utils')
const Utils = require('../util/Utils')

class TrackedServer {
  constructor (name, hostname, port, options, tracker, guildHolder) {
    this.name = name
    this.hostname = hostname
    this.port = port

    this.options = options

    this.guildHolder = guildHolder

    this.tracker = tracker

    this.watchedBy = []
    this.accessedBy = []
    this.channelSettings = {}

    this.tracker.addEventListeners(this)

    this.cachedIconUrl = null
  }

  getChannelSettings (channelId) {
    return this.channelSettings[channelId]
  }

  setChannelSettings (channelId, settings) {
    this.channelSettings[channelId] = settings
    this.markChanged()
  }

  getIconCached () {
    const iconUrl = this.getIcon()

    if (this.cachedIconUrl !== iconUrl) {
      this.cachedIcon = {
        url: iconUrl,
        file: null
      }
      this.cachedIconUrl = iconUrl

      if (iconUrl.substring(0, 11) === 'data:image/') {
        const fileFormat = iconUrl.split(';')[0].split('/')[1]
        const data = iconUrl.split(',')[1]
        const buf = Buffer.from(data, 'base64')
        this.cachedIcon.file = new MessageAttachment(buf, 'img.' + fileFormat)
        this.cachedIcon.url = 'attachment://img.' + fileFormat
      }
    }

    return this.cachedIcon
  }

  onRemove () {
    this.tracker.removeEventListeners(this)
  }

  toObject () {
    return {
      name: this.name,
      hostname: this.hostname,
      port: this.port,
      options: this.options,
      watchedBy: this.watchedBy,
      accessedBy: this.accessedBy,
      channelSettings: this.channelSettings
    }
  }

  async getChannelsToSend (enumObj) {
    return await this.guildHolder.getChannels(this.getWatchedBy().filter((channelId) => {
      const settings = this.getChannelSettings(channelId) || {}
      if (settings[enumObj.value] !== undefined) {
        return settings[enumObj.value]
      }
      return enumObj.default
    }))
  }

  sendToChannels (channels, obj) {
    channels.forEach((channel) => {
      channel.send(obj)
    })
  }

  async onStatusChange (value, prevValue) {
    const channels = await this.getChannelsToSend(WatchOptions.SERVER_STATUS)
    if (channels.length === 0) return
    const icon = this.getIconCached()
    const embed = new MessageEmbed()
    embed.setColor(this.getStatusColor())
      .setTitle(this.getName() + ' is now ' + value)
      .setDescription(prevValue + ' > ' + value)
      .setThumbnail(icon.url)
      .setTimestamp()

    if (value === ServerStatus.ONLINE) {
      embed.addField('Online', this.getOnlineCount() + '/' + this.getMaxCount(), true)
      embed.addField('Latency', this.getLatency() + 'ms', true)
      embed.addField('Version', this.getVersion().toString(), true)
    }
    const obj = {
      embeds: [embed]
    }
    if (icon.file) {
      obj.files = [icon.file]
    }

    this.sendToChannels(channels, obj)
  }

  async onVersionChange (value, prevValue) {
    const channels = await this.getChannelsToSend(WatchOptions.VERSION_CHANGE)
    if (channels.length === 0) return
    const icon = this.getIconCached()
    const embed = new MessageEmbed()
    embed.setColor(this.getStatusColor())
      .setTitle(`${this.getName()} has ${!Utils.compareVersion(value, prevValue) ? 'upgraded' : 'downgraded'}!`)
      .setDescription(prevValue + ' > ' + value)
      .setThumbnail(icon.url)
      .setTimestamp()

    const obj = {
      embeds: [embed]
    }
    if (icon.file) {
      obj.files = [icon.file]
    }

    this.sendToChannels(channels, obj)
  }

  async onMotdChange (value, prevValue) {
    const channels = await this.getChannelsToSend(WatchOptions.MOTD_CHANGE)
    if (channels.length === 0) return
    const icon = this.getIconCached()
    const embed = new MessageEmbed()
    embed.setColor(this.getStatusColor())
      .setTitle(`${this.getName()} changed MOTD`)
      .setThumbnail(icon.url)
      .setTimestamp()

    if (prevValue) { embed.addField('Old MOTD', prevValue.replace(/\u00A7[0-9a-gk-or]/g, ''), false) }
    if (value) { embed.addField('New MOTD', value.replace(/\u00A7[0-9a-gk-or]/g, ''), false) }

    const obj = {
      embeds: [embed]
    }
    if (icon.file) {
      obj.files = [icon.file]
    }

    this.sendToChannels(channels, obj)
  }

  async onIconChange (value, prevValue) {
    const channels = await this.getChannelsToSend(WatchOptions.ICON_CHANGE)
    if (channels.length === 0) return
    const icon = this.getIconCached()
    const embed = new MessageEmbed()
    embed.setColor(this.getStatusColor())
      .setTitle(`${this.getName()} changed icon`)
      .setDescription('Icon has changed')
      .setThumbnail(icon.url)
      .setTimestamp()

    const obj = {
      embeds: [embed]
    }
    if (icon.file) {
      obj.files = [icon.file]
    }

    this.sendToChannels(channels, obj)
  }

  async onMaxPlayerCountChange (value, prevValue) {
    const channels = await this.getChannelsToSend(WatchOptions.MAX_PLAYERS_CHANGE)
    if (channels.length === 0) return
    const icon = this.getIconCached()
    const embed = new MessageEmbed()
    embed.setColor(this.getStatusColor())
      .setTitle(`${this.getName()} changed player limit`)
      .setDescription(`${prevValue} > ${value} players`)
      .setThumbnail(icon.url)
      .setTimestamp()

    const obj = {
      embeds: [embed]
    }
    if (icon.file) {
      obj.files = [icon.file]
    }

    this.sendToChannels(channels, obj)
  }

  async onPlayersJoin (players) {
    if (this.tracker.sampleSupport !== SampleSupport.SUPPORTED) return
    const channels = await this.getChannelsToSend(WatchOptions.PLAYER_JOIN)
    if (channels.length === 0) return
    players.forEach((player) => {
      const icon = this.getIconCached()
      const embed = new MessageEmbed()
      embed.setColor('#0099ff')
        .setAuthor(player.name, 'https://minotar.net/helm/' + player.id.replace(/-/g, '') + '/100.png', `https://namemc.com/profile/${player.name}`)
        .setTitle(`Joined ${this.getName()}`)
        .setThumbnail(icon.url)
        .setTimestamp()

      embed.setDescription(this.getOnlineCount() + '/' + this.getMaxCount() + ' online')

      const obj = {
        embeds: [embed]
      }
      if (icon.file) {
        obj.files = [icon.file]
      }

      this.sendToChannels(channels, obj)
    })
  }

  async onPlayersLeave (players) {
    if (this.tracker.sampleSupport !== SampleSupport.SUPPORTED) return
    const channels = await this.getChannelsToSend(WatchOptions.PLAYER_LEAVE)
    if (channels.length === 0) return
    players.forEach((player) => {
      const icon = this.getIconCached()
      const embed = new MessageEmbed()
      embed.setColor('#575757')
        .setAuthor(player.name, 'https://minotar.net/helm/' + player.id.replace(/-/g, '') + '/100.png', `https://namemc.com/profile/${player.name}`)
        .setTitle(`Left ${this.getName()}`)
        .setThumbnail(icon.url)
        .setTimestamp()

      // embed.addField('Playtime', formatTime(Math.floor((Date.now() - player.joined_time) / 1000)))
      embed.setDescription(this.getOnlineCount() + '/' + this.getMaxCount() + ' online')

      const obj = {
        embeds: [embed]
      }
      if (icon.file) {
        obj.files = [icon.file]
      }

      this.sendToChannels(channels, obj)
    })
  }

  async onOnlinePlayerCountChange (value, prevValue) {
    if (this.tracker.sampleSupport === SampleSupport.SUPPORTED) return
    const channels = await this.getChannelsToSend(value > prevValue ? WatchOptions.PLAYER_JOIN : WatchOptions.PLAYER_LEAVE)
    if (channels.length === 0) return

    const icon = this.getIconCached()
    const embed = new MessageEmbed()
    embed.setColor(this.getStatusColor())
      .setTitle(`${this.getName()}`)
      .setDescription(`${prevValue} > ${value} online players`)
      .setThumbnail(icon.url)
      .setTimestamp()

    const obj = {
      embeds: [embed]
    }
    if (icon.file) {
      obj.files = [icon.file]
    }
    this.sendToChannels(channels, obj)
  }

  markChanged () {
    this.guildHolder.markChanged()
  }

  getName () {
    return this.name
  }

  getStatus () {
    return this.tracker.status
  }

  getStatusColor () {
    if (this.getStatus() === ServerStatus.ONLINE) {
      return '#0099ff'
    }
    if (this.getStatus() === ServerStatus.OFFLINE) {
      return '#575757'
    }
    return '#575757'
  }

  getVersion () {
    return this.tracker.version
  }

  getOnlineCount () {
    return this.tracker.online_players
  }

  getMaxCount () {
    return this.tracker.max_players
  }

  getLatency () {
    return this.tracker.latency
  }

  getPlayerList () {
    return Array.from(this.tracker.players, (a) => a[1])
  }

  getDisplayAddress (override) {
    return (!override && this.options.isAddressPrivate) ? '[Redacted Address]' : (this.hostname + ':' + this.port)
  }

  isAddressPrivate () {
    return this.options.isAddressPrivate
  }

  getHostname () {
    return this.hostname
  }

  getFailedAttempts () {
    return this.tracker.failed_attempts
  }

  getMotd () {
    return (this.tracker.motd || '').replace(/\u00A7[0-9a-gk-or]/g, '')
  }

  getIcon () {
    return this.tracker.icon || 'https://mcobserver.com/minecraft.png'
  }

  getPort () {
    return this.port
  }

  getWatchedBy () {
    return this.watchedBy
  }

  isWatchedBy (channelId) {
    return this.watchedBy.includes(channelId)
  }

  canUse (channelId) {
    return !this.options.isPrivate || this.accessedBy.includes(channelId)
  }

  watch (channelId) {
    if (this.watchedBy.includes(channelId)) {
      return false
    }
    this.watchedBy.push(channelId)
    if (!this.accessedBy.includes(channelId)) {
      this.accessedBy.push(channelId)
    }
    this.markChanged()
    return true
  }

  unwatch (channelId) {
    const ind = this.watchedBy.indexOf(channelId)
    if (ind === -1) return false
    this.watchedBy.splice(ind, 1)

    this.markChanged()
    return true
  }

  unwatchAll () {
    this.watchedBy.length = 0
    this.markChanged()
  }
}

module.exports = TrackedServer
