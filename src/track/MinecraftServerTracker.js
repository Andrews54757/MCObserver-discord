const Constants = require('../enum/Constants')
const SampleSupport = require('../enum/SampleSupport')
const ServerStatus = require('../enum/ServerStatus')
const MinecraftStatusQuery = require('../util/MinecraftStatusQuery')

class MinecraftServerTracker {
  constructor (hostname, port) {
    this.hostname = hostname
    this.port = port
    this.players = new Map()
    this.playerCache = new Map()
    this.status = ServerStatus.UNKNOWN
    this.sampleSupport = SampleSupport.UNKNOWN
    this.failed_attempts = 0
    this.max_players = 0
    this.online_players = 0
    this.icon = ''
    this.version = '0.0.0'
    this.motd = ''
    this.latency = 0

    this.eventListeners = []

    this.primed = false
  }

  setPropertyWithEvent (property, event, value) {
    const prevValue = this[property]
    this[property] = value
    if (prevValue !== value) {
      this.fire(event, value, prevValue)
      return true
    }
    return false
  }

  addEventListeners (obj) {
    this.eventListeners.push(obj)
  }

  removeEventListeners (obj) {
    const ind = this.eventListeners.indexOf(obj)
    if (ind === -1) {
      throw new Error('Event listeners not found!')
    }
    this.eventListeners.splice(ind, 1)
  }

  fire (name, ...args) {
    if (!this.primed) {
      return
    }
    this.eventListeners.forEach((listener) => {
      if (typeof listener[name] === 'function') {
        listener[name](...args)
      }
    })
  }

  async query () {
    let result
    try {
      result = await MinecraftStatusQuery.queryServerProxied(this.hostname, this.port)
      if (!result || !result.data || !result.data.version || !result.data.players) throw "Invalid data";
    } catch (e) {
      this.failed_attempts++

      if (this.failed_attempts > 5) {
        this.setPropertyWithEvent('status', 'onStatusChange', ServerStatus.OFFLINE)
      }
      return
    }
    this.failed_attempts = 0
    this.setPropertyWithEvent('status', 'onStatusChange', ServerStatus.ONLINE)
    this.setPropertyWithEvent('version', 'onVersionChange', result.data.version.name)
    this.setPropertyWithEvent('motd', 'onMotdChange', result.data.description.text)
    this.setPropertyWithEvent('icon', 'onIconChange', result.data.favicon)
    this.setPropertyWithEvent('latency', 'onLatencyChange', result.latency)
    const didPlayersChange = this.setPropertyWithEvent('online_players', 'onOnlinePlayerCountChange', parseInt(result.data.players.online))
    this.setPropertyWithEvent('max_players', 'onMaxPlayerCountChange', parseInt(result.data.players.max))

    this.sample = result.data.players.sample || []
    if (this.sample.length === 0 && this.online_players !== 0) {
      this.setPropertyWithEvent('sampleSupport', 'onSampleSupportChange', SampleSupport.UNSUPPORTED)
    } else {
      if (this.sample.length >= this.online_players / 5) {
        this.setPropertyWithEvent('sampleSupport', 'onSampleSupportChange', SampleSupport.SUPPORTED)
      } else {
        this.setPropertyWithEvent('sampleSupport', 'onSampleSupportChange', SampleSupport.OVERSATURATED)
      }
    }

    if (this.sampleSupport === SampleSupport.SUPPORTED || this.sampleSupport === SampleSupport.ANON_BOMBED) {
      this.sample.forEach((player) => {
        this.playerCache.set(player.id, player)
      })
      const hasAnonymous = this.playerCache.has(Constants.ANAONYMOUS_UUID);
      if (this.sample.size < this.online_players) {
        this.updatePlayerList(!didPlayersChange && this.playerCache.size === this.online_players)
        if (!didPlayersChange && this.playerCache.size === this.online_players) this.primed = true

        if (didPlayersChange || this.playerCache.size >= this.online_players) {
          this.playerCache.clear()
        }

        if (hasAnonymous) {
          this.setPropertyWithEvent('sampleSupport', 'onSampleSupportChange', SampleSupport.ANON_BOMBED);
        }
      } else {
        this.updatePlayerList(true)
        this.primed = true
        this.playerCache.clear();

        if (this.sampleSupport === SampleSupport.ANON_BOMBED) {
          this.setPropertyWithEvent('sampleSupport', 'onSampleSupportChange', SampleSupport.SUPPORTED);
        }
      }
    } else {
      this.primed = true
      this.playerCache.clear()
    }
  }

  updatePlayerList (canDelete) {
    const joined = []
    this.playerCache.forEach((player) => {
      player.last_seen_time = Date.now();
      if (!this.players.has(player.id)) {
        player.joined_time = Date.now();
        this.players.set(player.id, player)
        joined.push(player)
      }
    })
    if (this.primed) { this.fire('onPlayersJoin', joined) }

    if (canDelete) {
      const left = []
      this.players.forEach((player) => {
        if (!this.playerCache.has(player.id)) {
          this.players.delete(player.id)
          left.push(player)
        } else if (this.sampleSupport === SampleSupport.ANON_BOMBED) {
          if (player.last_seen_time + 1000 * 60 * 5 < Date.now()) {
            this.players.delete(player.id)
            left.push(player)
          }
        }
      })
      if (this.primed) { this.fire('onPlayersLeave', left) }
    }
  }
}

module.exports = MinecraftServerTracker
