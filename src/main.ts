import app from './index';
import { handlePushApi, PushStore, type PushEnv } from './push';

export { PushStore };

type Env = PushEnv & {
  ASSETS: Fetcher;
  DB?: D1Database;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/push/')) {
      return handlePushApi(request, env);
    }

    const response = await app.fetch(request, env);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;

    const html = await response.text();
    const injected = html.includes('/push-client.js')
      ? html
      : html.replace('</body>', '<script src="/push-client.js"></script></body>');

    return new Response(injected, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  },
};
