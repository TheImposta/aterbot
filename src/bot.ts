import * as mineflayer from 'mineflayer'
import type { Bot, ControlState } from 'mineflayer'

import { sleep, getRandom } from './utils.js'
import CONFIG from '../config.json' assert { type: 'json' }

let bot: Bot | null = null
let loop: NodeJS.Timeout | null = null
let reconnecting = false
let retryDelay = CONFIG.action.retryDelay // for exponential backoff

function createBot(): void {
  reconnecting = false

  bot = mineflayer.createBot({
    host: CONFIG.client.host,
    port: Number(CONFIG.client.port),
    username: CONFIG.client.username,
    version: CONFIG.client.version,
    connectTimeout: 60000, // increase timeout to 60s
    keepAlive: true
  })

  bot.on('login', () => {
    retryDelay = CONFIG.action.retryDelay // reset backoff on successful login
    console.log(`AFKBot logged in as ${bot!.username}`)
  })

  bot.on('spawn', () => {
    startActions()
  })

  bot.on('kicked', (reason) => {
    console.error('Kicked:', reason)
  })

  bot.on('end', () => {
    console.log('Bot connection ended')
    scheduleReconnect()
  })

  bot.on('error', (err) => {
    if (err.message.includes('timed out') || err.code === 'ETIMEDOUT') {
      console.warn('Server timeout detected, will retry...')
    } else {
      console.error('Bot error:', err)
    }
  })
}

function startActions(): void {
  if (!bot) return

  const activeBot = bot

  loop = setInterval(async () => {
    if (!activeBot || activeBot !== bot) return
    if (!activeBot.player) return

    const action = getRandom(CONFIG.action.commands) as ControlState
    const sprint = Math.random() < 0.5

    activeBot.setControlState('sprint', sprint)
    activeBot.setControlState(action, true)

    await sleep(CONFIG.action.holdDuration)

    if (activeBot !== bot) return
    activeBot.clearControlStates()
  }, CONFIG.action.holdDuration)
}

function cleanup(): void {
  if (loop) {
    clearInterval(loop)
    loop = null
  }

  if (bot) {
    bot.removeAllListeners()
    bot.end()
    bot = null
  }
}

async function scheduleReconnect(): Promise<void> {
  if (reconnecting) return
  reconnecting = true

  console.log(`Reconnecting in ${retryDelay / 1000}s...`)
  cleanup()
  await sleep(retryDelay)

  // Exponential backoff to avoid spamming free server
  retryDelay = Math.min(retryDelay * 2, 120000) // max 2 minutes
  createBot()
}

export default function initBot(): void {
  createBot()
}
