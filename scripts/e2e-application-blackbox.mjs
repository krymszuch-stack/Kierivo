import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtempSync,readFileSync,rmSync,existsSync,readdirSync} from 'node:fs';
import {tmpdir,homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hunter=process.env.HUNTER_CHECKOUT;
if(!hunter)throw new Error('Ustaw HUNTER_CHECKOUT na checkout kierivo-hunter z Wycinkiem 1A.');
function browserBinary(){
  const cache=path.join(homedir(),'.cache/ms-playwright');
  const cached=existsSync(cache)?readdirSync(cache).filter(name=>name.startsWith('chromium-')).sort().reverse().flatMap(name=>['chrome-linux64/chrome','chrome-linux/chrome'].map(file=>path.join(cache,name,file))):[];
  const selected=[process.env.HUNTER_CHROMIUM_PATH,process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,process.env.CHROME_BIN,chromium.executablePath(),...cached,'/usr/bin/chromium','/usr/bin/google-chrome','/usr/bin/brave-browser'].find(file=>file&&existsSync(file));
  if(!selected)throw new Error('Brak Chromium. Uruchom npx playwright install chromium.');
  return selected;
}
const temp=mkdtempSync(path.join(tmpdir(),'kierivo-blackbox-acceptance-'));
let server,browser;
try {
  const producer=await promisify(execFile)(process.execPath,['scripts/test-autofill-installed.mjs'],{cwd:hunter,
    env:{...process.env,HUNTER_BLACKBOX_ONLY:'1',HUNTER_BLACKBOX_EXPORT_DIR:temp},maxBuffer:2*1024*1024,timeout:180000});
  const producerReport=JSON.parse(producer.stdout.split('\n').find(line=>line.startsWith('ADR163_BLACKBOX ')).slice('ADR163_BLACKBOX '.length));
  assert.equal(producerReport.installedMV3,true);assert.equal(producerReport.twoSyntheticForms,true);assert.equal(producerReport.bothFormsNextBack,true);
  assert.equal(producerReport.explicitUserSubmitBeforeReceipt,true);
  const files=['react-snapshot.json','react-pair.json','native-snapshot.json','native-pair.json'];
  const exports=Object.fromEntries(files.map(file=>[file,JSON.parse(readFileSync(path.join(temp,file),'utf8'))]));
  const producerSchema=await import(pathToFileURL(path.join(hunter,'extension/applicationBlackboxSchema.js')).href);
  for(const value of Object.values(exports))assert.ok(producerSchema.parseApplicationImportEnvelope(value));
  server=await createServer({root,server:{host:'127.0.0.1',port:0}});await server.listen();
  const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({headless:true,executablePath:browserBinary()});
  const context=await browser.newContext({acceptDownloads:true});
  const page=await context.newPage();const logs=[];let writeRequests=0;
  page.on('console',message=>logs.push(message.text()));
  await context.route('**/*',route=>{
    const request=route.request();
    if(!request.url().startsWith(base+'/'))return route.abort();
    if(!['GET','HEAD'].includes(request.method())){writeRequests++;return route.abort();}
    return route.continue();
  });
  await page.goto(base);
  assert.equal(await page.evaluate(async()=> (await import('/src/features/tracker/applicationBlackbox.ts')).BLACKBOX_EXCLUDED.source),new RegExp(producerSchema.BLACKBOX_CAPTURE_POLICY.excluded,'iu').source,'producer and consumer exclusions agree');
  const profileA=await page.evaluate(async()=>{
    const {createLocalProfile}=await import('/src/lib/localProfile.ts');
    const result=await createLocalProfile('Synthetic Blackbox A');return result.profile.id;
  });
  async function pipeline(){await page.getByRole('button',{name:'Aplikacje',exact:true}).click();await page.getByLabel('Importuj plik Blackbox',{exact:true}).waitFor();}
  await page.reload();await pipeline();
  const panel=page.getByTestId('application-blackbox-panel');
  const records=()=>page.evaluate(async id=>(await import('/src/store/useApplications.ts')).loadApplicationsFor(id),profileA);
  async function importFile(filename,target){
    await page.getByLabel('Importuj plik Blackbox',{exact:true}).setInputFiles(path.join(temp,filename));
    const review=page.getByRole('dialog',{name:'Sprawdź import Blackbox'});await review.waitFor();
    if(target)await review.getByLabel('Docelowa aplikacja Blackbox').selectOption(target);
    await review.getByRole('button',{name:'Zatwierdź import w tym profilu'}).click();
    await review.waitFor({state:'hidden'});
    await panel.getByRole('status').filter({hasText:'Zapisano lokalnie'}).waitFor();
  }
  async function openCard(){await panel.getByRole('button',{name:/Blackbox: Synthetic Employer/}).click();return page.getByRole('dialog',{name:'Pamięć zgłoszenia'});}
  // Migawka nie jest aplikacją wysłaną. Podgląd nie zapisuje nic przed zgodą.
  await page.getByLabel('Importuj plik Blackbox',{exact:true}).setInputFiles(path.join(temp,'react-snapshot.json'));
  await page.getByRole('dialog',{name:'Sprawdź import Blackbox'}).waitFor();assert.equal((await records()).length,0);
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  await importFile('react-snapshot.json');let saved=await records();assert.equal(saved.length,1);assert.equal(saved[0].status,'Do wysłania');assert.deepEqual(saved[0].events,[]);
  const id=saved[0].id;
  await importFile('react-pair.json',id);saved=await records();assert.equal(saved.length,1);assert.equal(saved[0].events.length,1);assert.equal(saved[0].events[0].verificationStatus,'user_declared');
  await page.reload();await pipeline();await importFile('react-pair.json');saved=await records();assert.equal(saved.length,1);assert.equal(saved[0].events.length,1);
  let card=await openCard();await card.getByText('Użytkownik zadeklarował wysłanie.',{exact:false}).waitFor();
  await card.getByLabel('Korekta: Salary',{exact:true}).fill('24000 PLN');
  await card.getByLabel('Treść oferty Blackbox').fill('Synthetic warehouse role. Requirements: safe warehouse operations, inventory checks.');
  await card.getByRole('button',{name:'Zapisz korektę migawki'}).click();await card.waitFor({state:'hidden'});
  saved=await records();assert.equal(saved[0].applicationBlackbox.snapshot.answers.find(answer=>answer.category==='salary').value,'24000 PLN');assert.ok(saved[0].applicationBlackbox.snapshot.correctedAfterApprovalAt);
  card=await openCard();
  const [download]=await Promise.all([page.waitForEvent('download'),card.getByRole('button',{name:'Eksportuj migawkę'}).click()]);
  const downloaded=JSON.parse(readFileSync(await download.path(),'utf8'));assert.equal(downloaded.snapshot.job.description.includes('warehouse'),true);assert.ok(producerSchema.parseApplicationImportEnvelope(downloaded),'corrected consumer export remains producer-compatible');
  await card.getByRole('button',{name:'Interview Prep',exact:true}).click();
  await page.getByRole('dialog',{name:/Ściąga na rozmowę/}).waitFor();
  await page.getByText('historyczny wariant CV jest niedostępny.',{exact:false}).waitFor();
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  // Starszy eksport po korekcie ma odmowę i nie zmienia zapisanych odpowiedzi.
  await page.getByLabel('Importuj plik Blackbox',{exact:true}).setInputFiles(path.join(temp,'react-pair.json'));
  const stale=page.getByRole('dialog',{name:'Sprawdź import Blackbox'});await stale.waitFor();
  await stale.getByRole('button',{name:'Zatwierdź import w tym profilu'}).click();
  await panel.getByRole('status').filter({hasText:'Konflikt migawki'}).waitFor();
  assert.equal((await records())[0].applicationBlackbox.snapshot.answers.find(answer=>answer.category==='salary').value,'24000 PLN');
  await page.keyboard.press('Escape');await stale.waitFor({state:'hidden'});
  // Drugi, natywny formularz: stary receipt v1 najpierw, migawka później.
  const nativeReceipt=exports['native-pair.json'].receipt;
  await page.evaluate(receipt=>window.postMessage({type:'KIERIVO_HUNTER_APPLICATION_RECEIPT_V1',receipt},location.origin),nativeReceipt);
  const legacyReview=page.getByRole('dialog',{name:'Sprawdź potwierdzenie z Huntera'});await legacyReview.waitFor();
  await legacyReview.getByRole('button',{name:/Zapisz/}).last().click();await legacyReview.waitFor({state:'hidden'});
  await importFile('native-pair.json');await importFile('native-pair.json');saved=await records();assert.equal(saved.length,2);
  const native=saved.find(app=>app.applicationBlackbox?.snapshot.attemptId===exports['native-pair.json'].snapshot.attemptId);
  assert.equal(native.events.length,1);assert.equal(native.applicationBlackbox.snapshot.answers.length,4);
  // Osobny profil nie może odczytać historii A; ponowne wznowienie A ją zachowuje.
  const profileB=await page.evaluate(async()=> (await (await import('/src/lib/localProfile.ts')).createLocalProfile('Synthetic Blackbox B')).profile.id);
  await page.reload();await pipeline();assert.equal(await panel.getByRole('button',{name:/Blackbox:/}).count(),0);
  assert.equal((await page.evaluate(async id=>(await import('/src/store/useApplications.ts')).loadApplicationsFor(id),profileB)).length,0);
  await page.evaluate(async id=>{await (await import('/src/lib/localProfile.ts')).activateLocalProfile(id);},profileA);
  await page.reload();await pipeline();assert.equal(await panel.getByRole('button',{name:/Blackbox:/}).count(),2);
  card=await openCard();page.once('dialog',dialog=>dialog.accept());await card.getByRole('button',{name:'Usuń migawkę'}).click();await card.waitFor({state:'hidden'});
  saved=await records();assert.equal(saved.find(app=>app.id===id).applicationBlackbox,undefined);assert.equal(saved.find(app=>app.id===id).events.length,1);
  await page.reload();await pipeline();assert.equal(await panel.getByRole('button',{name:/Blackbox:/}).count(),1);
  // Usunięcie danych podczas File.text odmontowuje podgląd i odrzuca spóźniony plik.
  await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=function(){File.prototype.text=original;return new Promise(resolve=>{window.__releaseBlackboxRead=()=>original.call(this).then(resolve);});};});
  await page.getByLabel('Importuj plik Blackbox',{exact:true}).setInputFiles(path.join(temp,'native-pair.json'));
  assert.equal(await page.evaluate(async id=>(await import('/src/lib/storage.ts')).clearProfileStorageDurably(id),profileA),true);
  await page.evaluate(()=>window.__releaseBlackboxRead());
  await page.waitForFunction(()=>document.querySelector('[data-testid="application-blackbox-panel"] input[type=file]')?.disabled===false);
  assert.equal(await page.getByRole('dialog',{name:'Sprawdź import Blackbox'}).count(),0);
  assert.deepEqual(await records(),[]);
  assert.equal(writeRequests,0);for(const marker of ['24000 PLN','Synthetic experience','GROUP_PRIVATE_MARKER'])assert.equal(logs.some(log=>log.includes(marker)),false,'logs contain no answers');
  console.log('ADR163_ACCEPTANCE '+JSON.stringify({producer:producerReport,actualKierivoImporter:true,previewBeforePersistence:true,twoFormsImported:true,receiptFirst:true,snapshotFirst:true,retryAndReloadIdempotent:true,canonicalEventsPersist:true,correctionWithoutHistory:true,staleImportRejected:true,interviewPrepLinked:true,profileIsolation:true,deletePreservesEvents:true,lateReadAfterWipeRejected:true,writeRequests,answerLogs:0}));
} finally {await browser?.close();await server?.close();rmSync(temp,{recursive:true,force:true});}
