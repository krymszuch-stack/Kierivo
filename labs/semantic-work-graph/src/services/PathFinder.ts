import { Entity, Relation, RelationType } from '../domain/types.js';
import { SqliteGraphRepository } from '../repositories/SqliteGraphRepository.js';
import { SearchEngine } from './SearchEngine.js';

export interface PathStep {
  fromEntity: Entity;
  relation: Relation;
  toEntity: Entity;
  stepCost: number;
}

export interface PathFilterOptions {
  maxDepth?: number;
  minConfidence?: number;
  allowedRelationTypes?: RelationType[];
  excludeNodeIds?: string[];
}

export interface GraphPathResult {
  found: boolean;
  fromTerm: string;
  toTerm: string;
  startEntity?: Entity;
  targetEntity?: Entity;
  pathLength: number;
  totalCost: number;
  overallConfidence: number;
  steps: PathStep[];
  explanation: string[];
}

export class PathFinder {
  private searchEngine: SearchEngine;

  constructor(private repo: SqliteGraphRepository) {
    this.searchEngine = new SearchEngine(repo);
  }

  /**
   * Weighted Dijkstra Shortest Path Search Engine
   * Edge Cost Formula: cost = 1.0 / (relation.weight * relation.confidence * relationTypeFactor)
   * Combined Path Confidence: C_path = PROD(step.relation.confidence * step.relation.weight)
   */
  public async explainPath(
    fromTerm: string,
    toTerm: string,
    options: PathFilterOptions = {}
  ): Promise<GraphPathResult> {
    const { maxDepth = 4, minConfidence = 0.3, allowedRelationTypes, excludeNodeIds = [] } = options;

    const startResults = await this.searchEngine.search(fromTerm, { limit: 1 });
    const targetResults = await this.searchEngine.search(toTerm, { limit: 1 });

    if (startResults.length === 0 || targetResults.length === 0) {
      return {
        found: false,
        fromTerm,
        toTerm,
        pathLength: 0,
        totalCost: Infinity,
        overallConfidence: 0,
        steps: [],
        explanation: [
          `Nie znaleziono odpowiednika dla "${startResults.length === 0 ? fromTerm : toTerm}" w grafie wiedzy.`,
        ],
      };
    }

    const startEntity = startResults[0].entity;
    const targetEntity = targetResults[0].entity;

    if (startEntity.id === targetEntity.id) {
      return {
        found: true,
        fromTerm,
        toTerm,
        startEntity,
        targetEntity,
        pathLength: 0,
        totalCost: 0,
        overallConfidence: startEntity.confidence,
        steps: [],
        explanation: [`Pojęcia "${fromTerm}" i "${toTerm}" odnoszą się do tego samego obiektu: "${startEntity.name}" [${startEntity.type}].`],
      };
    }

    // Dijkstra Priority Queue & Distance Maps
    const distances = new Map<string, number>();
    const previous = new Map<string, { entityId: string; relation: Relation }>();
    const unvisited = new Set<string>();

    const allEntities = await this.repo.getAllEntities();
    const excludeSet = new Set(excludeNodeIds);

    allEntities.forEach((e) => {
      if (!excludeSet.has(e.id)) {
        distances.set(e.id, Infinity);
        unvisited.add(e.id);
      }
    });

    distances.set(startEntity.id, 0);

    while (unvisited.size > 0) {
      // Pick unvisited node with smallest distance
      let currentId: string | null = null;
      let minDistance = Infinity;

      unvisited.forEach((nodeId) => {
        const dist = distances.get(nodeId) ?? Infinity;
        if (dist < minDistance) {
          minDistance = dist;
          currentId = nodeId;
        }
      });

      if (!currentId || minDistance === Infinity) break;
      if (currentId === targetEntity.id) break;

      unvisited.delete(currentId);

      // Check depth limit from start
      const currentPathLen = this.getPathLengthToNode(currentId, previous);
      if (currentPathLen >= maxDepth) continue;

      const relations = await this.repo.getRelationsForEntity(currentId);

      for (const rel of relations) {
        if (rel.confidence < minConfidence) continue;
        if (allowedRelationTypes && !allowedRelationTypes.includes(rel.type)) continue;

        const neighborId = rel.fromEntityId === currentId ? rel.toEntityId : rel.fromEntityId;
        if (!unvisited.has(neighborId)) continue;

        // Calculate Edge Cost
        const relTypeFactor = this.getRelationPriorityWeight(rel.type);
        const edgeCost = 1.0 / (Math.max(0.1, rel.weight) * Math.max(0.1, rel.confidence) * relTypeFactor);
        const altDist = minDistance + edgeCost;

        if (altDist < (distances.get(neighborId) ?? Infinity)) {
          distances.set(neighborId, altDist);
          previous.set(neighborId, { entityId: currentId, relation: rel });
        }
      }
    }

    // Reconstruct Dijkstra Path
    if (!previous.has(targetEntity.id)) {
      return {
        found: false,
        fromTerm,
        toTerm,
        startEntity,
        targetEntity,
        pathLength: 0,
        totalCost: Infinity,
        overallConfidence: 0,
        steps: [],
        explanation: [
          `Brak bezpośredniego lub ważącego połączenia w granicach głębokości ${maxDepth} kroków pomiędzy "${startEntity.name}" a "${targetEntity.name}".`,
        ],
      };
    }

    const steps: PathStep[] = [];
    let curr = targetEntity.id;

    while (previous.has(curr)) {
      const prevInfo = previous.get(curr)!;
      const fromNode = (await this.repo.getEntityById(prevInfo.entityId))!;
      const toNode = (await this.repo.getEntityById(curr))!;
      const rel = prevInfo.relation;
      const relTypeFactor = this.getRelationPriorityWeight(rel.type);
      const stepCost = 1.0 / (Math.max(0.1, rel.weight) * Math.max(0.1, rel.confidence) * relTypeFactor);

      steps.unshift({
        fromEntity: fromNode,
        relation: rel,
        toEntity: toNode,
        stepCost: Math.round(stepCost * 100) / 100,
      });

      curr = prevInfo.entityId;
    }

    let overallConfidence = 1.0;
    const explanationLines: string[] = [];

    steps.forEach((step, idx) => {
      overallConfidence *= step.relation.confidence * step.relation.weight;
      const relationText = this.formatRelationName(step.relation.type);
      explanationLines.push(
        `Krok ${idx + 1}: [${step.fromEntity.type}] "${step.fromEntity.name}" --(${relationText})--> [${step.toEntity.type}] "${step.toEntity.name}" (Koszt: ${step.stepCost}, Pewność: ${Math.round(step.relation.confidence * 100)}%)`
      );
    });

    const totalCost = Math.round((distances.get(targetEntity.id) ?? 0) * 100) / 100;

    return {
      found: true,
      fromTerm,
      toTerm,
      startEntity,
      targetEntity,
      pathLength: steps.length,
      totalCost,
      overallConfidence: Math.round(overallConfidence * 100) / 100,
      steps,
      explanation: explanationLines,
    };
  }

  private getPathLengthToNode(nodeId: string, previousMap: Map<string, { entityId: string; relation: Relation }>): number {
    let count = 0;
    let curr = nodeId;
    while (previousMap.has(curr)) {
      count++;
      curr = previousMap.get(curr)!.entityId;
    }
    return count;
  }

  private getRelationPriorityWeight(type: RelationType): number {
    const weights: Record<RelationType, number> = {
      alias_of: 1.5,
      manufactures: 1.3,
      services: 1.2,
      installs: 1.2,
      requires_skill: 1.1,
      works_in: 1.0,
      used_by: 1.0,
      used_for: 1.0,
      repairs: 1.1,
      subtype_of: 1.2,
      belongs_to: 1.0,
      compatible_with: 0.9,
      produces: 1.0,
      sells: 0.9,
      certifies: 1.1,
      related_to: 0.8,
    };
    return weights[type] || 1.0;
  }

  private formatRelationName(type: string): string {
    const map: Record<string, string> = {
      alias_of: 'jest synonimem / aliasem',
      belongs_to: 'należy do',
      used_by: 'używane przez',
      used_for: 'używane do',
      installs: 'instaluje',
      services: 'serwisuje',
      repairs: 'naprawia',
      manufactures: 'produkuje',
      requires_skill: 'wymaga umiejętności',
      related_to: 'jest powiązane z',
      subtype_of: 'jest podtypem',
      compatible_with: 'jest kompatybilny z',
      works_in: 'pracuje w branży',
      produces: 'wytwarza',
      sells: 'sprzedaje',
      certifies: 'certyfikuje',
    };
    return map[type] || type;
  }
}
