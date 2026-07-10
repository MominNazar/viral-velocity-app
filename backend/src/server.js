import { createApp } from './app.js';
import { config } from './config.js';
import { startSubscriptionMaintenance } from './jobs/subscriptionMaintenance.js';

const app = createApp();
startSubscriptionMaintenance();
app.listen(config.port, '0.0.0.0', () => {
  console.log(`Viral Velocity API listening on http://0.0.0.0:${config.port} (LAN: use your PC IP, e.g. http://192.168.1.4:${config.port})`);
});
