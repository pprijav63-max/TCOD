#!/usr/bin/env python3
"""TCOD Svijet: službeni TED API, Hrvatska zasebno, otvoreni pozivi iz zadnjih 30 dana."""
import datetime as dt
import json
import re
import sys
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ZONE=ZoneInfo("Europe/Zurich")
NOW=dt.datetime.now(ZONE)
START=(NOW.date()-dt.timedelta(days=29)).strftime("%Y%m%d")
OUT=Path(__file__).resolve().parents[1]/"docs/data/world.json"
ENDPOINT="https://api.ted.europa.eu/v3/notices/search"
RELEVANT_CPV=("712","714","925","921","7993","798225","71354","71355","71356","72413","72212224","454541")
TOPIC=re.compile(r"arhitekt|architect|projektir|projektan|projektne dokumentacije|izrada (?:idejnog|glavnog|izvedbenog) projekta|project design|generalplan|urbanis|prostornog plana|studija prostora|konzervacij|konzervator|conserv|restaur|restor|heritage|denkmal|spomenik|baštin|bastin|museum|muzej|fotogram|photogram|lasersk|laser.scann|3d.skenir|bim|hbim|grafički dizajn|grafic design|graphic design|vizualni identitet|visual identity|vizualizacij|visualization|animacij|animation|video produkc|film produkc|videoproduc|web.stranic|web.site|website design|corporate.identity|multimedijsk(?:a|o) rješen|multimedia production|geodetsk|geodesy|bauleit|building design",re.I)
NOT_RELEVANT=re.compile(r"excavat|trailer|vehicle|tipper lorry|welfare van|truck|tires|goriv|materijal|office.suppl|computer equipment|printer cartridge|kupnja vozila|nabava goriva",re.I)
CPV_NAMES={"712":"arhitektonske usluge i projektiranje","714":"urbanizam i krajobrazno planiranje","925":"kulturna baština, muzeji ili kulturne usluge","921":"filmska, video i audiovizualna produkcija","7993":"specijalizirane dizajnerske usluge","798225":"grafički dizajn","71354":"geodetske i kartografske usluge","71355":"fotogrametrija i mjerenja","71356":"tehničko savjetovanje","72413":"izrada web stranica","72212224":"web usluge i specijalizirana podrška","454541":"restauratorski radovi"}
FIELDS=["publication-number","notice-title","buyer-name","buyer-country","publication-date","deadline","deadline-receipt-tender-date-lot","classification-cpv","notice-type","contract-nature"]
def pick(obj):
 if isinstance(obj,str):return obj.strip()
 if isinstance(obj,(int,float)):return str(obj)
 if isinstance(obj,list):
  for x in obj:
   v=pick(x)
   if v:return v
  return ""
 if isinstance(obj,dict):
  for lang in ("hrv","eng","deu","fra","ita","slv","hun"):
   if lang in obj:
    v=pick(obj[lang])
    if v:return v
  for x in obj.values():
   v=pick(x)
   if v:return v
 return ""
def strings(v):
 if isinstance(v,list):
  return [pick(x) for x in v if pick(x)]
 if isinstance(v,dict):
  return [pick(x) for x in v.values() if pick(x)]
 return [pick(v)] if pick(v) else []
def day(raw):
 x=pick(raw)
 m=re.search(r"\d{4}-\d{2}-\d{2}",x)
 if m:
  try:return dt.date.fromisoformat(m.group())
  except ValueError:pass
 if re.fullmatch(r"\d{8}",x):
  try:return dt.datetime.strptime(x,"%Y%m%d").date()
  except ValueError:pass
 return None
def req(query,page,limit=250):
 body={"query":query,"fields":FIELDS,"limit":limit,"scope":"ACTIVE","paginationMode":"PAGE_NUMBER","page":page}
 r=urllib.request.Request(ENDPOINT,json.dumps(body).encode("utf-8"),headers={"Accept":"application/json","Content-Type":"application/json","User-Agent":"TCOD-SIMAP-Radar/1.1"},method="POST")
 with urllib.request.urlopen(r,timeout=65) as handle:return json.load(handle)
def fetch_group(query,max_pages=12):
 items=[];total=0;complete=False
 for page in range(1,max_pages+1):
  d=req(query,page)
  arr=d.get("notices") or d.get("results") or []
  if not isinstance(arr,list):raise ValueError("TED notices response is not a list")
  if page==1:total=int(d.get("totalNoticeCount") or 0)
  items.extend(arr)
  print("PAGE",page,"ROWS",len(arr),"TOTAL",total,flush=True)
  if len(arr)<250 or total and len(items)>=total:
   complete=True
   break
 return items,complete,total
def match(title,cpv):
 has_topic=bool(TOPIC.search(title))
 relevant_cpv=any(any(code.startswith(prefix) for prefix in RELEVANT_CPV) for code in cpv)
 if NOT_RELEVANT.search(title):return False
 # Avoid generic construction and unrelated supplies solely mentioning renovations.
 if re.search(r"nabava i ugradnja .*opreme|nabava multimedijalne opreme|opremanje .* opremom",title,re.I) and not relevant_cpv:return False
 return has_topic or relevant_cpv
def description(title,cpv):
 chunks=[]
 for k,v in CPV_NAMES.items():
  if any(code.startswith(k) for code in cpv) and v not in chunks:chunks.append(v)
 if TOPIC.search(title):
  chunks.append("dodatne aktivnosti navedene u izvornom naslovu")
 return ", ".join(chunks[:5]) if chunks else "predmet treba provjeriti u službenom oglasu"
def report(item):
 a=item["authority"] or "nije potvrđen u javnim poljima"
 c=item["country"]
 d=item["deadline"]
 p=item["published"] or "nije naveden"
 cpvs=", ".join(item["cpv"][:5]) or "nije naveden"
 topic=description(item["title_original"],item["cpv"])
 country="Hrvatskoj" if c=="HRV" else "zemlji označenoj kao "+c
 return " ".join([
 f"Službeni naziv ovog natječaja jest „{item['title_original']}”.",
 f"Natječaj je objavljen u službenom europskom sustavu TED i odnosi se na naručitelja u {country}.",
 f"U javnim podacima naveden je naručitelj {a}.",
 f"Identifikacijski broj objave je {item['id']}.",
 f"Datum objave u TED-u naveden je kao {p}.",
 f"Zabilježeni rok za dostavu ponude ili zahtjeva jest {d}; točno vrijeme treba provjeriti u izvornom oglasu.",
 f"CPV klasifikacija ovog postupka uključuje oznake {cpvs}.",
 f"Prema nazivu i klasifikaciji moguće su usluge ili radovi iz područja: {topic}.",
 "Puni tehnički opis i granice pojedinih grupa nabave nisu potvrđeni samim rezultatom pretraživanja.",
 "Na službenoj poveznici treba provjeriti je li postupak podijeljen na lotove i koji se rok odnosi na svaku grupu.",
 "Za Codeling d.o.o. treba provjeriti uvjete stručne sposobnosti, reference, sastav tima i potrebna ovlaštenja.",
 "Potrebno je pregledati financijske uvjete, troškovnik, obvezne izjave i uvjete ugovora.",
 "Status otvorenosti temelji se na trenutno aktivnoj TED objavi s budućim datumom roka, a ne na izravnoj potvrdi naručitelja.",
 "Ovaj hrvatski sažetak je informativan i nije službeni prijevod niti potvrda podobnosti za prijavu."
 ])
def convert(row):
 if not isinstance(row,dict):return None
 typ=pick(row.get("notice-type")).lower()
 if not typ.startswith("cn-"):return None
 rid=pick(row.get("publication-number"))
 title=pick(row.get("notice-title"))
 if not rid or not title:return None
 deadline_items=strings(row.get("deadline-receipt-tender-date-lot")) or strings(row.get("deadline"))
 dd=[z for z in (day(x) for x in deadline_items) if z and z>NOW.date()]
 if not dd:return None
 cpv=list(dict.fromkeys(strings(row.get("classification-cpv"))))
 if not match(title,cpv):return None
 country=pick(row.get("buyer-country"))
 pub=day(row.get("publication-date"))
 link="https://ted.europa.eu/"+("hr" if country=="HRV" else "en")+"/notice/-/detail/"+rid
 result={"id":rid,"source":"TED","title_original":title,"title_hr":title if country=="HRV" else "",
  "authority":pick(row.get("buyer-name")),"country":country,"canton":"",
  "published":pub.isoformat() if pub else "","deadline":min(dd).isoformat(),
  "deadline_kind":"Rok ponude ili sudjelovanja; vrijeme provjeriti u TED-u",
  "deadline_precision":"date","notice_type":typ,"cpv":cpv,"categories":["architecture"] if any(x.startswith(("712","714")) for x in cpv) else [],
  "url":link,"codeling_status":"provjeriti","summary_sentence_minimum":14,
  "summary_kind":"Neslužbeni hrvatski sažetak (14 rečenica), metapodaci TED-a",
  "open_checked_at":NOW.isoformat(timespec="seconds")}
 if country=="HRV":result["source_portal"]="TED + potvrda putem EOJN RH"
 result["summary_hr"]=report(result)
 return result
def main():
 old=json.loads(OUT.read_text("utf-8")) if OUT.exists() else {}
 data={**old,"status":"not_connected","last_success":old.get("last_success"),"last_attempt":NOW.isoformat(timespec="seconds"),
   "window_start":(NOW.date()-dt.timedelta(days=29)).isoformat(),"window_end":NOW.date().isoformat(),
   "geographic_coverage":"TED Europa; Hrvatska zasebno preko TED-a, nacionalni EOJN preko portala",
   "tenders":old.get("tenders",[])}
 seen=set();records=[];errors=[];completeness={}
 queries=[
  ("HRV","buyer-country=HRV AND PD>="+START+" SORT BY publication-date DESC",12),
  ("EU-ARCH","PD>="+START+' AND (FT~"architectural services" OR FT~"conservation of monuments" OR FT~"heritage restoration") SORT BY publication-date DESC',3),
  ("EU-DIGITAL","PD>="+START+' AND (FT~"photogrammetry" OR FT~"graphic design" OR FT~"video production" OR FT~"BIM modelling") SORT BY publication-date DESC',3)
 ]
 for name,query,maxpages in queries:
  try:
   rows,complete,total=fetch_group(query,maxpages)
   completeness[name]={"complete":complete,"reported":total,"scanned":len(rows)}
   for row in rows:
    t=convert(row)
    if t and t["id"] not in seen:
     seen.add(t["id"]);records.append(t)
  except Exception as ex:
   errors.append(name+": "+str(ex)[:180])
 if not completeness:
  data["status"]="degraded";data["error"]="; ".join(errors)[:800]
 else:
  # Collapse repeated TED publication notices with the same buyer, contract title and deadline.
  unique={}
  for row in records:
   key=(re.sub(r"\W+"," ",row["title_original"].casefold()).strip(),row["authority"].casefold())
   previous=unique.get(key)
   if previous is None or (row.get("published",""),row.get("id",""))>(previous.get("published",""),previous.get("id","")):unique[key]=row
  records=list(unique.values())
  data.update({"status":"live" if len(completeness)==3 and all(v["complete"] for v in completeness.values()) and not errors else "partial",
    "last_success":NOW.isoformat(timespec="seconds"),"tenders":sorted(records,key=lambda t:(t["deadline"],t["country"])),
    "source_status":completeness,"errors":errors,
    "croatia_count":sum(t["country"]=="HRV" for t in records),
    "other_eu_count":sum(t["country"]!="HRV" for t in records),
    "notice_hr":"Hrvatska: javne TED objave s potvrđenim budućim datumom roka; nacionalna EOJN objava i prilozi traže zasebnu provjeru. Svijet: TED EU + izravne poveznice na druge portale."})
 OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
 print("WORLD",data["status"],"total",len(data.get("tenders",[])),"HR",data.get("croatia_count"),"errors",errors,flush=True)
 if data["status"]=="degraded":sys.exit(1)
if __name__=="__main__":main()
