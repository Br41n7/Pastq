from pathlib import Path
import re,sys
ROOT=Path(__file__).resolve().parents[2]
patterns=[
('direct full question select',re.compile(r"\.from\(['\"]questions['\"]\)\.select\(['\"]\*['\"]\)",re.I)),
]
found=[]
for p in ROOT.rglob('*'):
    if not p.is_file() or p.suffix not in {'.ts','.tsx','.js','.jsx','.sql'} or any(x in p.parts for x in ('node_modules','.next','.git')): continue
    t=p.read_text(errors='ignore')
    for name,rx in patterns:
        if rx.search(t): found.append((name,str(p.relative_to(ROOT))))
if found:
    print('Potential findings:')
    for x in found: print('-',x)
    sys.exit(1)
print('Static security audit: PASS')
