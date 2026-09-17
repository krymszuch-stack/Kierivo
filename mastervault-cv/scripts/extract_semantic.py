import sys
sys.path.insert(0, r'C:\Users\Adrian\Desktop\Projekty\kierivo\mastervault-cv')
from mvcv.tools.verify import actual_text_entries, jsonld_from_xmp
import pikepdf, os

pdf_path = sys.argv[1] if len(sys.argv) > 1 else 'build/cv11_blueprint_2col.pdf'
out_path = sys.argv[2] if len(sys.argv) > 2 else '/tmp/cv_readable.txt'

pdf = pikepdf.open(pdf_path)
entries = actual_text_entries(pdf)

lines = []
for e in entries:
    s = e['struct'].lstrip('/')
    a = e['actual']
    if s in ('H1', 'H2', 'H3'):
        lines.append(f'\n=== {a} ===\n')
    elif s == 'P':
        lines.append(f'{a}\n')
    elif s == 'LI':
        lines.append(f'- {a}\n')
    elif s == 'Figure':
        lines.append(f'{a}\n')
    elif s == 'Span':
        lines.append(f'{a}\n')
    elif s == 'Caption':
        lines.append(f'{a}\n')

text = '\n'.join(lines)
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(text)
print(f'{len(entries)} entries, {len(text)} chars -> {out_path}')
