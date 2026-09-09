const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});
for(const width of [320,390,430,1280])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:844}});
 await page.route('**/*',r=>new URL(r.request().url()).pathname==='/index.html'?r.fulfill({contentType:'text/html',body:fs.readFileSync('index.html','utf8')}):r.abort());
 await page.goto('https://example.test/index.html');
 await page.evaluate(theme=>{S=blank();S.settings.onboarded=1;S.settings.theme=theme;renderAll();closeSheet();document.querySelector('#tab-more').click();},theme);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const metrics=await page.locator('#s-more .fold-head').evaluateAll(els=>els.map(el=>{const t=el.querySelector('.fold-title'),s=el.querySelector('.fold-sum');return {title:t.getBoundingClientRect().toJSON(),sum:s.getBoundingClientRect().toJSON(),color:getComputedStyle(t).color,bg:getComputedStyle(el.closest('.fold')).backgroundColor};}));
 for(const m of metrics){assert(Math.abs(m.title.x-m.sum.x)<1);assert(m.sum.y>=m.title.bottom);if(theme==='dark')assert.equal(m.color,'rgb(244, 237, 248)');}
 if(width===390&&theme==='dark')await page.screenshot({path:'more-dark.png'});
 await page.close();
}await browser.close();console.log('PASS More layout at 320/390/430/1280, light/dark');})().catch(e=>{console.error(e);process.exitCode=1});