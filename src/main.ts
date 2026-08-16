import app from './index';
import { handlePushApi, PushStore, type PushEnv } from './push';

export { PushStore };

type Env = PushEnv & { ASSETS: Fetcher; DB?: D1Database; };

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
    if (url.pathname.startsWith('/api/push/') || url.pathname.startsWith('/api/route-recordings')) return handlePushApi(request, env);
    const response = await app.fetch(request, env);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;
    const html = await response.text(); let injected = html;
    if (!injected.includes('rel="manifest"')) injected = injected.replace('</head>', `${PWA_HEAD}</head>`);
    const scripts = [
      '/push-client.js','/bus-gps.js','/bus-auto-ui.js','/exit-app.js','/arrival-gps.js','/map-follow.js','/walk-map.js','/map-heading-fix.js','/keep-awake.js','/recovery-sync.js','/sound-ui.js','/route-cloud-sync.js','/layout-v3.js','/parent-ui-priority.js','/parent-wizard.js','/parent-test-mode.js','/recorder-state-sentinel.js','/recording-start-fix.js','/recorder-runtime-fix.js','/remove-legacy-route-loader.js','/remove-legacy-clear-recording.js'
    ];
    for (const src of scripts) if (!injected.includes(src)) injected = injected.replace('</body>', `<script src="${src}"></script></body>`);
    const headers = new Headers(response.headers); headers.delete('content-length'); headers.set('cache-control','no-cache');
    return new Response(injected,{status:response.status,statusText:response.statusText,headers});
  },
};
