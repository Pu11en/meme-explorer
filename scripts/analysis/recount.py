#!/usr/bin/env python3
"""Independent source recount; no production analyzer helpers are imported."""
import argparse,json,hashlib,collections,datetime,pathlib
p=argparse.ArgumentParser();p.add_argument('--data-root',required=True);p.add_argument('--result',required=True);p.add_argument('--output',required=True);a=p.parse_args()
data=pathlib.Path(a.data_root);result=json.load(open(a.result));rows=result['rows']
def timestamp(s):
 if not s:return None
 try:return round(datetime.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()*1000)
 except (ValueError,TypeError):return None
def first(d,names):
 return next((d[k] for k in names if isinstance(d.get(k),str) and d[k]),None)
def action(d):return ''.join(c for c in (first(d,['action','txType','tx_type','type']) or '').lower() if c.isalnum()).replace('createtoken','create')
# Deliberate stratification selects edge cases before filling the deterministic sample.
selected={}
for predicate in [lambda r:r['observation_status']!='complete',lambda r:r['buy_count']==0,lambda r:r['missing_wallet_buys']>0,lambda r:(r['repeat_buy_count'] or 0)>0,lambda r:(r['unique_buyers'] or 0)>=5]:
 for r in rows:
  if predicate(r):selected[r['observation_id']]=r;break
for r in rows:
 if len(selected)>=10:break
 selected[r['observation_id']]=r
expected={key:{'events':{},'creation':None,'refs':[]} for key in selected};venues=collections.Counter();creates=set();manifest_coverage={}
for rid in result['batch']['run_ids']:
 root=data/'runs'/rid;m=json.load(open(root/'manifest.json'));manifest_coverage[rid]={'start':m['started_at'],'end':min(m['stopped_at'],m['stops_at'])}
 for path in sorted((root/'raw').glob('pumpapi-*.ndjson')):
  with open(path) as f:
   for lineno,line in enumerate(f,1):
    if not line.strip():continue
    raw=json.loads(line);payload=json.loads(raw['payload_raw']);mint=first(payload,['mint','tokenAddress','token_address']);act=action(payload);at=timestamp(raw.get('source_at'))
    if act=='create':
     venue=str(payload.get('pool','unknown')).lower();key=(rid,mint,venue)
     if key not in creates:creates.add(key);venues[venue]+=1
    # JSON observation keys in the TS contract contain no whitespace.
    key=json.dumps([rid,mint],separators=(',',':'));row=selected.get(key)
    if row is None:continue
    state=expected[key]
    if act=='create' and payload.get('pool','').lower()=='pump':state['creation']=at
    items=next((payload[k] for k in ['breakdown','breakdowns','events','actions'] if isinstance(payload.get(k),list) and payload[k]),[payload])
    for index,item in enumerate(items):
     if (action(item) or act)!='buy':continue
     created=timestamp(row['created_at'])
     if at is None or created is None or not 0<=at-created<60000:continue
     sig=first(item,['signature','txSignature','transactionSignature']) or first(payload,['signature','txSignature','transactionSignature']) or raw.get('event_id')
     disc=next((item[k] for k in ['instructionIndex','instruction_index','eventIndex','event_index'] if k in item),payload.get('instructionIndex',payload.get('instruction_index',index)))
     event=(sig,str(disc));wallet=first(item,['trader','signer','user','txSigner']) or first(payload,['trader','signer','user','txSigner'])
     value=(at-created,wallet)
     if event in state['events']:assert state['events'][event]==value
     else:state['events'][event]=value;state['refs'].append({'file':str(path.relative_to(data)),'line':lineno,'item_index':index})
checks=[];discrepancies=[]
for key,row in selected.items():
 state=expected[key];buys=[0]*60;earliest={};missing=0
 for offset,wallet in state['events'].values():
  buys[offset//1000]+=1
  if wallet is None:missing+=1
  else:earliest[wallet]=min(offset,earliest.get(wallet,60000))
 arrivals=[0]*60
 for offset in earliest.values():arrivals[offset//1000]+=1
 values={'buy_count':sum(buys),'buy_bars':buys,'buy_buckets':[sum(buys[i:i+10]) for i in range(0,60,10)],'missing_wallet_buys':missing,'known_unique_buyers':len(earliest)}
 if missing==0:values.update(unique_buyers=len(earliest),repeat_buy_count=sum(buys)-len(earliest),arrival_bars=arrivals,arrival_buckets=[sum(arrivals[i:i+10]) for i in range(0,60,10)])
 if row['observation_status']=='complete':
  for field,value in values.items():
   if row[field]!=value:discrepancies.append({'observation_id':key,'field':field,'expected':value,'actual':row[field]})
 else:
  end=timestamp(manifest_coverage[row['run_id']]['end']);created=state['creation']
  if created is not None and created+60000>end:assert 'recording_ended_early' in row['reasons']
  assert row['buy_count'] is None
 checks.append({'observation_id':key,'status':row['observation_status'],'expected':values,'source_refs':state['refs']})
report={'schema':'pump.independent-recount/1','source_feature_hash':result['content_hash'],'sample_size':len(checks),'discrepancies':discrepancies,'creation_venues':dict(venues),'manifest_coverage':manifest_coverage,'checks':checks}
pathlib.Path(a.output).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['checks','manifest_coverage']}))
assert not discrepancies
