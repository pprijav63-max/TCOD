const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('docs/index.html','utf8');
const now=Date.now();
const inDays=(n)=>new Date(now+n*864e5).toISOString();
const today=(n)=>new Date(now+n*864e5).toISOString().slice(0,10);
const sid='aaabbb22-1122-3344-5566-abcdef123456',wid='703754-2026',hid='UNGM-319525';
const swiss={status:'partial',last_success:new Date().toISOString(),window_start:today(-20),window_end:today(0),tenders:[{
 id:sid,title_original:'Projekt restauracije povijesnog objekta u Zürichu',
 authority:'Stadt Zürich',city:'Zürich',canton:'ZH',published:today(-1),
 deadline:inDays(9),categories:['heritage'],codeling_status:'provjeriti',
 summary_hr:'Objekt je povijesna građevina. '.repeat(14),url:'https://www.simap.ch/de/project-detail/'+sid
}]};
const world={status:'partial',last_success:new Date().toISOString(),window_start:today(-20),window_end:today(0),tenders:[{
 id:wid,source:'TED',title_original:'Izrada projektno-tehničke dokumentacije za uređenje centra',authority:'Grad Split',
 country:'HRV',published:today(-1),deadline:today(10),categories:['architecture'],
 codeling_status:'provjeriti',summary_hr:'Projektiranje centra. '.repeat(14),
 url:'https://ted.europa.eu/hr/notice/-/detail/'+wid
}]};
const heritage={status:'partial',last_success:new Date().toISOString(),source_states:{Prozorro:{scanned:60}},sources:[
 {key:'UNESCO',name:'UNESCO',url:'https://www.unesco.org/en/procurement',region:'Svijet',mode:'official_directory'},
 {key:'UNGM',name:'UNGM',url:'https://www.ungm.org/Public/Notice',region:'Svijet',mode:'official_directory'}
 ],tenders:[{
  id:hid,title_original:'Conservation interventions for Moenjodaro',country_code:'PAK',country:'Pakistan',
  source:'UNGM',agency:'UNESCO',authority:'UNESCO',published:today(-1),
  deadline:inDays(15),areas:['restoration'],summary_hr:'Restauracija spomenika. '.repeat(14),
  url:'https://www.ungm.org/Public/Notice/319525',verification:'manual_official_2026_10_29'
 }]};
let copied='',errors=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function make(query){
 copied='';errors=[];
 const dom=new JSDOM(html,{url:'https://tcod-simap-radar.yapp.page/?tab='+query,runScripts:'dangerously',pretendToBeVisual:true,
 beforeParse(w){
  w.fetch=async u=>({ok:true,json:async()=>String(u).includes('heritage.json')?heritage:String(u).includes('world.json')?world:swiss});
  w.navigator.clipboard={writeText:async text=>{copied=text;}};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.URL.createObjectURL=()=> 'blob:test';
  w.URL.revokeObjectURL=()=>{};
  w.alert=()=>{};
  w.localStorage.setItem('tcod-simap-favs-2026',JSON.stringify({[sid]:true}));
  w.localStorage.setItem('tcod-world-favs-v2',JSON.stringify({[wid]:true}));
  w.localStorage.setItem('tcod-heritage-favs',JSON.stringify({[hid]:true}));
 }
 });
 dom.window.addEventListener('error',e=>errors.push(e.message));
 return dom;
}
async function main(){
 const tests=[
  {kind:'swiss',id:sid,link:'https://www.simap.ch/de/project-detail/'+sid},
  {kind:'world',id:wid,link:'https://ted.europa.eu/hr/notice/-/detail/'+wid},
  {kind:'heritage',id:hid,link:'https://www.ungm.org/Public/Notice/319525'}
 ];
 for(const {kind,id,link} of tests){
  const dom=make(kind);
  await wait(155);
  const d=dom.window.document;
  const card=d.querySelector('[data-review-kind="'+kind+'"][data-review-id="'+id+'"]');
  assert(card,'one-click reviewer button exists for '+kind);
  card.click();
  await wait(30);
  assert(copied.includes('PREDMET: Molba za stručnu provjeru'),'subject exists '+kind);
  assert(copied.includes('Codeling d.o.o.'),'Croatian company included');
  assert(copied.includes(link),'trusted official source included '+kind);
  assert(copied.includes('HRVATSKI ISTRAŽIVAČKI SAŽETAK'),'summary included '+kind);
  assert(copied.includes('Može li se ponuditi samo određeni LOT'),'question list included');
  assert(copied.includes('SAMOSTALNO')&&copied.includes('UZ PARTNERA'),'reviewer decision request included');
  assert(d.getElementById('tcodReviewNotice').textContent.includes('Kopirano'),'feedback exists');
  copied='';
  const bulk=d.querySelector('[data-review-bulk="'+kind+'"]');
  assert(bulk,'favourites bulk copy button exists '+kind);
  bulk.click();await wait(35);
  assert(copied.includes('Zajednička provjera'),'batch subject exists '+kind);
  assert(copied.includes(link),'batch official link included '+kind);
  assert(copied.includes('ZA SVAKI NATJEČAJ'),'batch reviewer questions exist');
  assert(!errors.length,'no browser errors: '+errors.join('; '));
  dom.window.close();
 }
 console.log('PASS: individual and favourite-batch one-click Croatian procurement review across Swiss, World and Heritage (6 copy flows).');
}
main().catch(err=>{console.error(err);process.exit(1)});
