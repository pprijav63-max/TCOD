const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('docs/index.html','utf8');
const NOW=new Date().toISOString();
const future=new Date(Date.now()+12*86400000).toISOString();
const world={status:'partial',last_success:NOW,window_start:'2026-10-01',window_end:'2026-10-29',tenders:[]};
const swiss={...world,tenders:[]};
const heritage={status:'partial',last_success:NOW,
 source_states:{Prozorro:{scanned:120},TED:{status:'live'},UNGM:{api_connected:false},NATO:{confirmed_heritage:0}},
 sources:[
  {key:'UNESCO',name:'UNESCO Procurement',region:'Cijeli svijet',url:'https://www.unesco.org/en/procurement',mode:'official_directory'},
  {key:'UNGM',name:'UNGM Procurement',region:'Cijeli svijet',url:'https://www.ungm.org/Public/Notice',mode:'official_directory'},
  {key:'Prozorro',name:'Prozorro',region:'Ukrajina',url:'https://prozorro.gov.ua/en',mode:'limited_public_api'},
  {key:'NATO',name:'NATO',region:'NATO',url:'https://www.nato.int/en/work-with-us/business-and-project-opportunities/procurement-opportunities',mode:'official_directory'}
 ],
 tenders:[
  {id:'UA-2026-10-29-000001-a',title_original:'Реставрація памʼятки архітектури у Києві',country_code:'UKR',country:'Ukrajina',source:'Prozorro',agency:'Prozorro',authority:'Kyiv authority',deadline:future,published:'2026-10-28',areas:['restoration','architecture'],summary_hr:'Opis projekta. '.repeat(14),url:'https://prozorro.gov.ua/tender/UA-2026-10-29-000001-a'},
  {id:'UNGM-319525',title_original:'Archaeological Ruins at Moenjodaro conservation',country_code:'PAK',country:'Pakistan',source:'UNGM',agency:'UNESCO',authority:'UNESCO',deadline:future,published:'2026-10-23',areas:['restoration','archaeology'],summary_hr:'UNESCO projekt. '.repeat(14),verification:'manual_official_2026_10_29',url:'https://www.ungm.org/Public/Notice/319525'},
  {id:'UNGM-317757',title_original:'Conservation Works at Agios Demetrios Church',country_code:'CYP',country:'Cipar',source:'UNGM',agency:'UNDP',authority:'UNDP',deadline:future,published:'2026-10-12',areas:['restoration'],summary_hr:'UNDP projekt. '.repeat(14),url:'https://www.ungm.org/Public/Notice/317757'}
 ]
};
let clipboard='';
const sleep=x=>new Promise(r=>setTimeout(r,x));
function make(url){
 let errors=[];
 const dom=new JSDOM(html,{url,runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){
   w.fetch=async (u)=>({ok:true,json:async()=>String(u).includes('heritage.json')?heritage:String(u).includes('world.json')?world:swiss});
   w.HTMLElement.prototype.scrollIntoView=function(){};
   w.navigator.clipboard={writeText:async x=>{clipboard=x;}};
   w.alert=()=>{};
   w.URL.createObjectURL=()=> 'blob:test';
   w.URL.revokeObjectURL=()=>{};
  }
 });
 dom.window.addEventListener('error',e=>errors.push(e.message));
 return {dom,errors};
}
(async()=>{
 let {dom,errors}=make('https://tcod-simap-radar.yapp.page/?tab=heritage');
 await sleep(130);
 let d=dom.window.document;
 assert(!d.getElementById('heritageView').hidden,'world heritage tab visible');
 assert.equal(d.getElementById('heritageTotal').textContent,'3','three live notices');
 assert.equal(d.getElementById('heritageUkraine').textContent,'1','Ukraine visible');
 assert.equal(d.getElementById('heritageUN').textContent,'2','UNGM sources counted');
 assert(d.getElementById('heritageDirectory').textContent.includes('UNESCO Procurement'),'UNESCO directory');
 assert(d.getElementById('heritageDirectory').textContent.includes('NATO'),'NATO official portal listed');
 assert(d.getElementById('heritageResults').textContent.includes('Moenjodaro'),'UNESCO exact title');
 assert(d.getElementById('heritageResults').textContent.includes('Києві'),'Ukraine exact title');
 d.querySelector('[data-hs="NATO"]').click();
 assert(d.getElementById('heritageResults').textContent.includes('Nema potvrđenih'),'NATO zero shows honest status');
 d.querySelector('[data-hs=""]').click();
 d.querySelector('[data-hc="UKR"]').click();
 assert(d.getElementById('heritageResults').textContent.includes('Києві'),'Ukraine filter works');
 assert(!d.getElementById('heritageResults').textContent.includes('Moenjodaro'),'other countries hidden');
 d.querySelector('[data-hf="UA-2026-10-29-000001-a"]').click();
 assert(d.querySelector('[data-hf="UA-2026-10-29-000001-a"]').textContent.includes('★'),'favourites checked');
 d.getElementById('heritageShare').click();
 await sleep(25);
 assert(clipboard.includes('favorites=UA-2026-10-29-000001-a'),'favourites share URL');
 d.querySelector('[data-hd="UA-2026-10-29-000001-a"]').click();
 assert(d.getElementById('details').textContent.includes('Kontrolna lista'),'full documentation controls');
 assert.equal(errors.length,0,'no browser errors: '+errors.join(';'));
 dom.window.close();
 const obj=make('https://tcod-simap-radar.yapp.page/?tab=heritage&favorites=UNGM-319525');
 await sleep(125);
 const dd=obj.dom.window.document;
 assert(dd.getElementById('heritageFavOnly').checked,'shared favourites view');
 assert(dd.getElementById('heritageResults').textContent.includes('Moenjodaro'),'shared UNESCO link');
 assert(!dd.getElementById('heritageResults').textContent.includes('Києві'),'shared link hides nonfavorites');
 assert(!dd.getElementById('heritageImport').hidden,'import shared favourites button');
 assert.equal(obj.errors.length,0,'no browser errors');
 obj.dom.window.close();
 console.log('PASS heritage: UNESCO, UNGM, NATO, Ukraine, country, source, favourites, share and 14-sentence analysis.');
})().catch(e=>{console.error(e);process.exit(1)});
