const WatchOptions = {
  SERVER_STATUS: {
    value: 'serverstatus',
    name: 'Server Status',
    description: 'Logs server status changes',
    default: true
  },
  SAMPLE_SUPPORT: {
    value: 'samplesupport',
    name: 'Sample Support',
    description: 'Logs changes in sample-based player list support',
    default: true
  },
  PLAYER_JOIN: {
    value: 'playerjoin',
    name: 'Player Join',
    description: 'Logs player joins',
    default: true
  },
  PLAYER_LEAVE: {
    value: 'playerleave',
    name: 'Player Leave',
    description: 'Logs player leaves',
    default: true
  },
  VERSION_CHANGE: {
    value: 'versionchange',
    name: 'Version',
    description: 'Logs version change',
    default: true
  },
  MAX_PLAYERS_CHANGE: {
    value: 'maxplayerschange',
    name: 'Max Players',
    description: 'Logs max players change',
    default: true
  },
  MOTD_CHANGE: {
    value: 'motdchange',
    name: 'MOTD',
    description: 'Logs MOTD change',
    default: true
  },
  ICON_CHANGE: {
    value: 'iconchange',
    name: 'Icon',
    description: 'Logs icon change',
    default: true
  }
}

module.exports = WatchOptions
