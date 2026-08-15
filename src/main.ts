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
    return app.fetch(request, env);
  },
};
