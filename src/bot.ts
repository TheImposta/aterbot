import * as mineflayer from 'mineflayer'
import type { Bot, ControlState } from 'mineflayer'

import { sleep, getRandom } from './utils.js'
import CONFIG from '../config.json' assert { type: 'json' }

let bot: Bot | null = null
let loop: NodeJS.Timeout | null = null
let reconnecting = false

function createBot(): void {
  reconnecting = false

  bot = mineflayer.createBot({
    host: CONFIG.client.host,
    port: Number(CONFIG.client.port),
    username: CONFIG.client.username,
    version: CONFIG.client.version
  })

  bot.on('login', () => {
    console.log(`AFKBot logged in as ${bot!.username}`)
  })

  bot.on('spawn', () => {
    startActions()
  })

  bot.on('kicked', (reason) => {
    console.error('Kicked:', reason)
  })

  bot.on('end', () => {
    scheduleReconnect()
  })

  bot.on('error', (err) => {
    console.error('Bot error:', err)
  })
}

function startActions(): void {
  if (!bot) return

  loop = setInterval(async () => {
    const action = getRandom(CONFIG.action.commands) as ControlState
    const sprint = Math.random() < 0.5

    bot!.setControlState('sprint', sprint)
    bot!.setControlState(action, true)

    await sleep(CONFIG.action.holdDuration)
    bot!.clearControlStates()
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

  console.log(`Reconnecting in ${CONFIG.action.retryDelay / 1000}s...`)
  cleanup()
  await sleep(CONFIG.action.retryDelay)
  createBot()
}

export default function initBot(): void {
  createBot()
}
