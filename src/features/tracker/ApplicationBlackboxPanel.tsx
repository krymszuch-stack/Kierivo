import React, {useEffect, useRef, useState} from 'react';
import type {JobApplication} from '../../types';
import {onAppStorageWiped, onProfileStorageCleared} from '../../lib/storage';
import {useAuth} from '../../context/AuthContext';
import {Modal} from '../../components/ui/Modal';
import {Button} from '../../components/ui/Button';
import {Card} from '../../components/ui/Card';
import {useScopedAsyncOperation} from '../../hooks/useScopedAsyncOperation';
import {saveApplicationDurablyFor} from '../../store/useApplications';
import {BLACKBOX_MAX_BYTES, blackboxConfirmation, blackboxEnvelope, buildApplicationFromBlackbox, correctApplicationBlackbox, findBlackboxImportCandidates, parseApplicationImportEnvelope, type ApplicationImportEnvelope} from './applicationBlackbox';

function download(application: JobApplication) {
  const envelope=blackboxEnvelope(application);
  if (!envelope) return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(envelope,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='kierivo-application-blackbox.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
interface Props {applications:JobApplication[];onInterviewPrep:(application:JobApplication)=>void}
export function ApplicationBlackboxPanel(props:Props) {
  const {user}=useAuth();
  const [storageRevision,setStorageRevision]=useState(0);
  useEffect(()=>{
    const clear=()=>setStorageRevision(revision=>revision+1);
    const offWipe=onAppStorageWiped(clear);
    const offProfile=onProfileStorageCleared(id=>{if(id===user?.id)clear();});
    return ()=>{offWipe();offProfile();};
  },[user?.id]);
  // Klucz odmontowuje również podgląd i oczekujący odczyt przy zmianie właściciela.
  return user ? <ScopedBlackboxPanel key={`${user.id}:${storageRevision}`} {...props} profileId={user.id} /> : null;
}
function ScopedBlackboxPanel({applications,profileId,onInterviewPrep}:Props & {profileId:string}) {
  const [preview,setPreview]=useState<ApplicationImportEnvelope|null>(null);
  const [opened,setOpened]=useState<JobApplication|null>(null);
  const [values,setValues]=useState<Record<string,unknown>>({});
  const [description,setDescription]=useState('');
  const [message,setMessage]=useState('');
  const [targetId,setTargetId]=useState('');
  const generation=useRef(0);
  const operation=useScopedAsyncOperation(profileId);
  const reading=useScopedAsyncOperation(profileId);
  const current=opened ? applications.find(app=>app.id===opened.id) : undefined;
  const close=()=>{generation.current++;setPreview(null);setTargetId('');setOpened(null);setValues({});setDescription('');};
  async function read(file:File|undefined) {
    const token=reading.begin();if(!token)return;
    const revision=++generation.current;setPreview(null);setMessage('');
    try {
      if(!file || file.size>BLACKBOX_MAX_BYTES) throw new Error();
      const contents=await file.text();
      if(!reading.isCurrent(token)||generation.current!==revision)return;
      const envelope=parseApplicationImportEnvelope(JSON.parse(contents));
      if(!envelope)throw new Error();
      // Tożsamość, konflikty i retry są sprawdzane ponownie przy zatwierdzeniu.
      setPreview(envelope);setTargetId('');
    } catch {if(reading.isCurrent(token)&&generation.current===revision)setMessage('Nie można bezpiecznie odczytać pliku. Sprawdź format, limit 256 KiB i zgodność danych.');}
    finally{reading.finish(token);}
  }
  async function persist(application:JobApplication) {
    const token=operation.begin();if(!token)return;
    try {
      const saved=await saveApplicationDurablyFor(profileId,application);
      if(!operation.isCurrent(token))return;
      if(!saved){setMessage('Nie zapisano zmiany. Dotychczasowe dane pozostają zachowane.');return;}
      close();setMessage('Zapisano lokalnie w bieżącym profilu. Nie potwierdza to odbioru przez ATS.');
    } catch {if(operation.isCurrent(token))setMessage('Nie zapisano zmiany. Sprawdź spójność migawki i możliwość zapisu.');}
    finally{operation.finish(token);}
  }
  function approve() {
    if(!preview)return;
    try{void persist(buildApplicationFromBlackbox(preview,applications,Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',targetId || undefined));}
    catch{setMessage('Konflikt migawki z zapisaną aplikacją. Nie nadpisano danych.');}
  }
  function correct() {
    if(!current)return;
    try{void persist(correctApplicationBlackbox(current,values,description,new Date().toISOString()));}
    catch{setMessage('Nie zapisano korekty: sprawdź limity i wykluczone kategorie.');}
  }
  const box=current?.applicationBlackbox;
  return <Card className="space-y-3" data-testid="application-blackbox-panel">
    <h2 className="font-semibold text-ink">Application Blackbox</h2>
    <p className="text-sm text-muted">Lokalna pamięć zatwierdzonych odpowiedzi. Dane i eksport JSON są jawne, bez szyfrowania. Zachowujemy je do usunięcia migawki, aplikacji lub profilu; eksportowane pliki usuń osobno.</p>
    <label className="block text-sm text-ink">Importuj plik Huntera
      <input aria-label="Importuj plik Blackbox" type="file" accept="application/json,.json" disabled={reading.isBusy||operation.isBusy}
        onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';void read(file);}} className="block w-full" />
    </label>
    <p role="status" aria-live="polite" className="text-sm text-muted">{message}</p>
    <ul className="space-y-2">{applications.filter(app=>app.applicationBlackbox).map(app=><li key={app.id}>
      <Button variant="secondary" onClick={()=>{close();setOpened(app);setDescription(app.applicationBlackbox!.snapshot.job.description || '');}}>
        Blackbox: {app.company || 'firma niepodana'} · {app.position || 'rola niepodana'}
      </Button>
    </li>)}</ul>
    <Modal isOpen={Boolean(preview)} onClose={close} title="Sprawdź import Blackbox" size="lg">
      {preview && <div className="space-y-3">
        <p>{preview.snapshot?.job.companyName || preview.receipt?.company || 'Firma niepodana'} · {preview.snapshot?.job.roleTitle || preview.receipt?.position || 'Rola niepodana'}</p>
        <p role="status">{preview.receipt ? 'Użytkownik zadeklarował wysłanie. Odbiór ATS niepotwierdzony.' : 'Zapisano odpowiedzi — wysłanie i odbiór ATS niepotwierdzone.'}</p>
        <p className="text-sm text-muted">Import zapisze tylko pokazane, wcześniej zatwierdzone odpowiedzi. Nie odczytuje profilu z pliku ani nie wysyła nic do sieci.</p>
        {findBlackboxImportCandidates(preview,applications).length > 0 && <label className="block">Istniejące zgłoszenie (łączenie wymaga wyboru)
          <select aria-label="Docelowa aplikacja Blackbox" className="block w-full border border-line bg-surface p-2 text-ink" value={targetId} onChange={event=>setTargetId(event.target.value)}>
            <option value="">Nowa aplikacja / automatyczny retry tego samego identyfikatora</option>
            {findBlackboxImportCandidates(preview,applications).map(app=><option key={app.id} value={app.id}>{app.company} · {app.position} · {app.date}</option>)}
          </select>
        </label>}
        {preview.snapshot && !preview.receipt && <div className="space-y-2">{(['companyName','roleTitle'] as const).map(key=><label key={key} className="block">{key==='companyName'?'Firma':'Rola'} (jeśli niepodana, uzupełnij jawnie)
          <input aria-label={`Blackbox ${key}`} maxLength={300} className="block w-full border border-line bg-surface p-2 text-ink" value={preview.snapshot!.job[key] || ''}
            onChange={event=>setPreview({...preview,snapshot:{...preview.snapshot!,job:{...preview.snapshot!.job,[key]:event.target.value || undefined}}})}/>
        </label>)}</div>}
        <dl>{preview.snapshot?.answers.map(answer=><React.Fragment key={answer.answerId}><dt className="font-semibold">{answer.label}</dt><dd className="mb-3 break-words">{String(answer.value)}</dd></React.Fragment>)}</dl>
        <Button onClick={approve} disabled={operation.isBusy}>Zatwierdź import w tym profilu</Button>
      </div>}
    </Modal>
    <Modal isOpen={Boolean(current&&box)} onClose={close} title="Pamięć zgłoszenia" size="lg">
      {current&&box&&<div className="space-y-4">
        <h3>{current.company || 'Firma niepodana'} · {current.position || 'Rola niepodana'}</h3>
        <p role="status">{blackboxConfirmation(current)==='captured'?'Zapisano odpowiedzi; wysłanie niepotwierdzone.':'Użytkownik zadeklarował wysłanie.'} Odbiór ATS niepotwierdzony.</p>
        <p className="text-sm text-muted">Źródło: odczyt formularza Hunter na żądanie. Odczyt: {box.snapshot.capturedAt}. Zatwierdzenie: {box.snapshot.approvedAt}. Pokrycie: {box.snapshot.stepCount} kroków; kompletność niepotwierdzona.</p>
        <p>Rewizja profilu: {box.snapshot.profileRevision || 'nieznana'} · Rewizja CV: {box.snapshot.cvRevision || 'nieznana'}. Rewizja nie dowodzi załączenia pliku CV.</p>
        {box.snapshot.correctedAfterApprovalAt&&<p>Korekta po zatwierdzeniu: {box.snapshot.correctedAfterApprovalAt}</p>}
        {box.snapshot.answers.map(answer=><label key={answer.answerId} className="block text-sm font-semibold">{answer.label}
          {typeof answer.value==='string'?<textarea aria-label={`Korekta: ${answer.label}`} maxLength={1500} className="block w-full rounded border border-line bg-surface p-2 text-ink" value={String(values[answer.answerId]??answer.value)} onChange={event=>setValues({...values,[answer.answerId]:event.target.value})}/>:typeof answer.value==='boolean'?<input type="checkbox" aria-label={`Korekta: ${answer.label}`} checked={Boolean(values[answer.answerId]??answer.value)} onChange={event=>setValues({...values,[answer.answerId]:event.target.checked})}/>
            :<textarea aria-label={`Korekta: ${answer.label}`} className="block w-full border border-line bg-surface p-2 text-ink" value={(values[answer.answerId] as string[] || answer.value as string[]).join('\n')} onChange={event=>setValues({...values,[answer.answerId]:event.target.value.split('\n')})}/>}
          <span className="block text-xs font-normal text-muted">{answer.category} · {answer.capturedAt} · observed_form_value</span>
        </label>)}
        <label className="block text-sm">Treść oferty (JD) — podaj jawnie, jeśli nie została zachowana
          <textarea aria-label="Treść oferty Blackbox" maxLength={20000} className="block w-full rounded border border-line bg-surface p-2 text-ink" value={description} onChange={event=>setDescription(event.target.value)}/>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={correct} disabled={operation.isBusy}>Zapisz korektę migawki</Button>
          <Button variant="secondary" onClick={()=>download(current)}>Eksportuj migawkę</Button>
          <Button variant="secondary" disabled={!box.snapshot.job.description?.trim()} onClick={()=>{onInterviewPrep(current);close();}}>Interview Prep</Button>
          <Button variant="ghost" disabled={operation.isBusy} onClick={()=>{if(window.confirm('Usunąć odpowiedzi i metadane Blackbox? Aplikacja oraz jej oś zdarzeń pozostaną.'))void persist({...current,applicationBlackbox:undefined});}}>Usuń migawkę</Button>
        </div>
        <p className="text-xs text-muted">Interview Prep użyje zapisanej oferty oraz historycznego profilu, jeśli istnieje; w przeciwnym razie bieżącego profilu. Odpowiedzi Blackbox nie są przekazywane do AI.</p>
      </div>}
    </Modal>
  </Card>;
}
