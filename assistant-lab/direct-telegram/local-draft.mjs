import {simpleAmount, currencyWord, hasDateMention} from './defaults.mjs';
import {validateProposal} from './proposal.mjs';

// Conservative fast path. Ambiguous requests continue through the existing model.
export function localDraft(text){
 const t=text.trim();
 const note=/^(?:заметка\s*:|запиши\s+(?:идею|заметку)\s*:?)\s*(.+)$/isu.exec(t);
 if(note)return validateProposal({kind:'note',title:note[1].trim()});
 if(hasDateMention(t)||/\d\s*[:/]\s*\d|(?:встреч|врач|стоматолог|напомни|перенеси|измени|исправь|доход|зарплат|получил|вернул|возврат|план|задач|замет|иде[яю])/iu.test(t))return null;
 // Require a letter-only description followed by one unambiguous positive amount.
 for(const separator of t.matchAll(/[,\s]+/gu)){
 const title=t.slice(0,separator.index).trim();
 if(!/^[\p{L}][\p{L} .«»()\-]*$/u.test(title))continue;
 let amountText=t.slice(separator.index+separator[0].length).replace(/[.!]$/,''),currency;
 const tail=/^(.*?)\s+(\S+)$/u.exec(amountText);
 if(tail&&currencyWord(tail[2])){currency=currencyWord(tail[2]);amountText=tail[1];}
 const amount=simpleAmount(amountText);
 if(!amount||amount>1e9||Math.abs(amount*100-Math.round(amount*100))>0.00001)continue;
 // Do not reinterpret a second operation or a range as a single purchase.
 if(/(?:^|\s)(?:и|или|от|до|за|на)(?:\s|$)/iu.test(title))return null;
 return validateProposal({kind:'expense',title,amount,...(currency?{currency}:{})});
 }
 return null;
}
