import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.HUNTER_CHROMIUM_PATH || chromium.executablePath();
const temp = mkdtempSync(path.join(tmpdir(), 'kierivo-autofill-smoke-'));
const keyPath = path.join(temp, 'localhost-key.pem');
const certPath = path.join(temp, 'localhost-cert.pem');
const profilePath = path.join(temp, 'chrome-profile');
const extensionPath = path.join(temp,'extension');
const extensionSource = process.env.HUNTER_EXTENSION_PATH || path.join(root,'extension');
const profileFile = path.join(temp, 'synthetic-approved-profile.json');
const kierivoApplicationUrl = process.env.KIERIVO_APPLICATION_URL || '';
const profileFixturePath = process.env.HUNTER_PROFILE_FILE || '';
let nextCdpId=1;
let cdp;
let context;
let server;
let appServer;
try {
  // The isolated smoke profile gets one narrow host permission so the popup can be tested headlessly.
  // The shipped manifest is unchanged; activeTab is exercised separately through the real toolbar smoke.
  cpSync(extensionSource,extensionPath,{recursive:true});
  const testManifestPath=path.join(extensionPath,'manifest.json');
  const testManifest=JSON.parse(readFileSync(testManifestPath,'utf-8'));
  testManifest.host_permissions=[...testManifest.host_permissions,'https://jobs.ashbyhq.com/*'];
  writeFileSync(testManifestPath,JSON.stringify(testManifest,null,2));
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,'-days','1','-subj','/CN=jobs.ashbyhq.com','-addext','subjectAltName=DNS:jobs.ashbyhq.com'],{stdio:'ignore'});
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic software engineer role</title><script type="application/ld+json">{"@type":"JobPosting","title":"Synthetic\\n  software engineer role","hiringOrganization":{"name":"Synthetic\\n  Employer"}}</script><style>.honeypot{position:absolute;left:-10000px;top:0;width:1px;height:1px}</style></head><body><h1>Synthetic software engineer role</h1><form id="application">
    <label>First name <input name="firstName" autocomplete="given-name"></label>
    <label>Email <input name="email" type="email" autocomplete="email"></label>
    <label>Work email <input name="workEmail" type="email" aria-label="Work email"></label>
    <label>LinkedIn <input name="linkedin" type="url" aria-label="LinkedIn profile"></label>
    <label>Start date <input name="startDate" type="date"></label>
    <label>Phone <input name="phone" type="tel" autocomplete="tel" value="already-entered"></label>
    <label>Mobile phone <input name="mobilePhone" type="tel" autocomplete="tel"></label>
    <input name="website_url" class="honeypot" autocomplete="off">
    <input name="lastName" autocomplete="family-name" hidden>
    <button type="submit">Submit application</button>
  </form><script>
    window.__smoke={submits:0,events:{input:0,change:0,blur:0}};
    const first=document.querySelector('[autocomplete="given-name"]'); let reactValue='';
    first.addEventListener('input',event=>{reactValue=event.target.value;window.__smoke.events.input++});
    first.addEventListener('change',()=>window.__smoke.events.change++);
    first.addEventListener('blur',()=>{window.__smoke.events.blur++;requestAnimationFrame(()=>{first.value=reactValue})});
    document.addEventListener('submit',event=>{event.preventDefault();window.__smoke.submits++});
    document.addEventListener('input',event=>{if(event.target!==first)window.__smoke.events.input++});
    document.addEventListener('change',event=>{if(event.target!==first)window.__smoke.events.change++});
    let workEmailValue=''; let activeWorkEmail=document.querySelector('[name="workEmail"]');
    function bindWorkEmail(field){
      field.addEventListener('input',event=>{workEmailValue=event.target.value});
      field.addEventListener('blur',()=>{
        const replacement=field.cloneNode(); replacement.value=workEmailValue;
        field.replaceWith(replacement); activeWorkEmail=replacement; bindWorkEmail(replacement);
      });
    }
    bindWorkEmail(activeWorkEmail);
  </script></body></html>`;
  server = createServer({key:readFileSync(keyPath),cert:readFileSync(certPath)},(_request,response)=>{response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});response.end(html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  let appPort;
  if (!kierivoApplicationUrl) {
    const appHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic Kierivo app</title></head><body>
      <main><h1>Moje aplikacje</h1><section id="receiptReview" hidden><h2>Sprawdź potwierdzenie</h2><pre id="receiptData"></pre></section></main>
      <script>
        window.__kierivoApplicationReceiptReady=true;
        window.__receipt=null;
        window.addEventListener('message',event=>{
          if(event.source!==window||event.origin!==window.location.origin)return;
          if(event.data?.type!=='KIERIVO_HUNTER_APPLICATION_RECEIPT_V1')return;
          window.__receipt=event.data.receipt;
          document.querySelector('#receiptData').textContent=JSON.stringify(event.data.receipt);
          document.querySelector('#receiptReview').hidden=false;
        });
      </script>
    </body></html>`;
    appServer = createHttpServer((_request,response)=>{response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});response.end(appHtml);});
    await new Promise(resolve=>appServer.listen(0,'127.0.0.1',resolve));
    appPort=appServer.address().port;
  }
  if (!kierivoApplicationUrl) writeFileSync(profileFile,JSON.stringify({schemaVersion:1,fields:{
    'given-name':'Alex Synthetic','family-name':'Synthetic',email:'synthetic@example.test',tel:'synthetic-phone'
  }}));
  context=await chromium.launchPersistentContext(profilePath,{
    headless:true,executablePath:chrome,viewport:{width:1280,height:900},
    args:['--headless=new','--no-sandbox','--disable-gpu','--ignore-certificate-errors','--host-resolver-rules=MAP jobs.ashbyhq.com 127.0.0.1',`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]
  });
  let worker=context.serviceWorkers().find(item=>item.url().startsWith('chrome-extension://'));
  if(!worker)worker=await context.waitForEvent('serviceworker',{timeout:15000});
  const extensionId=new URL(worker.url()).host;
  cdp=await context.browser().newBrowserCDPSession();
  const page=await context.newPage();
  if (kierivoApplicationUrl && profileFixturePath) {
    cpSync(profileFixturePath,profileFile);
  } else if (kierivoApplicationUrl) {
    const exportPage=await context.newPage();
    await exportPage.goto(kierivoApplicationUrl,{waitUntil:'domcontentloaded'});
    await exportPage.evaluate(async()=>{
      const {saveProfileVault}=await import('/src/lib/localProfile.ts');
      const {createEmptyVault}=await import('/src/lib/sampleVault.ts');
      const vault=createEmptyVault();
      Object.assign(vault.personalInfo,{
        firstName:'Alex Synthetic',middleName:'Middle Field Must Stay Local',lastName:'Synthetic',
        email:'synthetic@example.test',phone:'synthetic-phone',linkedin:'https://linkedin.example/disputed'
      });
      saveProfileVault('anonymous',vault);
    });
    await exportPage.reload({waitUntil:'domcontentloaded'});
    await exportPage.setViewportSize({width:375,height:812});
    const mobileHubBounds=await exportPage.getByRole('region',{name:'Kierivo Extension'}).boundingBox();
    assert.ok(mobileHubBounds,'extension hub remains visible on a mobile viewport');
    assert.ok(mobileHubBounds.x>=0&&mobileHubBounds.x+mobileHubBounds.width<=375,'extension hub fits the mobile viewport');
    await exportPage.getByText('Sparowanie i autoryzacja:',{exact:false}).waitFor({state:'visible'});
    await exportPage.getByText('Autofill:',{exact:false}).waitFor({state:'visible'});
    await exportPage.getByText('Pro:',{exact:false}).waitFor({state:'visible'});
    await exportPage.getByText('Telefon:',{exact:false}).waitFor({state:'visible'});
    await exportPage.getByRole('button',{name:'Wkrótce w Chrome Web Store'}).waitFor({state:'visible'});
    await exportPage.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur()});
    let profileExportKeyboardReachable=false;
    for(let i=0;i<80;i++){
      await exportPage.keyboard.press('Tab');
      profileExportKeyboardReachable=await exportPage.evaluate(()=>
        document.activeElement?.tagName==='BUTTON'&&document.activeElement.textContent?.includes('Pobierz profil do Huntera')===true
      );
      if(profileExportKeyboardReachable)break;
    }
    assert.equal(profileExportKeyboardReachable,true,'local profile export is reachable with Tab on mobile viewport');
    await exportPage.context().setOffline(true);
    await exportPage.getByText('Przeglądarka zgłasza brak połączenia.',{exact:false}).waitFor({state:'visible'});
    const [download]=await Promise.all([
      exportPage.waitForEvent('download'),
      exportPage.getByRole('button',{name:'Pobierz profil do Huntera'}).click(),
    ]);
    assert.equal(download.suggestedFilename(),'kierivo-hunter-autofill-profile.json');
    await download.saveAs(profileFile);
    const exportedProfile=JSON.parse(readFileSync(profileFile,'utf-8'));
    assert.deepEqual(Object.keys(exportedProfile.fields).sort(),['email','family-name','given-name','tel']);
    assert.deepEqual(exportedProfile.fields,{
      'given-name':'Alex Synthetic','family-name':'Synthetic',email:'synthetic@example.test',tel:'synthetic-phone'
    });
    await exportPage.context().setOffline(false);
    await exportPage.close();
  }
  const response=await page.goto(`https://jobs.ashbyhq.com:${port}/autofill-smoke`,{waitUntil:'domcontentloaded'});
  assert.equal(response?.status(),200);
  const before=await page.evaluate(()=>({controls:document.querySelectorAll('input,select,textarea,[contenteditable="true"],[role="textbox"]').length,submitButtons:document.querySelectorAll('button[type="submit"],input[type="submit"]').length}));
  const pageRequests=[];
  page.on('request',request=>pageRequests.push(new URL(request.url()).origin));
  const popupUrl=`chrome-extension://${extensionId}/popup.html`;
  let popupSessionId;
  async function attachPopup(){
    const alreadyOpen=(await cdp.send('Target.getTargets')).targetInfos.find(target=>target.type==='page'&&target.url===popupUrl);
    if(alreadyOpen){
      await cdp.send('Target.closeTarget',{targetId:alreadyOpen.targetId});
      for(let i=0;i<40;i++){const open=(await cdp.send('Target.getTargets')).targetInfos.some(target=>target.type==='page'&&target.url===popupUrl);if(!open)break;await new Promise(resolve=>setTimeout(resolve,100));}
    }
    await page.bringToFront();
    await worker.evaluate(()=>chrome.action.openPopup());
    let popupTarget;
    for(let i=0;i<40&&!popupTarget;i++){popupTarget=(await cdp.send('Target.getTargets')).targetInfos.find(target=>target.type==='page'&&target.url===popupUrl);if(!popupTarget)await new Promise(resolve=>setTimeout(resolve,100));}
    assert.ok(popupTarget,'extension action opened the real popup');
    const attached=await cdp.send('Target.attachToTarget',{targetId:popupTarget.targetId,flatten:false});
    popupSessionId=attached.sessionId;
  }
  await attachPopup();
  async function popupCommand(expression,userGesture=false){
    const id=nextCdpId++;
    const response=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{cdp.off('Target.receivedMessageFromTarget',listener);reject(new Error('popup command timed out'))},10000);
      const listener=event=>{if(event.sessionId!==popupSessionId)return;const message=JSON.parse(event.message);if(message.id!==id)return;clearTimeout(timer);cdp.off('Target.receivedMessageFromTarget',listener);message.error?reject(new Error(message.error.message)):resolve(message.result)};
      cdp.on('Target.receivedMessageFromTarget',listener);
    });
    await cdp.send('Target.sendMessageToTarget',{sessionId:popupSessionId,message:JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true,userGesture}})});
    return response;
  }
  const profileJson=JSON.stringify(readFileSync(profileFile,'utf-8'));
  await popupCommand(`(()=>{const input=document.querySelector('#autofillProfile');const transfer=new DataTransfer();transfer.items.add(new File([${profileJson}],'synthetic-approved-profile.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  let profileMessage='';for(let i=0;i<60;i++){profileMessage=(await popupCommand("document.querySelector('#autofillSummary').textContent")).result.value;if(profileMessage.includes('Profil wczytany tylko do tej sesji popupu'))break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(profileMessage.includes('Profil wczytany tylko do tej sesji popupu'),`synthetic profile loaded: ${profileMessage}`);
  await popupCommand("document.querySelector('#scanAutofill').click()",true);
  for(let i=0;i<60;i++){const count=await popupCommand("document.querySelectorAll('.fill-row').length");if(count.result.value>0)break;await new Promise(resolve=>setTimeout(resolve,100));}
  const rowCount=(await popupCommand("document.querySelectorAll('.fill-row').length")).result.value;
  const scanMessage=(await popupCommand("document.querySelector('#autofillSummary').textContent")).result.value;
  assert.equal(rowCount,4,`two email controls, first name and an empty phone are previewed; hidden family name and existing phone are excluded. ${scanMessage}`);
  const preview=await popupCommand("(()=>{const rows=[...document.querySelectorAll('.fill-row')];return JSON.stringify({text:rows.map(row=>row.textContent),honeypots:rows.some(row=>row.textContent.includes('website_url')),checked:document.querySelectorAll('.fill-row input[type=checkbox]:checked').length,disabled:document.querySelector('#applyAutofill').disabled})})()");
  const previewState=JSON.parse(preview.result.value);
  assert.equal(previewState.honeypots,false,'honeypot excluded');
  assert.equal(previewState.checked,0,'no fields preselected'); assert.equal(previewState.disabled,true);
  await popupCommand("(()=>{const rows=[...document.querySelectorAll('.fill-row')];for(const prefix of ['First name','Email ','Work email','Mobile phone']){const row=rows.find(item=>item.textContent.startsWith(prefix));if(!row)throw new Error('missing '+prefix);row.querySelector('input[type=checkbox]').click()}return document.querySelector('#applyAutofill').disabled})()",true);
  const fillDisabled=(await popupCommand("document.querySelector('#applyAutofill').disabled")).result.value;
  assert.equal(fillDisabled,false);
  await popupCommand("document.querySelector('#applyAutofill').click()",true);
  let fillSummary='';
  for(let i=0;i<100;i++){fillSummary=(await popupCommand("document.querySelector('#autofillSummary').textContent")).result.value;if(fillSummary.includes('pól wypełniono i zweryfikowano po blur/renderze'))break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(fillSummary.includes('pól wypełniono i zweryfikowano po blur/renderze'));
  const after=await page.evaluate(()=>({
    values:{givenName:document.querySelector('[autocomplete="given-name"]').value,email:document.querySelector('[autocomplete="email"]').value,workEmail:document.querySelector('[name="workEmail"]').value,linkedin:document.querySelector('[name="linkedin"]').value,startDate:document.querySelector('[name="startDate"]').value,phone:document.querySelector('[name="phone"]').value,mobilePhone:document.querySelector('[name="mobilePhone"]').value,honeypot:document.querySelector('[name="website_url"]').value,hidden:document.querySelector('[name="lastName"]').value},
    events:window.__smoke.events,submits:window.__smoke.submits,controls:document.querySelectorAll('input,select,textarea,[contenteditable="true"],[role="textbox"]').length,submitButtons:document.querySelectorAll('button[type="submit"],input[type="submit"]').length
  }));
  assert.equal(after.values.givenName,'Alex Synthetic','React-controlled value survives blur rerender');
  assert.equal(after.values.email,'synthetic@example.test');
  assert.equal(after.values.workEmail,'synthetic@example.test','repeated profile field is user-selected independently');
  assert.equal(after.values.linkedin,'','disputed LinkedIn value was omitted from the exported profile');
  assert.equal(after.values.startDate,'');
  assert.equal(after.values.phone,'already-entered','existing value preserved');
  assert.equal(after.values.mobilePhone,'synthetic-phone');
  assert.equal(after.values.honeypot,''); assert.equal(after.values.hidden,'');
  assert.deepEqual(after.events,{input:4,change:4,blur:1});
  assert.equal(after.submits,0);
  assert.equal(after.controls,before.controls); assert.equal(after.submitButtons,before.submitButtons);
  assert.deepEqual([...new Set(pageRequests)],[],'no network request during the local fill interaction');
  await page.locator('[name="workEmail"]').fill('user-edited@example.test');
  await attachPopup();
  let rollbackRestored=false;
  for(let i=0;i<100;i++){
    rollbackRestored=(await popupCommand("!document.querySelector('#rollbackAutofill').disabled")).result.value;
    if(rollbackRestored)break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(rollbackRestored,true,'rollback control is restored after reopening the popup in the same browser session');
  await popupCommand("document.querySelector('#rollbackAutofill').click()",true);
  let rollbackSummary='';
  for(let i=0;i<100;i++){rollbackSummary=(await popupCommand("document.querySelector('#autofillSummary').textContent")).result.value;if(rollbackSummary.includes('pól cofnięto'))break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(rollbackSummary.includes('3 pól cofnięto'),rollbackSummary);
  assert.ok(rollbackSummary.includes('1 zmienionych później pól pozostawiono bez zmian'),rollbackSummary);
  const rolledBack=await page.evaluate(()=>({
    values:{givenName:document.querySelector('[autocomplete="given-name"]').value,email:document.querySelector('[autocomplete="email"]').value,workEmail:document.querySelector('[name="workEmail"]').value,linkedin:document.querySelector('[name="linkedin"]').value,startDate:document.querySelector('[name="startDate"]').value,phone:document.querySelector('[name="phone"]').value},
    events:window.__smoke.events,submits:window.__smoke.submits,controls:document.querySelectorAll('input,select,textarea,[contenteditable="true"],[role="textbox"]').length,submitButtons:document.querySelectorAll('button[type="submit"],input[type="submit"]').length
  }));
  assert.deepEqual(rolledBack.values,{givenName:'',email:'',workEmail:'user-edited@example.test',linkedin:'',startDate:'',phone:'already-entered'});
  assert.deepEqual(rolledBack.events,{input:8,change:8,blur:2});
  assert.equal(rolledBack.submits,0);
  assert.equal(rolledBack.controls,before.controls); assert.equal(rolledBack.submitButtons,before.submitButtons);
  assert.deepEqual([...new Set(pageRequests)],[],'no network request during fill or rollback');
  const pageRequestsDuringFillAndRollback=pageRequests.length;
  await popupCommand("document.querySelector('#prepareReceipt').click()",true);
  let receiptDraftReady=false;
  for(let i=0;i<60;i++){receiptDraftReady=(await popupCommand("!document.querySelector('#receiptDraft').hidden")).result.value;if(receiptDraftReady)break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal(receiptDraftReady,true,'offer metadata can be prepared from the current ATS page');
  const preparedReceiptFields=(await popupCommand("({company:document.querySelector('#receiptCompany').value,position:document.querySelector('#receiptPosition').value})")).result.value;
  assert.deepEqual(preparedReceiptFields,{company:'Synthetic Employer',position:'Synthetic software engineer role'},'JSON-LD whitespace is collapsed before receipt fields are filled');
  await popupCommand("(()=>{const set=(selector,value)=>{const input=document.querySelector(selector);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))};set('#receiptCompany','Synthetic Employer');set('#receiptPosition','Synthetic Role')})()");
  assert.equal((await popupCommand("document.querySelector('#confirmReceipt').disabled")).result.value,false,'user declaration needs reviewed company and role');
  await popupCommand("document.querySelector('#confirmReceipt').click()",true);
  let receiptCreateSummary='';
  for(let i=0;i<60;i++){receiptCreateSummary=(await popupCommand("document.querySelector('#receiptCreateSummary').textContent")).result.value;if(receiptCreateSummary.includes('Zapisano Twoją deklarację wysłania'))break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.ok(receiptCreateSummary.includes('Hunter nie sprawdza ani nie wysyła formularza.'),receiptCreateSummary);
  const stagedReceipts=JSON.parse((await popupCommand("chrome.storage.session.get('pendingApplicationReceipt').then(value=>JSON.stringify(value.pendingApplicationReceipt))")).result.value);
  assert.ok(Array.isArray(stagedReceipts),'pending receipts are stored as a queue');
  assert.equal(stagedReceipts.length,1,'the synthetic run has one queued receipt');
  const stagedReceipt=stagedReceipts[0];
  assert.deepEqual(Object.keys(stagedReceipt).sort(),['company','jobUrl','position','receiptId','schemaVersion','submittedAt'].sort());
  assert.equal(stagedReceipt.company,'Synthetic Employer');
  assert.equal(stagedReceipt.position,'Synthetic Role');
  assert.equal(stagedReceipt.jobUrl.startsWith('https://jobs.ashbyhq.com:'),true);
  assert.match(stagedReceipt.receiptId,/^[a-zA-Z0-9_-]{8,100}$/);
  if (kierivoApplicationUrl) {
    await page.goto(kierivoApplicationUrl,{waitUntil:'domcontentloaded'});
    await page.evaluate(async()=>{
      const {saveMilestones}=await import('/src/lib/uxMilestones.ts');
      saveMilestones('anonymous',{firstApplicationAt:new Date().toISOString()});
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Aplikacje',exact:true}).first().click();
    await page.waitForFunction(()=>window.__kierivoApplicationReceiptReady===true);
  } else {
    await page.goto(`http://127.0.0.1:${appPort}/applications`,{waitUntil:'domcontentloaded'});
  }
  await attachPopup();
  let importEnabled=false;
  for(let i=0;i<60;i++){importEnabled=(await popupCommand("!document.querySelector('#importReceipt').disabled")).result.value;if(importEnabled)break;await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal(importEnabled,true,'receipt is available on the Kierivo application route in the same browser session');
  const importSummary=(await popupCommand("document.querySelector('#receiptImportSummary').textContent")).result.value;
  assert.ok(importSummary.includes('Synthetic Employer · Synthetic Role'),importSummary);
  const pageRequestsBeforeReceiptImport=pageRequests.length;
  await popupCommand("document.querySelector('#importReceipt').click()",true);
  if (kierivoApplicationUrl) {
    await page.getByText('To jest deklaracja użytkownika po ręcznym wysłaniu formularza.',{exact:false}).waitFor({state:'visible'});
    assert.equal(await page.getByLabel('Firma Rekrutująca').inputValue(),'Synthetic Employer');
    assert.equal(await page.getByLabel('Stanowisko Docelowe').inputValue(),'Synthetic Role');
    await page.getByRole('button',{name:'Zapisz potwierdzenie'}).click();
    await page.getByText('Potwierdzenie z Huntera zapisane',{exact:false}).waitFor({state:'visible'});
    const savedApplication=await page.evaluate(async(receiptId)=>{
      const {applicationsKeyFor,readJson}=await import('/src/lib/storage.ts');
      const applications=readJson(applicationsKeyFor('anonymous'),[]);
      return applications.find(application=>application.events?.some(event=>event.source==='extension'&&event.sourceEventId===receiptId))||null;
    },stagedReceipt.receiptId);
    assert.ok(savedApplication,'actual Kierivo tracker persists the reviewed Hunter receipt');
    assert.equal(savedApplication.company,'Synthetic Employer');
    assert.equal(savedApplication.position,'Synthetic Role');
    assert.equal(savedApplication.jobUrl,stagedReceipt.jobUrl);
    await page.getByRole('button',{name:'Widok kalendarza'}).click();
    await page.getByRole('button',{name:/Synthetic Employer · Synthetic Role, Wysłana/}).waitFor({state:'visible'});
    await attachPopup();
    await popupCommand("document.querySelector('#importReceipt').click()",true);
    await page.getByText('Potwierdzenie z Huntera jest już zapisane',{exact:false}).waitFor({state:'visible'});
    const duplicateCount=await page.evaluate(async(receiptId)=>{
      const {applicationsKeyFor,readJson}=await import('/src/lib/storage.ts');
      const applications=readJson(applicationsKeyFor('anonymous'),[]);
      return applications.filter(application=>application.events?.some(event=>event.source==='extension'&&event.sourceEventId===receiptId)).length;
    },stagedReceipt.receiptId);
    assert.equal(duplicateCount,1,'retrying the same receipt does not create a duplicate application');
    assert.equal(pageRequests.length,pageRequestsBeforeReceiptImport,'receipt import, review, save, and duplicate retry perform no page network request');
  } else {
    let receivedReceipt=null;
    for(let i=0;i<60;i++){receivedReceipt=await page.evaluate(()=>window.__receipt);if(receivedReceipt)break;await new Promise(resolve=>setTimeout(resolve,100));}
    assert.ok(receivedReceipt,'Kierivo route receives the explicit same-origin receipt handoff');
    assert.deepEqual(Object.keys(receivedReceipt).sort(),['company','jobUrl','position','receiptId','schemaVersion','submittedAt'].sort());
    assert.equal(receivedReceipt.receiptId,stagedReceipt.receiptId);
    assert.equal(receivedReceipt.company,'Synthetic Employer');
    assert.equal(receivedReceipt.position,'Synthetic Role');
    assert.equal(receivedReceipt.jobUrl,stagedReceipt.jobUrl);
    assert.equal(await page.locator('#receiptReview').isVisible(),true,'receipt is presented for review in the receiving app');
  }
  await popupCommand("document.querySelector('#clearReceipt').click()",true);
  let clearedReceipt;
  for(let i=0;i<40;i++){
    clearedReceipt=await popupCommand("chrome.storage.session.get('pendingApplicationReceipt').then(value=>value.pendingApplicationReceipt ?? null)");
    if(clearedReceipt.result.value===null)break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.equal(clearedReceipt.result.value,null,'user can explicitly remove the session receipt');
  console.log(JSON.stringify({installedMV3:true,extensionVersion:'1.2.0',atsHost:'jobs.ashbyhq.com',syntheticProfile:true,profileSource:profileFixturePath?'synthetic-profile-file':kierivoApplicationUrl?'actual-kierivo-export-button':'synthetic-fixture',testOnlyHostPermissionOverride:true,mobileViewportWidth:kierivoApplicationUrl?375:null,extensionHubFitsMobileViewport:Boolean(kierivoApplicationUrl),profileExportKeyboardReachable:Boolean(kierivoApplicationUrl),profileDownloadWorksOffline:Boolean(kierivoApplicationUrl),extensionUnavailableAndAuthStatesVisible:Boolean(kierivoApplicationUrl),previewRows:rowCount,verifiedFillCount:4,rolledBackCount:3,userEditedFieldPreserved:true,existingValuePreserved:true,honeypotAndHiddenSkipped:true,receiptCreatedByExplicitUserDeclaration:true,receiptContainsOnlyJobMetadata:true,applicationReceiver:kierivoApplicationUrl?'actual-kierivo-app':'synthetic-route',applicationRecordSaved:Boolean(kierivoApplicationUrl),calendarReceiptVisible:Boolean(kierivoApplicationUrl),duplicateReceiptIgnored:Boolean(kierivoApplicationUrl),receiptClearedByUser:true,submitCount:rolledBack.submits,controlCountUnchanged:true,pageRequestsDuringFillAndRollback}));
} finally {
  await cdp?.detach().catch(()=>{});
  await context?.close().catch(()=>{});
  if(server) await new Promise(resolve=>server.close(resolve));
  if(appServer) await new Promise(resolve=>appServer.close(resolve));
  rmSync(temp,{recursive:true,force:true});
}
