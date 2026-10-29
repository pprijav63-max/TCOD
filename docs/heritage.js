/* TCOD Heritage dashboard, distinct from all-market TED and Swiss views. */
(function(){
'use strict';
var $=id=>document.getElementById(id);
if(!$('heritageView'))return;
var DATA_URL='https://raw.githubusercontent.com/pprijav63-max/TCOD/main/docs/data/heritage.json';
var ROOT='https://tcod-simap-radar.yapp.page/';
var params=new URLSearchParams(location.search);
var country=params.get('country')||'', agency=params.get('source')||'', area=params.get('area')||'';
var shared=(params.get('favorites')||'').split(',').filter(x=>/^[A-Za-z0-9-]{5,50}$/.test(x)).slice(0,40);
var sharedMode=shared.length>0;
var fav={};try{fav=JSON.parse(localStorage.getItem('tcod-heritage-favs')||'{}')}catch(e){}
var feed={status:'not_connected',tenders:[],sources:[],last_success:null};
var areas={restoration:'Restauracija i konzervacija',architecture:'Povijesne građevine / projektiranje',documentation:'3D skeniranje / HBIM',archaeology:'Arheologija / lokaliteti',museum:'Muzeji / arhivi',research:'Stručne studije / istraživanja',equipment:'Oprema za zaštitu baštine'};
var countryNames={UKR:'Ukrajina',PAK:'Pakistan',CYP:'Cipar',JOR:'Jordan',HRV:'Hrvatska',DEU:'Njemačka',FRA:'Francuska',ITA:'Italija',ESP:'Španjolska',POL:'Poljska',BEL:'Belgija',IRL:'Irska',NLD:'Nizozemska',AUT:'Austrija',SVN:'Slovenija',NOR:'Norveška',SWE:'Švedska',CZE:'Češka',ROU:'Rumunjska',BGR:'Bugarska',DNK:'Danska',FIN:'Finska',PRT:'Portugal',GRC:'Grčka',MKD:'Sjeverna Makedonija',MLT:'Malta',LUX:'Luksemburg',LVA:'Latvija',LTU:'Litva',BIH:'Bosna i Hercegovina',USA:'SAD'};
var flags={UKR:'🇺🇦',PAK:'🇵🇰',CYP:'🇨🇾',JOR:'🇯🇴',HRV:'🇭🇷',DEU:'🇩🇪',FRA:'🇫🇷',ITA:'🇮🇹',ESP:'🇪🇸',POL:'🇵🇱',BEL:'🇧🇪',IRL:'🇮🇪',NLD:'🇳🇱',AUT:'🇦🇹',SVN:'🇸🇮',NOR:'🇳🇴',SWE:'🇸🇪',CZE:'🇨🇿',ROU:'🇷🇴',BGR:'🇧🇬',DNK:'🇩🇰',FIN:'🇫🇮',PRT:'🇵🇹',GRC:'🇬🇷',MKD:'🇲🇰',LVA:'🇱🇻',LTU:'🇱🇹'};
var name=k=>countryNames[k]||k||'Nepoznata država', flag=k=>flags[k]||'🌍';
var esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
var all=()=>Array.isArray(feed.tenders)?feed.tenders:[];
var due=t=>{if(!t.deadline)return false;var d=Date.parse(t.deadline.length===10?t.deadline+'T23:59:59+01:00':t.deadline);return Number.isFinite(d)&&d>=Date.now()};
var pretty=x=>{if(!x)return 'Nije potvrđeno';var d=new Date(x.length===10?x+'T23:59:59+01:00':x);return isNaN(d)?'Nije potvrđeno':d.toLocaleString('hr-HR',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})};
var order=(a,b)=>a==='UKR'?-1:b==='UKR'?1:a==='HRV'?-1:b==='HRV'?1:name(a).localeCompare(name(b),'hr');
var favIds=()=>sharedMode?shared:Object.keys(fav).filter(x=>fav[x]);
function store(){try{localStorage.setItem('tcod-heritage-favs',JSON.stringify(fav))}catch(e){}}
function link(ids){var u=new URL(ROOT);u.searchParams.set('tab','heritage');u.searchParams.set('favorites',ids.slice(0,40).join(','));return u.href}
function copy(s){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(s).then(()=>$('heritageFeedback').textContent='Link je kopiran za prosljeđivanje.',()=>oldCopy(s));return}oldCopy(s)}
function oldCopy(s){var e=document.createElement('textarea');e.value=s;document.body.appendChild(e);e.select();try{document.execCommand('copy');$('heritageFeedback').textContent='Poveznica kopirana.'}catch(ex){$('heritageFeedback').textContent=s}e.remove()}
function official(t){var u=t.url||'';return /^https:\/\/(www\.ungm\.org|ted\.europa\.eu|prozorro\.gov\.ua)\//.test(u)?u:'https://www.ungm.org/Public/Notice'}
function check(){var values=all().filter(due),by={};for(var t of values)by[t.country_code||'OTHER']=(by[t.country_code||'OTHER']||0)+1;return {values,by}}
function render(){
 var base=check(),values=base.values;
 $('heritageTotal').textContent=values.length;
 $('heritageUkraine').textContent=values.filter(t=>t.country_code==='UKR').length;
 $('heritageUN').textContent=values.filter(t=>t.source==='UNGM').length;
 $('heritageTED').textContent=values.filter(t=>t.source==='TED').length;
 var p=feed.source_states||{},ua=p.Prozorro||{},last=feed.last_success;
 $('heritageStatus').className='notice'+(last?' good':'');
 $('heritageStatus').textContent=(last?'DJELOMIČAN DOHVAT — posljednja obrada '+pretty(last)+'. ':'Izvor još nije aktiviran. ')+
 'Ukrajina / Prozorro: '+(ua.scanned||0)+' rezultata pregledano u ograničenoj pretrazi. UNESCO / UNGM pozivi provjereni 29.10.2026., ne preko UNGM API-ja. NATO: nema potvrđenog heritage oglasa u ovom pregledu. Nije potpuna baza svih svjetskih natječaja.';
 var codes=Object.keys(base.by).sort(order),combo=$('heritageCountry');
 combo.innerHTML='<option value="">Sve države ('+values.length+')</option>'+codes.map(c=>'<option value="'+esc(c)+'">'+esc(flag(c)+' '+name(c))+' ('+base.by[c]+')</option>').join('');
 if(country&&!codes.includes(country))combo.innerHTML+='<option value="'+esc(country)+'">'+esc(name(country))+' (0)</option>';
 combo.value=country;
 var query=$('heritageSearch').value.trim().toLowerCase(),onlyFav=$('heritageFavOnly').checked;
 var matched=values.filter(t=>(!country||t.country_code===country)&&(!agency||agency==='UNESCO'&&t.source==='UNGM'&&t.agency==='UNESCO'||agency==='UNGM'&&t.source==='UNGM'||agency==='UNDP'&&t.agency==='UNDP'||agency==='UNOPS'&&t.agency==='UNOPS'||t.source===agency)&&(!query||[t.title_original,t.authority,t.country,t.agency,t.summary_hr,t.reference,t.id].join(' ').toLowerCase().includes(query))&&(!onlyFav||favIds().includes(String(t.id))));
 var count={};for(var t of matched)for(var k of t.areas||[])count[k]=(count[k]||0)+1;
 $('heritageAreas').innerHTML='<button class="'+(!area?'active':'')+'" data-ha="">Sva područja <b>'+matched.length+'</b></button>'+
 Object.entries(areas).map(([k,v])=>'<button data-ha="'+k+'" class="'+(area===k?'active':'')+'">'+esc(v)+' <b>'+(count[k]||0)+'</b></button>').join('');
 var sources=['','UNESCO','UNGM','UNDP','UNOPS','Prozorro','TED','NATO'];
 $('heritageSources').innerHTML=sources.map(k=>'<button data-hs="'+k+'" class="'+(agency===k?'active':'')+'">'+esc(k||'Svi izvori')+' <b>'+(k?values.filter(t=>k==='UNESCO'?t.agency==='UNESCO':k==='UNGM'?t.source==='UNGM':k==='UNDP'?t.agency==='UNDP':k==='UNOPS'?t.agency==='UNOPS':t.source===k).length:values.length)+'</b></button>').join('');
 $('heritageCountries').innerHTML='<button data-hc="" class="'+(!country?'active':'')+'">🌍 Sve države '+values.length+'</button>'+
 codes.map(c=>'<button data-hc="'+esc(c)+'" class="'+(country===c?'active':'')+'">'+esc(flag(c)+' '+name(c))+' <b>'+base.by[c]+'</b></button>').join('');
 document.querySelectorAll('[data-ha]').forEach(b=>b.onclick=()=>{area=b.dataset.ha;render()});
 document.querySelectorAll('[data-hs]').forEach(b=>b.onclick=()=>{agency=b.dataset.hs;render()});
 document.querySelectorAll('[data-hc]').forEach(b=>b.onclick=()=>{country=b.dataset.hc;render()});
 var rows=matched.filter(t=>!area||(t.areas||[]).includes(area)).sort((a,b)=>String(a.deadline).localeCompare(String(b.deadline)));
 var groups={};for(var t of rows)(groups[t.country_code||'OTHER']??=[]).push(t);
 $('heritageCount').textContent=rows.length+' otvorenih poziva prema filtrima, grupiranih po državama i djelatnostima.';
 function card(t){
  var typ=t.verification==='manual_official_2026_10_29'?'Službeni UNGM — provjeren 29.10.':'Javni API — djelomičan';
  return '<article class="tcod-heritageCard"><div class="eyebrow">'+esc(t.agency||t.source)+' · '+esc(name(t.country_code))+'</div>'+
    '<h3>'+esc(t.title_original||'Bez naziva')+'</h3><p class="muted">'+esc(t.authority||'')+'</p>'+
    '<p class="tcod-heritageMeta">Rok: <b>'+esc(pretty(t.deadline))+' (CH)</b></p>'+
    '<p class="tcod-heritageMeta">'+esc(typ)+' · '+esc(t.fit==='high'?'Visoka podudarnost':t.fit==='low'?'Niža podudarnost':'Provjeriti uvjete')+'</p>'+
    '<p>'+esc((t.summary_hr||'Sažetak nije dostupan.').slice(0,460))+'</p>'+
    '<div class="tcod-heritageActions"><button data-hd="'+esc(t.id)+'">HR analiza</button>'+
    '<button data-hf="'+esc(t.id)+'">'+(fav[t.id]?'★ Favorit':'☆ Favorit')+'</button>'+
    '<button data-hshare="'+esc(t.id)+'">Proslijedi</button><button class="tcod-reviewButton" data-review-kind="heritage" data-review-id="'+esc(t.id)+'">📋 Kopiraj za javnu nabavu</button>'+
    '<a class="tcod-action" href="'+esc(official(t))+'" target="_blank" rel="noopener">Službeni oglas ↗</a></div></article>';
 }
 $('heritageResults').innerHTML=Object.keys(groups).sort(order).map(c=>{
  var z=groups[c],types={};for(var t of z)for(var k of t.areas||['research'])(types[k]??=[]).push(t);
  var inner=Object.keys(areas).filter(k=>types[k]?.length).map(k=>
    '<details class="tcod-heritageArea" open><summary>'+esc(areas[k])+' <b>'+types[k].length+'</b></summary>'+
    '<div class="tcod-heritageCards">'+types[k].map(card).join('')+'</div></details>').join('');
  return '<details class="tcod-heritageCountry" open><summary>'+esc(flag(c)+' '+name(c))+' <b>'+z.length+' poziva</b></summary>'+inner+'</details>';
 }).join('')||'<div class="tcod-box"><p>Nema potvrđenih otvorenih poziva u trenutačnom djelomičnom izvoru za ovaj odabir. To ne znači da pozivi ne postoje.</p><button id="heritageReset">Očisti filtre</button></div>';
 var reset=$('heritageReset');if(reset)reset.onclick=()=>{country='';agency='';area='';$('heritageSearch').value='';$('heritageFavOnly').checked=false;render()};
 document.querySelectorAll('[data-hd]').forEach(b=>b.onclick=()=>details(b.dataset.hd));
 document.querySelectorAll('[data-hf]').forEach(b=>b.onclick=()=>{var id=b.dataset.hf;if(fav[id])delete fav[id];else fav[id]=true;store();render()});
 document.querySelectorAll('[data-hshare]').forEach(b=>b.onclick=()=>copy(link([b.dataset.hshare])));
 var ids=favIds(),found=new Set(all().map(t=>String(t.id)));
 $('heritageFavStatus').textContent=ids.length+' favorita · '+ids.filter(id=>values.some(t=>String(t.id)===id)).length+
 ' aktivnih u trenutnom feedu · '+ids.filter(id=>!found.has(id)).length+
 ' nestalih iz rezultata. Provjera ne zamjenjuje pregled službenog portala svakog naručitelja.';
 $('heritageImport').hidden=!sharedMode;
 var portals=Array.isArray(feed.sources)&&feed.sources.length?feed.sources:[];
 var directories=[
 ['UN / UNESCO / UNGM / UNDP / UNOPS',['UNESCO','UNGM','UNDP','UNOPS']],
 ['Ukrajina / Prozorro',['Prozorro']],
 ['NATO / NCIA',['NATO','NCIA']],
 ['Europa / TED / EU',['TED','EU']],
 ['Razvojne banke',['WB','EBRD','ADB']],
 ['Baštinske institucije',['ICCROM','ICOMOS','OSCE']]
 ];
 $('heritageDirectory').innerHTML=directories.map(([group,keys])=>{
 var items=keys.map(k=>portals.find(p=>p.key===k)).filter(Boolean);
 if(!items.length)return '';
 return '<details class="tcod-heritageSourceGroup" '+(group.startsWith('UN ')||group.startsWith('Ukrajina')?'open':'')+'><summary>'+esc(group)+' <b>'+items.length+' izvora</b></summary>'+
 '<div class="tcod-heritageCards">'+items.map(p=>'<article class="tcod-heritageSource"><h3>'+esc(p.name)+'</h3>'+
 '<p class="tcod-heritageMeta">'+esc(p.region)+'</p><p>'+esc(p.note_hr||'Službeni izvor')+'</p>'+
 '<p class="tcod-heritageMeta">'+(p.mode==='limited_public_api'?'Ograničen automatski uvoz':'Službeni portal; nema potpunog automatskog uvoza')+'</p>'+
 '<a class="tcod-action" href="'+esc(p.url)+'" target="_blank" rel="noopener">Otvori službeni portal ↗</a></article>').join('')+'</div></details>';
 }).join('');
}
function details(id){
 var t=all().find(t=>String(t.id)===String(id));if(!t)return;
 var checks=['Dopuštenost prijave tvrtke Codeling d.o.o. Zagreb','Službena dokumentacija i sve izmjene','Reference na sličnim kulturnim dobrima','Ovlaštenja i lokalni partneri','Sastav projektnog i konzervatorskog tima','Natječajni obrazac, izjave i cjenik','Obvezni obilazak i postupak pitanja','Točno vrijeme i način predaje ponude'];
 $('details').innerHTML='<p class="eyebrow">TCOD · Kulturna baština · '+esc(t.agency||t.source)+'</p><h2>'+esc(t.title_original)+'</h2>'+
 '<p>'+esc(name(t.country_code))+' · '+esc(t.reference||t.id)+'</p>'+
 '<p><a class="tcod-action" href="'+esc(official(t))+'" target="_blank" rel="noopener">Otvori službenu dokumentaciju ↗</a></p>'+
 '<div class="field"><dt>Opširan hrvatski sažetak</dt><dd>'+esc(t.summary_hr||'Sažetak nedostupan')+'</dd></div>'+
 '<div class="field"><dt>Rok</dt><dd>'+esc(pretty(t.deadline))+' (CH). Obavezno provjeriti izvornu vremensku zonu.</dd></div>'+
 '<div class="field"><dt>Područja</dt><dd>'+esc((t.areas||[]).map(k=>areas[k]||k).join(', '))+'</dd></div>'+
 '<div class="field"><dt>Provjera podataka</dt><dd>'+esc(t.verification||'Nije potvrđeno')+' · '+esc(t.verified_at||'Nepoznat datum')+'</dd></div>'+
 '<div class="field"><dt>Što treba provjeriti za Codeling</dt><dd>'+esc(t.details_hr||'Pravo sudjelovanja, ovlaštenja i dokumentaciju provjeriti kod naručitelja.')+'</dd></div>'+
 '<div class="field"><dt>Kontrolna lista za prijavu</dt><dd><ul>'+checks.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></dd></div>'+
 '<button id="heritageDetailCopy">Podijeli ovaj projekt</button> <button class="tcod-reviewButton" data-review-kind="heritage" data-review-id="'+esc(t.id)+'">📋 Kopiraj upit za javnu nabavu</button>';
 $('modal').classList.add('open');
 $('heritageDetailCopy').onclick=()=>copy(link([t.id]));
}
async function load(){
 try{
  var res=await fetch(DATA_URL+'?v='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);
  var j=await res.json();if(!Array.isArray(j.tenders)||!Array.isArray(j.sources))throw Error('Nepotpun format');
  feed=j;
 }catch(e){feed={status:'not_connected',last_success:null,tenders:[],sources:[],error:String(e)}}
 render();
}
$('heritageSearch').oninput=render;
$('heritageCountry').onchange=e=>{country=e.target.value;render()};
$('heritageFavOnly').checked=sharedMode;$('heritageFavOnly').onchange=render;
$('heritageReload').onclick=load;
$('heritageReview').onclick=async()=>{await load();$('heritageFeedback').textContent='Uspoređeno s posljednjim feedom. Službeni UNGM, NATO i Prozorro oglasi moraju se dodatno provjeriti.'};
$('heritageShare').onclick=()=>{var ids=favIds();if(!ids.length){$('heritageFeedback').textContent='Najprije označi jedan favorit.';return}copy(link(ids))};
$('heritageImport').onclick=()=>{for(var id of shared)fav[id]=true;store();shared=[];sharedMode=false;$('heritageFavOnly').checked=true;var u=new URL(location.href);u.searchParams.delete('favorites');history.replaceState({},'',u);render();$('heritageFeedback').textContent='Primljeni favoriti su spremljeni.'};
$('heritageExport').onclick=()=>{
 var ids=favIds(),rows=[['Naziv','Izvor','Naručitelj','Država','Rok','Službeni link']];
 for(var id of ids){var t=all().find(x=>String(x.id)===id);rows.push([t?.title_original||id,t?.source||'',t?.authority||'',t?.country||'',t?.deadline||'',t?.url||''])}
 var csv='\uFEFF'+rows.map(a=>a.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(';')).join('\r\n');
 var blob=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=blob;a.download='TCOD_KULTURNA_BASTINA_SVIJET.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(blob),1500);
};
window.TCODHeritage={render,load,getData:()=>feed};
load();setInterval(load,30*60*1000);
})();