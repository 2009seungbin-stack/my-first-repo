/** Public identity only. Deployment credentials never belong in this module. */
export const BRAND = Object.freeze({
  name: 'Nerulio',
  baseUrl: '', // SITE_URL supplies the production origin at build time.
  defaultLanguage: 'en',
  supportedLanguages: Object.freeze(['ko', 'en', 'ja']),
  socialHandles: Object.freeze({}),
  adsenseId: '',
  analyticsId: '',
  searchVerification: '',
  get shareCaption() { return this.name; },
});
export const brandText = text => String(text).replaceAll('{brand}', BRAND.name);
export function brandCopy(value) {
  if (typeof value === 'string') return brandText(value);
  if (Array.isArray(value)) return value.map(brandCopy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,brandCopy(v)]));
  return value;
}
