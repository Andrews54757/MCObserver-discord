const { SlashCommandBuilder } = require('@discordjs/builders')
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js')
const EditPerms = require('../enum/EditPerms')
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
          .setName('status')
          .setDescription('Show status for a minecraft server')
          .addStringOption(option =>
            option.setName('name')
              .setDescription('Name of server to observe')
              .setRequired(true)
          )
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
      .addSubcommand(subcommand =>
        subcommand.setName('config')
          .setDescription('Configures MCObserver')
          .addStringOption(option =>
            option.setName('edit_permission_default')
              .setDescription('Sets the default edit permissions for the server')
              .addChoices([['Allowed', EditPerms.ALLOWED], ['Forbidden', EditPerms.FORBIDDEN]])
          )
          .addStringOption(option =>
            option.setName('edit_permission_channel')
              .setDescription('Sets the edit permissions for the channel')
              .addChoices([['Allowed', EditPerms.ALLOWED], ['Forbidden', EditPerms.FORBIDDEN], ['Default', EditPerms.DEFAULT]])
          )
      )
  }

  static replySilent (interaction, message) {
    interaction.reply({ content: message, ephemeral: true })
  }

  static async execute (interaction, bot) {
    switch (interaction.options.getSubcommand()) {
      case 'observe': {
        if (!Utils.hasEditPerms(interaction, bot)) {
          this.replySilent(interaction, 'You do not have permission to use this command!')
          return
        }
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
      case 'status': {
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
        this.getStatusOfServer(name, interaction, bot)
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
      case 'config': {
        this.configure(interaction, bot)
        break
      }
    }
  }

  static async configure (interaction, bot) {
    const guildId = interaction.guildId
    const guildHolder = bot.getGuildHolder(guildId)
    if (!Utils.hasPerms(interaction)) {
      this.replySilent(interaction, 'You do not have permission to use this command!')
      return
    }
    const editPermDefault = interaction.options.getString('edit_permission_default')
    const editPermChannel = interaction.options.getString('edit_permission_channel')
    if (editPermDefault !== null) {
      guildHolder.setConfig('edit_permission_default', editPermDefault)
    }
    if (editPermChannel !== null) {
      const conf = guildHolder.getConfig('edit_permission_channel') || {}
      conf[interaction.channelId] = editPermChannel
      guildHolder.setConfig('edit_permission_channel', conf)
    }
    this.replySilent(interaction, 'Set!')
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
      const max = bot.config.maxServersPerGuild || 20
      if (guildHolder.getServers().length >= max) {
        this.replySilent(interaction, `Maximum of ${max} servers allowed!`)
        return
      }

      trackedServer = guildHolder.addServer(name, hostname, port, options)
    }

    if (trackedServer.watch(interaction.channelId)) {
      interaction.reply(`Watching server ${name} (${trackedServer.getDisplayAddress()})!`)
    } else {
      this.replySilent(interaction, `Already watching server ${name} (${trackedServer.getDisplayAddress()})!`)
    }
  }

  static getContentForServer (server, isWatched, isAdmin, canEdit) {
    const embed = new MessageEmbed()
      .setColor(server.getStatusColor())
      .setTitle(`${server.getName()}${(server.isAddressPrivate() && !isAdmin) ? '' : ` (${server.getDisplayAddress(true)})`}`)
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

    if (canEdit) {
      components.push(
        new MessageButton()
          .setCustomId(`settings|${server.getName()}`)
          .setLabel('Settings')
          .setStyle('SECONDARY')
      )

      if (isWatched) {
        components.push(
          new MessageButton()
            .setCustomId(`unwatch|${server.getName()}`)
            .setLabel('Unwatch')
            .setStyle('SECONDARY')
        )
        if (!isAdmin && server.getWatchedBy().length <= 1) {
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
        if (!isAdmin && server.getWatchedBy().length === 0) {
          components.push(
            new MessageButton()
              .setCustomId(`delete|${server.getName()}`)
              .setLabel('Delete')
              .setStyle('DANGER')
          )
        }
      }

      if (isAdmin) {
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
    }

    const obj = { embeds: [embed], ephemeral: isAdmin }
    if (server.getIconCached().file) {
      obj.files = [server.getIconCached().file]
    }

    if (components.length) {
      const rows = new MessageActionRow()
        .addComponents(components)
      obj.components = [rows]
    }
    return obj
  }

  static async getStatusOfServer (name, interaction, bot) {
    const guildId = interaction.guildId
    const guildHolder = bot.getGuildHolder(guildId)
    const trackedServer = guildHolder.getServer(name)

    const isAdmin = Utils.hasPerms(interaction)
    const canEdit = Utils.hasEditPerms(interaction, bot)
    if (!trackedServer) {
      this.replySilent(interaction, `Server ${name} does not exist!`)
    } else {
      if (!trackedServer.canUse(interaction.channelId) && !isAdmin) {
        this.replySilent(interaction, `Server ${name} is private!`)
        return
      }

      interaction.reply(this.getContentForServer(trackedServer, trackedServer.isWatchedBy(interaction.channelId), false, canEdit))
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
    interaction.reply({ content: `Listed ${list.length} servers!`, ephemeral: listAll })

    const canEdit = Utils.hasEditPerms(interaction, bot)
    list.forEach((server) => {
      const content = this.getContentForServer(server, server.isWatchedBy(interaction.channelId), listAll, canEdit)
      content.ephemeral = true
      interaction.followUp(content)
    })
  }
}
