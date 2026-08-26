import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import electronPath from 'electron';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainEntry = path.join(appRoot, 'dist', 'main', 'main', 'main.js');
const rendererUrl = 'http://127.0.0.1:5174';

async function rendererReady() {
  try {
    const response = await fetch(rendererUrl, { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    return false;
  }
}

for (let attempt = 0; attempt < 120; attempt += 1) {
  if (existsSync(mainEntry) && (await rendererReady())) {
    const child = spawn(electronPath, ['.'], {
      cwd: appRoot,
      env: {
        ...process.env,
        ROOMATE_DESKTOP_DEV_SERVER_URL: rendererUrl,
      },
      stdio: 'inherit',
    });

    child.once('exit', (code) => {
      process.exitCode = code ?? 0;
    });
    break;
  }

  if (attempt === 119) {
    throw new Error('Timed out waiting for the Desktop main build and Vite renderer.');
  }

  await new Promise((resolve) => setTimeout(resolve, 250));
}
