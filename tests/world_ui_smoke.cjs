const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('docs/index.html','utf8');
const iso=new Date().toISOString();
const world={status:'live',last_success:iso,tenders:[
{id:'700001-2026',title_original:'Izrada projektne dokumentacije za obnovu muzeja',summary_hr:'Hrvatski sažetak. '.repeat(14),authority:'Grad Split',country:'HRV',deadline:'2026-11-20',published:'2026-10-25',url:'https://ted.europa.eu/hr/notice/-/detail/700001-2026',summary_sentence_minimum:14},
{id:'700002-2026',title_original:'Architectural services for public library',summary_hr:'Hrvatski sažetak. '.repeat(14),authority:'Berlin Municipality',country:'DEU',deadline:'2026-12-05',published:'2026-10-28',url:'https://ted.europa.eu/en/notice/-/detail/700002-2026',summary_sentence_minimum:14}
]};
const swiss={status:'partial',last_success:iso,window_start:'2026-10-01',window_end:'2026-10-29',tenders:[]};
const sleep=t=>new Promise(r=>setTimeout(r,t));
let clipboard='';
function make(url){
 const dom=new JSDOM(html,{url,runScripts:'dangerously',pretendToBeVisual:true,
 beforeParse(w){
  w.fetch=async (u)=>({ok:true,json:async()=>String(u).includes('world.json')?world:swiss});
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.navigator.clipboard={writeText:async text=>{clipboard=text;}};
  w.alert=()=>{};
  w.URL.createObjectURL=()=> 'blob:test';
  w.URL.revokeObjectURL=()=>{};
 }
 });
 dom.window.addEventListener('error',e=>{console.error('Browser error:',e.message);});
 return dom;
}
(async()=>{
 const dom=make('https://tcod-simap-radar.yapp.page/?tab=world');
 await sleep(120);
 const d=dom.window.document;
 assert(!d.getElementById('worldView').hidden,'world tab should show');
 assert(d.getElementById('worldResults').textContent.includes('Izrada projektne dokumentacije'));
 assert(d.getElementById('worldResults').textContent.includes('Architectural services'));
 assert.equal(d.querySelectorAll('[data-country-group]').length,2,'grouped into two countries');
 assert.equal(d.querySelector('[data-country-group]').dataset.countryGroup,'HRV','Croatia first');
 assert(d.querySelector('[data-country-group="HRV"] .tcod-countryHeader').textContent.includes('Hrvatska'));
 assert(d.querySelector('[data-country-group="DEU"] .tcod-countryHeader').textContent.includes('Njemačka'));
 assert(d.querySelector('[data-country-group="HRV"] .tcod-countryMeta').textContent.includes('1 natječaja'),'country count');
 d.querySelector('[data-country-share="HRV"]').click();
 await sleep(20);
 assert(clipboard.includes('country=HRV'),'share entire country');
 d.getElementById('worldCountry').value='HRV';
 d.getElementById('worldCountry').dispatchEvent(new dom.window.Event('change'));
 assert(d.getElementById('worldResults').textContent.includes('Izrada projektne dokumentacije'));
 assert(!d.getElementById('worldResults').textContent.includes('Architectural services'),'Croatia filter');
 d.querySelector('[data-favorite="700001-2026"]').click();
 assert(d.querySelector('[data-favorite="700001-2026"]').textContent.includes('★'));
 assert(d.getElementById('worldFavStatus').textContent.includes('1 spremljenih'));
 d.getElementById('worldShareFavorites').click();
 await sleep(30);
 assert(clipboard.includes('favorites=700001-2026'),'shareable favourite URL');
 d.getElementById('worldVerifyAll').click();
 await sleep(80);
 assert(d.getElementById('worldFavStatus').textContent.includes('1 s budućim rokom'),'review all');
 assert(d.getElementById('worldShared').compareDocumentPosition(d.getElementById('worldResults'))&dom.window.Node.DOCUMENT_POSITION_FOLLOWING,'favourites UI before results');
 dom.window.close();
 const d2=make('https://tcod-simap-radar.yapp.page/?tab=world&favorites=700001-2026');
 await sleep(140);
 const el=d2.window.document;
 assert(el.getElementById('worldFavOnly').checked,'shared link selected');
 assert(el.getElementById('worldResults').textContent.includes('Izrada projektne dokumentacije'));
 assert(!el.getElementById('worldResults').textContent.includes('Architectural services'));
 assert(!el.getElementById('worldImport').hidden,'import button visible on shared link');
 const d3=make('https://tcod-simap-radar.yapp.page/?tab=world&country=DEU');
 await sleep(130);
 assert.equal(d3.window.document.getElementById('worldCountry').value,'DEU','shared country selected');
 assert.equal(d3.window.document.querySelectorAll('[data-country-group]').length,1,'shared country isolated');
 assert.equal(d3.window.document.querySelector('[data-country-group]').dataset.countryGroup,'DEU');
 assert(d3.window.document.getElementById('worldResults').textContent.includes('Architectural services'));
 assert(!d3.window.document.getElementById('worldResults').textContent.includes('Izrada projektne dokumentacije'));
 d3.window.close();
 dom.window.close();d2.window.close();
 console.log('PASS: country grouping, country counts, Croatia filter, linked country, favourites, refresh and sharing');
})().catch(e=>{console.error(e);process.exit(1)});
