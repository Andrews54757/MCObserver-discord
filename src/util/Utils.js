const EditPerms = require('../enum/EditPerms')

class Utils {
  static formatTime (d) {
    const seconds = d % 60
    let minutes = Math.floor(d / 60)

    let hours = Math.floor(minutes / 60)
    let days = Math.floor((hours / 24) * 10) / 10
    if (days < 1) days = 0
    hours = hours % 24
    minutes = minutes % 60

    const years = Math.floor(days / 365)
    days = days % 365

    if (years) {
      return years + ' year' + (years === 1 ? '' : 's') + ' ' + days + ' day' + (days === 1 ? '' : 's')
    } else
    if (days) {
      return days + ' day' + (days === 1 ? '' : 's')
    } else
    if (hours) {
      return hours + ':' + (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds
    } else if (minutes) {
      return minutes + ':' + (seconds < 10 ? '0' : '') + seconds
    } else {
      return seconds + 's'
    }
  }

  static hasPerms (interaction) {
    if (!interaction.member) {
      return false
    }
    if (interaction.member.id === '239078039831445504') {
      return true
    }
    return false
  }

  static hasEditPerms (interaction, bot) {
    if (this.hasPerms(interaction)) return true
    const guildId = interaction.guildId
    const guildHolder = bot.getGuildHolder(guildId)

    const perChannel = guildHolder.getConfig('edit_permission_channel') || {}
    if (perChannel[interaction.channelId] === EditPerms.ALLOWED) {
      return true
    } else if (perChannel[interaction.channelId] === EditPerms.FORBIDDEN) {
      return false
    }
    return guildHolder.getConfig('edit_permission_default') === EditPerms.ALLOWED
  }

  static compareVersion (ver1, ver2) {
    ver1 = ver1.split('.').map(s => s.padStart(10)).join('.')
    ver2 = ver2.split('.').map(s => s.padStart(10)).join('.')
    return ver1 <= ver2
  }
}

module.exports = Utils
