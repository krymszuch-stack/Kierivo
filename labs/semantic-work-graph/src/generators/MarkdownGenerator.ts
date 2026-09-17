import { SqliteGraphRepository } from '../repositories/SqliteGraphRepository.js';
import fs from 'fs';
import path from 'path';

export class MarkdownGenerator {
  constructor(private repo: SqliteGraphRepository) {}

  public async generateKnowledgeMapMarkdown(outputPath: string = './data/generated/knowledge-map.md'): Promise<string> {
    const entities = await this.repo.getAllEntities();
    const relations = await this.repo.getAllRelations();

    let md = `# Mapa Wiedzy i Relacji Semantycznych (` + new Date().toISOString().split('T')[0] + `)\n\n`;
    md += `> **Status:** Wygenerowano z bazy SQLite / Grafu Wiedzy (\`${entities.length}\` węzłów, \`${relations.length}\` relacji).\n\n`;

    md += `## Statystyki Obiektów według Typów\n\n`;
    const typeCounts: Record<string, number> = {};
    entities.forEach((e) => {
      typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
    });

    md += `| Typ Obiektu | Liczba Obiektów |\n| --- | --- |\n`;
    Object.entries(typeCounts).forEach(([type, count]) => {
      md += `| \`${type}\` | ${count} |\n`;
    });
    md += `\n---\n\n`;

    md += `## Przegląd Obiektów i ich Relacji\n\n`;

    entities.sort((a, b) => a.name.localeCompare(b.name, 'pl'));

    for (const entity of entities) {
      md += `### ${entity.name} (\`${entity.type}\`)\n`;
      md += `- **ID:** \`${entity.id}\`\n`;
      if (entity.aliases.length > 0) {
        md += `- **Synonimy / Aliasy:** ${entity.aliases.map((a) => `\`${a}\``).join(', ')}\n`;
      }
      md += `- **Opis:** ${entity.description || 'Brak opisu.'}\n`;
      md += `- **Pewność:** ${Math.round(entity.confidence * 100)}% | **Źródło:** \`${entity.source}\` | **Status:** \`${entity.status}\`\n`;

      const rels = await this.repo.getRelationsForEntity(entity.id);
      if (rels.length > 0) {
        md += `- **Powiązane relacje:**\n`;
        for (const r of rels) {
          const isFrom = r.fromEntityId === entity.id;
          const otherId = isFrom ? r.toEntityId : r.fromEntityId;
          const otherEntity = await this.repo.getEntityById(otherId);
          const otherName = otherEntity ? otherEntity.name : otherId;
          const arrow = isFrom ? `--[${r.type}]-->` : `<--[${r.type}]--`;

          md += `  - ${arrow} **${otherName}** (Confidence: ${Math.round(r.confidence * 100)}%)\n`;
        }
      }
      md += `\n`;
    }

    const resolvedOutput = path.resolve(outputPath);
    const dir = path.dirname(resolvedOutput);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolvedOutput, md, 'utf-8');

    return resolvedOutput;
  }
}
