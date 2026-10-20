import { describe, expect, it } from 'vitest';
import type { JobApplication } from '../../../types';
import {
  buildApplicationFromReceipt,
  findSameDayReceiptCandidate,
  findApplicationForReceipt,
  HUNTER_APPLICATION_RECEIPT_MESSAGE,
  parseApplicationReceiptMessage,
  parseSameWindowApplicationReceipt,
} from '../applicationReceipt';

const message = {
  type: HUNTER_APPLICATION_RECEIPT_MESSAGE,
  receipt: {
    schemaVersion: 1,
    receiptId: '123e4567-e89b-12d3-a456-426614174000',
    company: ' Firma testowa ',
    position: 'Inżynier',
    submittedAt: '2026-10-20T10:15:00.000Z',
    jobUrl: 'https://jobs.example.test/role/123',
  },
};

describe('potwierdzenie wysłania z Kierivo Hunter', () => {
  it('akceptuje tylko minimalny, jawnie potwierdzony receipt i normalizuje pola tekstowe', () => {
    expect(parseApplicationReceiptMessage(message)).toEqual({
      schemaVersion: 1,
      receiptId: '123e4567-e89b-12d3-a456-426614174000',
      company: 'Firma testowa',
      position: 'Inżynier',
      submittedAt: '2026-10-20T10:15:00.000Z',
      jobUrl: 'https://jobs.example.test/role/123',
    });
  });

  it('odrzuca dodatkowe dane profilu, zły URL i czas bez strefy', () => {
    expect(parseApplicationReceiptMessage({ ...message, receipt: { ...message.receipt, cv: 'synthetic CV' } })).toBeNull();
    expect(parseApplicationReceiptMessage({ ...message, receipt: { ...message.receipt, jobUrl: 'javascript:alert(1)' } })).toBeNull();
    expect(parseApplicationReceiptMessage({ ...message, receipt: { ...message.receipt, submittedAt: '2026-10-20T10:15:00' } })).toBeNull();
    expect(parseApplicationReceiptMessage({ ...message, receipt: { ...message.receipt, submittedAt: '2026-02-30T10:15:00.000Z' } })).toBeNull();
    expect(parseApplicationReceiptMessage({ ...message, extra: 'unexpected' })).toBeNull();
  });

  it('przyjmuje receipt tylko z bieżącego okna i originu', () => {
    const targetWindow = {} as Window;
    const event = { source: targetWindow, origin: 'https://kierivo.com', data: message };

    expect(parseSameWindowApplicationReceipt(event, targetWindow, 'https://kierivo.com')).not.toBeNull();
    expect(parseSameWindowApplicationReceipt({ ...event, source: {} as Window }, targetWindow, event.origin)).toBeNull();
    expect(parseSameWindowApplicationReceipt({ ...event, origin: 'https://other.example' }, targetWindow, event.origin)).toBeNull();
  });

  it('tworzy wysłaną aplikację z potwierdzonym zdarzeniem źródłowym i datą lokalną', () => {
    const receipt = parseApplicationReceiptMessage(message);
    expect(receipt).not.toBeNull();
    const application = buildApplicationFromReceipt(receipt!, undefined, 'America/Los_Angeles');

    expect(application).toMatchObject({
      id: 'hunter-123e4567-e89b-12d3-a456-426614174000',
      company: 'Firma testowa',
      position: 'Inżynier',
      date: '2026-10-20',
      status: 'Wysłana',
      jobUrl: 'https://jobs.example.test/role/123',
    });
    expect(application.events).toEqual([expect.objectContaining({
      kind: 'application_sent',
      state: 'confirmed',
      source: 'extension',
      verificationStatus: 'user_declared',
      sourceEventId: receipt!.receiptId,
      timeZone: 'America/Los_Angeles',
    })]);
  });

  it('scala powtórny import z istniejącą aplikacją bez duplikatu i zachowuje ręczne pola', () => {
    const receipt = parseApplicationReceiptMessage(message)!;
    const first = buildApplicationFromReceipt(receipt, undefined, 'Europe/Warsaw');
    const edited: JobApplication = { ...first, position: 'Moja poprawiona rola', notes: 'Notatka prywatna', status: 'Rozmowa' };

    expect(findApplicationForReceipt([edited], receipt.receiptId)).toBe(edited);
    const retried = buildApplicationFromReceipt(receipt, edited, 'Europe/Warsaw');
    expect(retried.events).toHaveLength(1);
    expect(retried.position).toBe('Moja poprawiona rola');
    expect(retried.notes).toBe('Notatka prywatna');
    expect(retried.status).toBe('Rozmowa');
  });

  it('wykrywa możliwe ponowne zgłoszenie tego samego dnia, ale ignoruje różny URL lub dzień', () => {
    const receipt = parseApplicationReceiptMessage(message)!;
    const existing: JobApplication = {
      id: 'manual-1', company: 'FIRMA TESTOWA', position: 'Inżynier', salary: '',
      date: '2026-10-20', status: 'Wysłana', jobUrl: 'https://jobs.example.test/role/123?utm_source=mail',
    };

    expect(findSameDayReceiptCandidate([existing], receipt, 'UTC')).toBe(existing);
    expect(findSameDayReceiptCandidate([{ ...existing, date: '2026-10-19' }], receipt, 'UTC')).toBeUndefined();
    expect(findSameDayReceiptCandidate([{ ...existing, jobUrl: 'https://jobs.example.test/role/456' }], receipt, 'UTC')).toBeUndefined();
  });
});
