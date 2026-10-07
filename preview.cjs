const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.mp3':'audio/mpeg','.mp4':'video/mp4'};
http.createServer((request,response)=>{
  let file;
  try { file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://localhost').pathname)); } catch { response.writeHead(400); return response.end(); }
  if(file===root) file=path.join(root,'index.html');
  if(!file.startsWith(root+path.sep)){response.writeHead(403);return response.end();}
  fs.readFile(file,(error,bytes)=>{
    if(error){response.writeHead(404);return response.end('Not found');}
    response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(bytes);
  });
}).listen(Number(process.env.MUSEUM_PREVIEW_PORT||4173),'127.0.0.1',()=>console.log(`Local: http://localhost:${process.env.MUSEUM_PREVIEW_PORT||4173}`));
