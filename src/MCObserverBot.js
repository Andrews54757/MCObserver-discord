const { Client, Intents } = require('discord.js')
const GuildHolder = require('./GuildHolder')
const MinecraftServerTracker = require('./track/MinecraftServerTracker')
const GuiUtils = require('./util/GuiUtils')
const CommandUtils = require('./util/CommandUtils')

class MCObserverBot {
  constructor (config) {
    this.config = config

    this.client = new Client({
      intents: [Intents.FLAGS.GUILDS]
    })

    this.guilds = new Map()
    this.trackers = new Map()
    this.setup()
  }

  getGuildHolder (id) {
    return this.guilds.get(id)
  }

  getTracker (hostname, port) {
    return this.trackers.get(hostname + ':' + port)
  }

  createTracker (hostname, port) {
    const tracker = new MinecraftServerTracker(hostname, port)
    this.trackers.set(hostname + ':' + port, tracker)
    return tracker
  }

  async setup () {
    this.commands = await CommandUtils.getCommands()
    this.buttons = await GuiUtils.getButtons()
    this.menus = await GuiUtils.getMenus()
    this.client.once('ready', async () => {
      this.ready = true

      const guilds = await Promise.all((await this.client.guilds.fetch()).map((guild) => guild.fetch()))
      guilds.forEach((guild) => {
        this.guilds.set(guild.id, new GuildHolder(guild, this))
        CommandUtils.deployCommands(this.commands, this.config.token, this.config.clientId, guild.id)
      })

      this.loop()
    })

    this.client.on('guildCreate', guild => {
      console.log('Joined a new guild: ' + guild.name)
      this.guilds.set(guild.id, new GuildHolder(guild, this))
      CommandUtils.deployCommands(this.commands, this.config.token, this.config.clientId, guild.id)
    })

    this.client.on('guildDelete', guild => {
      console.log('Left a guild: ' + guild.name)
      this.guilds.delete(guild.id, new GuildHolder(guild, this))
    })

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.inGuild()) {
        return interaction.reply({ content: 'Cannot use outside of guild!', ephemeral: true })
      }

      if (interaction.isCommand()) {
        const command = this.commands.get(interaction.commandName)
        if (!command) return

        try {
          await command.execute(interaction, this)
        } catch (error) {
          console.error(error)
          return interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true })
        }
      } else if (interaction.isButton()) {
        const customId = interaction.customId.split('|')
        const button = this.buttons.get(customId[0])
        if (!button) return

        try {
          await button.execute(interaction, this, ...customId.slice(1))
        } catch (error) {
          console.error(error)
          return interaction.reply({ content: 'There was an error while executing this button!', ephemeral: true })
        }
      } else if (interaction.isSelectMenu()) {
        const customId = interaction.customId.split('|')
        const menu = this.menus.get(customId[0])
        if (!menu) return

        try {
          await menu.execute(interaction, this, ...customId.slice(1))
        } catch (error) {
          console.error(error)
          return interaction.reply({ content: 'There was an error while executing this menu!', ephemeral: true })
        }
      } else {
        return interaction.reply({ content: 'Invalid action!', ephemeral: true })
      }
    })

    this.login()
  }

  async loop () {
    this.guilds.forEach((guild) => {
      guild.saveDataIfNeeded()
    })

    this.trackers.forEach((tracker, key) => {
      if (tracker.eventListeners.length === 0) {
        this.trackers.delete(key)
        return
      }
      try {
        tracker.query()
      } catch (e) {
        console.error(e)
      }
    })

    setTimeout(() => {
      this.loop()
    }, 10000)
  }

  login () {
    this.client.login(this.config.token)
  }
}

module.exports = MCObserverBot
