import json, csv, urllib.request, sys
API="https://api.cpicpgx.org/v1"
import subprocess
def get(q): return json.loads(subprocess.run(["curl","-s",API+q],capture_output=True,text=True).stdout)
AV={a['name']:float(a['activityvalue']) for a in get("/allele?genesymbol=eq.CYP2D6&select=name,activityvalue") if a['activityvalue'] and a['activityvalue'].replace('.','',1).isdigit()}
C19={a['name']:a['clinicalfunctionalstatus'] for a in get("/allele?genesymbol=eq.CYP2C19&select=name,clinicalfunctionalstatus")}
def recs(drug,pop):
    out={}
    for r in get(f"/recommendation_view?select=phenotypes,activityscore,drugrecommendation,classification,population&drugname=eq.{drug}"):
        if r['population']!=pop: continue
        key=(r.get('activityscore') or {}).get('CYP2D6') or list(r['phenotypes'].values())[0]
        out[key]=(r['phenotypes'],r['drugrecommendation'],r['classification'])
    return out
R={'codeine':recs('codeine','general'),'tramadol':recs('tramadol','general'),
   'atomoxetine':recs('atomoxetine','adults'),'clopidogrel':recs('clopidogrel','CVI ACS PCI ')}
STRONG={'fluoxetine','paroxetine','bupropion'}; MODERATE={'duloxetine'}
def allele_as(a):
    if 'x' in a:
        base,n=a.split('x'); return AV[base]*int(n)
    return AV[a]
def d6(dip):
    if not dip: return None,'Insufficient data (no CYP2D6 result)'
    try: s=sum(allele_as(a) for a in dip.split('/'))
    except KeyError as e: return None,f'Indeterminate (allele {e} has no CPIC activity value)'
    return s,pheno(s)
def pheno(s):
    return 'Poor Metabolizer' if s==0 else 'Intermediate Metabolizer' if s<1.25 else 'Normal Metabolizer' if s<=2.25 else 'Ultrarapid Metabolizer'
def askey(s):
    k=f"{s:.2f}".rstrip('0'); k=k+'0' if k.endswith('.') else k
    return k if k in ('0.0',) or True else k
def lookup_as(drug,s):
    k=f"{round(s*4)/4:.2f}".rstrip('0');  k=k+'0' if k.endswith('.') else k
    t=R[drug]
    if k in t: return t[k]
    for g in ('≥6.0','≥5.0','≥4.0','≥3.75','≥3.5','≥3.25','≥3.0'):
        if g in t and s>=float(g[1:]): return t[g]
    raise KeyError(k)
def level(txt):
    t=txt.lower()
    if t.startswith('no recommendation'): return 'GREY'
    if t.startswith('avoid'): return 'RED'
    if 'if no response' in t or 'plasma concentration' in t and '40 mg/day and if no' in t: return 'YELLOW'
    if 'if no clinical response and in the absence of adverse events after 2 weeks increase' in t or '40 mg/day and if no clinical response' in t: return 'YELLOW'
    return 'GREEN'
C19P={('Normal function','Normal function'):'Normal Metabolizer',('Increased function','Normal function'):'Rapid Metabolizer',
      ('Increased function','Increased function'):'Ultrarapid Metabolizer',('No function','Normal function'):'Intermediate Metabolizer',
      ('Increased function','No function'):'Intermediate Metabolizer',('No function','No function'):'Poor Metabolizer'}
cases=[
 ('P01','*1/*1',None,['fluoxetine'],'codeine','Demo case 1: genotype says normal, fluoxetine makes them a poor metabolizer'),
 ('P02','*4/*4',None,['fluoxetine'],'codeine','Already PM by genotype; inhibitor adds no further change (alert de-escalation)'),
 ('P03','*1/*1',None,[],'codeine','Control: nothing to flag'),
 ('P04','*4/*4',None,[],'codeine','Genotype-only alert'),
 ('P05','*1x2/*2',None,[],'codeine','UM by duplication: toxicity risk'),
 ('P06','*1x2/*2',None,['paroxetine'],'codeine','UM + strong inhibitor: rule gives AS 0, but CPIC 2023 notes UMs may not phenoconvert with paroxetine; show caveat'),
 ('P07','*1/*41',None,['duloxetine'],'codeine','NM (AS 1.25) + moderate inhibitor -> AS 0.625 IM: genotype alone says green'),
 ('P08','*1/*4',None,[],'codeine','Threshold trap: AS 1.0 is IM under current CPIC (older guidelines called it NM)'),
 ('P09','*1/*10',None,[],'tramadol','Threshold edge: AS 1.25 is NM'),
 ('P10','*4/*10',None,[],'tramadol','IM (AS 0.25)'),
 ('P11','*1/*1',None,['bupropion'],'tramadol','Non-SSRI strong inhibitor'),
 ('P12','*1/*1',None,['fluoxetine (stopped 4 weeks ago)'],'tramadol','Fluoxetine phenoconversion can last 2-3 months after stopping (CPIC atomoxetine 2019): treat as active'),
 ('P13','*1/*1',None,['fluoxetine'],'atomoxetine','Demo case 2: drug builds up. Use PM-equivalent rec; cite atomoxetine label + CPIC atomoxetine narrative'),
 ('P14','*4/*4',None,[],'atomoxetine','PM by genotype: slower titration'),
 ('P15','*1/*4',None,[],'atomoxetine','Trap: phenotype label IM but CPIC atomoxetine rec for AS 1.0 = standard titration. Key atomoxetine rules on AS'),
 ('P16','*1/*1',None,['duloxetine'],'atomoxetine','Moderate inhibitor: CPIC states no adjustment for atomoxetine -> pharmacist review, do not compute'),
 ('P17',None,'*2/*2',[],'clopidogrel','CYP2C19 PM (ACS/PCI)'),
 ('P18',None,'*1/*2',[],'clopidogrel','CYP2C19 IM (ACS/PCI)'),
 ('P19',None,'*1/*17',['omeprazole'],'clopidogrel','RM = standard dose; omeprazole is a label-level interaction (Layer 2), NOT a computed phenoconversion'),
 ('P20','*1/*999',None,[],'codeine','Unsupported allele -> Indeterminate / not assessed'),
 ('P21',None,None,[],'codeine','No CYP2D6 result -> insufficient data'),
]
rows=[]
for pid,dip6,dip19,meds,drug,note in cases:
    r=dict(id=pid,cyp2d6=dip6 or '',cyp2c19=dip19 or '',current_meds=';'.join(meds),new_drug=drug,population='adult' if drug!='clopidogrel' else 'ACS/PCI')
    if drug=='clopidogrel':
        f=[C19[a] for a in dip19.split('/')]
        p=C19P.get(tuple(f)) or C19P.get(tuple(f[::-1]))
        ph,txt,cls=R['clopidogrel'][p]
        r.update(genotype_AS='n/a (CYP2C19 has no activity score)',genotype_phenotype=p,inhibitor='',adjusted_AS='',adjusted_phenotype=p,phenoconverted='no',alert=level(txt),cpic_recommendation=txt,cpic_strength=cls,source='CPIC clopidogrel 2022 (ACS/PCI)')
        if 'omeprazole' in meds: r['extra_flag']='Label interaction: clopidogrel + omeprazole (verify against FDA label). Shown separately from genotype result.'
    else:
        s,p=d6(dip6)
        inh=next((m for m in meds if m.split(' ')[0] in STRONG|MODERATE),'')
        strength='strong' if inh and inh.split(' ')[0] in STRONG else 'moderate' if inh else ''
        r.update(genotype_AS='' if s is None else s,genotype_phenotype=p,inhibitor=f"{inh} ({strength})" if inh else '')
        if s is None:
            r.update(adjusted_AS='',adjusted_phenotype=p,phenoconverted='n/a',alert='GREY',cpic_recommendation='Not assessed. No supported PGx alert can be given.',cpic_strength='',source='')
        else:
            adj=s
            if strength=='strong': adj=0.0
            elif strength=='moderate': adj=s*0.5
            if drug=='atomoxetine' and strength=='moderate':
                r.update(adjusted_AS='not computed',adjusted_phenotype='not computed',phenoconverted='unknown',alert='GREY',
                    cpic_recommendation='Moderate CYP2D6 inhibitor present; no CPIC-stated adjustment for atomoxetine. Refer to pharmacist.',cpic_strength='',source='CPIC atomoxetine 2019 (narrative only)')
            else:
                ph,txt,cls=lookup_as(drug,adj)
                src='CPIC opioids 2021 (phenoconversion rule stated in guideline)' if drug in('codeine','tramadol') else 'CPIC atomoxetine 2019 recs by AS; inhibitor handling per FDA label + CPIC atomoxetine narrative'
                r.update(adjusted_AS=adj,adjusted_phenotype=pheno(adj),phenoconverted='yes' if pheno(adj)!=p else 'no',alert=level(txt),cpic_recommendation=txt,cpic_strength=cls,source=src)
    r['note']=note; r.setdefault('extra_flag','')
    rows.append(r)
cols=list(rows[0].keys()); cols=[c for c in cols if c not in('note','extra_flag')]+['extra_flag','note']
out=sys.argv[1]
with open(out+'.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=cols); w.writeheader(); w.writerows(rows)
json.dump(rows,open(out+'.json','w'),indent=1,ensure_ascii=False)
for r in rows: print(r['id'],r['cyp2d6'] or r['cyp2c19'],r['current_meds'] or '-',r['new_drug'],'|',r['genotype_AS'],r['genotype_phenotype'][:22],'->',r['adjusted_AS'],str(r['adjusted_phenotype'])[:22],'|',r['alert'],'|',r['cpic_recommendation'][:70])
