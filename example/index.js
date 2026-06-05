const TuyaWebsocket = require('../dist/index').default;
const axios = require('axios');

const ACCESS_ID = '7rxhc4cpy3vddqgyjcyj';
const ACCESS_SECRET = '57d0a368aeb54f8498e3bb2a89a8c78a';
const N8N_WEBHOOK = 'https://dlight-ai-test.app.n8n.cloud/webhook/s1-motion';
const PIR_DEVICE_ID = 'a305baa68d482cc669q6yb';
const COOLDOWN_MS = 60000;
const MAX_AGE_MS = 300000;

const lastTriggerTime = {};

const client = new TuyaWebsocket({
  accessId: ACCESS_ID,
  accessKey: ACCESS_SECRET,
  url: 'wss://mqe-sg.iotbing.com:8285/',
  env: TuyaWebsocket.env.PROD,
  maxRetryTimes: 50,
});

client.start();

client.message(async (ws, msg) => {
  try {
    const data = msg.payload?.data;
    if (!data) return;

    const bizData = data.bizData;
    if (!bizData) return;

    if (bizData.devId !== PIR_DEVICE_ID) return;

    // 靜默丟棄超過5分鐘的舊訊息
    if (Date.now() - bizData.ts > MAX_AGE_MS) return;

    const pirStatus = bizData.properties?.find(s => s.code === 'pir_state');
    if (!pirStatus || pirStatus.value !== 'pir') return;

    // 冷卻時間
    const now = Date.now();
    const lastTime = lastTriggerTime[PIR_DEVICE_ID] || 0;
    if (now - lastTime < COOLDOWN_MS) return;
    lastTriggerTime[PIR_DEVICE_ID] = now;

    console.log('PIR triggered, sending to n8n...');

    await axios.post(N8N_WEBHOOK, {
      device_type: 'motion_corridor',
      triggered_at: new Date().toISOString(),
      user_id: 1,
      raw_device_id: PIR_DEVICE_ID
    });

    console.log('n8n notified');
  } catch (err) {
    console.error('Error:', err.message);
  }
});

client.open(() => console.log('Connected to Tuya Message Service'));
client.reconnect(() => console.log('Reconnecting...'));
client.close(() => console.log('Connection closed'));
client.error((err) => console.error('Connection error:', err));

console.log('Dlight Tuya Listener starting...');