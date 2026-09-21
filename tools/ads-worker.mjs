/** Cloudflare Pages advanced-mode worker, emitted ONLY for enabled AdSense builds.
 * Nonces must be unique per response, never static build-time values.
 * No upload endpoints; all requests go to the built static assets.
 */
export function nonce(){return Array.from(crypto.getRandomValues(new Uint8Array(18)),b=>b.toString(16).padStart(2,'0')).join('');}
export function adCSP(value){
 return `default-src 'self' https: blob: data:; script-src 'nonce-${value}' 'strict-dynamic' https: 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self' blob: https://cdn.jsdelivr.net; connect-src 'self' https:; img-src 'self' https: blob: data:; media-src 'self' blob: https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' https: blob: data:; frame-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'`;
}
export function transformHTML(html,value){return html.replace(/<script(?=\s|>)/g,`<script nonce="${value}"`);}
export async function secureResponse(response){
 if(!response.body||!response.headers.get('content-type')?.includes('text/html'))return response;
 const value=nonce(),headers=new Headers(response.headers);
 headers.set('Content-Security-Policy',adCSP(value));
 headers.set('Cache-Control','no-store');
 headers.set('X-Content-Type-Options','nosniff');
 headers.set('Referrer-Policy','no-referrer');
 headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 // A transformed body must not carry the original byte length or validators.
 for(const key of ['content-length','etag','last-modified','content-encoding'])headers.delete(key);
 return new Response(transformHTML(await response.text(),value),{status:response.status,statusText:response.statusText,headers});
}
export default {async fetch(request,env){return secureResponse(await env.ASSETS.fetch(request));}};
