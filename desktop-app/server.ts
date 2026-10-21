import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { stationMiddleware } from '../src/server/stationBridge.ts';

const MIME: Record<string, string> = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon',
  '.woff2':'font/woff2', '.woff':'font/woff', '.mp4':'video/mp4',
  '.webm':'video/webm', '.mp3':'audio/mpeg', '.wav':'audio/wav',
};

/** Public only on loopback; preserve existing OBS URLs at localhost:3000. */
export type NativeDirectStatus = {state:string;pid:number|null;error:string|null;camera:number;url:string};
export function createStationHandler(staticDir: string, directStatus?: () => NativeDirectStatus) {
  const root = resolve(staticDir);
  return (req: IncomingMessage, res: ServerResponse) => {
    const address = req.url || '/';
    const route = address.split('?')[0];
    if (route === '/api/direct/status') {
      const host=req.headers.host??'';
      const origin=req.headers.origin;
      let trusted=/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host);
      if(origin){try{const parsed=new URL(origin);trusted=trusted&&parsed.host===host&&['http:','https:'].includes(parsed.protocol);}catch{trusted=false;}}
      if(!trusted){res.writeHead(403);res.end();return;}
      if(req.method!=='GET'){res.writeHead(405);res.end();return;}
      res.writeHead(directStatus?200:503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(JSON.stringify(directStatus?directStatus():{state:'unavailable'}));return;
    }
    if (route === '/api/station/health') {
      res.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
      res.end(JSON.stringify({ok:true, mode:'desktop', version:'4.1.0-rc.1'})); return;
    }
    stationMiddleware(req, res, () => {
      if (route?.startsWith('/api/')) {
        res.writeHead(404, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'No existe ese recurso'})); return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);res.end();return;
      }
      let relative: string;
      try { relative = decodeURIComponent(route || '/'); }
      catch { res.writeHead(400);res.end();return; }
      if (relative.includes('\\') || relative.includes('\0')) {res.writeHead(400);res.end();return;}
      const candidate = resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
      if (candidate !== root && !candidate.startsWith(root+sep)) {res.writeHead(403);res.end();return;}
      let asset = candidate;
      if (!existsSync(asset) || !statSync(asset).isFile()) {
        // Allow app navigation, but never substitute HTML for missing assets.
        if (relative.startsWith('/assets/') || relative.includes('.')) {
          res.writeHead(404);res.end();return;
        }
        asset = resolve(root,'index.html');
      }
      if (!existsSync(asset)) {res.writeHead(503);res.end('Build sin archivos de frontend.');return;}
      const stats = statSync(asset);
      const headers = {
        'Content-Type': MIME[extname(asset).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stats.size,
        'X-Content-Type-Options':'nosniff',
        'Cache-Control':asset.endsWith('index.html')?'no-store':'public, max-age=3600',
      };
      res.writeHead(200, headers);
      if (req.method === 'HEAD') {res.end();return;}
      createReadStream(asset).on('error',()=>res.destroy()).pipe(res);
    });
  };
}

export async function startStationServer(options: {port:number, staticDir:string, directStatus?:()=>NativeDirectStatus}): Promise<Server[]> {
  const handler = createStationHandler(options.staticDir,options.directStatus);
  const listen = (host: string) => new Promise<Server>((resolveServer, rejectServer) => {
    const server = createServer(handler);
    server.once('error', rejectServer);
    server.listen(options.port, host, () => { server.removeListener('error', rejectServer); resolveServer(server); });
  });
  // Binding only localhost avoids exposing media and controls to the network.
  const servers: Server[] = [await listen('127.0.0.1')];
  try {servers.push(await listen('::1'));}
  catch (error: any) {
    // IPv6 may be disabled. A used localhost:3000 must not be shadowed silently.
    if (!['EADDRNOTAVAIL','EAFNOSUPPORT'].includes(error?.code)) {
      for (const srv of servers) srv.close();
      throw error;
    }
  }
  return servers;
}
