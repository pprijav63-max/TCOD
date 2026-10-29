/* TCOD Radar — one-click procurement review package for Codeling d.o.o.
 * Copies public data only; never exports local notes, private attachments or credentials.
 * All eligibility and documentary requests are QUESTIONS, not verified requirements.
 */
(function(){
'use strict';
const BASE='https://tcod-simap-radar.yapp.page/';
const HOST='Codeling d.o.o., Zagreb (Republika Hrvatska)';
const $=id=>document.getElementById(id);
const str=v=>typeof v==='string'?v:String(v??'');
const collapse=v=>str(v).replace(/\s+/g,' ').trim();
function sourceLabel(kind,t){
 if(kind==='swiss')return 'SIMAP — Švicarska';
 if(kind==='world')return 'TED — europske javne nabave';
 return t.source==='UNGM'?'UNGM / '+(t.agency||'UN'):t.source==='Prozorro'?'Prozorro — Ukrajina':t.source==='TED'?'TED — Europa':str(t.source||'Međunarodni portal');
}
function validLink(kind,t){
 const uri=str(t.url||'');
 const hosts=kind==='swiss'?['https://www.simap.ch/']:kind==='world'?['https://ted.europa.eu/']:['https://www.ungm.org/','https://ted.europa.eu/','https://prozorro.gov.ua/'];
 return hosts.some(host=>uri.startsWith(host))?uri:'(potrebno otvoriti službeni oglas na portalu)';
}
function projectLink(kind,t){
 const uri=new URL(BASE);
 uri.searchParams.set('tab',kind==='world'?'world':kind==='heritage'?'heritage':'swiss');
 uri.searchParams.set(kind==='swiss'?'project':'favorites',str(t.id||''));
 return uri.href;
}
function statusLabel(kind,t,overall){
 const time=overall?.last_success;
 const age=time?Date.now()-Date.parse(time):NaN;
 const dated=Number.isFinite(age)&&age<=36*3600000;
 if(kind==='heritage'&&t.verification==='manual_official_2026_10_29')return 'Službena objava pregledana 29.10.2026. (nije neprekidno praćena)';
 if(!dated)return 'Podaci nisu potvrđeni kao svježi — obavezna provjera na službenom portalu';
 if(overall?.status==='partial')return 'Posljednji dohvat je djelomičan; status projekta mora se potvrditi';
 if(overall?.status==='live')return 'Preuzet iz javnog izvora; postupak treba provjeriti';
 return 'Informativan pregled — pravo prijave nije potvrđeno';
}
const QUESTIONS=[
'Je li poduzeću Codeling d.o.o. iz Hrvatske dopušteno sudjelovati u ovom postupku kao samostalnom ponuditelju?',
'Je li potreban lokalni partner, zajednica ponuditelja, podizvođač ili lokalno stručno ovlaštenje?',
'Koje reference, kvalifikacije ključnih stručnjaka i osiguranja naručitelj obvezno traži?',
'Koji registracijski, porezni, poslovni i drugi dokazi ili izjave moraju biti priloženi?',
'Koja je točna natječajna dokumentacija za preuzimanje i koje obrasce/cjenike treba popuniti?',
'Postoje li posebni uvjeti za konzervaciju kulturne baštine, projektiranje, 3D dokumentaciju ili BIM/HBIM?',
'Koji su službeni rokovi za prijavu interesa, postavljanje pitanja i predaju, s točnom vremenskom zonom?',
'Predaje li se ponuda na SIMAP-u, EOJN-u, TED-u, UNGM/Quantum portalu, Prozorru ili drugim kanalom?',
'Postoje li obvezni potpisi, jamstva, potvrde o nepostojanju zapreka, jezik ponude ili ugovorne posebnosti?',
'Može li se ponuditi samo određeni LOT i kakvi su kriteriji ocjenjivanja i cijena?'
];
function questionLines(){return QUESTIONS.map((line,index)=>(index+1)+'. '+line).join('\n');}
function dataFor(kind){
 if(kind==='swiss')return window.TCODRadar?.getData?.()||null;
 if(kind==='world')return window.TCODWorld?.getData?.()||null;
 return window.TCODHeritage?.getData?.()||null;
}
function title(t){return collapse(t.title_original||t.title_hr||'Naziv nije potvrđen');}
function summary(t){return collapse(t.summary_hr||'Nije dostupan cjelovit hrvatski opis. Provjeriti izvornu dokumentaciju.');}
function individual(kind,t){
 const d=dataFor(kind);
 const deadline=t.deadline||'nije potvrđen';
 const area=kind==='swiss'?['Kanton',t.canton,'Grad',t.city].filter(Boolean).join(' · '):
  t.country||t.country_code||'Država nije potvrđena';
 const lines=[
 'PREDMET: Molba za stručnu provjeru javnog natječaja – '+title(t),
 '',
 'Poštovani,',
 '',
 'molim vas da za društvo '+HOST+' provjerite mogućnost sudjelovanja u sljedećem javnom natječaju i navedete sve potrebne korake i dokumente za prijavu.',
 '',
 'OSNOVNI PODACI O NATJEČAJU',
 'Naziv: '+title(t),
 'Naručitelj: '+(t.authority||t.agency||'nije potvrđen'),
 'Izvor: '+sourceLabel(kind,t),
 'Država / lokacija: '+(area||'nije potvrđena'),
 'Broj oglasa / projekta: '+(t.reference||t.project_number||t.id||'nije potvrđen'),
 'Datum objave: '+(t.published||'nije potvrđen'),
 'Rok iz trenutačnog pregleda: '+deadline+' (provjeriti datum, vrijeme, vremensku zonu i eventualne izmjene)',
 'Službeni oglas: '+validLink(kind,t),
 'TCOD istraživački prikaz: '+projectLink(kind,t),
 'Status podataka: '+statusLabel(kind,t,d),
 '',
 'HRVATSKI ISTRAŽIVAČKI SAŽETAK (NESLUŽBEN)',
 summary(t),
 '',
 'MOLIM PROVJERITI:',
 questionLines(),
 '',
 'Molim kratko stručno očitovanje: (A) MOŽEMO SAMOSTALNO, (B) MOŽEMO UZ PARTNERA ili (C) NE ISPUNJAVAMO UVJETE, uz popis obveznih dokumenata, rokova i eventualnih zapreka.',
 'Molim posebno navesti koje od navedenih stavki su stvarno propisane ovim natječajem, a koje nisu primjenjive.',
 '',
 'Napomena: podatke iz ovog istraživačkog prikaza treba usporediti sa službenim natječajem i svim naknadnim ispravcima.',
 '',
 'Hvala i srdačan pozdrav,',
 'Codeling d.o.o.',
 'Zagreb, Hrvatska'
 ];
 return lines.join('\n');
}
function selectedIds(kind){
 const key=kind==='swiss'?'tcod-simap-favs-2026':kind==='world'?'tcod-world-favs-v2':'tcod-heritage-favs';
 let saved={};
 try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){}
 const ids=Object.keys(saved).filter(id=>saved[id]);
 const params=new URLSearchParams(location.search);
 const incoming=params.get('tab')===kind?(params.get('favorites')||'').split(',').filter(Boolean):[];
 return [...new Set([...ids,...incoming])].slice(0,40);
}
function bulk(kind){
 const all=dataFor(kind)?.tenders||[];
 const fav=selectedIds(kind);
 if(!fav.length)return null;
 const keys=all.map(t=>[str(t.id),t]);
 const lookup=new Map(keys);
 const groups=fav.map((id,index)=>{
   const t=lookup.get(id);
   if(!t)return (index+1)+'. Oglas '+id+' nije u najnovijem izvoru — provjeriti je li istekao ili promijenjen.\n';
   return [
    (index+1)+'. '+title(t),
    '   Naručitelj: '+(t.authority||t.agency||'nije potvrđen')+'; država: '+(t.country||t.canton||'nije potvrđena'),
    '   Rok (potvrditi): '+(t.deadline||'nije potvrđen'),
    '   Službeni oglas: '+validLink(kind,t),
    '   Kratki HR opis: '+summary(t).slice(0,520)+(summary(t).length>520?' […]':''),
    ''
   ].join('\n');
 });
 return [
  'PREDMET: Zajednička provjera '+fav.length+' odabranih javnih natječaja – Codeling d.o.o.',
  '',
  'Poštovani,',
  '',
  'molim vas da za Codeling d.o.o., Zagreb, pregledate odabrane natječaje ispod te utvrdite u kojim postupcima smijemo sudjelovati i što trebamo pripremiti za prijavu.',
  '',
  'ODABRANI NATJEČAJI ('+fav.length+')',
  groups.join('\n'),
  'ZA SVAKI NATJEČAJ MOLIM PROVJERITI:',
  questionLines(),
  '',
  'Molim pregled u tablici: NATJEČAJ | SAMOSTALNO / UZ PARTNERA / NE | OBVEZNI PRILOZI | ROK | PREOSTALI KORACI | PREPORUKA.',
  '',
  'Napomena: ovo su neslužbeni hrvatski sažeci iz djelomičnih izvora. Konačni status, dokumentacija i rokovi potvrđuju se kod naručitelja.',
  '',
  'Hvala i srdačan pozdrav,',
  'Codeling d.o.o., Zagreb'
 ].join('\n');
}
function notify(message,success){
 let el=$('tcodReviewNotice');
 if(!el){
  el=document.createElement('div');
  el.id='tcodReviewNotice';
  el.setAttribute('role','status');
  el.setAttribute('aria-live','polite');
  document.body.appendChild(el);
 }
 el.className='tcod-reviewNotice'+(success?' success':'');
 el.textContent=message;
 el.hidden=false;
}
function backupCopy(text){
 const el=document.createElement('textarea');
 el.value=text;
 el.setAttribute('readonly','');
 el.style.position='fixed';
 el.style.left='-9999px';
 document.body.append(el);
 el.focus();el.select();
 let ok=false;
 try{ok=document.execCommand('copy')}catch(e){}
 el.remove();
 return ok;
}
async function copy(text){
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
  else if(!backupCopy(text))throw Error('Clipboard nije podržan');
  notify('Kopirano! Otvori e-mail ili WhatsApp i zalijepi (Cmd + V / Ctrl + V).',true);
  return true;
 }catch(e){
  if(backupCopy(text)){notify('Kopirano! Zalijepi u poruku javnoj nabavi.',true);return true;}
  // Make contents selectable without using unsafe unsupported storage.
  let panel=$('tcodReviewFallback');
  if(!panel){
   panel=document.createElement('dialog');panel.id='tcodReviewFallback';
   panel.innerHTML='<h2>Tekst za provjeru javne nabave</h2><p>Označi sav tekst i kopiraj ga.</p><textarea readonly></textarea><button type="button">Zatvori</button>';
   panel.querySelector('button').onclick=()=>panel.close();
   document.body.append(panel);
  }
  panel.querySelector('textarea').value=text;
  panel.showModal();
  panel.querySelector('textarea').focus();panel.querySelector('textarea').select();
  notify('Preglednik nije dopustio izravno kopiranje. Tekst je pripremljen za ručno kopiranje.',false);
  return false;
 }
}
document.addEventListener('click',event=>{
 const one=event.target.closest('[data-review-kind][data-review-id]');
 const many=event.target.closest('[data-review-bulk]');
 if(one){
  const kind=one.dataset.reviewKind;
  const id=one.dataset.reviewId;
  const t=(dataFor(kind)?.tenders||[]).find(row=>str(row.id)===id);
  if(!t){notify('Ovaj projekt nije pronađen u učitanim podacima. Osvježi Radar.',false);return;}
  void copy(individual(kind,t));return;
 }
 if(many){
  const content=bulk(many.dataset.reviewBulk);
  if(!content){notify('Prvo označi barem jedan natječaj zvjezdicom ★ Favorit.',false);return;}
  void copy(content);
 }
});
window.TCODReview={individual,bulk,selectedIds,copy};
})();