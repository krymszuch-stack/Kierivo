import {beforeEach, describe, expect, it, vi} from 'vitest';
import {BLACKBOX_IMPORT_TYPE, BLACKBOX_EXCLUDED, blackboxConfirmation, blackboxEnvelope, buildApplicationFromBlackbox, correctApplicationBlackbox, normalizeBlackboxUrl, parseApplicationImportEnvelope, parseApplicationSnapshot, type ApplicationSnapshot, type ApplicationImportEnvelope} from '../applicationBlackbox';
import {buildApplicationFromReceipt, parseApplicationReceiptMessage, HUNTER_APPLICATION_RECEIPT_MESSAGE} from '../applicationReceipt';
import {migrateApplication} from '../../../lib/dataMigration';
import {isJobApplication, parseApplications} from '../../../lib/applicationRecordSchema';
import {resolveApplicationJobOffer} from '../../../lib/applicationSnapshot';
import {MemoryStorage} from '../../../lib/__tests__/helpers/memoryStorage';
import * as storage from '../../../lib/storage';
import {loadApplicationsFor, saveApplicationDurablyFor} from '../../../store/useApplications';
const at='2026-10-22T10:00:00.000Z';
const url='https://jobs.lever.co/synthetic/12345678-1234-1234-1234-123456789abc';
const receipt={schemaVersion:1 as const,receiptId:'receipt-synthetic',company:'Synthetic',position:'Role',submittedAt:at,jobUrl:url};
const snapshot=(changes:Partial<ApplicationSnapshot>={}):ApplicationSnapshot=>({schemaVersion:1,snapshotId:'snapshot-one',attemptId:'attempt-one',capturedAt:at,approvedAt:at,
  job:{canonicalUrl:url,companyName:'Synthetic',roleTitle:'Role'},stepCount:1,completeness:'unconfirmed',profileRevision:'profile-v1',cvRevision:'cv-v2',
  answers:[{answerId:'answer-one',stepKey:'step-one',category:'salary',label:'Salary',value:'18000 PLN',capturedAt:at,provenance:'observed_form_value'}],...changes});
const envelope=(changes:Partial<ApplicationImportEnvelope>={}):ApplicationImportEnvelope=>({type:BLACKBOX_IMPORT_TYPE,schemaVersion:1,snapshot:snapshot(),...changes});
beforeEach(()=>{vi.restoreAllMocks();vi.stubGlobal('localStorage',new MemoryStorage());storage.resetLastGoodCache();});
describe('Application Blackbox — zatwierdzony import lokalny',()=>{
  it('odrzuca dodatkowe klucze, złą wersję, brak modułu i nie zmienia receipt v1',()=>{
    expect(parseApplicationImportEnvelope(envelope())).not.toBeNull();
    for(const bad of [{...envelope(),extra:true},{...envelope(),schemaVersion:2},{type:BLACKBOX_IMPORT_TYPE,schemaVersion:1}])expect(parseApplicationImportEnvelope(bad)).toBeNull();
    expect(parseApplicationSnapshot({...snapshot(),revisions:[]})).toBeNull();
    expect(parseApplicationReceiptMessage({type:HUNTER_APPLICATION_RECEIPT_MESSAGE,receipt:{...receipt,snapshot:snapshot()}})).toBeNull();
    expect(parseApplicationReceiptMessage({type:HUNTER_APPLICATION_RECEIPT_MESSAGE,receipt})).not.toBeNull();
  });
  it('wspólny URL jest HTTPS bez poświadczeń/fragmentu, wyjątek loopback tylko w teście',()=>{
    for(const bad of ['http://example.test/',url+'#',url+'#fragment','https://user:pass@example.test/','https://example.test/'+'x'.repeat(2048)])expect(normalizeBlackboxUrl(bad)).toBeNull();
    expect(normalizeBlackboxUrl('http://127.0.0.1:3000/job')).toBeNull();
    expect(normalizeBlackboxUrl('http://127.0.0.1:3000/job',true)).toBe('http://127.0.0.1:3000/job');
    expect(parseApplicationImportEnvelope(envelope({receipt:{...receipt,jobUrl:url+'#'},snapshot:snapshot({receiptId:receipt.receiptId})}))).toBeNull();
  });
  it('blokuje dane wrażliwe, zbyt długie wartości, duplikaty i nadmiar kroków',()=>{
    for(const label of ['Medical history','Marital status','Nationality','Disability','PESEL','Date of birth']) {
      expect(BLACKBOX_EXCLUDED.test(label)).toBe(true);
      expect(parseApplicationSnapshot(snapshot({answers:[{...snapshot().answers[0],label}]}))).toBeNull();
    }
    for(const changes of [{stepCount:21},{answers:[snapshot().answers[0],snapshot().answers[0]]},{answers:[{...snapshot().answers[0],value:'x'.repeat(1501)}]}])expect(parseApplicationSnapshot(snapshot(changes))).toBeNull();
  });
  it('para wymaga zgodnego receiptId, URL, firmy i roli',()=>{
    const pair=envelope({receipt,snapshot:snapshot({receiptId:receipt.receiptId})});
    expect(parseApplicationImportEnvelope(pair)).not.toBeNull();
    for(const changes of [{receiptId:'different-id'},{company:'Other'},{position:'Other'},{jobUrl:url+'/other'}])expect(parseApplicationImportEnvelope({...pair,receipt:{...receipt,...changes}})).toBeNull();
  });
  it('sama migawka nie tworzy wysłania ani potwierdzenia ATS',()=>{
    const app=buildApplicationFromBlackbox(envelope(),[],'UTC');
    expect(app.status).toBe('Do wysłania');expect(app.events).toEqual([]);expect(blackboxConfirmation(app)).toBe('captured');
    expect(isJobApplication(app)).toBe(true);
  });
  it('receipt najpierw, potem migawka i retry zachowują jedną aplikację oraz jedno zdarzenie',()=>{
    const first=buildApplicationFromReceipt(receipt,undefined,'UTC');
    let next=buildApplicationFromBlackbox(envelope({receipt,snapshot:snapshot({receiptId:receipt.receiptId})}),[first],'UTC');
    for(let i=0;i<3;i++)next=buildApplicationFromBlackbox(envelope({receipt,snapshot:snapshot({receiptId:receipt.receiptId})}),[next],'UTC');
    expect(next.id).toBe(first.id);expect(next.events).toHaveLength(1);expect(next.applicationBlackbox?.snapshot.answers).toHaveLength(1);
    expect(blackboxConfirmation(next)).toBe('user_declared_sent');expect(next.events?.[0].verificationStatus).toBe('user_declared');
  });
  it('migawka najpierw, potem receipt wymagają jawnego wybrania istniejącego zgłoszenia',()=>{
    const first=buildApplicationFromBlackbox(envelope(),[],'UTC');
    const next=buildApplicationFromBlackbox({type:BLACKBOX_IMPORT_TYPE,schemaVersion:1,receipt},[first],'UTC',first.id);
    expect(next.id).toBe(first.id);expect(next.status).toBe('Wysłana');expect(next.events).toHaveLength(1);
    expect(blackboxEnvelope(next)?.snapshot?.receiptId).toBe(receipt.receiptId);
    expect(buildApplicationFromBlackbox({type:BLACKBOX_IMPORT_TYPE,schemaVersion:1,receipt},[next],'UTC').id).toBe(first.id);
  });
  it('restart i migracja zachowują odpowiedzi, metadane i kanoniczne events[]',()=>{
    const first=buildApplicationFromBlackbox(envelope({receipt,snapshot:snapshot({receiptId:receipt.receiptId})}),[],'UTC');
    const restored=migrateApplication(JSON.parse(JSON.stringify(first)));
    expect(restored?.applicationBlackbox).toEqual(first.applicationBlackbox);expect(restored?.events).toEqual(first.events);
    expect(parseApplications([restored]).applications).toHaveLength(1);
  });
  it('korekta aktualizuje jeden wpis, datę i JD; starszy retry nie cofa korekty',()=>{
    const first=buildApplicationFromBlackbox(envelope(),[],'UTC');
    const next=correctApplicationBlackbox(first,{'answer-one':'21000 PLN'},'Synthetic JD for a warehouse role','2026-10-22T11:00:00.000Z');
    expect(next.applicationBlackbox?.snapshot.correctedAfterApprovalAt).toBe('2026-10-22T11:00:00.000Z');
    expect(next.applicationBlackbox?.snapshot.answers[0].value).toBe('21000 PLN');expect(next.applicationBlackbox).not.toHaveProperty('revisions');
    expect(resolveApplicationJobOffer(next)?.description).toContain('warehouse');
    expect(()=>buildApplicationFromBlackbox(envelope(),[next],'UTC')).toThrow('Starsza migawka');
    expect(parseApplicationImportEnvelope(blackboxEnvelope(next))).not.toBeNull();
  });
  it('usunięcie migawki pozostawia oś zdarzeń i kompatybilny rekord legacy',()=>{
    const app=buildApplicationFromBlackbox(envelope({receipt,snapshot:snapshot({receiptId:receipt.receiptId})}),[],'UTC');
    const next={...app,applicationBlackbox:undefined};expect(isJobApplication(next)).toBe(true);expect(next.events).toHaveLength(1);expect(blackboxEnvelope(next)).toBeNull();
  });
  it('błędna migawka zostaje w kwarantannie rekordu zamiast cicho znikać',()=>{
    const app=buildApplicationFromBlackbox(envelope(),[],'UTC');
    const malformed={...app,applicationBlackbox:{...app.applicationBlackbox,snapshot:{...snapshot(),answers:[]}}};
    expect(parseApplications([malformed]).rejected).toEqual([malformed]);
  });
  it('zapis profili jest izolowany, a błąd utrwalenia nie publikuje ani nie nadpisuje danych',async()=>{
    const app=buildApplicationFromBlackbox(envelope(),[],'UTC');
    expect(await saveApplicationDurablyFor('blackbox-profile-a',app)).toBe(true);
    expect(loadApplicationsFor('blackbox-profile-b')).toEqual([]);
    const previous=localStorage.getItem(storage.applicationsKeyFor('blackbox-profile-a'));
    vi.spyOn(storage,'writeJsonDurably').mockResolvedValue(false);
    expect(await saveApplicationDurablyFor('blackbox-profile-a',{...app,company:'Changed'})).toBe(false);
    expect(localStorage.getItem(storage.applicationsKeyFor('blackbox-profile-a'))).toBe(previous);
    expect(loadApplicationsFor('blackbox-profile-a')[0].company).toBe('Synthetic');
    expect(await saveApplicationDurablyFor('anonymous',app)).toBe(false);
  });
  it('wyczyszczenie profilu unieważnia spóźnione potwierdzenie trwałości',async()=>{
    const profile='blackbox-pending-wipe';
    const app=buildApplicationFromBlackbox(envelope(),[],'UTC');
    let release!:(value:boolean)=>void;
    vi.spyOn(storage,'writeJsonDurably').mockImplementation(()=>new Promise(resolve=>{release=resolve;}));
    const pending=saveApplicationDurablyFor(profile,app);
    expect(await storage.clearProfileStorageDurably(profile)).toBe(true);
    release(true);expect(await pending).toBe(false);expect(loadApplicationsFor(profile)).toEqual([]);
  });
  it('korekta obsługuje boolean i listę; filtr wrażliwych wartości działa ponownie',()=>{
    const answer=snapshot().answers[0];
    const app=buildApplicationFromBlackbox(envelope({snapshot:snapshot({answers:[{...answer,category:'work-authorization',value:true},
      {...answer,answerId:'answer-two',category:'work-mode',label:'Work mode',value:['Remote']}]})}),[],'UTC');
    const corrected=correctApplicationBlackbox(app,{'answer-one':false,'answer-two':['Office']},'','2026-10-22T12:00:00.000Z');
    expect(corrected.applicationBlackbox?.snapshot.answers.map(answer=>answer.value)).toEqual([false,['Office']]);
    expect(()=>correctApplicationBlackbox(app,{'answer-two':['Medical history']},'',at)).toThrow();
  });

});
