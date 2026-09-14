const {JSDOM}=require('jsdom'),fs=require('node:fs'),assert=require('node:assert/strict');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'dangerously',url:'https://test.invalid/',beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};}});
const w=dom.window;
try{
 w.eval(`S=blank();S.settings.cur='RUB';S.exp=[{id:'a',title:'Куртка',cat:'Одежда',sum:100,cur:'RUB',date:today()},{id:'b',title:'Еда',cat:'Продукты',sum:50,cur:'RUB',date:today()},{id:'c',title:'Иная валюта',cat:'Одежда',sum:30,cur:'KZT',date:today()}];foldOpen['fin-cats']=true;renderMoney();`);
 const before=w.eval('JSON.stringify(S)');
 w.document.querySelector('#s-money button.stat').click();
 assert.equal(w.eval('financeCategory'),'Одежда');assert.equal(w.document.querySelectorAll('#s-money .item').length,1);assert.match(w.document.querySelector('#s-money .item').textContent,/Куртка/);
 assert.equal(w.eval('JSON.stringify(S)'),before);
 [...w.document.querySelectorAll('#s-money button')].find(b=>b.textContent==='Все категории').click();assert.equal(w.document.querySelectorAll('#s-money .item').length,2);
 w.eval(`financeCategorySet('Одежда');financeFrom='2000-01-01';financeTo='2000-01-02';financeSet('custom');`);assert.equal(w.document.querySelectorAll('#s-money .item').length,0);assert.match(w.document.querySelector('#s-money').textContent,/расходов нет/);
 assert.equal(w.eval('JSON.stringify(S)'),before);
 console.log('PASS category click, reset, period, currency, empty result and unchanged data');
}finally{w.close();}
