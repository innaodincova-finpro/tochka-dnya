const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('assert');
const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'dangerously',url:'https://test.invalid/',beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){}});w.scrollTo=()=>{};w.alert=()=>{};w.confirm=()=>false;}});
setTimeout(()=>{const w=dom.window,box=w.document.getElementById('sheet-in');
const open=()=>w.document.getElementById('sheet').classList.contains('open');
function swipe(target,dy=100,dx=0){for(const type of ['touchstart','touchmove','touchend']){const e=new w.Event(type,{bubbles:true,cancelable:true});const pt={clientX:100+(type==='touchstart'?0:dx),clientY:100+(type==='touchstart'?0:dy)};Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[pt]});Object.defineProperty(e,'changedTouches',{value:[pt]});target.dispatchEvent(e);}}
w.eval("openSheet('help')");swipe(box.querySelector('h3'));assert(!open(),'heading swipe closes');
w.eval("openSheet('voice')");const input=box.querySelector('textarea');input.value='Не потерять текст';swipe(input);assert(open(),'text scroll does not close');swipe(box.querySelector('h3'));assert(open(),'cancel preserves dirty form');assert.equal(input.value,'Не потерять текст');w.confirm=()=>true;swipe(box.querySelector('h3'));assert(!open(),'confirmed discard closes');
w.eval("openSheet('help')");swipe(box.querySelector('h3'),20);assert(open(),'short motion ignored');swipe(box.querySelector('h3'),100,150);assert(open(),'horizontal ignored');
w.eval("openSheet('welcome')");swipe(box.querySelector('h3')||box);assert(open(),'welcome protected');
console.log('PASS: heading swipe, content scroll, dirty form cancel/confirm, short/horizontal gestures, protected welcome');dom.window.close();},200);
