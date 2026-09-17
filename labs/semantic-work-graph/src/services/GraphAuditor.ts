import { SqliteGraphRepository } from '../repositories/SqliteGraphRepository.js';
import { Entity, Relation } from '../domain/types.js';

export interface AuditAnomaly {
  type: 'ORPHANED_NODE' | 'CYCLIC_ALIAS' | 'LOW_CONFIDENCE' | 'CONFLICTING_RELATION' | 'DUPLICATE_NAME';
  severity: 'WARNING' | 'ERROR' | 'INFO';
  entityId?: string;
  relationId?: string;
  message: string;
}

export interface AuditReport {
  timestamp: string;
  totalEntities: number;
  totalRelations: number;
  anomalyCount: number;
  anomalies: AuditAnomaly[];
}

export class GraphAuditor {
  constructor(private repo: SqliteGraphRepository) {}

  public async auditGraph(): Promise<AuditReport> {
    const entities = await this.repo.getAllEntities();
    const relations = await this.repo.getAllRelations();
    const anomalies: AuditAnomaly[] = [];

    const entityMap = new Map<string, Entity>();
    const relationCountMap = new Map<string, number>();
    const nameMap = new Map<string, string[]>();

    entities.forEach((e) => {
      entityMap.set(e.id, e);
      relationCountMap.set(e.id, 0);

      const normName = e.name.toLowerCase().trim();
      const list = nameMap.get(normName) || [];
      list.push(e.id);
      nameMap.set(normName, list);

      // Check low confidence entities
      if (e.confidence < 0.4) {
        anomalies.push({
          type: 'LOW_CONFIDENCE',
          severity: 'WARNING',
          entityId: e.id,
          message: `Obiekt "${e.name}" ma bardzo niski wskaźnik pewności: ${Math.round(e.confidence * 100)}%`,
        });
      }
    });

    // Check duplicate names
    nameMap.forEach((ids, name) => {
      if (ids.length > 1) {
        anomalies.push({
          type: 'DUPLICATE_NAME',
          severity: 'WARNING',
          message: `Wykryto ${ids.length} obiekty o identycznej nazwie: "${name}" (${ids.join(', ')})`,
        });
      }
    });

    relations.forEach((r) => {
      if (r.status !== 'rejected') {
        const fromCnt = relationCountMap.get(r.fromEntityId) ?? 0;
        relationCountMap.set(r.fromEntityId, fromCnt + 1);

        const toCnt = relationCountMap.get(r.toEntityId) ?? 0;
        relationCountMap.set(r.toEntityId, toCnt + 1);

        if (r.confidence < 0.3) {
          anomalies.push({
            type: 'LOW_CONFIDENCE',
            severity: 'WARNING',
            relationId: r.id,
            message: `Relacja ${r.fromEntityId} --(${r.type})--> ${r.toEntityId} ma niski wskaźnik pewności: ${Math.round(r.confidence * 100)}%`,
          });
        }
      }
    });

    // Check orphaned nodes
    relationCountMap.forEach((cnt, id) => {
      if (cnt === 0) {
        const e = entityMap.get(id);
        anomalies.push({
          type: 'ORPHANED_NODE',
          severity: 'INFO',
          entityId: id,
          message: `Sierota (brak jakichkolwiek relacji w grafie): "${e?.name || id}" [${e?.type}]`,
        });
      }
    });

    return {
      timestamp: new Date().toISOString(),
      totalEntities: entities.length,
      totalRelations: relations.length,
      anomalyCount: anomalies.length,
      anomalies,
    };
  }
}
