const { MessageButton, MessageActionRow } = require('discord.js')
const Utils = require('../util/Utils')

module.exports = class DeleteButton {
  static getName () {
    return 'delete'
  }

  static replySilent (interaction, message) {
    interaction.reply({ content: message, ephemeral: true })
  }

  static execute (interaction, bot, name, confirm) {
    if (!Utils.hasEditPerms(interaction, bot)) {
      this.replySilent(interaction, 'You do not have permission to use this button!')
      return
    }

    const guildId = interaction.guildId
    const guildHolder = bot.getGuildHolder(guildId)

    const trackedServer = guildHolder.getServer(name)
    if (!trackedServer) {
      this.replySilent(interaction, `Server '${name}' doesn't exist!`)
      return
    }

    const hasPerms = Utils.hasPerms(interaction)

    if (!hasPerms && !trackedServer.canUse(interaction.channelId)) {
      this.replySilent(interaction, 'You do not have permission to use this button!')
      return
    }
    if (!hasPerms && trackedServer.getWatchedBy().length > 0) {
      if (trackedServer.getWatchedBy().length !== 1 || trackedServer.getWatchedBy()[0] !== interaction.channelId) {
        this.replySilent(interaction, 'The server must not be watched by other channels to use this button!')
        return
      }
    }
    const len = trackedServer.getWatchedBy().length
    if (confirm) {
      trackedServer.unwatchAll()
      guildHolder.removeServer(name)
      interaction.reply(`<@${interaction.user.id}> Deleted server '${name}' and unwatched for ${len} channels`)
    } else {
      const row = new MessageActionRow()
        .addComponents(
          new MessageButton()
            .setCustomId(`delete|${name}|true`)
            .setLabel(`Delete '${name}'`)
            .setStyle('DANGER')
        )
      interaction.reply({ content: 'Are you sure?', components: [row], ephemeral: true })
    }
  }
}
