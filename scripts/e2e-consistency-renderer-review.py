import asyncio
import json
import os
import atexit
import subprocess
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
            args=["--no-sandbox"], proxy={"server": proxy, "bypass": "127.0.0.1,localhost"} if proxy else None)
        # Wstrzykujemy konkretną awarię w rzeczywisty renderer, nie atrapę całego silnika.
        async def changed_renderer(route):
            response = await route.fetch()
            body = await response.text()
            mutations = {
                'metric': ('metric: claim.metric,', 'metric: claim.metric === "20%" ? "40%" : claim.metric,'),
                'missing-cv': ('sections: [experiencesSection, projectsSection]', 'sections: []'),
                'missing-pitch': ('profileStatements.push({', 'if (false) profileStatements.push({'),
                'missing-date': ('const dateRangeDisplay = formatClaimDateRange(claim.dateRange);', 'const dateRangeDisplay = "Daty niepodane w profilu";'),
            }
            marker, replacement = mutations[scenario]
            assert marker in body, "Nie znaleziono miejsca kontrolowanej mutacji renderera"
            body = body.replace(marker, replacement, 1)
            await route.fulfill(response=response, body=body)
        for scenario, baseline in [(case, old) for case in ['metric', 'missing-cv', 'missing-pitch', 'missing-date'] for old in [True, False]]:
            context = await browser.new_context()
            await context.route("**/src/lib/consistencyGuard/consistencyEngine.ts*", changed_renderer)
            page = await context.new_page()
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
                vault.claims = [{id:'metric', sourceProject:'Syntetyczny monter', tags:[],
                    ...(scenario === 'metric' ? {metric:'20%'} : {}),
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
            assert (count == 0) if baseline else (count > 0)
            await context.close()
        page = await browser.new_page()
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
    report = {"evidence": "LOCAL Playwright real components + controlled renderer fault injection",
              "production_verified": False, "results": results}
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))

asyncio.run(main())
