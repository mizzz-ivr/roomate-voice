import { createServer, type Server } from 'node:http';

export interface HealthSnapshot {
  status: 'ok' | 'degraded';
  discordReady: boolean;
  activeVoiceSessions: number;
  model: string;
  uptimeSeconds: number;
  version: string;
}

export interface HealthServerOptions {
  port: number;
  getSnapshot: () => HealthSnapshot;
}

export function startHealthServer(options: HealthServerOptions): Server {
  const server = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (request.method === 'OPTIONS') {
      response.writeHead(204).end();
      return;
    }

    if (request.method === 'GET' && request.url === '/health') {
      const snapshot = options.getSnapshot();
      response.writeHead(snapshot.status === 'ok' ? 200 : 503);
      response.end(JSON.stringify(snapshot));
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ error: 'not_found' }));
  });

  server.listen(options.port, '0.0.0.0');
  return server;
}
