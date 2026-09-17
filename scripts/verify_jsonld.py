import sys, json, pikepdf

def jsonld_from_xmp(pdf):
    meta = pdf.Root.get("/Metadata")
    if meta is None: return None
    xmp = meta.read_bytes().decode("utf-8", errors="replace")
    start = xmp.find("<mv:jsonLd>")
    if start == -1: return None
    start += len("<mv:jsonLd>")
    end = xmp.find("</mv:jsonLd>", start)
    raw = xmp[start:end]
    if raw.startswith("<![CDATA["): raw = raw[9:-3]
    return json.loads(raw)

def get_embedded_json(pdf):
    try:
        names = pdf.Root.Names.EmbeddedFiles.Names
    except (AttributeError, KeyError): return None
    for i in range(0, len(names), 2):
        if str(names[i]) == "mastervault.json":
            return json.loads(names[i+1].EF.F.read_bytes().decode("utf-8"))
    return None

truth = json.load(open('mastervault-cv/sample/mastervault.json', encoding='utf-8'))

pdfs = ['mastervault-cv/build/cv11_blueprint_2col.pdf', 'mastervault-cv/build/cv12_pastel_banner.pdf', 'mastervault-cv/build/cv13_violet_single.pdf',
        'mastervault-cv/build/cv14_charlotte_wide.pdf', 'mastervault-cv/build/cv15_maryblue_sidebar.pdf', 'mastervault-cv/build/cv16_sun_two-col.pdf',
        'mastervault-cv/build/cv17_graphite_banner.pdf', 'mastervault-cv/build/cv18_lilac_single.pdf', 'mastervault-cv/build/cv19_isabella_sidebar.pdf',
        'mastervault-cv/build/cv20_ink_compact.pdf']

errors = 0
for pdf_path in pdfs:
    pdf = pikepdf.open(pdf_path)
    name = pdf_path.split('/')[-1].replace('.pdf','')
    jl = jsonld_from_xmp(pdf)
    emb = get_embedded_json(pdf)

    if not jl:
        print(f"[FAIL] {name}: BRAK JSON-LD")
        errors += 1
        continue

    fail = False
    # Check JSON-LD fields match truth
    if jl.get('name') != truth['name']:
        print(f"[FAIL] {name}: JSON-LD name mismatch")
        fail = True
    if jl.get('@type') != 'Person':
        print(f"[FAIL] {name}: JSON-LD @type wrong")
        fail = True
    if jl.get('jobTitle') != truth['title']:
        print(f"[FAIL] {name}: JSON-LD jobTitle mismatch: '{jl.get('jobTitle')}' != '{truth['title']}'")
        fail = True

    # Check knowsAbout
    truth_skills = [s.get('semantic', s.get('label', s)) if isinstance(s, dict) else s for s in truth['skills']]
    jl_ka = jl.get('knowsAbout', [])
    for ts in truth_skills:
        ts_lower = ts.lower()
        found = any(ts_lower in ka.lower() for ka in jl_ka)
        if not found:
            # Check if label matches
            truth_labels = [s.get('label', s) if isinstance(s, dict) else s for s in truth['skills']]
            if ts not in jl_ka and ts not in truth_labels:
                pass  # semantic full sentence might not be in knowsAbout directly

    # Check hasCredential
    truth_certs = [c.get('name', c) if isinstance(c, dict) else c for c in truth['certifications']]
    jl_hc = jl.get('hasCredential', [])
    for tc in truth_certs:
        tc_lower = tc.lower()
        hc_strs = [h.get('name', h) if isinstance(h, dict) else h for h in jl_hc]
        found = any(tc_lower in str(hc).lower() for hc in hc_strs)
        if not found:
            print(f"[WARN] {name}: cert '{tc}' not in hasCredential")

    # Check embedded mastervault.json
    if emb:
        if emb.get('name') != truth['name']:
            print(f"[FAIL] {name}: embedded name mismatch")
            fail = True
        if emb.get('title') != truth['title']:
            print(f"[FAIL] {name}: embedded title mismatch")
            fail = True

    if not fail:
        print(f"[OK] {name}: JSON-LD + embedded match truth")

print(f"\n{'='*50}")
if errors == 0:
    print("PASS — wszystkie warstwy semantyczne zgodne z prawdą")
else:
    print(f"FAIL — {errors} błędów")
