/**
 * Captura de tela via Chrome DevTools Protocol (sem dependências).
 * Uso: node server/tools/screenshot.mjs <url> <arquivo.png> [scriptJS...]
 * Requer Chrome escutando em --remote-debugging-port=9222.
 */
const PORT = process.env.CDP_PORT || 9222;
const [url, output, ...scripts] = process.argv.slice(2);

if (!url || !output) {
  console.error('Uso: node server/tools/screenshot.mjs <url> <arquivo.png> [js...]');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function newTarget() {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  if (!response.ok) throw new Error(`CDP /json/new falhou: ${response.status}`);
  return response.json();
}

async function main() {
  const target = await newTarget();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      console.error('EXCEÇÃO:', details.exception?.description || details.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
      console.error(`CONSOLE[${message.params.type}]:`, message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      console.error('LOG:', message.params.entry.text);
    }
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', reject);
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const messageId = ++id;
      pending.set(messageId, (message) => (message.error ? reject(new Error(message.error.message)) : resolve(message.result)));
      socket.send(JSON.stringify({ id: messageId, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(3500);

  for (const script of scripts) {
    const result = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) console.error('Script falhou:', result.exceptionDetails.text);
    else if (result.result && result.result.value !== undefined) console.log('retorno:', JSON.stringify(result.result.value));
    await sleep(1400);
  }

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(output, Buffer.from(shot.data, 'base64'));
  console.log(`screenshot: ${output}`);

  socket.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
