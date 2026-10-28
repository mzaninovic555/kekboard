import { createKekboardBot, startKekboardBot } from './discord-bot';
import config from './config';

/** Starts the configured bot and reports login failures with a nonzero process exit code. */
async function startApplication(): Promise<void> {
  try {
    await startKekboardBot(createKekboardBot(config));
  } catch (error) {
    console.error('Error starting bot', error);
    process.exitCode = 1;
  }
}

void startApplication();
