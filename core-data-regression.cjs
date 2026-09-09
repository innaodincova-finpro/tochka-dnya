const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'dangerously',url:'https://test.invalid/index.html',beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};}});
const w=dom.window,copy=x=>JSON.parse(JSON.stringify(x));let count=0;function test(name,fn){fn();count++;console.log('PASS '+name)}
try{
 const recent=new Date().toISOString(),old=new Date(Date.now()-200*86400000).toISOString();
 test('latest deletion wins in both directions; stale copies cannot revive record',()=>{
  const b=w.blank(),l=copy(b),r=copy(b);l.del=[{id:'n',at:recent}];r.del=[{id:'n',at:old}];r.notes=[{id:'n',date:'2026-09-09',text:'stale'}];
  for(const [a,z] of [[l,r],[r,l]]){const m=w.mergeThree(b,a,z);assert.equal(m.del[0].at,recent);assert.equal(m.notes.length,0);}
 });
 test('unchanged-side shortcut cannot discard newer deletion',()=>{const b=w.blank();b.del=[{id:'n',at:recent}];const r=copy(b);r.del=[{id:'n',at:old}];assert.equal(w.mergeThree(b,b,r).del[0].at,recent)});
 test('more than 4000 active deletion marks stay protected',()=>{assert.equal(w.normalize({del:Array.from({length:4100},(_,i)=>({id:'n'+i,at:recent}))}).del.length,4100)});
 test('normalization keeps latest duplicate deletion',()=>{for(const del of [[{id:'n',at:recent},{id:'n',at:old}],[{id:'n',at:old},{id:'n',at:recent}]])assert.equal(w.normalize({del}).del[0].at,recent)});
 test('legacy timestamp-free deletion remains protective',()=>{assert.equal(w.normalize({del:[{id:'n'}]}).del.length,1);assert.equal(w.mergeDeletionMarks([{id:'n'}],[{id:'n',at:recent}])[0].at,undefined)});
 test('invalid deletion data rejected',()=>{for(const del of ['broken',null,{},[null],[{id:5}],[{id:'x',at:'invalid'}],[{id:'x',at:'2026-02-31T10:00:00Z'}]])assert.throws(()=>w.normalize({del}))});
 test('numeric legacy strings retained; coercible objects and booleans rejected',()=>{for(const k of ['exp','inc']){for(const sum of [true,false,[],{},null,'','  '])assert.throws(()=>w.normalize({[k]:[{id:'x',date:'2026-09-09',sum}]}));for(const sum of [0,12.5,'12.5'])assert.equal(w.normalize({[k]:[{id:'x',date:'2026-09-09',sum}]} )[k][0].sum,sum)}});
 test('conflict delete/edit requires choice; explicit restore removes mark',()=>{
 const b=w.blank();b.notes=[{id:'n',text:'base',date:'2026-09-09'}];const l=copy(b),r=copy(b);l.notes=[];l.del=[{id:'n',at:recent}];r.notes[0].text='edited';assert.throws(()=>w.mergeThree(b,l,r),e=>e.conflict===true);assert.equal(w.mergeThree(b,l,r,'local').notes.length,0);const m=w.mergeThree(b,l,r,'remote');assert.equal(m.notes[0].text,'edited');assert.equal(m.del.length,0);
 });
 test('merge does not mutate any input, including equal-input shortcut',()=>{const b=w.blank();b.notes=[{id:'n',text:'base',date:'2026-09-09'}];b.del=[{id:'n',at:recent}];const before=JSON.stringify(b);w.mergeThree(b,b,b);assert.equal(JSON.stringify(b),before)});
 test('1500 records and independent edits survive merge',()=>{const b=w.blank();b.notes=Array.from({length:1500},(_,i)=>({id:'n'+i,date:'2026-09-09',text:'note'}));const l=copy(b),r=copy(b);l.notes[0].text='local';r.notes[1499].text='remote';const before=JSON.stringify([b,l,r]);const m=w.mergeThree(b,l,r);assert.equal(m.notes.length,1500);assert.equal(m.notes.find(n=>n.id==='n0').text,'local');assert.equal(m.notes.find(n=>n.id==='n1499').text,'remote');assert.equal(JSON.stringify([b,l,r]),before)});
 test('corrupted local deletion list is preserved, saving blocked',()=>{w.eval("localStorage.setItem(KEY,JSON.stringify({del:'broken'}));load();saveQuiet();save()");assert.equal(w.eval('loadBlocked'),true);assert.equal(w.eval('JSON.parse(localStorage.getItem(KEY)).del'),'broken')});
 console.log(count+' core data scenarios passed');
}finally{dom.window.close()}
