const { MessageButton, MessageActionRow } = require('discord.js')
const Utils = require('../util/Utils')

module.exports = class UnwatchAllButton {
  static getName () {
    return 'unwatch_all'
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

    if (!hasPerms) {
      this.replySilent(interaction, 'You do not have permission to use this button!')
      return
    }
    const len = trackedServer.getWatchedBy().length
    if (confirm) {
      trackedServer.unwatchAll()
      interaction.reply(`<@${interaction.user.id}> Unwatched '${name}' for ${len} channels`)
    } else {
      const row = new MessageActionRow()
        .addComponents(
          new MessageButton()
            .setCustomId(`unwatch_all|${name}|true`)
            .setLabel(`Unwatch '${name}' for ${len} channels`)
            .setStyle('DANGER')
        )
      interaction.reply({ content: 'Are you sure?', components: [row], ephemeral: true })
    }
  }
}
