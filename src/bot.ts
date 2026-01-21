let bot: Mineflayer.Bot | null = null;
let loop: NodeJS.Timeout | null = null;
let reconnecting = false;

function createBot(): void {
  reconnecting = false;

  bot = Mineflayer.createBot({
    host: CONFIG.client.host,
    port: Number(CONFIG.client.port),
    username: CONFIG.client.username,
    version: CONFIG.client.version // IMPORTANT: set this explicitly
  });

  bot.on('login', () => {
    console.log(`AFKBot logged in as ${bot!.username}`);
  });

  bot.on('spawn', () => {
    startActions();
  });

  bot.on('kicked', (reason) => {
    console.error('Kicked:', reason);
  });

  bot.on('end', () => {
    scheduleReconnect();
  });

  bot.on('error', (err) => {
    console.error('Bot error:', err);
  });
}

function startActions(): void {
  if (!bot) return;

  loop = setInterval(async () => {
    const action = getRandom(CONFIG.action.commands) as Mineflayer.ControlState;
    const sprint = Math.random() < 0.5;

    bot!.setControlState('sprint', sprint);
    bot!.setControlState(action, true);

    await sleep(CONFIG.action.holdDuration);
    bot!.clearControlStates();
  }, CONFIG.action.holdDuration);
}

function cleanup(): void {
  if (loop) clearInterval(loop);
  loop = null;

  try {
    bot?.removeAllListeners();
    bot?.end();
  } catch {}
}

async function scheduleReconnect(): Promise<void> {
  if (reconnecting) return;
  reconnecting = true;

  console.log(`Reconnecting in ${CONFIG.action.retryDelay / 1000}s...`);
  cleanup();
  await sleep(CONFIG.action.retryDelay);
  createBot();
}

export default () => createBot();
