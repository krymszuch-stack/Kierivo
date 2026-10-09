import asyncio
from datetime import datetime, timezone
import json
import os
import atexit
import subprocess
import urllib.request
import urllib.parse
from pathlib import Path
from playwright.async_api import async_playwright

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:3045")
OUT = Path(os.environ.get("EVIDENCE_DIR", "docs/evidence/consistency-renderer-review-2026-10-08"))

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    repo = Path(__file__).resolve().parent.parent
    # Osobny plik tylko na czas próby: stary konsument z niezmienionego commitu.
    # Nie cofamy plików roboczych i nie podstawiamy atrapy komponentu.
    baseline_ref = os.environ.get("BASELINE_REF", "06064b33a786dd54dd50ef1548ccbf47838cab0a")
    baseline_file = repo / "src/features/consistency/ReleaseBaselineConsistencyGuardView.tsx"
    if baseline_file.exists():
        raise RuntimeError("Plik dowodu już istnieje; nie nadpisujemy cudzej pracy")
    result = subprocess.run(["git", "show", f"{baseline_ref}:src/features/consistency/ConsistencyGuardView.tsx"],
                            cwd=repo, capture_output=True, text=True, check=True)
    baseline_file.write_text(result.stdout)
    atexit.register(lambda file=baseline_file: file.unlink(missing_ok=True))
    results = []
    async with async_playwright() as p:
        proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
        browser = await p.chromium.launch(executable_path=os.environ.get("PLAYWRIGHT_CHROME_PATH", "/usr/bin/chromium"), headless=True,
            args=["--no-sandbox", "--no-proxy-server"])
        # Wstrzykujemy konkretną awarię w rzeczywisty renderer, nie atrapę całego silnika.
        async def changed_renderer(route):
            # API route.fetch może kierować localhost przez proxy mimo bypass przeglądarki.
            # Pobieramy wyłącznie lokalny zasób Vite; nie zmieniamy polityki dla zewnętrznej sieci.
            assert urllib.parse.urlparse(route.request.url).hostname in ['127.0.0.1', 'localhost']
            def fetch_local():
                with urllib.request.urlopen(route.request.url, timeout=10) as response:
                    return response.status, dict(response.headers), response.read().decode()
            status, headers, body = await asyncio.to_thread(fetch_local)
            mutations = {
                'metric': ('metric: claim.metric,', 'metric: claim.metric === "20%" ? "40%" : claim.metric,'),
                'missing-cv': ('sections: [experiencesSection, projectsSection]', 'sections: []'),
                'missing-pitch': ('profileStatements.push({', 'if (false) profileStatements.push({'),
                'missing-date': ('const dateRangeDisplay = formatClaimDateRange(claim.dateRange);', 'const dateRangeDisplay = "Daty niepodane w profilu";'),
                'hud-count': ('activeClaimsCount: claims.length,', 'activeClaimsCount: 0,'),
                'hud-duplicate': ('verifiedMetrics.push({', 'verifiedMetrics.push({claimId:claim.id, label:claim.sourceProject, value:"40%", sourceProject:claim.sourceProject}); verifiedMetrics.push({'),
                'cv-duplicate': ('experiencesSection.items.push(item);', 'experiencesSection.items.push(item, item);'),
                'pitch-duplicate': ('const hookCtx = {', 'profileStatements.push(...profileStatements); const hookCtx = {'),
                'missing-tags': ('tags: claim.tags || [],', 'tags: [],'),
                'changed-tags': ('tags: claim.tags || [],', 'tags: ["UDT"],'),
                'hud-skill-count': ('count: data.count,', 'count: 99,'),
                'hud-skill-duplicate': ('skillsRadar,', 'skillsRadar: [...skillsRadar, ...skillsRadar],'),
                'cv-project': ('project: claim.sourceProject,', 'project: "Inna firma",'),
                'cv-summary': ('summary: describeCvClaim(claim),', 'summary: "Wymyślony fakt",'),
                'hud-label': ('label: claim.sourceProject,', 'label: "Inna firma",'),
                'hud-source': ('sourceProject: claim.sourceProject,', 'sourceProject: "Inna firma",'),
                'pitch-statement': ('statement: describeProfileClaim(claim),', 'statement: "Wymyślony fakt",'),
                'cv-name': ("candidateName: vault.personalInfo?.fullName || \"Kandydat\"", 'candidateName: "Inna osoba"'),
                'cv-title': ("title: vault.personalInfo?.title || \"Profil Kandydata\"", 'title: "Wymyślone stanowisko"'),
                'pitch-hook': ('const hook = hookVariations[hookIdx];', 'const hook = "Wymyślona wypowiedź";'),
                'pitch-cta': ('const callToAction = ctaVariations[ctaIdx];', 'const callToAction = "Wymyślona wypowiedź";'),
                'hud-timeline-years': ('...sourceEmploymentTimeline(vault),', '...sourceEmploymentTimeline(vault), timelineCoverageYears:99,'),
                'hud-timeline-excluded': ('...sourceEmploymentTimeline(vault),', '...sourceEmploymentTimeline(vault), timelineExcludedEntries:99,'),
            }
            marker, replacement = mutations[scenario]
            renderer = 'renderHudFromClaims' if scenario.startswith('hud-') else ('renderPitchFromClaims' if 'pitch' in scenario else 'renderCvFromClaims')
            start = body.index('function '+renderer+'(')
            prefix, renderer_body = body[:start], body[start:]
            if marker not in renderer_body and marker.endswith(','):
                marker = marker[:-1]
                replacement = replacement.rstrip(',')
            if marker not in renderer_body:
                await route.abort()
                raise AssertionError(f"Nie znaleziono mutacji: {scenario}: {marker}")
            body = prefix + renderer_body.replace(marker, replacement, 1)
            headers = {key:value for key,value in headers.items() if key.lower() not in ['content-length','content-encoding','connection']}
            await route.fulfill(status=status, headers=headers, body=body)
        for scenario, baseline in [(case, old) for case in ['metric', 'missing-cv', 'missing-pitch', 'missing-date', 'hud-count', 'hud-duplicate', 'cv-duplicate', 'pitch-duplicate', 'missing-tags', 'changed-tags', 'hud-skill-count', 'hud-skill-duplicate', 'cv-project', 'cv-summary', 'hud-label', 'hud-source', 'pitch-statement', 'hud-timeline-years', 'hud-timeline-excluded', 'cv-name', 'cv-title', 'pitch-hook', 'pitch-cta'] for old in [True, False]]:
            context = await browser.new_context()
            await context.route("**/src/lib/consistencyGuard/consistencyEngine.ts*", changed_renderer)
            page = await context.new_page()
            await page.route(BASE.rstrip('/')+'/', lambda route: route.fulfill(content_type='text/html', body='<html><head><title>Renderer fixture</title></head><body><script type="module">import {injectIntoGlobalHook} from "/@react-refresh";injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;</script></body></html>'))
            await page.goto(BASE, wait_until="domcontentloaded")
            await page.evaluate("""async ({baseline, scenario}) => {
                const [React, ReactDOM, view, {createEmptyVault}] = await Promise.all([
                    import('/node_modules/.vite/deps/react.js'),
                    import('/node_modules/.vite/deps/react-dom_client.js'),
                    import(baseline
                        ? '/src/features/consistency/ReleaseBaselineConsistencyGuardView.tsx'
                        : '/src/features/consistency/ConsistencyGuardView.tsx'),
                    import('/src/lib/sampleVault.ts')
                ]);
                const vault = createEmptyVault();
                vault.claims = [{id:'metric', sourceProject:'Syntetyczny monter', tags:['missing-tags','changed-tags','hud-skill-count','hud-skill-duplicate'].includes(scenario) ? ['SEP'] : [],
                    ...(['metric','hud-duplicate','hud-label','hud-source'].includes(scenario) ? {metric:'20%'} : {}),
                    ...(scenario === 'missing-date' ? {dateRange:'2020-2022'} : {})}];
                document.body.innerHTML = '<main id="release-proof"></main>';
                (ReactDOM.createRoot ?? ReactDOM.default.createRoot)(document.getElementById('release-proof')).render(
                    (React.createElement ?? React.default.createElement)(view.ConsistencyGuardView, {vault}));
            }""", {'baseline':baseline, 'scenario':scenario})
            await page.get_by_role("heading", name="Kontrola danych", exact=True).wait_for()
            if scenario == 'metric':
                await page.get_by_text("40%", exact=True).first.wait_for()
            count = await page.get_by_role("alert").count()
            filename = ("before" if baseline else "after") + ('' if scenario == 'metric' else '-'+scenario) + '.png'
            await page.screenshot(path=str(OUT / filename), full_page=True)
            results.append({"case": scenario,
                            "baseline": baseline, "alert_count": count,
                            "expected_alert_present": count > 0})
            assert (count == 0) if baseline else (count > 0), f'{scenario}: baseline={baseline}, alerts={count}'
            await context.close()
        page = await browser.new_page()
        await page.route(BASE.rstrip('/')+'/', lambda route: route.fulfill(content_type='text/html', body='<html><head><title>Editor fixture</title></head><body><script type="module">import {injectIntoGlobalHook} from "/@react-refresh";injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;</script></body></html>'))
        await page.goto(BASE, wait_until="domcontentloaded")
        await page.evaluate("""async () => {
            const [React, ReactDOM, {AchievementEditor}] = await Promise.all([
                import('/node_modules/.vite/deps/react.js'),
                import('/node_modules/.vite/deps/react-dom_client.js'),
                import('/src/features/vault/AchievementEditor.tsx')
            ]);
            const h = React.createElement ?? React.default.createElement;
            window.releaseHighlight = {id:'hl', text:'Skróciłem czas obsługi o 25%', metric:'',
                action:'', target:'', tool:'', keywords:[]};
            function Fixture() {
                const [items, setItems] = (React.useState ?? React.default.useState)([window.releaseHighlight]);
                return h(AchievementEditor, {highlights:items, roleTitle:'Magazynier',
                    onChange: next => { window.releaseHighlight = next[0]; setItems(next); }});
            }
            document.body.innerHTML = '<main id="editor-proof"></main>';
            (ReactDOM.createRoot ?? ReactDOM.default.createRoot)(document.getElementById('editor-proof')).render(h(Fixture));
        }""")
        await page.get_by_label("Metryka osiągnięcia 1", exact=True).fill("25%")
        metric = await page.evaluate("window.releaseHighlight.metric")
        assert metric == "25%"
        await page.screenshot(path=str(OUT / "editor-metric.png"), full_page=True)
        results.append({"case": "Actual AchievementEditor callback", "metric": metric, "passed": True,
                        "storage_and_reload_verified": False})
        await browser.close()
    report = {"observedAt":datetime.now(timezone.utc).isoformat(), "evidence": "LOCAL Playwright real components + controlled renderer fault injection",
              "production_verified": False, "results": results}
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))

asyncio.run(main())
