#!/usr/bin/env python3
"""Independent default-predicate oracle across every saved feature row."""
import argparse,json,pathlib,fractions
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--output',required=True);a=p.parse_args();root=pathlib.Path(a.root);features=json.load(open(root/'features.json'))
checks=[]
for fid in ['observable-launches','minimum-buy-activity','buyer-diversity','repeat-buyer-concentration','launch-activity-shape','new-buyer-arrival-rate']:
 cohort=json.load(open(root/(fid+'.json')));expected={}
 for row in features['rows']:
  b=row['buy_count'];u=row['unique_buyers']
  if fid=='observable-launches':value=row['observation_status']=='complete'
  elif fid=='minimum-buy-activity':value=None if b is None else b>=10
  elif fid=='buyer-diversity':value=None if u is None else u>=5
  elif fid=='repeat-buyer-concentration':value=None if b in (None,0) or u is None else fractions.Fraction(b-u,b)>=fractions.Fraction(1,2)
  else:
   series=row['buy_bars'] if fid=='launch-activity-shape' else row['arrival_bars']
   value=None if series is None else all(sum(series[i:i+10])>=1 for i in range(0,60,10))
  expected[row['observation_id']]='unobservable' if value is None else 'member' if value else 'rejected'
 actual={d['observation_id']:d['status'] for d in cohort['decisions']};assert len(actual)==len(cohort['decisions']);assert actual==expected,fid
 counts={status:sum(v==status for v in expected.values()) for status in ['member','rejected','unobservable']}
 assert cohort['summary']['members']==counts['member'];assert cohort['summary']['rejected']==counts['rejected'];assert cohort['summary']['unobservable']==counts['unobservable'];assert sum(counts.values())==len(features['rows'])
 checks.append({'filter_id':fid,'definition_hash':cohort['definition_hash'],'decisions_verified':len(expected),'counts':counts})
report={'passed':True,'source_feature_hash':features['content_hash'],'decisions_verified':sum(c['decisions_verified'] for c in checks),'filters':checks}
pathlib.Path(a.output).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'passed':True,'decisions_verified':report['decisions_verified']}))
