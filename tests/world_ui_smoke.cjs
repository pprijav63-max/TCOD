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
 dom.window.close();d2.window.close();
 console.log('PASS: Croatia filter, exact titles, favourites, refresh, sharing, imported shared list');
})().catch(e=>{console.error(e);process.exit(1)});
