const TuyaWebsocket = require('../dist/index').default;
const axios = require('axios');

const ACCESS_ID = '7rxhc4cpy3vddqgyjcyj';
const ACCESS_SECRET = '57d0a368aeb54f8498e3bb2a89a8c78a';
const N8N_WEBHOOK = 'https://dlight-ai.app.n8n.cloud/webhook/s1-motion';
const PIR_DEVICE_ID = 'a305baa68d482cc669q6yb';

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

    // 過濾舊訊息（5分鐘以上忽略）
    if (Date.now() - bizData.ts > 300000) {
      return;
    }

    const pirStatus = bizData.properties?.find(s => s.code === 'pir_state');
    if (!pirStatus || pirStatus.value !== 'pir') return;

    // 冷卻時間：60秒內只觸發一次
    const now = Date.now();
    const lastTime = lastTriggerTime[PIR_DEVICE_ID] || 0;
    if (now - lastTime < 60000) {
      console.log('冷卻中，忽略重複觸發');
      return;
    }
    lastTriggerTime[PIR_DEVICE_ID] = now;

    console.log('PIR 觸發！送到 n8n...');
    await axios.post(N8N_WEBHOOK, {
      device_type: 'motion_corridor',
      triggered_at: new Date().toISOString(),
      user_id: 1,
      raw_device_id: PIR_DEVICE_ID
    });

    console.log('n8n 通知成功');
  } catch (err) {
    console.error('處理訊息錯誤:', err.message);
  }
});

client.open(() => console.log('✅ 連線 Tuya Message Service 成功'));
client.reconnect(() => console.log('🔄 重新連線中...'));
client.close(() => console.log('❌ 連線關閉'));
client.error((err) => console.error('連線錯誤:', err));

console.log('Dlight Tuya Listener 啟動中...');