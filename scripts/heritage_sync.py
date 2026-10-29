#!/usr/bin/env python3
"""TCOD World Heritage: TED + official Ukrainian Prozorro search + verified UNGM listings.

Bounded searches are deliberately marked PARTIAL; there is no claim of indexing all
UNGM, NATO or global procurements.  Manual official UNGM notices retain
an explicit 2026-10-29 check date and are automatically removed after deadlines.
"""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
from heritage_insights import enrich_all

BASE=Path(__file__).resolve().parents[1]
WORLD=BASE/"docs/data/world.json"
OUTPUT=BASE/"docs/data/heritage.json"
TZ=ZoneInfo("Europe/Zurich")
NOW=dt.datetime.now(TZ)
TODAY=NOW.date()
UA_API="https://prozorro.gov.ua/api/search/tenders"
UA_TERMS=[
 "пам'ятки архітектури","культурної спадщини","реставрація пам'ятки",
 "реставрація будівлі","археологічні","об'єкта культурної спадщини",
 "музей реставрація","фотограмметрія"
]
UA_HERITAGE=re.compile(
 r"пам.?ят(?:ки|ок|ка|к)|культурн.{0,16}спадщин|історичн.{0,20}(?:будівл|споруд|пам.?ят|об.?єкт)|"
 r"археолог|архітектурн.{0,30}(?:спадщин|пам.?ят)|реставрац.{0,70}(?:будівл|палац|храм|церкв|замк|споруд|собор|театр|музе|пам.?ят)|"
 r"музей|музею|історико.культурн|монастир|костел|фортец|катедр|собор|"
 r"фотограмметр|лазерн.{0,20}скануван.{0,80}(?:пам.?ят|спадщин|музе)|"
 r"документац.{0,40}(?:пам.?ят|спадщин)",re.I)
UA_EXCLUDE=re.compile(r"картридж|принтер|тонер|рідина|продуктів харчування|заправк|друкар|непрофільн|військов.{0,15}містечк",re.I)
TED_HERITAGE=re.compile(
 r"heritage|denkmal|denkmalschutz|monument historique|historical monument|"
 r"cultural monument|patrimoine (?:bâti|culturel)|patrimonio culturale|"
 r"restauration|restaurierung|restauro|restaurac|konzerv|conservation of historic|"
 r"arch[aäe]olog|arch[eé]olog|archeolog|muzej|museum|museo|musee|mus[eé]e|"
 r"castle|ch[aâ]teau|church (?:restor|renovat)|historical building|"
 r"povijesn.{0,20}građev|kulturn.{0,10}baštin|kultur(?:erbe|gut)|historic site",re.I)
TED_EXCLUDE=re.compile(r"biodiversity|environmental restoration|soil remediation|forest restoration|water restoration|ornitološk|ekološk|ornitholog|ecological monitoring|pericolosit.{0,15}idraul|hydraulic flood risk|cyclotouristes|restauration pour le grand public",re.I)
COUNTRIES={
 "HRV":"Hrvatska","DEU":"Njemačka","FRA":"Francuska","ITA":"Italija","BEL":"Belgija",
 "POL":"Poljska","IRL":"Irska","ESP":"Španjolska","SWE":"Švedska","NOR":"Norveška",
 "CZE":"Češka","NLD":"Nizozemska","AUT":"Austrija","SVN":"Slovenija","CYP":"Cipar",
 "GRC":"Grčka","PRT":"Portugal","DNK":"Danska","FIN":"Finska","BGR":"Bugarska",
 "LVA":"Latvija","LTU":"Litva","EST":"Estonija","ROU":"Rumunjska","MKD":"Sjeverna Makedonija"
}
SOURCES=[
 {"key":"UNESCO","name":"UNESCO — javni pozivi","region":"Cijeli svijet","url":"https://www.unesco.org/en/procurement","mode":"official_directory","note_hr":"UNESCO objavljuje nabavu preko UNGM-a; dokumenti i ponude ovise o oglasu."},
 {"key":"UNGM","name":"UNGM — UN Global Marketplace","region":"Cijeli svijet","url":"https://www.ungm.org/Public/Notice","mode":"official_directory","note_hr":"Više UN agencija, uključujući UNESCO, UNDP i UNOPS. Javni API zahtijeva autorizaciju agencije; nije uključen potpuni automatski uvoz."},
 {"key":"UNDP","name":"UNDP — nabave i Quantum","region":"Cijeli svijet","url":"https://www.undp.org/procurement","mode":"official_directory","note_hr":"Mnogi UNDP postupci podnose se na Quantum Supplier Portalu."},
 {"key":"UNOPS","name":"UNOPS — eSourcing","region":"Cijeli svijet","url":"https://www.unops.org/business-opportunities","mode":"official_directory","note_hr":"Posebni projekti izgradnje, konzervacije i opreme; predaja prema eSourcing uputama."},
 {"key":"Prozorro","name":"Prozorro — Ukrajina","region":"Ukrajina","url":"https://prozorro.gov.ua/en","mode":"limited_public_api","note_hr":"Uvoz ograničenih relevantnih rezultata javne pretrage, s potvrdom budućeg roka."},
 {"key":"NATO","name":"NATO — javne nabave","region":"NATO i međunarodni projekti","url":"https://www.nato.int/en/work-with-us/business-and-project-opportunities/procurement-opportunities","mode":"official_directory","note_hr":"NATO prilike nisu automatski kulturna baština; potvrđeni heritage pozivi se ne izmišljaju. Za mnoge postupke trebaju specifični uvjeti i registracija."},
 {"key":"NCIA","name":"NCIA — NATO agencija za komunikacije","region":"NATO","url":"https://www.ncia.nato.int/business/procurement/current-opportunities","mode":"official_directory","note_hr":"Tehnički, geoinformacijski i digitalni poslovi; nisu svi kulturna baština."},
 {"key":"TED","name":"TED — europske javne nabave","region":"Europa i zemlje TED-a","url":"https://ted.europa.eu/en/","mode":"limited_public_api","note_hr":"Strojno preuzeti TED oglasi, ograničeni na prethodno prikupljene pretrage."},
 {"key":"EU","name":"EU Funding & Tenders","region":"Europa i svijet","url":"https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home","mode":"official_directory","note_hr":"Natječaji, grantovi i europski projekti kulturne baštine."},
 {"key":"WB","name":"World Bank — poslovne prilike","region":"Cijeli svijet","url":"https://projects.worldbank.org/en/projects-operations/opportunities","mode":"official_directory","note_hr":"Javni pozivi za obnovu i projektiranje financirani sredstvima Svjetske banke."},
 {"key":"EBRD","name":"EBRD — ECEPP","region":"Više zemalja","url":"https://ecepp.ebrd.com/","mode":"official_directory","note_hr":"Radovi i konzultantske usluge u projektima EBRD-a."},
 {"key":"ADB","name":"Asian Development Bank","region":"Azija i Pacifik","url":"https://www.adb.org/business/project-procurement/business-opportunities","mode":"official_directory","note_hr":"Projektne konzultacije i infrastrukturne nabave."},
 {"key":"ICCROM","name":"ICCROM — zaštita baštine","region":"Cijeli svijet","url":"https://www.iccrom.org/","mode":"official_directory","note_hr":"Stručne suradnje i pozivi vezani uz konzervaciju baštine."},
 {"key":"ICOMOS","name":"ICOMOS — spomenici i lokaliteti","region":"Cijeli svijet","url":"https://www.icomos.org/","mode":"official_directory","note_hr":"Stručni natječaji i suradnje uz povijesna dobra i svjetsku baštinu."},
 {"key":"OSCE","name":"OSCE — nabava i suradnje","region":"Europa i šire","url":"https://procurement.osce.org/","mode":"official_directory","note_hr":"Povremene stručne projektne i tehničke usluge."},
]
# VERIFIED FROM OFFICIAL UNGM NOTICE PAGES on 29-Oct-2026; not an automated UNGM API feed.
UNGM_NOTICES=[
 {"id":"UNGM-319525","title":"Research, Technical Studies and Proposed Conservation Interventions for the World Heritage property ‘Archaeological Ruins at Moenjodaro’",
  "agency":"UNESCO","country":"Pakistan","country_code":"PAK","deadline":"2026-11-25T15:00:00+05:00","published":"2026-10-23","url":"https://www.ungm.org/Public/Notice/319525","reference":"FO/ISB/RFP/10/2026-288",
  "areas":["restoration","archaeology","documentation"],"fit":"high",
  "facts":["Predmet je svjetsko arheološko dobro Moenjodaro u Pakistanu.","Traže se istraživanja, tehničke studije i predložene konzervatorske intervencije.","Lokalitet je upisan na UNESCO Popis svjetske baštine."],
  "needs":"Provjeriti reference međunarodne konzervacije, stručni tim, metodologiju i službeni RFP."},
 {"id":"UNGM-317757","title":"Conservation Works at Agios Demetrios Church",
  "agency":"UNDP","country":"Cipar","country_code":"CYP","deadline":"2026-11-10T10:00:00-04:00","published":"2026-10-12","url":"https://www.ungm.org/Public/Notice/317757","reference":"UNDP-CYP-00250",
  "areas":["restoration","architecture"],"fit":"high",
  "facts":["Predmet su konzervatorski radovi na crkvi Agios Demetrios na Cipru.","Naručitelj je UNDP.","Ponude se predaju putem sustava Quantum."],
  "needs":"Provjeriti registraciju na Quantum Portalu, radove, troškovnik, potrebnu lokalnu ekipu i osiguranje."},
 {"id":"UNGM-318907","title":"RFQ Goods — Supply & Commissioning of Conservation/Restoration Tools to the Department of General Antiquities — Amman, Jordan",
  "agency":"UNOPS","country":"Jordan","country_code":"JOR","deadline":"2026-11-03T09:00:00+00:00","published":"2026-10-20","url":"https://www.ungm.org/Public/Notice/318907","reference":"RFQ/2026/65084",
  "areas":["equipment","restoration"],"fit":"low",
  "facts":["Nabava se odnosi na isporuku i puštanje u rad opreme za konzerviranje i restauriranje kulturnih predmeta.","Naručitelj je UNOPS za jordanski Odjel za starine.","Ovo nije arhitektonsko projektiranje ni restauratorska usluga."],
  "needs":"Provjeriti mogućnosti isporuke opreme, dokumente dobavljača i uvjet barem jednog sličnog ugovora u sedam godina."},
 {"id":"UNGM-317513","title":"Final evaluation of the third project “Support to Education, Culture and Media in Ukraine through UNESCO”",
  "agency":"UNESCO","country":"Ukrajina","country_code":"UKR","deadline":"2026-10-30T14:00:00+03:00","published":"2026-10-09","url":"https://www.ungm.org/Public/Notice/317513","reference":"RFP-UA-26-09",
  "areas":["research","documentation"],"fit":"low",
  "facts":["Predmet je završna evaluacija UNESCO-ova projekta potpore obrazovanju, kulturi i medijima u Ukrajini.","Nije riječ o projektiranju ili fizičkoj restauraciji kulturnog dobra.","U oglasu je objavljen kontakt UNESCO-ova ureda u Ukrajini."],
  "needs":"Provjeriti konačni rok iz oglasa i obvezne reference za evaluacije programa; izvorni opis sadrži i raniji datum predaje."}
]
AREAS={
 "restoration":"Restauracija / konzervacija",
 "architecture":"Povijesne građevine / projektiranje",
 "documentation":"Digitalna dokumentacija / 3D / HBIM",
 "archaeology":"Arheologija / nalazišta",
 "museum":"Muzeji / arhivi",
 "research":"Istraživanje / stručne studije",
 "equipment":"Oprema / konzervatorski materijali"
}
def get_json(url,payload=None,timeout=32):
 body=json.dumps(payload,ensure_ascii=False).encode() if payload is not None else None
 hdr={"Accept":"application/json","User-Agent":"TCOD-WorldHeritage/1.0 public research"}
 if body is not None:hdr["Content-Type"]="application/json"
 req=urllib.request.Request(url,data=body,headers=hdr)
 with urllib.request.urlopen(req,timeout=timeout) as x:return json.load(x)
def active(date):
 try:
  d=dt.datetime.fromisoformat(date.replace("Z","+00:00"))
  if d.tzinfo is None:d=d.replace(tzinfo=TZ)
  return d.astimezone(TZ)>NOW
 except (ValueError,AttributeError):return False
def text(v):
 if isinstance(v,dict):
  for field in ("uk","en","hr","name","title"):
   if v.get(field):return text(v[field])
  return ""
 return str(v or "").strip()
def report(t,facts=None):
 name=t.get("title_original") or "naziv nije objavljen"
 agency=t.get("agency") or t.get("authority") or "naručitelj nije potvrđen"
 country=t.get("country") or "država nije potvrđena"
 deadline=t.get("deadline") or "rok nije potvrđen"
 source=t.get("source") or "javni izvor"
 info=[
  f"Predmet je objavljen pod službenim nazivom „{name}”.",
  f"Izvor natječaja označen je kao {source}.",
  f"Naručitelj ili nadležna agencija je {agency}.",
  f"Mjesto provedbe navedeno je kao {country}.",
  f"Objava je zabilježena s datumom {t.get('published') or 'koji treba dodatno potvrditi'}.",
  f"Najbliži zabilježeni rok jest {deadline}, a mjerodavan je rok na službenom oglasu.",
 ]
 for fact in (facts or [])[:3]:
  fact=fact.strip()
  if fact:info.append(fact if fact.endswith((".","!","?")) else fact+".")
 info.extend([
  "Za Codeling d.o.o. najprije treba utvrditi dopuštenost prijave hrvatske pravne osobe.",
  "Potrebno je pregledati sve službene priloge, kriterije sposobnosti i tražene reference.",
  "Prije izrade ponude treba provjeriti zahtijeva li se lokalni partner ili stručnjak s ovlaštenjem.",
  "Posebno treba provjeriti način predaje, jezik, lokaciju i eventualni obvezni obilazak.",
  "Dostupnost prijave i konačni uvjeti ovise o pojedinom naručitelju i njegovim izmjenama.",
  "Ovaj hrvatski tekst neslužbeni je istraživački sažetak, a ne službeni prijevod ili pravna ocjena."
 ])
 return " ".join(info)
def from_ungm():
 out=[]
 for n in UNGM_NOTICES:
  if not active(n["deadline"]):continue
  t={
   "id":n["id"],"title_original":n["title"],"title_hr":"",
   "source":"UNGM","agency":n["agency"],"authority":n["agency"],"country":n["country"],
   "country_code":n["country_code"],"deadline":n["deadline"],"published":n["published"],
   "url":n["url"],"reference":n["reference"],"areas":n["areas"],"fit":n["fit"],
   "access":"službena UNGM objava; dokumenti često zahtijevaju registraciju",
   "verified_at":"2026-10-29T18:00:00+01:00",
   "verification":"manual_official_2026_10_29","details_hr":n["needs"],"facts_hr":n.get("facts",[])
  }
  t["summary_hr"]=report(t,n["facts"]);out.append(t)
 return out
def ted_areas(t):
 title=t.get("title_original","")
 cats=t.get("categories",[])
 cpv=t.get("cpv") or []
 confirmed_heritage=bool(TED_HERITAGE.search(title) and not TED_EXCLUDE.search(title)) or any(str(code).startswith(("92521","92522")) for code in cpv) or "heritage" in cats
 if not confirmed_heritage:return []
 areas=[]
 if TED_HERITAGE.search(title) and not TED_EXCLUDE.search(title):
  areas.append("restoration")
 if re.search(r"muse[eo]|muzej|mus[eé]e|museum|archiv|biblioth[eè]que historiques",title,re.I):
  areas.append("museum")
 if re.search(r"arch[aäe]olog|arch[eé]olog|archeolog|archaeolog",title,re.I):
  areas.append("archaeology")
 if re.search(r"restaur|sanierung|rehabilit|architect|architekt|bauplan|architecture|progettazion",title,re.I):
  areas.append("architecture")
 if re.search(r"scan|photogramm|fotogramm|bim|digitali|laser|documentation",title,re.I):
  areas.append("documentation")
 if any(str(code).startswith(("92521","92522")) for code in cpv):areas.append("restoration")
 if not areas and "heritage" in cats:areas.append("restoration")
 return list(dict.fromkeys(areas))
def from_ted():
 if not WORLD.exists():return [],"missing"
 try:
  d=json.loads(WORLD.read_text("utf-8"))
 except Exception:return [],"invalid"
 out=[]
 for t in d.get("tenders",[]):
  if not active(t.get("deadline","")):continue
  areas=ted_areas(t)
  if not areas:continue
  result={**t,"source":"TED","agency":"TED / naručitelj","authority":t.get("authority",""),
   "country":COUNTRIES.get(t.get("country"),t.get("country") or "Nepoznata država"),
   "country_code":t.get("country") or "OTHER","areas":areas,
   "verification":"live_ted_subset","verified_at":d.get("last_success"),
   "fit":"high" if any(x in areas for x in ("restoration","archaeology","documentation")) else "medium",
   "details_hr":"Provjeriti službeni opis, sve lotove, kulturno-povijesni status objekta te uvjete tima."}
  result["summary_hr"]=report(result,[
   "Oglas je prepoznat prema izvornom nazivu ili CPV skupini povezanoj s kulturnom baštinom.",
   "Predmet treba provjeriti po pojedinim lotovima jer sama klasifikacija ne potvrđuje cjelokupan opseg."
  ])
  out.append(result)
 return out,d.get("status","partial")
def search_ua():
 found={};scanned=0;failures=[];attempts=0
 max_pages=int(os.getenv("TCOD_UA_PAGES","2"))
 for term in UA_TERMS:
  for page in range(1,max_pages+1):
   try:
    payload={"text":term,"page":page,"status":["active.tendering","active.enquiries"]}
    response=get_json(UA_API,payload,25)
    data=response.get("data") or []
    if not isinstance(data,list):raise ValueError("Invalid UA result list")
    scanned+=len(data);attempts+=1
    for row in data:
     title=text(row.get("title"))
     status=row.get("status","")
     if status not in ("active.tendering","active.enquiries"):continue
     if UA_EXCLUDE.search(title) or not UA_HERITAGE.search(title):continue
     tend=row.get("tenderPeriod") or {}
     deadline=tend.get("endDate") or ""
     if not active(deadline):continue
     tid=text(row.get("tenderID"))
     if not re.fullmatch(r"UA-\d{4}-\d{2}-\d{2}-\d{6}-[a-z]",tid):continue
     key=tid
     buyer=row.get("procuringEntity") or {}
     address=buyer.get("address") or {}
     pub="-".join(tid.split("-")[1:4])
     fields=[key,title,buyer.get("name"),deadline]
     if not all(fields):continue
     cpv=str(row.get("mainProcurementCategory",""))
     areas=["restoration"]
     if re.search(r"скануван|фотограмм|3d",title,re.I):areas=["documentation"]
     if re.search(r"музе|архів|археолог",title,re.I):areas.append("museum")
     if re.search(r"документац|проєктн|проектн|архітектур",title,re.I):areas.append("architecture")
     if re.search(r"археолог",title,re.I):areas.append("archaeology")
     org=text(buyer.get("name"))
     obj={"id":tid,"title_original":title,"title_hr":"","source":"Prozorro",
       "agency":"Prozorro / "+org,"authority":org,"country":"Ukrajina",
       "country_code":"UKR","city":text(address.get("locality")),
       "published":pub,"deadline":deadline,"url":"https://prozorro.gov.ua/tender/"+tid,
       "areas":list(dict.fromkeys(areas)),"fit":"medium",
       "verification":"limited_live_api","verified_at":NOW.isoformat(timespec="seconds"),
       "access":"Dokumenti i rok na službenoj Prozorro kartici",
       "details_hr":"Provjeriti ukrajinsko pravo sudjelovanja stranih ponuditelja, registraciju na akreditiranoj platformi i ratne uvjete nabave."
     }
     obj["summary_hr"]=report(obj,[
      "Izvorni naslov projekta upućuje na kulturnu baštinu, restauraciju ili arhitektonsku dokumentaciju.",
      "Ukrajinski izvor u trenutku dohvata označio je postupak kao aktivan za ponude ili upite.",
      "Konačne stavke radova, osiguranje, lokalna ovlaštenja i popis priloga treba pročitati u izvornom oglasu."
     ])
     found[key]=obj
    if len(data)<20:break
    time.sleep(.22)
   except Exception as ex:
    failures.append(term+": "+str(ex)[:100]);break
 return list(found.values()),{"mode":"limited_live_api","scanned":scanned,"found":len(found),
    "queries":len(UA_TERMS),"pages_per_query":max_pages,
    "partial":True,"errors":failures[:6],"attempted":attempts}
def main():
 old={}
 try:
  if OUTPUT.exists():old=json.loads(OUTPUT.read_text("utf-8"))
 except Exception:pass
 ted,ted_status=from_ted()
 ungm=from_ungm()
 ua,ua_status=search_ua()
 combined=ungm+ted+ua
 # Dedupe by source+id and sort by soonest first.
 merged={}
 for item in combined:
  key=(item.get("source"),str(item.get("id")))
  merged[key]=item
 items=sorted(merged.values(),key=lambda x:x.get("deadline",""))
 items,insight_stats=enrich_all(items)
 # Keep subject area labels only when they are backed by the official tender text.
 for item in items:
  codes=set(item.get("intervention_codes") or [])
  mapped=[]
  if codes.intersection({"heritage_design","survey","adaptive_reuse"}):mapped.append("architecture")
  if codes.intersection({"investigation","digital_inventory"}):mapped.append("research")
  if codes.intersection({"laser_scanning","point_cloud","photogrammetry","hbim","survey","digital_inventory"}):mapped.append("documentation")
  if codes.intersection({"archaeology"}):mapped.append("archaeology")
  if codes.intersection({"museum"}):mapped.append("museum")
  if codes.intersection({"conservation","rehabilitation","urgent_works","adaptive_reuse","roof","facade"}):mapped.append("restoration")
  if "equipment" in codes:mapped.append("equipment")
  # Allow confirmed publisher-tagged heritage areas when detailed text is silent.
  if not mapped and item.get("source")=="UNGM":
   mapped=[v for v in (item.get("areas") or []) if v in AREAS]
  item["areas"]=list(dict.fromkeys(mapped or ["research"]))
  item["fit"]="high" if item.get("tcod_priority")=="visoko" else "low" if item.get("tcod_priority")=="nisko" else "medium"
 items.sort(key=lambda x:(-(x.get("tcod_priority_rank") or 0),x.get("deadline","")))

 summary={"TED":len(ted),"UNGM_CURATED":len(ungm),"PROZORRO":len(ua),"NATO_CONFIRMED_HERITAGE":0}
 response={
  "schema_version":2,
  "status":"partial",
  "source":"TED ograničena pretraga + Prozorro javni API + provjerene službene UNGM objave",
  "last_attempt":NOW.isoformat(timespec="seconds"),
  "last_success":NOW.isoformat(timespec="seconds") if ted_status!="missing" or ua_status["attempted"] else old.get("last_success"),
  "heritage_only":True,
  "coverage_complete":False,
  "coverage_warning_hr":"Ovo nije cjelovit popis natječaja cijelog svijeta. TED i Prozorro obuhvaćeni su ograničenim pretragama. UNGM/UNESCO/UNDP/UNOPS i NATO imaju vlastite portale; UNESCO/UNGM primjeri provjereni su 29.10.2026., a ne automatski s UNGM API-ja.",
  "tenders":items,"counts_by_source":summary,"insights_stats":insight_stats,
  "source_states":{"TED":{"status":ted_status,"partial":True},
    "Prozorro":ua_status,
    "UNGM":{"mode":"verified_official_notices","last_human_check":"2026-10-29","api_connected":False},
    "NATO":{"mode":"official_directory_only","confirmed_heritage":0}},
  "sources":SOURCES
 }
 OUTPUT.parent.mkdir(parents=True,exist_ok=True)
 OUTPUT.write_text(json.dumps(response,ensure_ascii=False,indent=2),encoding="utf-8")
 print("HERITAGE",len(items),"TED",len(ted),"UNGM",len(ungm),"UA",len(ua),
       "ua_scanned",ua_status["scanned"],"ua_errors",len(ua_status["errors"]),flush=True)
if __name__=="__main__":main()
