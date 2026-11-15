/* The site root (/) is the x-default language entry, not a copy of the English home: this
 * classic script (blocking, in <head> after <base>) sends each visitor to /ko/, /en/ or /ja/ before
 * the picker paints. Order as src/i18n.js chooseLocale: ?lang=, the saved choice (STORAGE_KEY), the
 * browser languages, English. Crawlers without those preferences land on /en/, so Google indexes
 * /en/ as the English home instead of folding it into / (Search Console, 2026-09-28).
 * `?choose` keeps the picker on screen. Other query parameters and the hash are carried over. */
(function(){
 var LOCALES=['ko','en','ja'],KEY='fileforge.language.v1';
 function norm(v){v=String(v||'').toLowerCase().split(/[-_]/)[0];return LOCALES.indexOf(v)>=0?v:null;}
 /* `/?choose`: the picker stays. It marks the language this visitor would otherwise be sent to
  * (their saved choice, else the browser language), and a click on a language is kept as the manual
  * choice under the same key the header language menu writes, so / goes there next time. */
 function picker(saved,browser){
  document.addEventListener('DOMContentLoaded',function(){
   var links=document.querySelectorAll('a[data-lang]'),current=saved||browser;
   Array.prototype.forEach.call(links,function(a){
    var l=a.getAttribute('data-lang'),hint=l===saved?a.getAttribute('data-hint-saved'):l===browser?a.getAttribute('data-hint-browser'):'',b=a.querySelector('b');
    if(hint&&b){var em=document.createElement('em');em.textContent=hint;b.appendChild(em);}
    if(l===current){a.className='is-current';a.setAttribute('aria-current','true');}
    a.addEventListener('click',function(){try{localStorage.setItem(KEY,l);}catch(e){}});
   });
  });
 }
 try{
  var q=new URLSearchParams(location.search);
  var saved=null;try{saved=norm(localStorage.getItem(KEY));}catch(e){}
  var langs=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];
  var browser=null;
  for(var i=0;!browser&&i<langs.length;i++)browser=norm(langs[i]);
  if(q.has('choose'))return void picker(saved,browser);
  var lang=norm(q.get('lang'))||saved||browser;
  q.delete('lang');var rest=q.toString();
  location.replace(new URL((lang||'en')+'/'+(rest?'?'+rest:'')+location.hash,document.baseURI).href);
 }catch(e){}
})();
