import { GoogleGenAI } from '@google/genai';
import { Proposal, Entity, Relation } from '../domain/types.js';
import { SqliteGraphRepository } from '../repositories/SqliteGraphRepository.js';
import { SecurityGuardrails } from '../services/SecurityGuardrails.js';
import fs from 'fs';
import path from 'path';

export class GeminiEnrichmentProvider {
  private ai: GoogleGenAI | null = null;

  constructor(private repo: SqliteGraphRepository) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  public async enrichProfession(professionName: string): Promise<Proposal[]> {
    if (!this.ai) {
      console.warn('⚠️ GEMINI_API_KEY nie jest zdefiniowany w środowisku Node.js. Generowanie propozycji w trybie symulacji bezpiecznej.');
      return this.generateMockProposal(professionName);
    }

    const existingEntity = await this.repo.getEntityByName(professionName);
    const contextStr = existingEntity ? JSON.stringify(existingEntity) : `Profesja: ${professionName}`;

    const prompt = `Jesteś ekspertem ontologii zawodowych. Zanalizuj profesję "${professionName}".
Podaj powiązane kompetencje, narzędzia, urządzenia i marki (np. Junkers dla urządzeń grzewczych).
ZWRÓĆ WYŁĄCZNIE CZYSTY JSON odpowiadający strukturze z dwoma tablicami:
{
  "newEntities": [
    { "type": "tool|device|skill|brand", "name": "Nazwa", "aliases": [], "description": "Opis", "tags": [] }
  ],
  "newRelations": [
    { "toEntityName": "Nazwa", "relationType": "used_by|services|installs|requires_skill|manufactures", "confidence": 0.85 }
  ]
}
Kontekst obok: ${contextStr}`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text || '';
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return await this.processGeminiResponse(professionName, parsed);
    } catch (err: any) {
      console.error('Błąd podczas zapytania Gemini API:', err.message);
      return await this.generateMockProposal(professionName);
    }
  }

  private async processGeminiResponse(professionName: string, data: any): Promise<Proposal[]> {
    const proposals: Proposal[] = [];
    const now = new Date().toISOString();
    const profEntity = await this.repo.getEntityByName(professionName);

    if (data.newEntities && Array.isArray(data.newEntities)) {
      for (let idx = 0; idx < data.newEntities.length; idx++) {
        const item = data.newEntities[idx];
        const entityId = `${item.type}:${item.name.toLowerCase().replace(/\s+/g, '-')}`;
        const newEntity: Entity = {
          id: entityId,
          type: item.type,
          name: item.name,
          aliases: item.aliases || [],
          description: item.description || `Zaproponowane przez Gemini dla ${professionName}`,
          tags: item.tags || ['gemini-proposal'],
          status: 'proposed',
          confidence: 0.75,
          source: 'gemini',
          createdAt: now,
          updatedAt: now,
        };

        const proposal: Proposal = {
          id: `prop_ent_${Date.now()}_${idx}`,
          entity: newEntity,
          status: 'proposed',
          proposedBy: 'gemini-2.5-flash',
          notes: `Propozycja nowej encji dla profesji ${professionName}`,
          createdAt: now,
        };

        const guardrails = new SecurityGuardrails();
        const safetyCheck = guardrails.validateProposalSafety(proposal);

        if (safetyCheck.isSafe) {
          await this.saveProposalToFileAndDb(proposal);
          proposals.push(proposal);
        } else {
          console.warn(`🛑 Odrzucono propozycję AI ze względów bezpieczeństwa: ${safetyCheck.reason}`);
        }
      }
    }

    if (profEntity && data.newRelations && Array.isArray(data.newRelations)) {
      for (let idx = 0; idx < data.newRelations.length; idx++) {
        const relItem = data.newRelations[idx];
        const targetEntity = await this.repo.getEntityByName(relItem.toEntityName);
        if (targetEntity) {
          const relationId = `rel_${profEntity.id}_${relItem.relationType}_${targetEntity.id}`;
          const newRelation: Relation = {
            id: relationId,
            fromEntityId: targetEntity.id,
            toEntityId: profEntity.id,
            type: relItem.relationType,
            weight: 1.0,
            confidence: relItem.confidence || 0.8,
            status: 'proposed',
            source: 'gemini',
            evidence: [
              {
                sourceType: 'gemini',
                note: `Wykryto powiązanie Gemini dla ${professionName}`,
                createdAt: now,
              },
            ],
            createdAt: now,
            updatedAt: now,
          };

          const proposal: Proposal = {
            id: `prop_rel_${Date.now()}_${idx}`,
            relation: newRelation,
            status: 'proposed',
            proposedBy: 'gemini-2.5-flash',
            notes: `Propozycja relacji pomiędzy ${targetEntity.name} a ${profEntity.name}`,
            createdAt: now,
          };

          await this.saveProposalToFileAndDb(proposal);
          proposals.push(proposal);
        }
      }
    }

    return proposals;
  }

  private async generateMockProposal(professionName: string): Promise<Proposal[]> {
    const now = new Date().toISOString();
    const mockEntity: Entity = {
      id: `device:specjalistyczny-sprzet-${Date.now()}`,
      type: 'device',
      name: `Analizator Diagnostyczny dla ${professionName}`,
      aliases: [`Analizator ${professionName}`],
      description: `Wykryte urządzenie pomiarowe i diagnostyczne wykorzystywane przez ${professionName}`,
      tags: ['diagnostyka', 'gemini-proposal'],
      status: 'proposed',
      confidence: 0.8,
      source: 'gemini',
      createdAt: now,
      updatedAt: now,
    };

    const proposal: Proposal = {
      id: `prop_mock_${Date.now()}`,
      entity: mockEntity,
      status: 'proposed',
      proposedBy: 'gemini-provider-simulation',
      notes: `Niezweryfikowana propozycja urządzeń dla profesji ${professionName}`,
      createdAt: now,
    };

    await this.saveProposalToFileAndDb(proposal);
    return [proposal];
  }

  private async saveProposalToFileAndDb(proposal: Proposal): Promise<void> {
    await this.repo.saveProposal(proposal);

    const pendingDir = path.resolve('./data/proposals/pending');
    if (!fs.existsSync(pendingDir)) {
      fs.mkdirSync(pendingDir, { recursive: true });
    }
    const filePath = path.join(pendingDir, `${proposal.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(proposal, null, 2), 'utf-8');

    const auditDir = path.resolve('./data/audit');
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true });
    }
    const auditPath = path.join(auditDir, 'changes.jsonl');
    const logLine = JSON.stringify({ action: 'PROPOSAL_CREATED', proposalId: proposal.id, timestamp: new Date().toISOString() }) + '\n';
    fs.appendFileSync(auditPath, logLine, 'utf-8');
  }
}
