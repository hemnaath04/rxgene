import json, csv, pathlib, sys
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
_INH=json.loads((pathlib.Path(__file__).resolve().parent.parent/'data'/'inhibitors.json').read_text())['CYP2D6']
STRONG=set(_INH['strong']); MODERATE=set(_INH['moderate']); WEAK=set(_INH['weak'])
# Alert levels are curated by a person in data/alert_levels.json; never inferred from the recommendation text.
LEVELS=json.loads((pathlib.Path(__file__).resolve().parent.parent/'data'/'alert_levels.json').read_text())
def alert_for(drug,pop,key): return LEVELS[drug][pop.strip()][key]['alertLevel']
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
    if k in t: return t[k]+(k,)
    for g in ('≥6.0','≥5.0','≥4.0','≥3.75','≥3.5','≥3.25','≥3.0'):
        if g in t and s>=float(g[1:]): return t[g]+(g,)
    raise KeyError(k)
def lookup_pheno(drug,ph):
    # codeine and tramadol: one recommendation per phenotype, so look up by phenotype, never by an exact score key.
    for phenos,txt,cls in R[drug].values():
        if list(phenos.values())[0]==ph: return phenos,txt,cls
    raise KeyError(ph)
C19P={('Normal function','Normal function'):'Normal Metabolizer',('Increased function','Normal function'):'Rapid Metabolizer',
      ('Increased function','Increased function'):'Ultrarapid Metabolizer',('No function','Normal function'):'Intermediate Metabolizer',
      ('Increased function','No function'):'Intermediate Metabolizer',('No function','No function'):'Poor Metabolizer'}
# Approved GREY labels: three separate states, none sharing wording with the GREEN "No supported PGx alert (not the same as safe)".
GREY_TEXT={
 'Indeterminate':'Indeterminate: this gene result includes a variant we cannot interpret, so no pharmacogenomic check was done for this drug. Ask a pharmacist.',
 'Insufficient data':'Insufficient data: there is no CYP2D6 result on file, so no pharmacogenomic check was done for this drug.',
 'Not assessed':'Not assessed: a moderate CYP2D6 inhibitor is present and CPIC states no adjustment for atomoxetine, so RxGene does not compute this. Pharmacist review needed.',
}
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
 ('P12','*1/*1',None,['codeine'],'fluoxetine','Reverse case: adding the inhibitor re-alerts the codeine already on the list'),
 ('P13','*1/*1',None,['fluoxetine'],'atomoxetine','Demo case 2: drug builds up. Use PM-equivalent rec; cite atomoxetine label + CPIC atomoxetine narrative'),
 ('P14','*4/*4',None,[],'atomoxetine','PM by genotype: slower titration'),
 ('P15','*1/*4',None,[],'atomoxetine','Trap: phenotype label IM but CPIC atomoxetine rec for AS 1.0 = standard titration. Key atomoxetine rules on AS'),
 ('P16','*1/*1',None,['duloxetine'],'atomoxetine','Moderate inhibitor: CPIC states no adjustment for atomoxetine -> pharmacist review, do not compute'),
 ('P17',None,'*2/*2',[],'clopidogrel','CYP2C19 PM (ACS/PCI)'),
 ('P18',None,'*1/*2',[],'clopidogrel','CYP2C19 IM (ACS/PCI)'),
 ('P19',None,'*1/*17',['omeprazole'],'clopidogrel','RM = standard dose; omeprazole is a label-level interaction (Layer 2), NOT a computed phenoconversion'),
 ('P20','*1/*999',None,[],'codeine','Unsupported allele -> Indeterminate / not assessed'),
 ('P21',None,None,[],'codeine','No CYP2D6 result -> insufficient data'),
 ('P22','*1/*1',None,['sertraline'],'codeine','Weak inhibitor (FDA): no activity-score adjustment'),
 ('P23','*10/*10',None,[],'atomoxetine','Discriminates the *10 value: current 0.25 gives AS 0.5 (titration row, YELLOW); the old 0.5 would give AS 1.0 (standard-titration row, GREEN). Phenotype label is IM either way'),
]
rows=[]
for pid,dip6,dip19,meds,drug,note in cases:
    added=drug; orig_meds=list(meds)
    if drug in STRONG|MODERATE and any(m in R for m in meds):
        target=next(m for m in meds if m in R); meds=[m for m in meds if m!=target]+[drug]; drug=target
    r=dict(id=pid,cyp2d6=dip6 or '',cyp2c19=dip19 or '',current_meds=';'.join(orig_meds),new_drug=added,alerted_drug=drug,population='adult' if drug!='clopidogrel' else 'ACS/PCI')
    if drug=='clopidogrel':
        f=[C19[a] for a in dip19.split('/')]
        p=C19P.get(tuple(f)) or C19P.get(tuple(f[::-1]))
        ph,txt,cls=R['clopidogrel'][p]
        r.update(genotype_AS='n/a (CYP2C19 has no activity score)',genotype_phenotype=p,inhibitor='',adjusted_AS='',adjusted_phenotype=p,phenoconverted='no',alert=alert_for('clopidogrel','CVI ACS PCI ',p),cpic_recommendation=txt,cpic_strength=cls,source='CPIC clopidogrel 2022 (ACS/PCI)')
        if 'omeprazole' in meds: r['extra_flag']='Label interaction: clopidogrel + omeprazole (verify against FDA label). Shown separately from genotype result.'
    else:
        s,p=d6(dip6)
        inh=next((m for m in meds if m.split(' ')[0] in STRONG|MODERATE),'')
        strength='strong' if inh and inh.split(' ')[0] in STRONG else 'moderate' if inh else ''
        r.update(genotype_AS='' if s is None else s,genotype_phenotype=p,inhibitor=f"{inh} ({strength})" if inh else '')
        if s is None:
            r.update(adjusted_AS='',adjusted_phenotype=p,phenoconverted='n/a',alert='GREY',cpic_recommendation=GREY_TEXT['Indeterminate'] if p.startswith('Indeterminate') else GREY_TEXT['Insufficient data'],cpic_strength='',source='')
        else:
            adj=s
            if strength=='strong': adj=0.0
            elif strength=='moderate': adj=s*0.5
            if drug=='atomoxetine' and strength=='moderate':
                r.update(adjusted_AS='not computed',adjusted_phenotype='not computed',phenoconverted='unknown',alert='GREY',
                    cpic_recommendation=GREY_TEXT['Not assessed'],cpic_strength='',source='CPIC atomoxetine 2019 (narrative only)')
            else:
                if drug in('codeine','tramadol'):
                    ph,txt,cls=lookup_pheno(drug,pheno(adj)); akey=pheno(adj); pop='general'
                else:
                    ph,txt,cls,akey=lookup_as(drug,adj); pop='adults'
                src='CPIC opioids 2021 (phenoconversion rule stated in guideline)' if drug in('codeine','tramadol') else 'CPIC atomoxetine 2019 recs by AS; inhibitor handling per FDA label + CPIC atomoxetine narrative'
                r.update(adjusted_AS=adj,adjusted_phenotype=pheno(adj),phenoconverted='yes' if pheno(adj)!=p else 'no',alert=alert_for(drug,pop,akey),cpic_recommendation=txt,cpic_strength=cls,source=src)
                if strength=='strong' and p=='Ultrarapid Metabolizer':
                    r['confidence']='reduced (UMs may not fully phenoconvert, CPIC 2023)'
                    if drug in('codeine','tramadol'):
                        # Show both: the converted recommendation and the genotype one, since the conversion may be incomplete.
                        r['genotype_recommendation']=lookup_pheno(drug,p)[1]
                        r['inhibitor_note']=f"Caveat: CPIC 2023 notes ultrarapid metabolizers may not phenoconvert with {inh.split(' ')[0]}. Both recommendations are shown (converted and genotype); both say avoid {drug}."
                if drug=='atomoxetine' and strength=='strong':
                    # Label-based handling, not the opioid x0 rule: FDA STRATTERA label section 2.5 treats a strong CYP2D6 inhibitor like a poor metabolizer (4-week titration interval).
                    r.update(adjusted_AS='n/a (label-based, no score computed)',adjusted_phenotype='Poor-metabolizer-equivalent dosing (FDA label)',phenoconverted='yes' if p!='Poor Metabolizer' else 'no',
                             source='FDA STRATTERA label section 2.5 (strong CYP2D6 inhibitor handled like a poor metabolizer); CPIC atomoxetine 2019 poor-metabolizer text')
                    # Lead with the FDA label (it directly addresses strong-inhibitor coadministration); CPIC 2019 PM text is supporting genotype-based context only.
                    r['label_recommendation']='FDA STRATTERA label, section 2.5 (adult, concomitant strong CYP2D6 inhibitor): "a longer titration interval of 4 weeks is recommended", "if ADHD symptoms fail to improve and the initial STRATTERA dosage is well tolerated". Starting, target and maximum dosages are the same as the label\'s standard adult table (40 mg/day start, 80 mg/day target, 100 mg/day maximum).'
                    r['cpic_role']='Supporting genotype-based context only (CPIC 2019 poor-metabolizer guidance); not an equally applicable dosing instruction for inhibitor-induced phenoconversion.'
                    r['discrepancy_flag']='Different guidance contexts: FDA labeling directly addresses strong CYP2D6 inhibitor coadministration and recommends a 4-week titration interval. CPIC 2019 provides genotype-based poor-metabolizer guidance with a 2-week response assessment. These recommendations should not be treated as interchangeable.'
                    r['source_links']='FDA STRATTERA label, DailyMed set id 309de576-c318-404a-bc15-660c2b1876fb, version 69 (2026-07-23): https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=309de576-c318-404a-bc15-660c2b1876fb | CPIC atomoxetine guideline 2019 (Brown et al.): https://pmc.ncbi.nlm.nih.gov/articles/PMC6612570/'
                if inh and s==0 and drug!='atomoxetine': r['inhibitor_note']=f"{inh.split(' ')[0]} adds no further effect: already a poor metabolizer by genotype. The drug-level alert still applies."
                if not strength and any(m in WEAK for m in meds): r['inhibitor_note']='Weak CYP2D6 inhibitor present: no activity-score adjustment (CPIC adjusts strong and moderate only).'
    if drug in ('codeine','tramadol') and not orig_meds and r.get('genotype_AS')!='':
        # Genotype-only case (no medications, so no inhibitor): cite the phenotype recommendation, not the phenoconversion rule.
        r['source']=f"CPIC opioid guideline 2021, CYP2D6 {r['genotype_phenotype'].lower().replace(' metabolizer','-metabolizer')} {drug} recommendation."
    r['note']=note; r.setdefault('extra_flag',''); r.setdefault('confidence','standard'); r.setdefault('inhibitor_note','')
    rows.append(r)
cols=list(dict.fromkeys(k for r in rows for k in r)); cols=[c for c in cols if c not in('note','extra_flag')]+['extra_flag','note']
out=sys.argv[1]
with open(out+'.csv','w',newline='') as f:
    w=csv.DictWriter(f,fieldnames=cols); w.writeheader(); w.writerows(rows)
json.dump(rows,open(out+'.json','w'),indent=1,ensure_ascii=False)
for r in rows: print(r['id'],r['cyp2d6'] or r['cyp2c19'],r['current_meds'] or '-',r['new_drug'],'|',r['genotype_AS'],r['genotype_phenotype'][:22],'->',r['adjusted_AS'],str(r['adjusted_phenotype'])[:22],'|',r['alert'],'|',r['cpic_recommendation'][:70])
