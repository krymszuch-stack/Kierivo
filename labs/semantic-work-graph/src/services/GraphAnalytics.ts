import { SqliteGraphRepository } from '../repositories/SqliteGraphRepository.js';
import { Entity } from '../domain/types.js';

export interface PageRankNode {
  entity: Entity;
  score: number;
  inDegree: number;
  outDegree: number;
  totalDegree: number;
}

export class GraphAnalytics {
  constructor(private repo: SqliteGraphRepository) {}

  /**
   * Implements PageRank algorithm for Node Centrality scoring across the semantic graph
   * Score = (1 - d) / N + d * SUM(PageRank(v) / OutDegree(v))
   */
  public async calculatePageRank(dampingFactor: number = 0.85, maxIterations: number = 50): Promise<PageRankNode[]> {
    const entities = await this.repo.getAllEntities();
    const relations = await this.repo.getAllRelations();

    const n = entities.length;
    if (n === 0) return [];

    let rankMap = new Map<string, number>();
    const outDegreeMap = new Map<string, number>();
    const inDegreeMap = new Map<string, number>();
    const incomingMap = new Map<string, string[]>();

    entities.forEach((e) => {
      rankMap.set(e.id, 1 / n);
      outDegreeMap.set(e.id, 0);
      inDegreeMap.set(e.id, 0);
      incomingMap.set(e.id, []);
    });

    relations.forEach((r) => {
      if (r.status !== 'rejected') {
        const outCount = outDegreeMap.get(r.fromEntityId) ?? 0;
        outDegreeMap.set(r.fromEntityId, outCount + 1);

        const inCount = inDegreeMap.get(r.toEntityId) ?? 0;
        inDegreeMap.set(r.toEntityId, inCount + 1);

        const incList = incomingMap.get(r.toEntityId) ?? [];
        incList.push(r.fromEntityId);
        incomingMap.set(r.toEntityId, incList);
      }
    });

    // PageRank Iteration loop
    for (let iter = 0; iter < maxIterations; iter++) {
      const newRankMap = new Map<string, number>();
      let sinkSum = 0;

      entities.forEach((e) => {
        if ((outDegreeMap.get(e.id) ?? 0) === 0) {
          sinkSum += rankMap.get(e.id) ?? 0;
        }
      });

      entities.forEach((e) => {
        const incoming = incomingMap.get(e.id) ?? [];
        let incomingSum = 0;

        incoming.forEach((inNodeId) => {
          const inRank = rankMap.get(inNodeId) ?? 0;
          const inOutDegree = outDegreeMap.get(inNodeId) ?? 1;
          incomingSum += inRank / inOutDegree;
        });

        const newRank = (1 - dampingFactor) / n + dampingFactor * (incomingSum + sinkSum / n);
        newRankMap.set(e.id, newRank);
      });

      rankMap = newRankMap;
    }

    const results: PageRankNode[] = entities.map((e) => {
      const inDeg = inDegreeMap.get(e.id) ?? 0;
      const outDeg = outDegreeMap.get(e.id) ?? 0;
      return {
        entity: e,
        score: Math.round((rankMap.get(e.id) ?? 0) * 10000) / 10000,
        inDegree: inDeg,
        outDegree: outDeg,
        totalDegree: inDeg + outDeg,
      };
    });

    results.sort((a, b) => b.score - a.score);
    return results;
  }
}
