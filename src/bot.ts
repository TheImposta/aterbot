import * as mineflayer from 'mineflayer'
import type { Bot, ControlState } from 'mineflayer'
import { sleep, getRandom } from './utils.js'
import CONFIG from '../config.json' assert { type: 'json' }
import { ping } from 'minecraft-server-util'

let bot: Bot | null = null
let loop: NodeJS.Timeout | null = null
let reconnecting = false
let retryDelay = CONFIG.action.retryDelay // exponential backoff

// Check if Minecraft server is online using proper Minecraft ping
async function isServerOnline(host: string, port: number): Promise<boolean> {
  try {
    await ping(host, Number(port), { timeout: 5000 })
    return true
  } catch {
    return false
  }
}

async function waitForServer(): Promise<void> {
  console.log(`Checking if server ${CONFIG.client.host}:${CONFIG.client.port} is online...`)
  while (!(await isServerOnline(CONFIG.client.host, Number(CONFIG.client.port)))) {
    console.log('Server not online yet, retrying in 10s...')
    await sleep(10000)
  }
  console.log('Server is online! Attempting to connect...')
}

async function createBot(): Promise<void> {
  reconnecting = false

  await waitForServer() // wait until server accepts connections

  try {
    console.log(`Connecting to ${CONFIG.client.host}:${CONFIG.client.port}...`)
    bot = mineflayer.createBot({
      host: CONFIG.client.host,
      port: Number(CONFIG.client.port),
      username: CONFIG.client.username,
      version: CONFIG.client.version,
      connectTimeout: 60000,
      keepAlive: true
    })
  } catch (err) {
    console.error('Failed to create bot:', err)
    scheduleReconnect()
    return
  }

  bot.on('login', () => {
    retryDelay = CONFIG.action.retryDelay
    console.log(`AFKBot logged in as ${bot!.username}`)
  })

  bot.on('spawn', () => {
    console.log('AFKBot spawned in world')
    startActions()
  })

  bot.on('kicked', (reason) => {
    console.error('Kicked from server:', reason)
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

  retryDelay = Math.min(retryDelay * 2, 120000) // exponential backoff max 2 min
  await createBot()
}

export default async function initBot(): Promise<void> {
  await createBot()
}
