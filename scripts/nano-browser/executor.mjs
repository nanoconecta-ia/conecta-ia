import {chromium} from 'playwright';
import {authorizeUrl,authorizeRequest} from './policy.mjs';
const target=authorizeUrl(process.argv[2]??'https://nanoconecta-ia.github.io/conecta-ia/');
let browser;
try {
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({acceptDownloads:false,permissions:[],serviceWorkers:'block',storageState:{cookies:[],origins:[]}});
 const page=await context.newPage();
 await page.route('**/*',r=>authorizeRequest(r.request())?r.continue():r.abort('blockedbyclient'));
 const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:25000});
 await page.waitForTimeout(1200);
 console.log(JSON.stringify({status:response?.status(),url:page.url(),title:await page.title(),headings:(await page.locator('h1,h2').allTextContents()).slice(0,12),buttons:(await page.getByRole('button').allTextContents()).slice(0,15),mode:'read-only; no credentials; no writes'},null,2));
 await context.close();
} catch(e){console.error('Browser test failed:',e.message);process.exitCode=1} finally {await browser?.close()}
