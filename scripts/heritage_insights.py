#!/usr/bin/env python3
"""Evidence-first heritage summaries from the official TED XML and Prozorro tender detail.

No generic sentence-padding and no invented deliverables. Every intervention label
is backed by original title, tender/lot description or item. UNESCO membership is
reported only when matched against UNESCO World Heritage List records.
"""
from __future__ import annotations
import concurrent.futures
import datetime as dt
import html
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any

USER_AGENT = "TCOD-Heritage-Radar/2.0 (public cultural-heritage procurement analysis)"
UNESCO_API = "https://data.unesco.org/api/explore/v2.1/catalog/datasets/whc001/records"
MAX_ORIGINAL = 5500
TRUSTED_UNESCO = {
 "moenjodaro": ("Archaeological Ruins at Moenjodaro", "https://whc.unesco.org/en/list/138/")
}
SPECIALTY_LABELS = {
 "heritage_design":"Projektiranje i konzervatorska projektna dokumentacija",
 "investigation":"Istraživanje kulturne baštine i tehničke studije",
 "laser_scanning":"3D lasersko skeniranje",
 "point_cloud":"Oblak točaka (point cloud)",
 "photogrammetry":"Fotogrametrija / fotodokumentacija",
 "hbim":"HBIM / digitalni model povijesne građevine",
 "survey":"Arhitektonska snimka / geodetsko ili izmjerno snimanje",
 "digital_inventory":"Digitalna inventarizacija, arhiviranje i dokumentiranje",
 "conservation":"Konzervacija / restauracija",
 "archaeology":"Arheološko istraživanje / dokumentiranje",
 "urgent_works":"Hitni protuhavarijski i stabilizacijski radovi",
 "adaptive_reuse":"Prilagodba i prenamjena povijesne građevine",
 "rehabilitation":"Sanacija / rehabilitacija postojećeg objekta",
 "roof":"Sanacija krovišta ili pokrova",
 "facade":"Konzervacija ili sanacija pročelja",
 "museum":"Muzejska postava / interpretacija kulturne baštine",
 "equipment":"Nabava opreme za konzervaciju",
}
# Strict terms: do not infer digital survey, BIM, point clouds from 'project' or 'restoration'.
PATTERNS = {
 "heritage_design":r"project (?:documentation|design)|architectural(?:\s+led)? design team|architectural design|architectural services|technical design|design services|ma[iî]trise d.?[oœ]uvre|progettazion|architekt(?:ur)?planung|planungsleist|projektn[a-zćč]* dokumentac|projektiranj|прое?ктн.{0,25}документац|проектуван|розробк.{0,25}прое?кт|архітектурн.{0,12}прое?кт",
 "investigation":r"technical stud|research|investigat|studie|forsch|recherche scientifique|diagnostic|auswertung|дослідженн|обстеженн|історико.архітектурн|науково.прое?кт|історичних досліджен",
 "laser_scanning":r"laser.{0,8}scan|3d.{0,8}scan|laser.{0,10}scann|лазерн.{0,20}скан|лазерн.{0,20}зніман|сканування",
 "point_cloud":r"point.{0,4}cloud|punktwolke|nuage de points|pointcloud|облак.{0,8}точ|хмара точок",
 "photogrammetry":r"photogram|fotogram|photogramm[eé]tr|фотограм",
 "hbim":r"(?:^|\W)hbim(?:\W|$)|historic building information model|heritage bim|building information model.{0,30}heritage",
 "survey":r"measured survey|architectural survey|geometric survey|building survey|relev[eé] architectural|bestand(?:s)?aufnahme|bauaufnahme|vermessung|обмірн|архітектурн.{0,15}обмір|геодезичн.{0,18}зніман|геодетск|geodetsko snimanj",
 "digital_inventory":r"digital documentation|digital inventory|digitis|digitalis|inventariz|documentation numérique|digital heritage|photographic documentation|documentierung|цифров.{0,15}документац|цифровізац|оцифровуван|інвентаризац|фотофіксац|архівуван",
 "conservation":r"conservat|restaurat|restaurier|restauro|conservazion|konserv|konzerv|реставрац|консервац|reparaci[oó]n de monument",
 "archaeology":r"archaeolog|arch[eé]olog|arch[aä]olog|archeolog|arheolog|археолог|arheolo",
 "urgent_works":r"emergency stabilis|emergency stabiliz|urgent conservation|emergency intervent|protuhavar|протиаварійн|першочергов.{0,20}робіт|невідкладн",
 "adaptive_reuse":r"adaptive reuse|change of use|conversion to|adaptation of historic|пристосуван|réaffectation|reconversion|prenamjen|prilagodba|prilagođavan",
 "rehabilitation":r"rehabilit|rénovat|renovat|sanierung|sanac|rekonstrukc|реконструкц|капітальн.{0,12}ремонт",
 "roof":r"roof(?:ing)?|dach(?:sanierung|deckung|arbeiten)?|pokrov|krovišt|покрівл|дах(?:у|ом)?",
 "facade":r"fa[çc]ade|fassad|fasad|pročelj|фасад",
 "museum":r"museum exhibit|museum display|muzejsk.{0,15}postav|музейн.{0,15}експозиц|мультимедійн.{0,15}експозиц|interpretation centre|cultural interpretation",
 "equipment":r"procurement of (?:conservation|restoration) tools|supply.{0,40}(?:conservation|restoration) tools|postачан.{0,25}обладнан|прилад(?:ів|дя) для реставрац",
}
COMPILED={k:re.compile(p,re.I) for k,p in PATTERNS.items()}
HERITAGE_SIGNAL=re.compile(
 r"cultural heritage|world heritage|protected building|listed building|historic (?:building|monument|site|church)|"
 r"heritage led|heritage-led|patrimoine culturel|denkmal|baštin|spomenik|povijesn|"
 r"культурн.{0,15}спадщин|пам.?ят(?:ка|ок|ки)|історико|археолог|"
 r"archaeolog|restaur|conserv|muzej|museum|museo",re.I)
SOURCE_LANG={"UKR":"uk","TED":"en","UNGM":"en","SIMAP":"de"}
def clean(value:Any,limit:int=MAX_ORIGINAL)->str:
 if isinstance(value,dict):
  for key in ("uk","en","hr","eng","deu","fra","value","description"):
   if isinstance(value.get(key),str) and value[key]:return clean(value[key],limit)
  return ""
 if isinstance(value,(list,tuple)):
  return "; ".join(clean(x,400) for x in value if x)[:limit]
 if not value:return ""
 text=html.unescape(re.sub(r"<[^>]*>"," ",str(value)))
 return re.sub(r"\s+"," ",text).strip()[:limit]
def get(url:str,accept:str="application/json",limit:int=1500000)->bytes:
 req=urllib.request.Request(url,headers={"Accept":accept,"User-Agent":USER_AGENT})
 with urllib.request.urlopen(req,timeout=30) as res:return res.read(limit)
def get_json(url:str)->dict:
 return json.loads(get(url,"application/json"))
def ted_full(record:dict)->dict:
 """Retrieve original descriptions using official TED Search API, including lots."""
 pub=clean(record.get("id"),60)
 if not re.fullmatch(r"\d{4,9}-20\d\d",pub):return {}
 body={"query":"ND="+pub,
  "fields":["publication-number","description-proc","description-lot","description-part","description-glo","additional-info-glo"],
  "limit":2,"scope":"ALL"}
 req=urllib.request.Request("https://api.ted.europa.eu/v3/notices/search",
  data=json.dumps(body).encode("utf-8"),
  headers={"Accept":"application/json","Content-Type":"application/json","User-Agent":USER_AGENT},
  method="POST")
 with urllib.request.urlopen(req,timeout=30) as response:answer=json.load(response)
 found=next((x for x in (answer.get("notices") or []) if x.get("publication-number")==pub),{})
 if not found:return {}
 desc=[];languages=[]
 for key in ("description-proc","description-lot","description-part","description-glo","additional-info-glo"):
  raw=found.get(key)
  if not isinstance(raw,dict):raw={"unspecified":raw}
  for language,parts in raw.items():
   if isinstance(parts,str):parts=[parts]
   if not isinstance(parts,list):continue
   for entry in parts[:7]:
    value=clean(entry,2000)
    if len(value)>28 and value not in desc:
     desc.append(value);languages.append(language)
 full=" ".join(desc[:7])[:MAX_ORIGINAL]
 return {"description_original":full,
  "description_source":"Službeni TED Search API — opis postupka i lotova",
  "description_level":"full_notice" if len(full)>35 else "title_only",
  "description_languages":list(dict.fromkeys(languages)),
  "source_excerpts_original":desc[:7],
  "documents_titles":[]}

def prozorro_full(record:dict)->dict:
 tid=clean(record.get("id"),70)
 if not re.fullmatch(r"UA-\d{4}-\d{2}-\d{2}-\d{6}-[a-z]",tid):return {}
 summary=get_json("https://prozorro.gov.ua/api/tenders/"+urllib.parse.quote(tid)+"/summary")
 uid=summary.get("id")
 if not isinstance(uid,str) or not re.fullmatch(r"[0-9a-f]{32}",uid):return {}
 tender=get_json("https://public-api.prozorro.gov.ua/api/2.5/tenders/"+uid).get("data") or {}
 if tender.get("tenderID")!=tid:return {}
 texts=[clean(tender.get("description"),2500)]
 items=tender.get("items") or []
 descriptions=[]
 for item in items[:10]:
  msg=clean(item.get("description"),850)
  if msg and msg not in descriptions:descriptions.append(msg)
 for lot in (tender.get("lots") or [])[:7]:
  msg=clean(lot.get("description"),850)
  if msg and msg not in descriptions:descriptions.append(msg)
 paragraphs=[x for x in texts+descriptions if x]
 main=" ".join(dict.fromkeys(paragraphs))[:MAX_ORIGINAL]
 documents=[]
 for document in (tender.get("documents") or [])[:80]:
  label=clean(document.get("title"),180)
  if label and label not in documents:documents.append(label)
 nature=tender.get("mainProcurementCategory") or ""
 amount=tender.get("value") or {}
 deliverables=[]
 for item in items[:6]:
  title=clean(item.get("description"),500)
  if title and title not in deliverables:deliverables.append(title)
 return {
  "description_original":main,
  "description_source":"Službeni Prozorro API (puni zapis natječaja: opis/stavke/lotovi)",
  "description_level":"item_descriptions" if len(main)>60 else "title_only",
  "source_excerpts_original":descriptions[:5],
  "documents_titles":documents[:30],
  "document_count":len(tender.get("documents") or []),
  "item_descriptions_original":deliverables,
  "estimated_amount":amount.get("amount"),
  "estimated_currency":amount.get("currency"),
  "procurement_nature":nature,
  "tender_status_verified":tender.get("status"),
  "tender_id_internal":uid,
 }
def short_uk_title(title:str)->str:
 """Translate common Ukrainian *contract subject* constructions without altering names."""
 # Only render matched evidence; do not translate unknown project titles by guessing.
 parts=[]
 rules=[
  (r"реставрац.{0,10}та.{0,15}пристосуван","restauracija i prilagodba za novu namjenu"),
  (r"реставрац|реставрацi","restauracija"),
  (r"консервац","konzervacija"),
  (r"протиаварійн","hitni protuhavarijski radovi"),
  (r"проєктн.{0,25}документац|проектн.{0,25}документац","izrada projektne dokumentacije"),
  (r"історико.архітектурн","povijesno-arhitektonsko istraživanje"),
  (r"археологічн.{0,20}дослідженн","arheološka istraživanja"),
  (r"капітальн.{0,15}ремонт.*покрівл|ремонт.*покрівл","opsežna sanacija krova"),
  (r"обмірн.{0,20}робіт","izrada arhitektonske snimke"),
  (r"лазерн.{0,15}скануван","lasersko 3D skeniranje"),
  (r"фотограм","fotogrametrija"),
  (r"оцифровуван","digitalizacija dokumentacije"),
  (r"музейн.{0,16}експозиц","muzejska postava"),
  (r"охоронн.{0,12}дощок","izrada zaštitnih natpisnih ploča"),
 ]
 for regex,hr in rules:
  if re.search(regex,title,re.I) and hr not in parts:parts.append(hr)
 return "; ".join(parts[:5])
def determine(record:dict)->dict:
 title=clean(record.get("title_original"),650)
 desc=clean(record.get("description_original"),4200)
 original=(title+" "+desc)
 codes=[k for k,regex in COMPILED.items() if regex.search(original)]
 works=str(record.get("procurement_nature") or "").lower()
 if "equipment" in codes and works not in ("works","services"):proc_kind="Nabava opreme / robe"
 elif works=="works":proc_kind="Izvođenje radova"
 elif works=="services":proc_kind="Usluge (vrsta usluge navedena u predmetu ugovora)"
 elif works=="goods":proc_kind="Nabava robe / opreme"
 elif re.search(r"\bwork[s]?\b|radovi|робот[иі]|travaux|bauarbeiten",title,re.I):proc_kind="Mogući radovi — provjeriti ugovor"
 elif re.search(r"design|stud|research|project|проєктн|проектн|planung|services",title,re.I):proc_kind="Moguće stručne usluge — potvrditi"
 else:proc_kind="Vrsta ugovora nije potvrđena"
 labels=[SPECIALTY_LABELS[k] for k in codes]
 work_keys={"heritage_design","investigation","laser_scanning","point_cloud","photogrammetry","hbim","survey","digital_inventory","archaeology"}
 direct=sorted(set(codes).intersection(work_keys))
 if direct:priority="visoko";rank=3
 elif "conservation" in codes and "works" in proc_kind.lower():priority="srednje";rank=2
 elif "conservation" in codes or "adaptive_reuse" in codes:priority="srednje";rank=2
 elif "equipment" in codes:priority="nisko";rank=0
 elif re.search(r"final evaluation|evaluacija projekta|підсумков.{0,15}оцінк|furniture|office equipment",title,re.I):
  priority="nisko";rank=0
 else:priority="provjeriti";rank=1
 # Direct objects and buildings come from original titles; never fabricate protected status.
 origin=short_uk_title(title) if record.get("country_code")=="UKR" else ""
 intervention=", ".join(labels[:7]) if labels else "Vrsta intervencije nije dovoljno opisana u dostupnom javnom oglasu."
 return {
  "intervention_codes":codes,
  "intervention_hr":intervention,
  "subject_explanation_hr":origin,
  "procurement_type_hr":proc_kind,
  "tcod_priority":priority,
  "tcod_priority_rank":rank,
  "heritage_evidence":bool(HERITAGE_SIGNAL.search(original)),
 }
def norm(value:str)->str:
 value=unicodedata.normalize("NFKD",clean(value,650)).casefold()
 return re.sub(r"[^a-z0-9]+"," ",value).strip()
def fetch_unesco_names()->list[dict]:
 """The actual UNESCO inscription list is ground truth, not the procuring agency."""
 sites=[]
 try:
  first=get_json(UNESCO_API+"?limit=50&offset=0")
  count=min(1500,int(first.get("total_count",0)))
  sites.extend(first.get("results",[]))
  offsets=list(range(50,count,50))
  def page(offset):
   try:return get_json(UNESCO_API+"?limit=50&offset="+str(offset)).get("results",[])
   except Exception:return []
  with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
   for results in pool.map(page,offsets):
    sites.extend(results)
 except Exception:return []
 return sites
def unesco_match(record:dict,sites:list[dict])->dict:
 title=clean(record.get("title_original"),950)
 desc=clean(record.get("description_original"),2000)
 txt=norm(title+" "+desc)
 # Explicit known site and independently verified UNESCO World Heritage Centre reference.
 for term,(name,url) in TRUSTED_UNESCO.items():
  if term in txt:return {"unesco_status":"unesco_confirmed","unesco_site":name,
   "unesco_url":url,"unesco_source":"UNESCO World Heritage Centre / official property listing"}
 # Only match names fully present in text; avoid UNESCO-agency == UNESCO-site inference.
 best=None;best_len=0
 for site in sites:
  name=clean(site.get("name_en"),250)
  key=norm(name)
  if len(key)<17 or len(key.split())<3 or key not in txt:continue
  if len(key)>best_len:best=site;best_len=len(key)
 if best:
  name=clean(best.get("name_en"),250)
  code=best.get("id_no") or best.get("id") or best.get("site_id")
  uri="https://whc.unesco.org/en/list/"+str(code)+"/" if isinstance(code,(int,str)) and str(code).isdigit() else "https://whc.unesco.org/en/list/"
  return {"unesco_status":"unesco_confirmed","unesco_site":name,
    "unesco_url":uri,"unesco_source":"UNESCO DataHub: World Heritage List (literalni puni naziv)"}
 return {"unesco_status":"not_verified","unesco_site":"","unesco_url":"",
   "unesco_source":"UNESCO status nije utvrđen; naručitelj UNESCO ne znači da je objekt upisan"}
def summarize(record:dict)->str:
 """Evidence-first, Croatian concise intervention assessment. No padding."""
 title=clean(record.get("title_original"),650)
 origin=clean(record.get("description_original"),1200)
 source=clean(record.get("description_source") or "službeni oglas")
 kind=record.get("procurement_type_hr","Vrsta ugovora nije potvrđena")
 codes=record.get("intervention_codes") or []
 subject=record.get("subject_explanation_hr") or ""
 country=record.get("country") or "lokacija nije potvrđena"
 authority=clean(record.get("authority") or record.get("agency") or "naručitelj nije naveden",250)
 lines=[]
 if subject:lines.append("Predmet intervencije prema izvornom naslovu: "+subject+".")
 else:lines.append("Predmet je u objavi naveden pod nazivom: „"+title+"”.")
 lines.append("Vrsta zahvata: "+record.get("intervention_hr","nije utvrđena").rstrip(".")+".")
 for verified_fact in (record.get("facts_hr") or [])[:3]:
  fact=clean(verified_fact,280)
  if fact:lines.append(fact if fact.endswith((".","?","!")) else fact+".")

 lines.append("Uloga iz ugovora: "+kind+".")
 if "urgent_works" in codes:lines.append("Izričito su prepoznati hitni radovi stabilizacije ili zaštite objekta; to je drukčije od samog projektiranja.")
 if "adaptive_reuse" in codes:lines.append("Spominje se prilagodba ili prenamjena postojećeg povijesnog objekta.")
 if "heritage_design" in codes:lines.append("Tekst upućuje na projektantske usluge ili pripremu projektne dokumentacije.")
 if "investigation" in codes:lines.append("Tekst upućuje na istraživanje, dijagnostiku ili stručne studije.")
 if "laser_scanning" in codes:lines.append("Izvorni oglas izričito spominje lasersko skeniranje.")
 if "point_cloud" in codes:lines.append("Izvorni oglas izričito spominje oblak točaka (point cloud).")
 if "photogrammetry" in codes:lines.append("Izvorni oglas izričito spominje fotogrametriju.")
 if "hbim" in codes:lines.append("Izvorni oglas izričito spominje HBIM.")
 if record.get("estimated_amount") is not None:
  amount=record["estimated_amount"];currency=record.get("estimated_currency") or "valuta nije potvrđena"
  lines.append("U izvornom zapisu navedena je procijenjena vrijednost "+str(amount)+" "+currency+".")
 if record.get("document_count") is not None:
  lines.append("U javnom zapisu evidentirano je "+str(record["document_count"])+" priloga; njihovi naslovi ne potvrđuju da je sadržaj dokumenata automatski pregledan.")
 if origin and norm(origin)!=norm(title):
  # Exact quotation in original language, not falsely presented as Croatian translation.
  lines.append("Dodatni opis iz službenog oglasa dostupan je u izvornom jeziku te je odvojen od ovog hrvatskog tumačenja.")
 else:
  lines.append("Opis izvan samog naslova i popisa stavki nije potvrđen u dostupnim javnim podacima.")
 if record.get("unesco_status")=="unesco_confirmed":
  lines.append("UNESCO status je provjeren: "+str(record.get("unesco_site"))+" nalazi se na Popisu svjetske baštine.")
 else:
  lines.append("Upis konkretnog objekta na UNESCO-ov Popis svjetske baštine nije potvrđen.")
 if record.get("tcod_priority")=="visoko":
  lines.append("Oglas je snažno povezan s projektiranjem, istraživanjem ili dokumentacijom kulturne baštine; uvjete natječaja ipak treba pročitati.")
 elif record.get("tcod_priority")=="nisko":
  lines.append("Predmet je primarno oprema, što nije osnovna projektantska ili dokumentacijska usluga ureda.")
 else:
  lines.append("Podudarnost s uslugama ureda treba potvrditi u tehničkom zadatku i kriterijima sposobnosti.")
 lines.append("Naručitelj je "+authority+"; država/lokacija navedena u pregledu: "+str(country)+".")
 lines.append("Izvor: "+source+".")
 lines.append("Mjerodavni su izvorni natječaj i njegovi prilozi, uključujući moguće izmjene rokova i opsega.")
 return " ".join(lines)
def process_one(record:dict,sites:list[dict])->dict:
 row=dict(record)
 origin=row.get("source")
 try:
  full=ted_full(row) if origin=="TED" else prozorro_full(row) if origin=="Prozorro" else {}
  if full:row.update(full)
  else:
   row.setdefault("description_source","Provjereni naslov i dostupni metapodaci izvornog oglasa")
   row.setdefault("description_level","title_only")
 except Exception as ex:
  row["detail_fetch_error"]=str(ex)[:150]
  row.setdefault("description_source","Nije uspio dohvat potpunog opisa; korišten javni naslov")
  row.setdefault("description_level","title_only")
 row.update(determine(row))
 row.update(unesco_match(row,sites))
 row["summary_hr"]=summarize(row)
 row["summary_kind"]="Sadržajni HR pregled stvarne intervencije i dostupnog službenog opisa"
 row["summary_evidence_level"]=row.get("description_level","title_only")
 row["summary_sentence_minimum"]=None
 return row
def enrich_all(rows:list[dict])->tuple[list[dict],dict]:
 sites=fetch_unesco_names()
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
  output=list(executor.map(lambda t:process_one(t,sites),rows))
 stats={"official_unesco_sites_loaded":len(sites),
        "full_ted_xml":sum(1 for x in output if x.get("description_level")=="full_notice"),
        "prozorro_item_details":sum(1 for x in output if x.get("description_level")=="item_descriptions"),
        "title_only":sum(1 for x in output if x.get("description_level")=="title_only"),
        "confirmed_unesco":sum(1 for x in output if x.get("unesco_status")=="unesco_confirmed"),
        "detail_errors":sum(bool(x.get("detail_fetch_error")) for x in output)}
 return output,stats
