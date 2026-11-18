import { handleCloudflareApiRequest, type CloudflareEnv } from './server/cfApiHandler.ts';

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return handleCloudflareApiRequest(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Assets binding not configured', { status: 500 });
  },
};
