#!/usr/bin/env python3
"""TED EU (svjetski odjel) — samo dokazive objave s rokom; ostali portali ostaju izravne poveznice."""
import datetime as dt,json,sys,urllib.request,re
from pathlib import Path
from zoneinfo import ZoneInfo
p=Path(__file__).resolve().parents[1]/"docs/data/world.json"
tz=ZoneInfo("Europe/Zurich")
now=dt.datetime.now(tz)
data=json.loads(p.read_text("utf-8"))
q="PD>="+(now.date()-dt.timedelta(days=29)).strftime("%Y%m%d")+' AND (FT~"architecture" OR FT~"heritage" OR FT~"restoration")'
payload={"query":q,"fields":["publication-number","notice-title","buyer-name","buyer-country","publication-date","deadline"],"limit":100,"scope":"ACTIVE","paginationMode":"PAGE_NUMBER","page":1}
request=urllib.request.Request("https://api.ted.europa.eu/v3/notices/search",json.dumps(payload).encode(),headers={"Accept":"application/json","Content-Type":"application/json","User-Agent":"TCOD-Radar/1.0"},method="POST")
try:
 with urllib.request.urlopen(request,timeout=60) as response:found=json.load(response)
 rows=found.get("notices") or found.get("results") or []
 if not isinstance(rows,list):raise ValueError("Unexpected TED response")
 notices=[]
 def value(o):
  if isinstance(o,list):return value(o[0]) if o else ""
  if isinstance(o,dict):return value(next(iter(o.values()),""))
  return str(o or "")
 for v in rows:
  if not isinstance(v,dict):continue
  rid=value(v.get("publication-number"));title=value(v.get("notice-title"))
  rawdate=value(v.get("deadline"))
  try:
   deadline=dt.datetime.fromisoformat(rawdate.replace("Z","+00:00"))
   if deadline.tzinfo is None:deadline=deadline.replace(tzinfo=tz)
   deadline=deadline.astimezone(tz)
  except Exception:continue
  if deadline<=now or not rid or not title:continue
  if not re.search(r"architect|architekt|generalplan|heritage|restaur|conserv|denkmal|monument|museum|fotogram|photogram|laserscan|bim|visual|webdesign|website|graphic.design|videoproduc|animation|design and build|urbanis|sanierung",title,re.I):continue
  org=value(v.get("buyer-name"));country=value(v.get("buyer-country"))
  summary=[
   "Naziv javnog poziva jest „"+title+"”.",
   "Ovaj poziv objavljen je u europskom sustavu TED.",
   "Naručitelj je "+(org or "nije potvrđen")+".",
   "Zemlja naručitelja je "+(country or "nije potvrđena")+".",
   "Broj objave u TED-u je "+rid+".",
   "Datum objave zabilježen je kao "+value(v.get("publication-date"))+".",
   "Rok naveden u rezultatima jest "+deadline.strftime("%d.%m.%Y. %H:%M")+".",
   "Predmet nabave potrebno je detaljno provjeriti u izvornom dokumentu.",
   "Posebno provjeri postoji li više lotova s različitim uvjetima.",
   "Prije prijave provjeri dopuštenost Codelinga kao hrvatskog ponuditelja.",
   "Zatim provjeri reference, ovlaštenja i stručni tim.",
   "Potrebno je pročitati način predaje i natječajne obrasce.",
   "Pojedinačni zahtjevi mogu biti dodatno navedeni u prilozima.",
   "Ovo je neslužbeni hrvatski sažetak za istraživanje, a ne pravna potvrda uvjeta."
  ]
  notices.append({"id":rid,"source":"TED","title_original":title,"authority":org,"country":country,"deadline":deadline.isoformat(),"published":value(v.get("publication-date")),"url":"https://ted.europa.eu/en/notice/-/detail/"+rid,"summary_hr":" ".join(summary),"summary_sentence_minimum":14,"codeling_status":"provjeriti"})
 data.update({"status":"partial","last_success":now.isoformat(),"tenders":notices,"notice_hr":"Automatski preuzeti TED EU oglasi, ograničeni pretragom i prvim rezultatskim stranicama. Ostali portali prikazani su kao izravne poveznice."})
except Exception as err:
 data["status"]="degraded";data["error"]=str(err)[:300];data["last_attempt"]=now.isoformat()
p.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
print("Global source status:",data["status"],"items:",len(data.get("tenders",[])))
if data["status"]=="degraded":sys.exit(1)
