const { SlashCommandBuilder } = require('@discordjs/builders')
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js')
const ServerStatus = require('../enum/ServerStatus')
const Utils = require('../util/Utils')
const { formatTime } = require('../util/Utils')
module.exports = class MCOCommand {
  static getData () {
    return new SlashCommandBuilder()
      .setName('mcobserver')
      .setDescription('Observe minecraft servers')
      .addSubcommand(subcommand =>
        subcommand
          .setName('observe')
          .setDescription('Observe a minecraft server')
          .addStringOption(option =>
            option.setName('name')
              .setDescription('Name of server to observe')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('address')
              .setDescription('ip:port of server to observe')
          )
          .addBooleanOption(option => option.setName('is_address_private')
            .setDescription('Redacts the address in the listings'))
          .addBooleanOption(option => option.setName('is_private')
            .setDescription('Disables usage of server in other channels'))
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('List watched minecraft servers')
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('list_all')
          .setDescription('List all watched minecraft servers')
      )
  }

  static replySilent (interaction, message) {
    interaction.reply({ content: message, ephemeral: true })
  }

  static async execute (interaction, bot) {
    switch (interaction.options.getSubcommand()) {
      case 'observe': {
        const unfilteredName = interaction.options.getString('name')
        const name = unfilteredName.replace(/[^a-zA-Z0-9_\-[\]()]/g, '')

        if (!name || name.length === 0 || name.length > 40) {
          if (name !== unfilteredName) {
            this.replySilent(interaction, `'${unfilteredName}' (escaped to '${name}') is not a valid name!`)
          } else {
            this.replySilent(interaction, 'Please supply a valid name!')
          }
          return
        }

        const address = interaction.options.getString('address')
        if (address) {
          const options = {
            isAddressPrivate: interaction.options.getBoolean('is_address_private') || false,
            isPrivate: interaction.options.getBoolean('is_private') || false
          }
          this.observeNewServer(name, address, options, interaction, bot)
        } else {
          this.observeExistingServer(name, interaction, bot)
        }
        break
      }
      case 'list': {
        this.listServers(false, interaction, bot)
        break
      }
      case 'list_all': {
        if (!Utils.hasPerms(interaction)) {
          this.replySilent(interaction, 'You do not have permission to use this command!')
          return
        }
        this.listServers(true, interaction, bot)
        break
      }
    }
  }

  static async observeExistingServer (name, interaction, bot) {
    const guildId = interaction.guildId
    const guildHolder = bot.getGuildHolder(guildId)
    const trackedServer = guildHolder.getServer(name)

    if (!trackedServer) {
      this.replySilent(interaction, `Server ${name} does not exist!`)
    } else {
      if (!trackedServer.canUse(interaction.channelId) && !Utils.hasPerms(interaction)) {
        this.replySilent(interaction, `Server ${name} is private!`)
        return
      }

      if (trackedServer.watch(interaction.channelId)) {
        interaction.reply(`Watching server ${name} (${trackedServer.getDisplayAddress()})!`)
      } else {
        this.replySilent(interaction, `Already watching server ${name} (${trackedServer.getDisplayAddress()})!`)
      }
    }
  }

  static async observeNewServer (name, address, options, interaction, bot) {
    const guildId = interaction.guildId

    const guildHolder = bot.getGuildHolder(guildId)

    if (address.length === 0 || address.length > 40) {
      this.replySilent(interaction, 'Please supply a valid address!')
      return
    }

    let newaddr = address
    if (address.indexOf('://') === -1) {
      newaddr = 'http://' + address
    }
    let url
    try {
      url = new URL(newaddr)
    } catch (e) {
      this.replySilent(interaction, `'${address}' is not a valid address`)
      console.error(e)
      return
    }

    const host = url.host

    if (!host || host.indexOf('.') === -1) {
      this.replySilent(interaction, `'${address}' is not a valid address`)
      return
    }

    const port = url.port || 25565
    const hostname = url.hostname

    let trackedServer = guildHolder.getServer(name)
    if (trackedServer) {
      if (!Utils.hasPerms(interaction)) {
        this.replySilent(interaction, `'${name}' is already being used!`)
        return
      }

      const prevServer = trackedServer

      trackedServer = guildHolder.addServer(name, hostname, port, options)

      trackedServer.watchedBy = prevServer.watchedBy
      trackedServer.accessedBy = prevServer.accessedBy
      trackedServer.channelSettings = prevServer.channelSettings
      prevServer.onRemove()

      this.replySilent(interaction, 'Modification success!')
      return
    } else {
      trackedServer = guildHolder.addServer(name, hostname, port, options)
    }

    if (trackedServer.watch(interaction.channelId)) {
      interaction.reply(`Watching server ${name} (${trackedServer.getDisplayAddress()})!`)
    } else {
      this.replySilent(interaction, `Already watching server ${name} (${trackedServer.getDisplayAddress()})!`)
    }
  }

  static async listServers (listAll, interaction, bot) {
    const guildId = interaction.guildId
    const guildHolder = bot.getGuildHolder(guildId)

    const list = []
    guildHolder.getServers().forEach((server) => {
      if (listAll || server.canUse(interaction.channelId)) {
        list.push(server)
      }
    })
    if (list.length === 0) {
      this.replySilent(interaction, 'There are no servers to list!')
      return
    }
    interaction.reply({ content: `Listing ${list.length} servers...`, ephemeral: listAll })

    list.forEach((server) => {
      const embed = new MessageEmbed()
        .setColor(server.getStatusColor())
        .setTitle(`${server.getName()}${(server.isAddressPrivate() && !listAll) ? '' : ` (${server.getDisplayAddress(true)})`}`)
        .setThumbnail(server.getIconCached().url)

      if (server.getMotd()) {
        embed.setDescription(server.getMotd().toString())
      }
      if (server.getStatus() === ServerStatus.ONLINE) {
        embed.addField('Online', server.getOnlineCount() + '/' + server.getMaxCount(), true)
        embed.addField('Latency', server.getLatency() + 'ms', true)
        embed.addField('Version', server.getVersion().toString(), true)
      } else {
        embed.addField('Offline', server.getFailedAttempts() + ' failed attempts', true)
      }

      const players = server.getPlayerList()
      if (players.length) {
        embed.addField('Players', players.map((player) => `${player.name} (${formatTime(Math.floor((Date.now() - player.joined_time) / 1000))})`).join(', '), true)
      }

      embed.addField('Watched By', server.getWatchedBy().length ? server.getWatchedBy().map(o => `<#${o}>`).join('') : 'None', false)

      const components = []
      components.push(
        new MessageButton()
          .setCustomId(`settings|${server.getName()}`)
          .setLabel('Settings')
          .setStyle('SECONDARY')
      )
      if (server.isWatchedBy(interaction.channelId)) {
        components.push(
          new MessageButton()
            .setCustomId(`unwatch|${server.getName()}`)
            .setLabel('Unwatch')
            .setStyle('SECONDARY')
        )
        if (!listAll && server.getWatchedBy().length <= 1) {
          components.push(
            new MessageButton()
              .setCustomId(`delete|${server.getName()}`)
              .setLabel('Delete')
              .setStyle('DANGER')
          )
        }
      } else {
        components.push(
          new MessageButton()
            .setCustomId(`watch|${server.getName()}`)
            .setLabel('Watch')
            .setStyle('PRIMARY')
        )
        if (!listAll && server.getWatchedBy().length === 0) {
          components.push(
            new MessageButton()
              .setCustomId(`delete|${server.getName()}`)
              .setLabel('Delete')
              .setStyle('DANGER')
          )
        }
      }

      if (listAll) {
        if (server.getWatchedBy().length > 0) {
          components.push(
            new MessageButton()
              .setCustomId(`unwatch_all|${server.getName()}`)
              .setLabel('Unwatch All')
              .setStyle('SECONDARY')
          )
        }

        components.push(
          new MessageButton()
            .setCustomId(`delete|${server.getName()}`)
            .setLabel('Delete')
            .setStyle('DANGER')
        )
      }

      const row = new MessageActionRow()
        .addComponents(components)

      const obj = { embeds: [embed], components: [row], ephemeral: listAll }
      if (server.getIconCached().file) {
        obj.files = [server.getIconCached().file]
      }
      interaction.followUp(obj)
    })
  }
}
