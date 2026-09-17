import os
from pdfminer.high_level import extract_text
import pikepdf, io

pdfs = ['cv11_blueprint_2col.pdf', 'cv12_pastel_banner.pdf', 'cv13_violet_single.pdf',
        'cv14_charlotte_wide.pdf', 'cv15_maryblue_sidebar.pdf', 'cv16_sun_two-col.pdf',
        'cv17_graphite_banner.pdf', 'cv18_lilac_single.pdf', 'cv19_isabella_sidebar.pdf',
        'cv20_ink_compact.pdf']

for p in pdfs:
    pdf = pikepdf.open(os.path.join('build', p))
    buf = io.BytesIO()
    pdf.save(buf)
    buf.seek(0)
    text = extract_text(buf)
    name = p.replace('.pdf', '')
    with open(f'/tmp/{name}.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    print(f'{name}: {len(text)} chars')
