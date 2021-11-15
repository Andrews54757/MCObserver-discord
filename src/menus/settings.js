const WatchOptions = require('../enum/WatchOptions')
const Utils = require('../util/Utils')

module.exports = class WatchButton {
  static getName () {
    return 'settings'
  }

  static replySilent (interaction, message) {
    interaction.reply({ content: message, ephemeral: true })
  }

  static execute (interaction, bot, name) {
    if (!Utils.hasEditPerms(interaction, bot)) {
      this.replySilent('You do not have permission to use this button!')
      return
    }

    const guildId = interaction.guildId
    const guildHolder = bot.getGuildHolder(guildId)

    const trackedServer = guildHolder.getServer(name)
    if (!trackedServer) {
      this.replySilent(interaction, `Server '${name}' doesn't exist!`)
      return
    }

    if (!trackedServer.canUse(interaction.channelId) && !Utils.hasPerms(interaction)) {
      this.replySilent(interaction, `Server ${name} is private!`)
      return
    }

    const values = interaction.values

    const settings = trackedServer.getChannelSettings(interaction.channelId) || {}
    const added = []
    const removed = []
    for (const prop in WatchOptions) {
      const value = WatchOptions[prop].value
      if (values.includes(value)) {
        if (settings[value] === undefined) {
          if (!WatchOptions[prop].default) added.push(WatchOptions[prop].name)
        } else if (!settings[value]) {
          added.push(WatchOptions[prop].name)
        }
        settings[value] = true
      } else {
        if (settings[value] === undefined) {
          if (WatchOptions[prop].default) removed.push(WatchOptions[prop].name)
        } else if (settings[value]) {
          removed.push(WatchOptions[prop].name)
        }
        settings[value] = false
      }
    }

    trackedServer.setChannelSettings(interaction.channelId, settings)

    const str = []

    if (added.length) {
      str.push('Added ' + added.join(', '))
    }

    if (removed.length) {
      str.push('Removed ' + removed.join(', '))
    }

    if (str.length) {
      interaction.reply(`${str.join(' and ')} for logging '${name}'`)
    } else {
      interaction.reply(`No settings changed for server '${name}'`)
    }
  }
}
