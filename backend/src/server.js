import { createApp } from './app.js';
import { getAiStatus } from './config/env.js';

const { app, config } = createApp();
const aiStatus = getAiStatus(config);

app.listen(config.port, () => {
  console.log(`SmartMate AI backend listening on http://localhost:${config.port}`);
  console.log(`AI Mode: ${aiStatus.activeProvider} (${aiStatus.model})`);
});
