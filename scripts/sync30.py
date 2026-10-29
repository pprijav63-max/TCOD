#!/usr/bin/env python3
"""TCOD SIMAP: 30 dana, svi kantoni, aktivni rokovi, neslužbeni HR sažeci."""
import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
from heritage_insights import determine, summarize, verified_facts

TZ=ZoneInfo("Europe/Zurich")
API="https://www.simap.ch/api"
TARGET=Path(__file__).resolve().parents[1]/"docs/data/tenders.json"
ALLOWED={"tender","competition","study_contract","participant_selection"}
WINDOW=30
CATEGORIES={
 "heritage":(r"denkmal|restaurier|konserv|kultur(?:erbe|gut)|patrimoine|monument historique|archaeolog|archäolog|musée|museum|beni culturali|restauro|heritage","kulturne baštine, restauracije i konzervacije"),
 "architecture":(r"architekt|architect|generalplan|bauleit|planerleistung|raumplan|urbanis|schulhaus|gebäudesanier|sanierung|construction|progettazion","arhitekture i projektiranja"),
 "scanning":(r"laser.?scan|fotogramm|photogramm|point.?cloud|punktwolke|3d.?scan|digitalisier|relevé 3d","3D skeniranja, fotogrametrije i digitalne dokumentacije"),
 "bim":(r"\b(?:bim|hbim)\b|digital twin|digitaler zwilling|jumeau numérique|building information","BIM/HBIM modeliranja"),
 "graphic":(r"grafik|graphique|design graphique|corporate design|visuell|branding|kommunikationsdesign|communication visuelle|kampagne","grafičkog dizajna i vizualnog identiteta"),
 "web":(r"webseite|webdesign|website|site internet|webauftritt|ux design|ui design|webportal|webentwicklung","web i UX dizajna"),
 "video":(r"videoprodukt|erklärvideo|filmprodukt|animation|animat|audiovisual|visualisierung|visualisation|motion design","videa, animacije i digitalnih prezentacija")
}
PAT={k:re.compile(v[0],re.I) for k,v in CATEGORIES.items()}
SCOPE=[
 (r"restaurier|restauro|restaurat|restoration","restauracija"),
 (r"denkmal|patrimoine|monument historique|heritage|kulturgut","zaštita kulturne baštine"),
 (r"sanierung|rénovation|renovation|risanamento","obnova postojećih građevina"),
 (r"neubau|nouvelle construction|new building","nova gradnja"),
 (r"archäolog|archaeolog|archéolog","arheološka baština"),
 (r"laser.?scan|3d.?scan","lasersko 3D skeniranje"),
 (r"photogramm|fotogramm","fotogrametrija"),
 (r"\bhbim\b","HBIM"),
 (r"\bbim\b","BIM"),
 (r"visualis|visualiz","vizualizacija"),
 (r"animation|animat","animacija"),
 (r"webseite|website|site internet","web dizajn"),
 (r"grafik|graphique|branding|identity","grafički dizajn i identitet"),
 (r"erklärvideo|video","video produkcija"),
 (r"communication|kommunikation|kampagne","komunikacija i kampanje"),
]
def plain(v,size=8000):
 if isinstance(v,dict):
  v=next((v[k] for k in ("de","fr","it","en") if isinstance(v.get(k),str) and v[k]),"")
 v=html.unescape(re.sub(r"<[^>]+>"," ",str(v or "")))
 return re.sub(r"\s+"," ",v).strip()[:size]
def first(*xs):
 for x in xs:
  if x not in ("",None,[],{}):return x
 return ""
def parse(s):
 if not isinstance(s,str) or not s:return None
 try:
  o=dt.datetime.fromisoformat(s.replace("Z","+00:00"))
  if o.tzinfo is None:
   if "T" not in s:o=o.replace(hour=23,minute=59,second=59)
   o=o.replace(tzinfo=TZ)
  return o.astimezone(TZ)
 except ValueError:return None
def fetch(path,params=None):
 u=API+path
 if params:u+="?"+urllib.parse.urlencode(params)
 for i in range(3):
  try:
   req=urllib.request.Request(u,headers={"Accept":"application/json","User-Agent":"TCOD-SIMAP-Radar/1.0 (public notice research)"})
   with urllib.request.urlopen(req,timeout=35) as r:return json.load(r)
  except Exception as ex:
   if i==2:raise RuntimeError("SIMAP API request failed: "+str(ex)) from ex
   time.sleep(2*(i+1))
def search(now):
 begin=(now.date()-dt.timedelta(days=WINDOW-1)).isoformat()
 end=now.date().isoformat()
 params={"newestPublicationFrom":begin,"newestPublicationUntil":end,"lang":"de"}
 results=[];seen=set();cursor=None;complete=True
 for i in range(int(os.environ.get('TCOD_MAX_PAGES','500'))):
  q=dict(params)
  if cursor:q["lastItem"]=cursor
  doc=fetch("/publications/v2/project/project-search",q)
  projects=doc.get("projects",[])
  if not isinstance(projects,list):raise ValueError("Invalid SIMAP projects response")
  for p in projects:
   if isinstance(p,dict) and p.get("id") and p["id"] not in seen:
    seen.add(p["id"]);results.append(p)
  pag=doc.get("pagination") or {}
  new=pag.get("lastItem")
  if not projects or len(projects)<int(pag.get("itemsPerPage",20)):break
  if not new:complete=False;break
  if new==cursor:raise RuntimeError("SIMAP pagination stalled")
  cursor=new
  time.sleep(.15)
 else:complete=False
 return results,complete,begin,end
def dates(detail,now):
 d=detail.get("dates") or {}
 if not isinstance(d,dict):d={}
 pairs=[
  ("Prijava za sudjelovanje",first(d.get("participationDeadline"),d.get("applicationDeadline"),d.get("requestToParticipateDeadline"))),
  ("Registracija",first(d.get("registrationDeadline"),d.get("registerDeadline"))),
  ("Ponuda",d.get("offerDeadline")),
  ("Predaja projekta",first(d.get("submissionDeadline"),d.get("projectSubmissionDeadline")))
 ]
 for obj in (detail.get("competition"),detail.get("participation"),detail.get("procedure")):
  if isinstance(obj,dict):
   for key,label in (("participationDeadline","Prijava za sudjelovanje"),("registrationDeadline","Registracija"),("offerDeadline","Ponuda"),("submissionDeadline","Predaja projekta")):
    pairs.append((label,obj.get(key)))
 valid=[(d,kind) for kind,v in pairs if (d:=parse(v)) and d>=now]
 if not valid:return None,None
 return min(valid,key=lambda x:x[0])
def detail(row,now):
 pid=row.get("id");pub=row.get("publicationId")
 if not pid or not pub:return None
 d=fetch("/publications/v1/project/"+urllib.parse.quote(str(pid))+"/publication-details/"+urllib.parse.quote(str(pub)))
 deadline,kind=dates(d,now)
 if not deadline:return None
 base=d.get("base") or {};proc=d.get("procurement") or {};office=d.get("project-info") or d.get("projectInfo") or {}
 addr=office.get("procOfficeAddress") or {}
 location=row.get("orderAddress") or {}
 title=plain(first(base.get("title"),row.get("title")),400)
 description=plain(first(proc.get("orderDescription"),proc.get("shortDescription"),d.get("description")),6000)
 org=plain(first(row.get("procOfficeName"),office.get("procOfficeName"),addr.get("name")),250)
 canton=str(first(location.get("cantonId"),addr.get("cantonId")))
 city=plain(first(location.get("city"),addr.get("city")),200)
 pubdate=str(first(row.get("publicationDate"),base.get("publicationDate")))[:10]
 txt=title+" "+description
 scores={k:min(36,len(p.findall(title))*12+len(p.findall(description))*2) for k,p in PAT.items()}
 cats=sorted((k for k,v in scores.items() if v),key=lambda x:-scores[x])
 scopes=[label for pat,label in SCOPE if re.search(pat,txt,re.I)]
 scopes=list(dict.fromkeys(scopes))[:6]
 stage=str(row.get("pubType") or "")
 process=str(first(row.get("processType"),base.get("processType")))
 kind_hr={"tender":"postupak javne nabave","competition":"projektni natječaj","participant_selection":"pretkvalifikaciju","study_contract":"studijski zadatak"}.get(stage,"javni postupak")
 summary=(org or "Naručitelj nije potvrđen")+" objavljuje "+kind_hr+" za projekt „"+(title or "naslov nije potvrđen")+"” u mjestu "+(city or "nije navedeno")+", "+(canton or "CH")+". "
 if scopes:summary+="Predmet prema izvornom opisu uključuje: "+", ".join(scopes)+". "
 else:summary+="Nema dovoljno podataka za pouzdan detaljniji opis zahvata. "
 summary+="Sljedeći rok ("+kind.lower()+") je "+deadline.strftime("%d.%m.%Y. u %H:%M")+" po švicarskom vremenu."
 risks=["Provjeriti dokumentaciju, jezik, reference i prihvatljivost ponuditelja iz Hrvatske."]
 if re.search(r"brandschutz|protection incendie|aeai|\bvkf\b",txt,re.I):risks.append("Potreban stručnjak zaštite od požara s prihvaćenim kvalifikacijama.")
 if re.search(r"\bsia\b|schweizer referenz|reg a|reg b",txt,re.I):risks.append("Provjeriti stručna ovlaštenja i lokalne reference.")
 if re.search(r"sitz in der schweiz|siège en suisse|wohnsitz in der schweiz",txt,re.I):risks.append("Provjeriti zahtjev sjedišta u Švicarskoj.")
 status="provjeriti"
 if "invitation" in process.lower() or "freihand" in process.lower():status="otezano"
 oa=office.get("procOfficeAddress") or {}
 email=str(first(oa.get("email"),oa.get("emailAddress"),office.get("email")))
 if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",email):email=""
 return {"id":pid,"publication_id":pub,"project_number":str(row.get("projectNumber") or ""),
 "title_original":title,"title_hr":"","description_original":description,"description_hr":"",
 "authority":org,"canton":canton,"city":city,"published":pubdate,
 "deadline":deadline.isoformat(timespec="seconds"),"deadline_kind":kind,
 "category":cats[0] if cats else "","categories":cats,"score":max(scores.values(),default=0),
 "codeling_status":status,"codeling_reasons":risks,"summary_hr":summary,
 "summary_kind":"Neslužbeni hrvatski sažetak iz metapodataka i opisa",
 "contact":plain(first(oa.get("contactPerson"),office.get("contactPerson")),150),
 "email":email,"documents_present":d.get("hasProjectDocuments"),"procedure":process,"stage":stage,
 "url":"https://www.simap.ch/de/project-detail/"+str(pid)}

def report_hr(t):
 """Sastavi >= 10 rečenica na hrvatskom za svaki oglas.
 Odvoji opis projekta od preporučenih provjera; ne izmišljaj uvjete.
 """
 title=plain(t.get("title_hr") or t.get("title_original"),350).rstrip(".")
 authority=plain(t.get("authority"),200)
 city=plain(t.get("city"),150)
 canton=str(t.get("canton") or "nije naveden")
 pub=plain(t.get("published"),30)
 stage=str(t.get("stage") or "nije potvrđena")
 deadline=str(t.get("deadline") or "")
 kind=str(t.get("deadline_kind") or "rok")
 groups=t.get("categories") or []
 scope=[]
 txt=plain(t.get("title_original"),400)+" "+plain(t.get("description_original"),5000)
 for rx,label in SCOPE:
  if re.search(rx,txt,re.I) and label not in scope:scope.append(label)
 cats={"heritage":"zaštita kulturne baštine","architecture":"arhitektonsko projektiranje","scanning":"3D skeniranje i fotogrametrija","bim":"BIM/HBIM","graphic":"grafički dizajn i komunikacije","web":"web i UX dizajn","video":"video i animacija"}
 sentences=[
 "Projekt se u objavi vodi pod nazivom „"+(title or "naziv nije potvrđen")+"”.",
 ("Kao naručitelj naveden je "+authority+"." if authority else "Naručitelj nije potvrđen u dostupnim javnim podacima."),
 ("Mjesto provedbe je "+city+" u kantonu ili području "+canton+"." if city else "Točno mjesto provedbe nije potvrđeno u dostupnom prikazu."),
 ("Zabilježeni datum javne objave jest "+pub+"." if pub else "Datum izvorne objave treba provjeriti na SIMAP-u."),
 ("Prepoznate aktivnosti u predmetu nabave uključuju "+", ".join(scope[:5])+"." if scope else "Iz dostupnog naslova i opisa nije moguće pouzdano izdvojiti sve planirane usluge ili zahvate."),
 ("Natječaj se sadržajno povezuje s područjima: "+", ".join(cats.get(x,x) for x in groups[:4])+"." if groups else "U sadržaju natječaja nije potvrđena usklađenost s užim područjima rada Codelinga."),
 ("Oznaka postupka u dostupnim metapodacima glasi „"+stage+"”." if stage else "Vrstu postupka potrebno je provjeriti u službenom oglasu."),
 ("Sljedeći zabilježeni termin za „"+kind+"” jest "+deadline+" prema švicarskom vremenu." if deadline else "Točan rok prijave ili ponude nije potvrđen."),
 ("Objava označava postojanje projektne dokumentacije." if t.get("documents_present") is True else "Prisutnost preuzimljive natječajne dokumentacije nije potvrđena u javnim metapodacima."),
 "Za pristup dokumentaciji na SIMAP-u u pravilu je potrebno prijaviti se u svoj račun ponuditelja, odabrati tvrtku i registrirati interes.",
 ("Status moguće prijave za Codeling d.o.o. trenutačno je „"+str(t.get("codeling_status") or "provjeriti")+"”; to nije službena pravna ocjena."),
 "Prije odluke o ponudi treba provjeriti reference tvrtke, ključne stručnjake, tražena ovlaštenja i osiguranje profesionalne odgovornosti.",
 "U originalnoj dokumentaciji treba pročitati kriterije sposobnosti i dodjele, način predaje, obrasce, cijene, valutu, potpise te pitanja i odgovore naručitelja.",
 "Mjerodavni su isključivo službeni SIMAP oglas i njegovi prilozi, a ovaj tekst je neslužbeni hrvatski istraživački sažetak."
 ]
 # Uključi sadržajniji prevedeni opis, ako je DeepL aktiviran; bez izmišljanja.
 translated=plain(t.get("description_hr"),2000)
 if translated:
  parts=[v.strip() for v in re.split(r"(?<=[.!?])\s+",translated) if len(v.strip())>28]
  if parts:
   rich=[]
   for p in parts[:3]:
    p=p.rstrip(" .!?")
    if p:rich.append("Prevedeni izvorni opis navodi: "+p+".")
   sentences[5:5]=rich
 return " ".join(sentences)

def translate(rows):
 key=os.environ.get("DEEPL_API_KEY","").strip()
 if not key:return
 host="https://api-free.deepl.com/v2/translate" if key.endswith(":fx") else "https://api.deepl.com/v2/translate"
 done=0
 for t in sorted(rows,key=lambda x:x.get("score",0),reverse=True):
  if done>=75:break
  if not t["categories"] or not t["description_original"]:continue
  form=urllib.parse.urlencode([("target_lang","HR"),("text",t["title_original"]),("text",t["description_original"][:3000])]).encode()
  req=urllib.request.Request(host,data=form,headers={"Authorization":"DeepL-Auth-Key "+key,"Content-Type":"application/x-www-form-urlencoded"},method="POST")
  try:
   with urllib.request.urlopen(req,timeout=30) as r:res=json.load(r)
   xx=res.get("translations",[])
   if len(xx)!=2:break
   t["title_hr"]=xx[0]["text"];t["description_hr"]=xx[1]["text"]
   sentences=re.split(r"(?<=[.!?])\s+",t["description_hr"])
   t["summary_hr"]=" ".join(sentences[:3])[:650]
   t["summary_kind"]="Neslužbeni strojni prijevod izvornog opisa na hrvatski"
   done+=1
  except Exception as ex:
   print("DeepL disabled after error: "+str(ex)[:120],file=sys.stderr);break
def main():
 now=dt.datetime.now(TZ)
 old={}
 if TARGET.exists():
  try:old=json.loads(TARGET.read_text("utf-8"))
  except (OSError,ValueError):pass
 try:
  projects,complete,begin,end=search(now)
  projects=[p for p in projects if p.get("pubType") in ALLOWED and p.get("publicationId")]
  if now.hour<8:
   projects=[p for p in projects if str(p.get("publicationDate"))[:10]!=end]
  failed=0;out=[];limit=int(os.environ.get('TCOD_MAX_DETAILS','3000'))
  capped=len(projects)>limit
  for i,row in enumerate(projects[:limit]):
   try:
    t=detail(row,now)
    if t:out.append(t)
   except Exception as ex:
    failed+=1
    if failed<6:print("Detail failed:",ex,file=sys.stderr)
   if i%40==0:print("Processed",i+1,"/",min(len(projects),limit),flush=True)
   time.sleep(.32)
  if projects and failed==len(projects[:limit]):raise RuntimeError("All SIMAP detail requests failed")
  if len(projects)>=30 and not out:raise RuntimeError("Suspicious zero future deadlines, check API schema")
  translate(out)
  for t in out:
   t["source"]="SIMAP"
   t["country"]="Švicarska"
   t["description_source"]="Službeni SIMAP oglas — izvorni opis predmeta nabave"
   t["description_level"]="full_notice" if len(t.get("description_original") or "")>35 else "title_only"
   t.update(determine(t))
   t["confirmed_facts_hr"]=verified_facts(t)
   t["unesco_status"]="not_verified"
   t["summary_hr"]=summarize(t)
   t["summary_sentence_minimum"]=None
   t["summary_kind"]="HR tumačenje vrste intervencije iz službenog SIMAP opisa"
   t["summary_evidence_level"]=t["description_level"]
  out.sort(key=lambda t:(t["deadline"],-t["score"]))
  result={"schema_version":6,"status":"live" if complete and failed==0 and not capped else "partial",
    "source":"official simap.ch public API","last_success":now.isoformat(timespec="seconds"),
    "window_start":begin,"window_end":end,"window_days":WINDOW,"coverage":"whole_ch_no_canton_filter",
    "published_projects_found":len(projects),"tender_rows_processed":min(len(projects),limit),
    "details_failed":failed,"pagination_complete":complete,"detail_limit_reached":capped,
    "tenders":out,"disclaimer":"Dies ist keine amtliche Veröffentlichung. Massgebend sind die auf der Plattform www.simap.ch veröffentlichten Daten."}
  TARGET.parent.mkdir(parents=True,exist_ok=True)
  temp=TARGET.with_suffix(".tmp")
  temp.write_text(json.dumps(result,ensure_ascii=False),encoding="utf-8")
  temp.replace(TARGET)
  print("Success; open:",len(out),"relevant:",sum(bool(x["categories"]) for x in out))
 except Exception as ex:
  print("SIMAP ERROR:",ex,file=sys.stderr)
  if old.get("last_success"):
   old["status"]="degraded";old["last_attempt"]=now.isoformat(timespec="seconds")
   old["error"]=str(ex)[:250]
   TARGET.write_text(json.dumps(old,ensure_ascii=False),encoding="utf-8")
  sys.exit(1)
if __name__=="__main__":main()
