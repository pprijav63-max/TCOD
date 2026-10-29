
(function(){
'use strict';
const root='https://tcod-simap-radar.yapp.page/';
const feed='https://raw.githubusercontent.com/pprijav63-max/TCOD/main/docs/data/world.json';
const $=s=>document.getElementById(s);
const esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PORTALS=[
['EOJN RH — Hrvatska','Republika Hrvatska','https://eojn.hr/','Nacionalni javni natječaji u Hrvatskoj, uključujući i postupke koji nisu objavljeni na TED-u.'],
['TED — europska javna nabava','Europska unija i druge zemlje oglasnika','https://ted.europa.eu/en/','Objave u TED-u, arhitektura, projektiranje, grafički dizajn i digitalni projekti.'],
['UNGM — UN, UNESCO, UNDP, UNOPS','Svijet','https://www.ungm.org/Public/Notice','Javni pozivi agencija UN-a, uključujući konzervaciju kulturne baštine i digitalizaciju.'],
['World Bank — Business Opportunities','Svijet','https://projects.worldbank.org/en/projects-operations/opportunities','Natječaji, studije, projektiranje i nadzor povezani s projektima Svjetske banke.'],
['EBRD — ECEPP','Više zemalja','https://ecepp.ebrd.com/','Nabava financirana od EBRD-a; za detalje i prijavu može biti potrebna registracija.'],
['Prozorro — Ukrajina','Ukrajina','https://prozorro.gov.ua/en','Javni pozivi za obnovu, restauraciju, konstrukcije i tehničke usluge.'],
['SAM.gov — SAD','SAD','https://sam.gov/opportunities','Službena pretraga saveznih javnih nabava i konzultantskih usluga u SAD-u.']
];
const GROUPS=[
['01 · Službena objava i pristup',[
'Provjeriti izvornu SIMAP objavu, lot i identifikacijski broj',
'Provjeriti izmjene, ispravke i dopunske objave',
'Prijava ponuditelja i članstvo Codelinga u SIMAP organizaciji',
'Registrirati interes ako je potreban pristup prilozima',
'Preuzeti sve službene PDF, DOCX i XLSX priloge',
'Provjeriti obvezni obilazak lokacije ili informativni sastanak',
'Provjeriti rok za pitanja, prijavu, registraciju i ponudu',
'Pročitati odgovore naručitelja i naknadne dopune']],
['02 · Pravo sudjelovanja Codelinga iz Hrvatske',[
'Potvrditi međunarodni obuhvat sporazuma ili dopuštenost hrvatske tvrtke',
'Provjeriti treba li švicarski partner ili lokalni potpisnik',
'Pribaviti aktualni izvadak iz sudskog registra RH, ako se traži',
'Provjeriti OIB, PDV/VAT i identifikacijske podatke ponuditelja',
'Pribaviti porezne potvrde i potvrde o doprinosima, ako su zatražene',
'Provjeriti izjave o nekažnjavanju, stečaju i sukobu interesa',
'Pripremiti punomoći i ovlaštenje za potpis ponude',
'Provjeriti potrebnu policu profesionalne odgovornosti']],
['03 · Reference i stručni tim',[
'Provjeriti broj i starost traženih usporedivih referenci',
'Pripremiti opis reference, vrijednost i kontakt investitora',
'Provjeriti smiju li se koristiti osobne reference članova tima',
'Pripremiti životopise i diplome ključnih stručnjaka',
'Provjeriti ovlaštenje arhitekta, inženjera i drugih potpisnika u CH',
'Provjeriti uvjete za podizvođače i zajednicu ponuditelja']],
['04 · Tehnička ponuda',[
'Pročitati Leistungsbeschreibung, program i tehničke priloge',
'Pripremiti metodologiju, faze rada i plan isporuka',
'Pripremiti organizacijsku shemu i podjelu odgovornosti',
'Pripremiti projektni kalendar i plan kontrole kvalitete',
'Provjeriti BIM/HBIM, CAD, IFC i format digitalne predaje',
'Provjeriti zahtjeve zaštite kulturne baštine i konzervacije',
'Provjeriti norme, pristupačnost, zaštitu od požara i održivost']],
['05 · Financijska i ugovorna ponuda',[
'Popuniti i potpisati službeni Angebotsformular',
'Popuniti cjenik, Preisblatt i sve tražene lotove',
'Provjeriti valutu, PDV i švicarsku poreznu obradu',
'Pročitati Vertragsentwurf, jamstva, penale i odgovornost',
'Provjeriti kriterije ocjenjivanja i ponderiranje cijene',
'Priložiti bankovne i financijske dokaze samo ako su traženi']],
['06 · Konačna predaja',[
'Provjeriti točan kanal predaje: SIMAP, e-mail ili fizički',
'Provjeriti jezik, format datoteka, nazive i maksimalne veličine',
'Provjeriti je li kvalificirani elektronički potpis obvezan',
'Provjeriti potpise svih zakonskih zastupnika i stručnjaka',
'Predati prije službenog roka u vremenskoj zoni Europe/Zurich',
'Preuzeti i arhivirati potvrdu o zaprimanju ponude']]
];
const q=new URLSearchParams(location.search);
let activeTab='swiss',activeDoc=q.get('project')||'',world={status:'not_connected',tenders:[]},checked={},notes={};
try{checked=JSON.parse(localStorage.getItem('tcod-checks-v1')||'{}');notes=JSON.parse(localStorage.getItem('tcod-notes-v1')||'{}')}catch(e){}
function projLink(id,tab){let u=new URL(root);u.searchParams.set('tab',tab||'swiss');if(id)u.searchParams.set('project',id);return u.href}
async function copy(text,msg){try{await navigator.clipboard.writeText(text);showMessage(msg||'Poveznica kopirana.')}catch(e){const tmp=document.createElement('textarea');tmp.value=text;document.body.appendChild(tmp);tmp.select();let copied=false;try{copied=document.execCommand('copy')}catch(_){ }tmp.remove();showMessage(copied?'Kopirano.':'Kopiraj ovu adresu: '+text)}}
function showMessage(message){let out=$('tcodActionStatus');if(out){out.textContent=message;out.scrollIntoView({block:'nearest',behavior:'smooth'})}else alert(message)}
function showTab(tab,save){tab=['swiss','world','docs','share'].includes(tab)?tab:'swiss';activeTab=tab;
for(let name of ['swiss','world','docs','share'])$(name+'View').hidden=tab!==name;
document.querySelectorAll('#tcodTabs [data-switch]').forEach(b=>{b.classList.toggle('active',b.dataset.switch===tab);b.setAttribute('aria-current',b.dataset.switch===tab?'page':'false')});
if(save!==false){let u=new URL(location.href);u.searchParams.set('tab',tab);if(tab==='world'||tab==='share')u.searchParams.delete('project');history.replaceState({},'',u)}
if(tab==='world')renderWorld();if(tab==='docs')renderDocs();if(tab==='share')renderShare();}
function getProject(){const list=window.TCODRadar?window.TCODRadar.list():[];return list.find(t=>t.id===activeDoc)||list[0]||null}
function allProjects(){return window.TCODRadar?window.TCODRadar.list():[]}
function ten(t){
 if(!t)return '';
 if(t.summary_sentence_minimum>=10)return t.summary_hr||'';
 let s=t.summary_hr||'';
 const finished=x=>{x=String(x||'').trim();return x?/[\.\!?]$/.test(x)?x:x+'.':''};
 let sentences=[
 finished('Predmet oglasa je projekt „'+(t.title_original||t.title_hr||'naslov nije potvrđen')+'”'),
 finished(t.authority?'Naručitelj naveden u evidenciji je '+t.authority:'Identitet naručitelja nije potvrđen u ovom početnom prikazu'),
 finished(t.city?'Navedeno mjesto provedbe je '+t.city+' u području '+(t.canton||'CH'):'Lokacija projekta nije dovoljno potvrđena'),
 finished(t.published?'Zabilježeni datum objave jest '+t.published:'Datum javne objave treba provjeriti na službenom portalu'),
 finished(s||'Sadržaj predmeta nabave nije dovoljno opisan u dostupnim metapodacima'),
 finished('Prepoznata djelatnost je '+((t.categories||[]).join(', ')||'nije automatski utvrđena')),
 finished('Faza nabave označena je kao '+(t.deadline_kind||t.stage||'nije potvrđena')),
 finished(t.deadline?'Najbliži zabilježeni rok je '+t.deadline+' prema švicarskom vremenu':'Točan rok za prijavu nije potvrđen'),
 finished('Službeni natječaj i eventualne ispravke potrebno je pregledati neposredno na portalu naručitelja'),
 finished('Za preuzimanje priloga na SIMAP-u obično treba prijava ponuditelja i registracija interesa'),
 finished('Za hrvatsku tvrtku Codeling d.o.o. treba provjeriti primjenu međunarodnih pravila i pravo sudjelovanja'),
 finished('Potrebno je provjeriti zahtjeve za reference, stručne potpise i osiguranje odgovornosti'),
 finished('Važno je pročitati tehničke uvjete, ugovorni nacrt, cjenik i obrasce, ako ih naručitelj propisuje'),
 finished('Ovaj tekst služi istraživanju i nije službeni prijevod ni potvrda ispunjenja uvjeta')
 ];
 return sentences.filter(Boolean).join(' ')
}
window.TCOD_report=ten;
window.TCOD_share=id=>copy(projLink(id,'swiss'),'Kopirana je poveznica na projekt za slanje kolegama.');
const worldView=$('worldView'), docsView=$('docsView'), shareView=$('shareView');
worldView.innerHTML='<p class="eyebrow">NEOVISNO OD ŠVICARSKE</p><h1>Svjetske javne nabave.</h1><p class="muted">Međunarodni izvori za kulturnu baštinu, arhitekturu, skeniranje, BIM, vizualizacije, grafiku i video. Svaka zemlja i izvor imaju vlastite uvjete sudjelovanja; pregled nije potpuni automatski indeks svih svjetskih natječaja.</p><div class="notice" id="worldNotice">Dohvaćam međunarodni izvor…</div><div class="tcod-grid" id="worldPortals"></div><div class="tcod-box"><h2>Automatski pronađeni međunarodni oglasi</h2><p class="tcod-note">Za sada je predviđen ograničeni TED API dohvat europskih oglasa. UNGM, World Bank, EBRD, Prozorro i drugi otvaraju se na izvornim službenim portalima.</p><div class="tcod-row"><input id="worldSearch" placeholder="Pretraži međunarodne oglase…"><button id="worldReload">Osvježi</button></div><div class="tcod-grid" id="worldResults"></div></div>';

worldView.insertAdjacentHTML('beforeend','<div class="tcod-box" id="worldShared"><h2>Favoriti · zajednički pregled</h2><p class="tcod-note">Označi zvjezdicom natječaje. Zatim klikni „Provjeri sve favorite” za usporedbu s posljednjim službenim TED podacima i „Proslijedi favorite” za zajednički link. Oznake se pohranjuju lokalno. Link prenosi odabrane brojeve TED objava, bez privatnih bilježaka.</p><div class="tcod-row"><label for="worldCountry">Država</label><select id="worldCountry"><option value="">Sve države</option><option value="HRV">Hrvatska</option><option value="OTHER">Druge države</option></select><label><input id="worldFavOnly" type="checkbox"> Samo favoriti</label></div><div class="tcod-row" style="margin-top:12px"><button id="worldVerifyAll">↻ Provjeri sve favorite</button><button id="worldShareFavorites">↗ Proslijedi favorite</button><button id="worldCsvFavorites">↓ Izvezi favorite</button><button id="worldImport" hidden>Spremi primljene favorite</button></div><p class="tcod-note" id="worldFavStatus"></p></div>');
docsView.innerHTML='<p class="eyebrow">ISTRAŽIVANJE NATJEČAJA I PRIPREMA PONUDE</p><h1>Dokumentacija projekta.</h1><p class="muted">Opširan kontrolni pregled dokumenata, sposobnosti i predaje za Codeling. Stavke su preporučena provjera, a ne tvrdnja da ih svaki naručitelj obvezno traži.</p><div class="notice">Službeni SIMAP: prijava ponuditelja → odabir organizacije Codeling → otvaranje projekta → Register interest → Documentation. Natječajne priloge često nije moguće preuzeti anonimno.</div><div class="tcod-box"><label for="docSelect">Odaberi projekt</label><div class="tcod-row"><select id="docSelect"></select><a id="docOfficial" class="tcod-action" target="_blank" rel="noopener">Otvori SIMAP projekt ↗</a><button id="docShare">Podijeli ovu provjeru</button></div><p id="docHeadline" class="tcod-note"></p><p id="docProgress" class="tcod-note"></p></div><div id="docChecklists"></div><div class="tcod-box"><h2>Bilješke i primljeni prilozi</h2><p class="tcod-note">Bilješke i oznake pohranjuju se samo u tvom pregledniku i nisu zajednički sinkronizirane.</p><textarea id="docNotes" class="tcod-textarea" placeholder="Npr. pitanja naručitelju, analiza natječajne dokumentacije, tko priprema koji prilog…"></textarea><p><input id="docFiles" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.zip"></p><p class="tcod-note" id="docFilesInfo">Odabrane datoteke ostaju na tvom uređaju; ne prenose se na poslužitelj i ne čitaju se automatski.</p><div class="tcod-row"><button id="docExport">Preuzmi analizu / checklist</button><button id="docCopy">Kopiraj kontrolnu listu</button></div></div>';
shareView.innerHTML='<p class="eyebrow">ZAJEDNIČKO ISTRAŽIVANJE</p><h1>Pošalji javne nabave kolegama.</h1><p class="muted">Cijeli Radar i svaki projekt imaju adresu koju možeš poslati e-mailom, WhatsAppom ili Slackom. Prijatelji i kolege mogu otvoriti iste javno dostupne podatke i službeni SIMAP oglas.</p><div class="tcod-box"><h2>Zajednički link aplikacije</h2><div class="tcod-row"><input class="tcod-copy" value="'+root+'" readonly><button id="shareApp">Kopiraj link</button></div></div><div class="tcod-box"><h2>Izravni link na pojedini projekt</h2><div class="tcod-row"><select id="shareSelect"></select><button id="shareSelected">Kopiraj projekt</button></div><p class="tcod-note">Link otvara projekt i njegov hrvatski sažetak. Lokalni favoriti, označeni dokumenti, bilješke i odabrane datoteke ne dijele se automatski.</p></div><div class="tcod-box"><h2>Zaštita podataka i rad u timu</h2><p class="tcod-note">Ne dijeli povjerljive cijene, osobne isprave ni privatnu natječajnu dokumentaciju kroz javnu poveznicu. Za zajedničko uređivanje kontrolnih lista treba zasebna autentificirana baza i korisnička prava; ova verzija dijeli javne projekte i dopušta izvoz vlastitih bilježaka.</p></div><p id="tcodActionStatus" role="status" class="tcod-note"></p>';

let worldFav={},worldCache={},sharedIds=(q.get('favorites')||'').split(',').filter(x=>/^\d{4,8}-20\d\d$/.test(x)).slice(0,80),shareMode=sharedIds.length>0;
try{worldFav=JSON.parse(localStorage.getItem('tcod-world-favs-v2')||'{}');worldCache=JSON.parse(localStorage.getItem('tcod-world-cache-v2')||'{}')}catch(e){}
const dateCH=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const worldOpen=t=>String(t.deadline||'').slice(0,10)>=dateCH();
function favSet(){return shareMode?sharedIds:Object.keys(worldFav).filter(id=>worldFav[id])}
function storeWorld(){try{localStorage.setItem('tcod-world-favs-v2',JSON.stringify(worldFav));localStorage.setItem('tcod-world-cache-v2',JSON.stringify(worldCache))}catch(e){}}
function worldLink(ids){let x=new URL(root);x.searchParams.set('tab','world');x.searchParams.set('favorites',ids.join(','));return x.href}
function worldFavStatus(){let ids=favSet(),list=world.tenders||[],matched=ids.map(id=>list.find(t=>String(t.id)===id)),fresh=world.last_success&&Date.now()-Date.parse(world.last_success)<36*3600*1000,active=matched.filter(t=>t&&worldOpen(t)).length,expired=matched.filter(t=>t&&!worldOpen(t)).length,missing=matched.filter(t=>!t).length;
let txt=ids.length+' spremljenih ili podijeljenih favorita · '+active+' s budućim rokom u zadnjem feedu · '+expired+' isteklih · '+missing+' nije prisutno u zadnjem feedu. ';
txt+=fresh?'Zadnji izvor ažuriran '+world.last_success+'.':'Izvor je nedostupan ili stariji od 36 sati; status oglasa nije svježe provjeren.';
if(shareMode)txt+=' Prikazuje se POPIS primljen preko poveznice; možeš ga spremiti u svoje favorite.';
$('worldFavStatus').textContent=txt;
$('worldImport').hidden=!shareMode;
}
function renderWorld(){
 const portals=$('worldPortals');portals.innerHTML=PORTALS.map(p=>'<article class="tcod-portal"><div class="eyebrow">'+esc(p[1])+'</div><h3>'+esc(p[0])+'</h3><p class="muted">'+esc(p[3])+'</p><a class="tcod-action" href="'+esc(p[2])+'" target="_blank" rel="noopener">Otvori službeni portal ↗</a></article>').join('');
 const n=(world.tenders||[]).filter(x=>x&&x.id);
 const t0=$('worldCountry'),country=t0?t0.value:'';
 const search=($('worldSearch')?.value||'').trim().toLowerCase();
 const only=$('worldFavOnly')&&$('worldFavOnly').checked;
 const ids=favSet();
 const countedHR=n.filter(t=>t.country==='HRV'&&worldOpen(t)).length;
 const countedOTHER=n.filter(t=>t.country!=='HRV'&&worldOpen(t)).length;
 $('worldNotice').className='notice'+(world.last_success&&world.status!=='degraded'?' good':'');
 $('worldNotice').textContent=world.last_success
  ?'TED: '+countedHR+' otvorenih relevantnih oglasa iz Hrvatske i '+countedOTHER+' iz drugih država u dohvaćenom uzorku. Provjera '+world.last_success+'. Status '+world.status+'. '+(world.source_status?.HRV?.complete?'Hrvatski TED rezultat potpuno paginiran.':'Hrvatski TED rezultat još nije potpuno potvrđen.')+' Nacionalni EOJN oglasi koji nisu u TED-u otvaraju se na zasebnom portalu.'
  :'Međunarodni izvor još nije potvrđeno ažuriran. Provjeri hrvatski EOJN i ostale službene portale.';
 const candidates=n.filter(worldOpen);
 let shown=candidates.filter(t=>(!country||country==='OTHER'&&t.country!=='HRV'||t.country===country)&&(!search||[t.title_original,t.title_hr,t.authority,t.country,t.summary_hr,t.id].join(' ').toLowerCase().includes(search))&&(!only||ids.includes(String(t.id))));
 if(only){
  for(const id of ids){if(!n.some(t=>String(t.id)===id)){
   const p=worldCache[id]||{title_original:'TED objava '+id,country:'',url:'https://ted.europa.eu/en/notice/-/detail/'+id,deadline:'',authority:''};
   if((!country||country==='OTHER'&&p.country!=='HRV'||p.country===country)&&(!search||[p.title_original,p.authority,id].join(' ').toLowerCase().includes(search)))shown.push({...p,id,not_in_feed:true});
  }}
 }
 shown.sort((a,b)=>(a.country==='HRV'?0:1)-(b.country==='HRV'?0:1)||String(a.deadline||'9999').localeCompare(String(b.deadline||'9999')));
 const isCurrent=!!world.last_success&&Date.now()-Date.parse(world.last_success)<36*3600*1000;
 $('worldResults').innerHTML=shown.length?shown.slice(0,300).map(t=>{
  const favorite=!!worldFav[t.id],shared=shareMode&&sharedIds.includes(String(t.id));
  const unavailable=!!t.not_in_feed,expiry=!unavailable&&!worldOpen(t);
  const title=esc(t.title_original||t.title_hr||'Naziv nije potvrđen');
  const label=t.country==='HRV'?'Hrvatska':esc(t.country||'Međunarodno');
  const url=/^https:\/\/ted\.europa\.eu\//.test(t.url||'')?t.url:'https://ted.europa.eu/en/notice/-/detail/'+encodeURIComponent(t.id);
  return '<article class="tcod-worldCard"><div class="eyebrow">'+label+' · TED '+esc(t.id)+'</div><h3>'+title+'</h3><p class="muted">'+esc(t.authority||'Naručitelj nije potvrđen')+'</p><p>'+esc((t.summary_hr||'Sažetak nije dostupan u trenutačnom feedu.').slice(0,370))+'</p><p class="tcod-note">Rok: <b>'+esc(String(t.deadline||'nije potvrđen').slice(0,10))+'</b> · Vrijeme: provjeriti u službenom oglasu</p><p class="tcod-note">'+(unavailable?'<b>Nije pronađen u najnovijem feedu — status provjeriti.</b>':expiry?'Rok prema feedu je istekao.':isCurrent?'U posljednjem ažuriranju TED-a; rok još nije istekao.':'Izvor nije svježe potvrđen.')+'</p><div class="tcod-row"><button data-world="'+esc(t.id)+'">HR detalji</button><button data-favorite="'+esc(t.id)+'">'+(favorite?'★ Favorit':'☆ Favorit')+'</button><button data-world-share="'+esc(t.id)+'">Proslijedi</button><a class="tcod-action" href="'+esc(url)+'" target="_blank" rel="noopener">Provjeri službeni TED ↗</a></div></article>';
 }).join(''):'<div class="tcod-box"><p>Nema otvorenih oglasa prema filtrima ili izvor nije dostupno ažuriran. Za hrvatske postupke pogledaj službeni EOJN RH.</p></div>';
 document.querySelectorAll('[data-world]').forEach(b=>b.onclick=()=>worldDetails(b.dataset.world));
 document.querySelectorAll('[data-favorite]').forEach(b=>b.onclick=()=>{let id=b.dataset.favorite;if(worldFav[id])delete worldFav[id];else{worldFav[id]=true;let item=n.find(t=>String(t.id)===id);if(item)worldCache[id]={title_original:item.title_original,authority:item.authority,country:item.country,deadline:item.deadline,url:item.url}}storeWorld();renderWorld()});
 document.querySelectorAll('[data-world-share]').forEach(b=>b.onclick=()=>copy(worldLink([b.dataset.world]),'Kopirana poveznica na ovaj međunarodni natječaj.'));
 worldFavStatus();
}
async function fetchWorld(){try{let r=await fetch(feed+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);let j=await r.json();if(!Array.isArray(j.tenders))throw Error('Neispravan format');world=j}catch(e){world={status:'not_connected',tenders:[],error:String(e)}}renderWorld()}
function worldDetails(id){let t=(world.tenders||[]).find(x=>x.id===id);if(!t)return;
 const info=ten(t);$('details').innerHTML='<p class="eyebrow">SVIJET / '+esc(t.source||'TED')+'</p><h2>'+esc(t.title_original||'Međunarodni projekt')+'</h2><p><a target="_blank" rel="noopener" href="'+esc(t.url||'https://ted.europa.eu/en/')+'">Otvori službeni oglas ↗</a></p><div class="field"><dt>HR sažetak — najmanje 10 rečenica</dt><dd>'+esc(info)+'</dd></div><div class="field"><dt>Napomena</dt><dd>Pravo sudjelovanja, dokumenti i rokovi provjeravaju se kod izvornog međunarodnog naručitelja.</dd></div>';$('modal').classList.add('open')}
function populateSelect(el,selected){let x=allProjects();el.innerHTML=x.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.title_hr||t.title_original||'Projekt')+' ('+esc(t.canton||'CH')+')</option>').join('');if(selected&&x.some(t=>t.id===selected))el.value=selected}
function renderDocs(){
 populateSelect($('docSelect'),activeDoc);if($('docSelect').value)activeDoc=$('docSelect').value;
 const p=getProject();if(!p){$('docHeadline').textContent='Nema još podataka o projektima.';return}
 $('docOfficial').href=p.url||'https://www.simap.ch/en';$('docHeadline').textContent=(p.authority||'Naručitelj nije potvrđen')+' · '+(p.deadline_kind||'Rok')+': '+(p.deadline||'nije potvrđen')+' · Prilozi: '+(p.documents_present===true?'prisutnost označena na SIMAP-u':'nije potvrđeno');
 let status=checked[p.id]||{};let allItems=GROUPS.flatMap(g=>g[1]);$('docProgress').textContent='Označeno kao pregledano: '+allItems.filter(t=>!!status[t]).length+' / '+allItems.length+'. Oznaka ne dokazuje da je prilog obvezan ili predan.';
 $('docChecklists').innerHTML=GROUPS.map(([title,rows])=>'<details class="tcod-docsGroup" open><summary>'+esc(title)+'</summary>'+rows.map(item=>'<label class="tcod-check"><input type="checkbox" data-ck="'+esc(item)+'" '+(status[item]?'checked':'')+'><span>'+esc(item)+'<small>Preporučena kontrola; potvrditi u službenoj dokumentaciji.</small></span></label>').join('')+'</details>').join('');
 document.querySelectorAll('[data-ck]').forEach(c=>c.onchange=()=>{if(!checked[p.id])checked[p.id]={};checked[p.id][c.dataset.ck]=c.checked;try{localStorage.setItem('tcod-checks-v1',JSON.stringify(checked))}catch(e){}renderDocs()});
 $('docNotes').value=notes[p.id]||'';
}
function reportText(){const p=getProject();if(!p)return '';let x=checked[p.id]||{};return 'TCOD SIMAP RADAR — ISTRAŽIVANJE NATJEČAJA\nProjekt: '+(p.title_hr||p.title_original)+'\nSIMAP: '+(p.url||'')+'\nZabilježeni rok: '+(p.deadline||'')+'\n\nHR SAŽETAK\n'+ten(p)+'\n\nKONTROLNA LISTA — SUGERIRANE PROVJERE\n'+GROUPS.map(([t,items])=>t+'\n'+items.map(a=>(x[a]?'[x] ':'[ ] ')+a).join('\n')).join('\n\n')+'\n\nBILJEŠKE\n'+(notes[p.id]||'')+'\n\nNapomena: ovo nije službena natječajna dokumentacija.\n'}
function downloadText(str,name){let url=URL.createObjectURL(new Blob([str],{type:'text/plain;charset=utf-8'}));let a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function renderShare(){populateSelect($('shareSelect'),activeDoc)}
document.querySelectorAll('#tcodTabs [data-switch]').forEach(b=>b.onclick=()=>showTab(b.dataset.switch));
$('worldSearch').oninput=renderWorld;$('worldReload').onclick=fetchWorld;
$('docSelect').onchange=e=>{activeDoc=e.target.value;renderDocs()};
$('docShare').onclick=()=>copy(projLink(activeDoc,'docs'),'Kopirana poveznica na odabranu kontrolnu listu. Bilješke se ne dijele.');
$('docNotes').oninput=e=>{let p=getProject();if(p){notes[p.id]=e.target.value;try{localStorage.setItem('tcod-notes-v1',JSON.stringify(notes))}catch(err){}}};
$('docFiles').onchange=e=>{$('docFilesInfo').textContent=Array.from(e.target.files||[]).map(f=>f.name+' ('+Math.ceil(f.size/1024)+' KB)').join(' · ')||'Nije odabrana datoteka.'};
$('docExport').onclick=()=>downloadText(reportText(),'TCOD_SIMAP_analiza_'+(activeDoc||'projekt')+'.txt');
$('docCopy').onclick=()=>copy(reportText(),'Kontrolna lista i bilješke kopirane.');
$('shareApp').onclick=()=>copy(root,'Kopirana zajednička poveznica na TCOD Radar.');
$('shareSelected').onclick=()=>copy(projLink($('shareSelect').value,'swiss'),'Kopirana poveznica na pojedini natječaj.');
document.addEventListener('tcod:loaded',()=>{if(activeTab==='docs')renderDocs();if(activeTab==='share')renderShare();let project=q.get('project');if(project&&activeTab==='swiss'&&window.TCODRadar&&window.TCODRadar.list().some(t=>t.id===project))window.TCODRadar.detail(project)});
showTab(q.get('tab')||'swiss',false);fetchWorld();
if(q.get('project')&&activeTab==='swiss'){setTimeout(()=>{if(window.TCODRadar)window.TCODRadar.detail(q.get('project'))},100)}
})();
