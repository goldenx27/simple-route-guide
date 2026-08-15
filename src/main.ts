import app from './index';
import { handlePushApi, PushStore, type PushEnv } from './push';

export { PushStore };

type Env = PushEnv & {
  ASSETS: Fetcher;
  DB?: D1Database;
};

const PWA_HEAD = [
  '<link rel="manifest" href="/manifest.json">',
  '<link rel="icon" href="/icons/app-icon.svg" type="image/svg+xml">',
  '<meta name="application-name" content="הדרך של מאור">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="הדרך של מאור">',
].join('');

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/push/') || url.pathname.startsWith('/api/route-recordings')) {
      return handlePushApi(request, env);
    }

    const response = await app.fetch(request, env);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;

    const html = await response.text();
    let injected = html;
    if (!injected.includes('rel="manifest"')) {
      injected = injected.replace('</head>', `${PWA_HEAD}</head>`);
    }
    if (!injected.includes('/push-client.js')) {
      injected = injected.replace('</body>', '<script src="/push-client.js"></script></body>');
    }
    if (!injected.includes('/bus-gps.js')) {
      injected = injected.replace('</body>', '<script src="/bus-gps.js"></script></body>');
    }
    if (!injected.includes('/recovery-sync.js')) {
      injected = injected.replace('</body>', '<script src="/recovery-sync.js"></script></body>');
    }
    if (!injected.includes('/sound-ui.js')) {
      injected = injected.replace('</body>', '<script src="/sound-ui.js"></script></body>');
    }
    if (!injected.includes('/route-cloud-sync.js')) {
      injected = injected.replace('</body>', '<script src="/route-cloud-sync.js"></script></body>');
    }
    if (!injected.includes('/layout-v3.js')) {
      injected = injected.replace('</body>', '<script src="/layout-v3.js"></script></body>');
    }
    if (!injected.includes('/parent-ui-priority.js')) {
      injected = injected.replace('</body>', '<script src="/parent-ui-priority.js"></script></body>');
    }
    if (!injected.includes('/parent-wizard.js')) {
      injected = injected.replace('</body>', '<script src="/parent-wizard.js"></script></body>');
    }
    if (!injected.includes('/parent-test-mode.js')) {
      injected = injected.replace('</body>', '<script src="/parent-test-mode.js"></script></body>');
    }
    if (!injected.includes('/recorder-state-sentinel.js')) {
      injected = injected.replace('</body>', '<script src="/recorder-state-sentinel.js"></script></body>');
    }

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-cache');

    return new Response(injected, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
