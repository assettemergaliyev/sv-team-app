let hours=false;const issues=s=>{const d=s.replace(/\D/g,'');const bad=[];if(d.length>=2&&+d.slice(0,2)>(hours?23:59))bad.push({start:0,label:hours?'Часы':'Минуты',value:d.slice(0,2),limit:hours?23:59});if(hours&&d.length>=4&&+d.slice(2,4)>59)bad.push({start:3,label:'Минуты',value:d.slice(2,4)});const sec=hours?4:2;if(d.length>=sec+2&&+d.slice(sec,sec+2)>59)bad.push({start:hours?6:3,label:'Секунды',value:d.slice(sec,sec+2)});return bad};const parse=s=>{if(hours){const m=s.trim().match(/^(\d{2}):(\d{2}):(\d{2})[.,](\d{2})$/);if(!m||+m[1]>23||+m[2]>59||+m[3]>59)return null;const v=(+m[1]*3600 + +m[2]*60 + +m[3])*100 + +m[4];return v>0?v:null;}const m=s.trim().match(/^(?:(\d+):)?(\d{1,2})[.,](\d{2})$/);if(!m||+(m[1]||0)>59||+m[2]>59)return null;const v=(+(m[1]||0)*60 + +m[2])*100 + +m[3];return v>0?v:null};
const assert=(c)=>{if(!c)throw Error('Failed time validation')};
assert(issues('99:01.00')[0].label==='Минуты');assert(parse('99:01.00')===null);
assert(parse('59:59.99')!==null);assert(issues('01:69.00')[0].label==='Секунды');
hours=true;assert(issues('99:01:01.00')[0].label==='Часы');assert(parse('99:01:01.00')===null);
assert(issues('01:99:01.00')[0].label==='Минуты');assert(parse('23:59:59.99')!==null);
assert(parse('24:00:00.00')===null);console.log('7 time checks passed');
