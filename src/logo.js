/** Nerulio mark: a single-stroke "n" arch on the brand square, with the same accent dot
 * as the "Nerulio." wordmark. Pure shapes (no font), so it renders identically in the
 * header, static pages and the favicon, and stays legible at 16px. */
export const LOGO_COLORS=Object.freeze({base:'#3182f6',stroke:'#ffffff',accent:'#bfe0ff'});
export function logoMark({size=34,className='brand-mark'}={}){
 const {base,stroke,accent}=LOGO_COLORS;
 return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="18" fill="${base}"/><path d="M21 47V31a11 11 0 0 1 22 0v16" fill="none" stroke="${stroke}" stroke-width="8.5" stroke-linecap="round"/><circle cx="47.5" cy="16.5" r="5" fill="${accent}"/></svg>`;
}
/** Standalone favicon document. */
export const faviconSVG=()=>logoMark({size:64,className:'logo'}).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ').replace(/ aria-hidden="true" focusable="false"/,'');
