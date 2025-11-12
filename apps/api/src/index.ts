import { config } from './config';
import { createServer } from './server';

const app = createServer();

app.listen(config.port, () => {
  console.log(`API prête sur http://localhost:${config.port}`);
});
