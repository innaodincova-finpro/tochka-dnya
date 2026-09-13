const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 for(const width of [1280,390]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.route('**/*',route=>route.request().url()==='https://test.invalid/index.html'?route.fulfill({contentType:'text/html',body:fs.readFileSync('index.html','utf8')}):route.abort());
 await page.goto('https://test.invalid/index.html');
 await page.evaluate(()=>{S=blank();S.settings.cur='RUB';S.exp=[{id:'a',title:'Куртка',cat:'Одежда',sum:100,cur:'RUB',date:today()},{id:'b',title:'Еда',cat:'Продукты',sum:50,cur:'RUB',date:today()}];foldOpen['fin-cats']=true;renderMoney();document.querySelectorAll('.screen').forEach(el=>el.style.display='none');document.getElementById('s-money').style.display='block';});
 await page.locator('#s-money button.stat').filter({hasText:'Одежда'}).click();
 assert.equal(await page.locator('#s-money .item').count(),1);assert.match(await page.locator('#s-money .item').innerText(),/Куртка/);
 await page.getByRole('button',{name:'Все категории',exact:true}).click();assert.equal(await page.locator('#s-money .item').count(),2);
 await page.screenshot({path:'/tmp/finance-category-'+width+'.png',fullPage:true});
 console.log('PASS Chromium category filter and reset at width '+width);await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
