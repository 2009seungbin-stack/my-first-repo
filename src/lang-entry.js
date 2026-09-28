/* The site root (/) is the x-default language entry, not a copy of the English home: this
 * classic script (blocking, in <head> after <base>) sends each visitor to /ko/, /en/ or /ja/ before
 * the picker paints. Order as src/i18n.js chooseLocale: ?lang=, the saved choice (STORAGE_KEY), the
 * browser languages, English. Crawlers without those preferences land on /en/, so Google indexes
 * /en/ as the English home instead of folding it into / (Search Console, 2026-09-28).
 * `?choose` keeps the picker on screen. Other query parameters and the hash are carried over. */
(function(){
 var LOCALES=['ko','en','ja'],KEY='fileforge.language.v1';
 function norm(v){v=String(v||'').toLowerCase().split(/[-_]/)[0];return LOCALES.indexOf(v)>=0?v:null;}
 try{
  var q=new URLSearchParams(location.search);if(q.has('choose'))return;
  var saved=null;try{saved=norm(localStorage.getItem(KEY));}catch(e){}
  var langs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];
  var lang=norm(q.get('lang'))||saved;
  for(var i=0;!lang&&i<langs.length;i++)lang=norm(langs[i]);
  q.delete('lang');var rest=q.toString();
  location.replace(new URL((lang||'en')+'/'+(rest?'?'+rest:'')+location.hash,document.baseURI).href);
 }catch(e){}
})();
