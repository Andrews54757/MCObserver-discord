const { MessageActionRow, MessageButton } = require('discord.js')

module.exports = class UnwatchButton {
  static getName () {
    return 'unwatch'
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

    if (!trackedServer.isWatchedBy(interaction.channelId)) {
      this.replySilent(`'${name}' is not being watched by this channel!`)
      return
    }

    trackedServer.unwatch(interaction.channelId)

    const row = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId(`watch|${name}`)
          .setLabel(`Watch '${name}'`)
          .setStyle('PRIMARY')
      )
    interaction.reply({ content: `Unwatched '${name}' for this channel`, components: [row] })
  }
}