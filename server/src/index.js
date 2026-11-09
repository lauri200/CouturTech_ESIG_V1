const config = require('./config');
const app = require('./app');
const { executerAlertes } = require('./services/alertes');

app.listen(config.port, () => {
  console.log(`API CouturTech sur http://localhost:${config.port}/api`);
});

// En local, le cron tourne dans le processus ; sur Vercel, il est appelé par vercel.json.
if (process.env.DISABLE_LOCAL_CRON !== 'true') {
  const tick = () => executerAlertes().catch((e) => console.error('[cron]', e.message));
  setInterval(tick, 15 * 60 * 1000);
  setTimeout(tick, 5000);
}
