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
  // Public by protocol: IndexNow proves ownership by serving this same value at /<key>.txt.
  indexNowKey: 'aeb52199b8b46fbc510766f496462876',
  // Ownership tokens for Naver Search Advisor and Bing Webmaster Tools (public meta tags).
  naverVerification: '',
  bingVerification: '',
  get shareCaption() { return this.name; },
});
export const brandText = text => String(text).replaceAll('{brand}', BRAND.name);
export function brandCopy(value) {
  if (typeof value === 'string') return brandText(value);
  if (Array.isArray(value)) return value.map(brandCopy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,brandCopy(v)]));
  return value;
}
