const { MessageActionRow, MessageButton } = require('discord.js')
const Utils = require('../util/Utils')

module.exports = class WatchButton {
  static getName () {
    return 'watch'
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

    if (trackedServer.isWatchedBy(interaction.channelId)) {
      this.replySilent(`'${name}' is already being watched by this channel!`)
      return
    }

    trackedServer.watch(interaction.channelId)

    const row = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId(`unwatch|${name}`)
          .setLabel(`Unwatch '${name}'`)
          .setStyle('SECONDARY')
      )
    interaction.reply({ content: `Watching '${name}' in this channel`, components: [row] })
  }
}
