const { MessageActionRow, MessageSelectMenu } = require('discord.js')
const WatchOptions = require('../enum/WatchOptions')
const Utils = require('../util/Utils')

module.exports = class SettingsButton {
  static getName () {
    return 'settings'
  }

  static replySilent (interaction, message) {
    interaction.reply({ content: message, ephemeral: true })
  }

  static execute (interaction, bot, name) {
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

    const settings = trackedServer.getChannelSettings(interaction.channelId) || {}

    const opts = []
    for (const prop in WatchOptions) {
      const obj = {
        label: WatchOptions[prop].name,
        description: WatchOptions[prop].description,
        value: WatchOptions[prop].value,
        default: settings[WatchOptions[prop].value] !== undefined ? settings[WatchOptions[prop].value] : WatchOptions[prop].default
      }

      opts.push(obj)
    }

    const row = new MessageActionRow()
      .addComponents(new MessageSelectMenu()
        .setCustomId(`settings|${name}`)
        .setMinValues(0)
        .setMaxValues(opts.length)
        .setPlaceholder('Select Notifications')
        .addOptions(opts))
    interaction.reply({ content: `Change notification settings of '${name}' in this channel`, components: [row], ephemeral: true })
  }
}
