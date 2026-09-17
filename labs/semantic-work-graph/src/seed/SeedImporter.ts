import { Entity, Relation } from '../domain/types.js';
import { SqliteGraphRepository } from '../repositories/SqliteGraphRepository.js';
import fs from 'fs';
import path from 'path';

export interface SeedProfessionItem {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  skills: string[];
  tools: string[];
  tasks: string[];
  brands?: string[];
  technologies?: string[];
  relatedProfessions?: string[];
  confidence: number;
}

/**
 * Klasyfikacja narzędzia jako urządzenia (`device`) albo narzędzia (`tool`).
 *
 * Jedno źródło prawdy: wcześniej ten sam warunek był powielony w dwóch miejscach
 * z różnymi listami słów kluczowych (blok narzędzi znał `drukarka|serwer`, blok
 * marek już nie). Rozjazd generował identyfikatory `tool:...` dla bytów zapisanych
 * jako `device:...`, czyli relacje wskazujące na nieistniejące węzły grafu.
 */
const DEVICE_KEYWORDS = /kocioł|piec|analizator|podnośnik|koparka|spawarka|drukarka|serwer/i;

export function classifySeedTool(toolName: string): 'device' | 'tool' {
  return DEVICE_KEYWORDS.test(toolName) ? 'device' : 'tool';
}

export function buildSeedToolId(toolName: string): string {
  return `${classifySeedTool(toolName)}:${toolName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
}

export class SeedImporter {
  constructor(private repo: SqliteGraphRepository) {}

  public async importSeedFile(seedFilePath: string = './data/seed/professions-top-100.pl.json'): Promise<{ entitiesCount: number; relationsCount: number }> {
    const resolvedPath = path.resolve(seedFilePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Plik seed nie istnieje pod ścieżką: ${resolvedPath}`);
    }

    const rawData = fs.readFileSync(resolvedPath, 'utf-8');
    const professions: SeedProfessionItem[] = JSON.parse(rawData);

    let entitiesCount = 0;
    let relationsCount = 0;
    const now = new Date().toISOString();

    for (const p of professions) {
      // 1. Profession Entity
      const profEntity: Entity = {
        id: `profession:${p.id}`,
        type: 'profession',
        name: p.name,
        aliases: p.aliases || [],
        description: `Zawód z obszaru: ${p.category}`,
        tags: [p.category, 'seed-top-100'],
        status: 'verified',
        confidence: p.confidence || 0.95,
        source: 'curated',
        createdAt: now,
        updatedAt: now,
      };
      await this.repo.upsertEntity(profEntity);
      entitiesCount++;

      // 2. Industry Entity
      const indId = `industry:${p.category.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const indEntity: Entity = {
        id: indId,
        type: 'industry',
        name: p.category,
        aliases: [],
        description: `Obszar branżowy: ${p.category}`,
        tags: ['industry'],
        status: 'verified',
        confidence: 1.0,
        source: 'curated',
        createdAt: now,
        updatedAt: now,
      };
      await this.repo.upsertEntity(indEntity);

      const profIndRel: Relation = {
        id: `rel_${profEntity.id}_works_in_${indEntity.id}`,
        fromEntityId: profEntity.id,
        toEntityId: indEntity.id,
        type: 'works_in',
        weight: 1.0,
        confidence: 0.95,
        status: 'verified',
        source: 'curated',
        evidence: [{ sourceType: 'curated', note: 'Seed import 100 profesji', createdAt: now }],
        createdAt: now,
        updatedAt: now,
      };
      await this.repo.upsertRelation(profIndRel);
      relationsCount++;

      // 3. Skills
      for (const skillName of p.skills || []) {
        const skillId = `skill:${skillName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const skillEntity: Entity = {
          id: skillId,
          type: 'skill',
          name: skillName,
          aliases: [],
          description: `Umiejętność: ${skillName}`,
          tags: ['skill'],
          status: 'verified',
          confidence: 0.9,
          source: 'curated',
          createdAt: now,
          updatedAt: now,
        };
        await this.repo.upsertEntity(skillEntity);
        entitiesCount++;

        const rel: Relation = {
          id: `rel_${profEntity.id}_requires_skill_${skillEntity.id}`,
          fromEntityId: profEntity.id,
          toEntityId: skillEntity.id,
          type: 'requires_skill',
          weight: 1.0,
          confidence: 0.9,
          status: 'verified',
          source: 'curated',
          evidence: [{ sourceType: 'curated', note: 'Wykaz umiejętności zawodu', createdAt: now }],
          createdAt: now,
          updatedAt: now,
        };
        await this.repo.upsertRelation(rel);
        relationsCount++;
      }

      // 4. Tools / Devices
      for (const toolName of p.tools || []) {
        const type = classifySeedTool(toolName);
        const toolId = buildSeedToolId(toolName);

        const toolEntity: Entity = {
          id: toolId,
          type: type as any,
          name: toolName,
          aliases: [],
          description: `${type === 'device' ? 'Urządzenie' : 'Narzędzie'}: ${toolName}`,
          tags: [type],
          status: 'verified',
          confidence: 0.9,
          source: 'curated',
          createdAt: now,
          updatedAt: now,
        };
        await this.repo.upsertEntity(toolEntity);
        entitiesCount++;

        const relType = type === 'device' ? 'services' : 'used_by';
        const rel: Relation = {
          id: `rel_${toolEntity.id}_${relType}_${profEntity.id}`,
          fromEntityId: toolEntity.id,
          toEntityId: profEntity.id,
          type: relType,
          weight: 1.0,
          confidence: 0.9,
          status: 'verified',
          source: 'curated',
          evidence: [{ sourceType: 'curated', note: 'Narzędzia/urządzenia w pracy', createdAt: now }],
          createdAt: now,
          updatedAt: now,
        };
        await this.repo.upsertRelation(rel);
        relationsCount++;
      }

      // 5. Brands
      for (const brandName of p.brands || []) {
        const brandId = `brand:${brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const brandEntity: Entity = {
          id: brandId,
          type: 'brand',
          name: brandName,
          aliases: [],
          description: `Marka / Producent: ${brandName}`,
          tags: ['brand'],
          status: 'verified',
          confidence: 0.95,
          source: 'curated',
          createdAt: now,
          updatedAt: now,
        };
        await this.repo.upsertEntity(brandEntity);
        entitiesCount++;

        for (const toolName of (p.tools || []).slice(0, 2)) {
          const toolId = buildSeedToolId(toolName);
          const brandRel: Relation = {
            id: `rel_${brandEntity.id}_manufactures_${toolId}`,
            fromEntityId: brandEntity.id,
            toEntityId: toolId,
            type: 'manufactures',
            weight: 1.0,
            confidence: 0.9,
            status: 'verified',
            source: 'curated',
            evidence: [{ sourceType: 'curated', note: 'Producent sprzętu', createdAt: now }],
            createdAt: now,
            updatedAt: now,
          };
          await this.repo.upsertRelation(brandRel);
          relationsCount++;
        }
      }
    }

    return { entitiesCount, relationsCount };
  }

  public exportProfessionsSeedMarkdown(seedFilePath: string = './data/seed/professions-top-100.pl.json', mdOutputPath: string = './data/seed/professions-top-100.pl.md'): string {
    const rawData = fs.readFileSync(path.resolve(seedFilePath), 'utf-8');
    const professions: SeedProfessionItem[] = JSON.parse(rawData);

    let md = `# TOP 100 Profesji w Polsce (Zrównoważony Zbiór Semantyczny)\n\n`;
    md += `> **Notatka:** Dokument ma charakter roboczy i ontologiczny. Nie stanowi oficjalnego klasyfikatora rynkowego.\n\n`;

    const byCategory: Record<string, SeedProfessionItem[]> = {};
    professions.forEach((p) => {
      byCategory[p.category] = byCategory[p.category] || [];
      byCategory[p.category].push(p);
    });

    Object.entries(byCategory).forEach(([category, items]) => {
      md += `## Obszar: ${category}\n\n`;
      items.forEach((p, idx) => {
        md += `### ${idx + 1}. ${p.name}\n`;
        md += `- **ID:** \`${p.id}\`\n`;
        md += `- **Synonimy / Potoczne:** ${p.aliases.map((a) => `\`${a}\``).join(', ')}\n`;
        md += `- **Główne Umiejętności:** ${p.skills.join(', ')}\n`;
        md += `- **Narzędzia i Sprzęt:** ${p.tools.join(', ')}\n`;
        if (p.brands && p.brands.length > 0) {
          md += `- **Przykładowe Marki / Producenci:** ${p.brands.join(', ')}\n`;
        }
        md += `- **Przykładowe Zadania:** ${p.tasks.join('; ')}\n\n`;
      });
    });

    const resolvedOutput = path.resolve(mdOutputPath);
    fs.writeFileSync(resolvedOutput, md, 'utf-8');
    return resolvedOutput;
  }
}
