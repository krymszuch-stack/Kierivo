import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import { SqliteGraphRepository } from '../repositories/SqliteGraphRepository.js';
import { SearchEngine } from '../services/SearchEngine.js';
import { PathFinder } from '../services/PathFinder.js';
import { SeedImporter } from '../seed/SeedImporter.js';
import { MarkdownGenerator } from '../generators/MarkdownGenerator.js';
import { GeminiEnrichmentProvider } from '../providers/GeminiEnrichmentProvider.js';
import { GraphAnalytics } from '../services/GraphAnalytics.js';
import { GraphAuditor } from '../services/GraphAuditor.js';

dotenv.config();

const program = new Command();
const repo = new SqliteGraphRepository();

program
  .name('swg')
  .description('CLI dla Semantic Work Graph - Niezależnego Silnika Relacji i Semantyki Zawodowej')
  .version('1.1.0');

program
  .command('seed:import')
  .description('Importuje wstępny seed 100 profesji do bazy SQLite oraz tworzy powiązane węzły/relacje')
  .option('-f, --file <path>', 'Ścieżka do pliku seed', './data/seed/professions-top-100.pl.json')
  .action(async (options) => {
    console.log(`📥 Importowanie seed z pliku ${options.file}...`);
    const importer = new SeedImporter(repo);
    const result = await importer.importSeedFile(options.file);
    console.log(`✅ Pomyślnie zaimportowano ${result.entitiesCount} obiektów oraz ${result.relationsCount} relacji do bazy SQLite.`);
  });

program
  .command('seed:export-md')
  .description('Generuje dokumentację Markdown z bazy danych SQLite i pliku seed')
  .action(async () => {
    console.log('📝 Generowanie mapy wiedzy w formacie Markdown...');
    const importer = new SeedImporter(repo);
    const mdSeed = importer.exportProfessionsSeedMarkdown();
    console.log(`✅ Wygenerowano dokument seed: ${mdSeed}`);

    const generator = new MarkdownGenerator(repo);
    const mdMap = await generator.generateKnowledgeMapMarkdown();
    console.log(`✅ Wygenerowano pełną mapę wiedzy: ${mdMap}`);
  });

program
  .command('search <term>')
  .description('Wyszukuje pojęcia, profesje, narzędzia, urządzenia lub marki w grafie (stemming lematyczny + hybryda Jaro-Winkler/Trigram)')
  .option('-t, --type <type>', 'Filtruj wg typu obiektu (profession, skill, tool, device, brand, etc.)')
  .action(async (term, options) => {
    const engine = new SearchEngine(repo);
    const results = await engine.search(term, { type: options.type });

    console.log(`\n🔍 Wyniki wyszukiwania dla frazy: "${term}" (${results.length} wyników):\n`);
    results.forEach((r, idx) => {
      console.log(`${idx + 1}. [${r.entity.type.toUpperCase()}] ${r.entity.name} (Wynik: ${Math.round(r.score * 100)}%)`);
      console.log(`   ID: ${r.entity.id} | Pewność: ${Math.round(r.entity.confidence * 100)}% | Status: ${r.entity.status}`);
      console.log(`   Typ dopasowania: ${r.matchType} | Powód: ${r.reason}`);
      if (r.entity.aliases.length > 0) {
        console.log(`   Aliasy: ${r.entity.aliases.join(', ')}`);
      }
      console.log('');
    });
  });

program
  .command('path <fromTerm> <toTerm>')
  .description('Wyjaśnia i odnajduje optymalną ważoną ścieżkę w grafie (algorytm Dijkstry)')
  .option('-d, --depth <maxDepth>', 'Maksymalna głębokość przeszukiwania', '4')
  .action(async (fromTerm, toTerm, options) => {
    const finder = new PathFinder(repo);
    const res = await finder.explainPath(fromTerm, toTerm, { maxDepth: parseInt(options.depth, 10) });

    console.log(`\n🕸️ Ścieżka ważona w grafie (Dijkstra) pomiędzy "${fromTerm}" a "${toTerm}":\n`);
    if (!res.found) {
      console.log(`❌ NIE ZNALEZIONO ŚCIEŻKI: ${res.explanation[0]}`);
    } else {
      console.log(`✅ Znaleziono ścieżkę (Długość: ${res.pathLength} kroków, Koszt: ${res.totalCost}, Pewność: ${Math.round(res.overallConfidence * 100)}%):\n`);
      res.explanation.forEach((line) => console.log(`   ${line}`));
    }
    console.log('');
  });

program
  .command('analytics:pagerank')
  .description('Oblicza wskaźniki PageRank oraz stopień węzłów w grafie semantycznym')
  .option('-l, --limit <number>', 'Liczba węzłów do wyświetlenia', '15')
  .action(async (options) => {
    const analytics = new GraphAnalytics(repo);
    const nodes = await analytics.calculatePageRank();

    console.log(`\n📊 Analiza ważności węzłów PageRank w grafie (Top ${options.limit}):\n`);
    nodes.slice(0, parseInt(options.limit, 10)).forEach((n, idx) => {
      console.log(`${idx + 1}. [${n.entity.type.toUpperCase()}] ${n.entity.name} (PageRank: ${n.score})`);
      console.log(`   Stopień wejściowy (in): ${n.inDegree} | Wyjściowy (out): ${n.outDegree} | Łącznie: ${n.totalDegree}`);
    });
    console.log('');
  });

program
  .command('analytics:audit')
  .description('Wykonuje audyt spójności i anomalii w grafie semantycznym')
  .action(async () => {
    const auditor = new GraphAuditor(repo);
    const report = await auditor.auditGraph();

    console.log(`\n🛡️ Raport Audytu Spójności Grafu Wiedzy (${report.timestamp}):\n`);
    console.log(`- Łącznie węzłów: ${report.totalEntities}`);
    console.log(`- Łącznie relacji: ${report.totalRelations}`);
    console.log(`- Wykryto anomalii: ${report.anomalyCount}\n`);

    report.anomalies.forEach((a, idx) => {
      console.log(`${idx + 1}. [${a.severity}] ${a.type}: ${a.message}`);
    });
    console.log('');
  });

program
  .command('enrich <profession>')
  .description('Generuje propozycję rozszerzenia grafu dla danej profesji poprzez Gemini API')
  .action(async (profession) => {
    console.log(`🤖 Pobieranie propozycji relacji i obiektów dla "${profession}" via Gemini API...`);
    const provider = new GeminiEnrichmentProvider(repo);
    const proposals = await provider.enrichProfession(profession);

    console.log(`\n💡 Utworzono ${proposals.length} niezweryfikowanych propozycji (status: proposed):\n`);
    proposals.forEach((p) => {
      console.log(`- ID: ${p.id} | Status: ${p.status} | Proponujący: ${p.proposedBy}`);
      if (p.entity) {
        console.log(`  Proponowana encja: [${p.entity.type}] ${p.entity.name}`);
      }
      if (p.relation) {
        console.log(`  Proponowana relacja: ${p.relation.fromEntityId} --(${p.relation.type})--> ${p.relation.toEntityId}`);
      }
    });
    console.log('\nWszystkie propozycje zostały zapisane w data/proposals/pending do weryfikacji przez właściciela.');
  });

program.parseAsync(process.argv);
