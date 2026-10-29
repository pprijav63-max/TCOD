/* TCOD subject classification: interpret original contract title, CPV and verified description only.
   Do not classify from generic Croatian procedural summaries. */
(function(){
'use strict';
const LABELS={
 architecture:'Arhitektura / Bauleitung',
 heritage:'Kulturna baština / restauracija',
 scanning:'3D skeniranje / fotogrametrija',
 bim:'BIM / HBIM',
 graphic:'Grafički dizajn / komunikacije',
 web:'Web / UX',
 video:'Video / animacija',
 other:'Ostalo / potrebno provjeriti'
};
const PATTERNS={
 architecture:/architekt|architect|arquitect|arquitet|objektplan|planerleist|generalplan|bauleit|ma[iî]trise d.?oeuvre|progettazion|urbanis|urbanistič|urbanistic|krajobraz|landscape arch|projektiranj|projektantsk|projektna dokumentacij|izrada glavnih projekta|redacci[oó]n de proyectos|planning services|stručni nadzor|construction supervis|supervision de travaux|project design|projektno.tehničk/i,
 heritage:/kulturn[a-zćčšž]* baštin|kultur(?:erbe|gut)|patrimoine|heritage|denkmal|monument historique|monument.*histori|restaurat|restauro|restaurir|restoration of historic|konzervator|arheolog|arch[aä]olog|museu[m]?|muzej|cultural monument|historical preservation|unesco|conservation of heritage/i,
 scanning:/laser.{0,6}scan|lasersk.{0,14}sken|scans?ione laser|3d.{0,8}scan|3d.{0,12}sken|skeniranj|photogramm|fotogramm|photogramm[eé]trie|point.{0,4}cloud|punktwolke|nuage de points|digital surveying.*3d/i,
 bim:/(?:^|[^a-z])hbim(?:[^a-z]|$)|(?:^|[^a-z])bim(?:[^a-z]|$)|building information model|digital twin|digitaler zwilling|jumeau num[eé]rique/i,
 graphic:/grafičk|grafi[cč]k|graphic.{0,18}design|graphique|graphis|mise en page|grafische|corporate design|visual identity|vizualni identitet|branding|design graphique|kommunikationsdesign|comunicaci[oó]n visual|kommunikationskampagne|komunikacijsk.{0,25}kampanj|graphic communication|public information campaign|gestaltun[g]?.*print|printmedien|visual design/i,
 web:/web.{0,14}(design|razvoj|stranic|site|page|entwickl|portal)|webdesign|website|site internet|portail web|user experience|ux\/ui|ui\/ux|webauftritt|website design|internet portal|izrada web/i,
 video:/videoprodu|video.produc|erkl[aä]rvideo|fil[m]?produktion|film produc|filmsk|audiovisual|audiovizual|multimedijsk|multimedia (production|solution|design)|animacij|animation|motion design|3d animat|motion graphics/i
};
function getText(value){if(!value)return '';if(typeof value==='string')return value;if(typeof value==='number')return String(value);return '';}
function prefix(cpv,pre){return cpv.some(code=>code.startsWith(pre));}
function categories(t){
 t=t||{};
 const source=(t.source||'').toUpperCase();
 const cpv=(Array.isArray(t.cpv)?t.cpv:[]).map(String);
 const title=getText(t.title_original||t.title_hr);
 const desc=source==='TED'?'':getText(t.description_original);
 const phrase=(title+' '+desc).slice(0,12000);
 const arr=[];
 for(const [k,regexp] of Object.entries(PATTERNS)){if(regexp.test(phrase))arr.push(k);}
 if(prefix(cpv,'712')||prefix(cpv,'714')||prefix(cpv,'7132'))arr.push('architecture');
 if(prefix(cpv,'798225')||prefix(cpv,'7993'))arr.push('graphic');
 if(prefix(cpv,'921'))arr.push('video');
 if(prefix(cpv,'72413'))arr.push('web');
 if(prefix(cpv,'713551'))arr.push('scanning');
 if(prefix(cpv,'92521')||prefix(cpv,'92522'))arr.push('heritage');
 // TED old records sometimes mark architecture for every CPV; discard that stale label.
 // Swiss public SIMAP classification has verified description and is retained.
 if(source!=='TED'){
  const stored=Array.isArray(t.categories)?t.categories:[t.category].filter(Boolean);
  for(const k of stored){if(k in LABELS&&k!=='other')arr.push(k);}
 }
 const unique=[...new Set(arr.filter(k=>k in LABELS&&k!=='other'))];
 return unique.length?unique:['other'];
}
function first(t){return categories(t)[0];}
function count(rows){const out={};for(const t of rows||[]){for(const k of categories(t))out[k]=(out[k]||0)+1;}return out;}
window.TCODSubject={labels:LABELS,order:Object.keys(LABELS),categories,first,count};
})();