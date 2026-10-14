import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});let errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/about');await page.locator('footer').scrollIntoViewIfNeeded();await page.waitForTimeout(3000);
await page.locator('footer').screenshot({path:'checks/footer-desktop.png'});
console.log('Desktop',await page.locator('footer').evaluate(el=>({footer:el.getBoundingClientRect().toJSON(),size:el.querySelector('.bwf-word-in').style.fontSize,beam:el.style.getPropertyValue('--bwf-b'),word:el.querySelector('.bwf-word-in').getBoundingClientRect().toJSON()})));
for(const width of [320,390,768]) {await page.setViewportSize({width,height:950});await page.locator('footer').scrollIntoViewIfNeeded();await page.waitForTimeout(500);await page.locator('footer').screenshot({path:`checks/footer-${width}.png`});console.log(width,await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,letters:Array.from(document.querySelectorAll('.bwf-l')).map(x=>x.getBoundingClientRect().right),footerHeight:document.querySelector('footer').clientHeight})));}
console.log('Errors',errors);await browser.close();
