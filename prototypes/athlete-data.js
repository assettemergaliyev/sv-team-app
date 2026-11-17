(function(root){
  const athletes=[{id:'a1',name:'Алексей Смирнов',sex:'M'},{id:'a2',name:'Мария Иванова',sex:'F'},{id:'a3',name:'Данияр Омаров',sex:'M'}];
  const categories=[{id:'swim400',label:'400 м · Кроль',sport:'Плавание'},{id:'swim100',label:'100 м · Кроль',sport:'Плавание'},{id:'run5000',label:'5 км',sport:'Бег'},{id:'swim1500',label:'1500 м · Кроль',sport:'Плавание'}];
  const events=[
    {id:'e1',date:'2026-06-14',category:'swim400',published:true,results:[{athlete:'a1',attempts:[{time:40520,status:'FINISHED'},{time:40180,status:'FINISHED'}]},{athlete:'a2',attempts:[{time:39510,status:'FINISHED'}]},{athlete:'a3',attempts:[{time:41000,status:'FINISHED'}]}]},
    {id:'e2',date:'2026-07-19',category:'swim400',published:true,results:[{athlete:'a1',attempts:[{time:39240,status:'FINISHED'}]},{athlete:'a2',attempts:[{time:39000,status:'FINISHED'}]}]},
    {id:'e3',date:'2026-08-23',category:'swim400',published:true,results:[{athlete:'a1',attempts:[{time:39710,status:'FINISHED'}]},{athlete:'a3',attempts:[{time:null,status:'DNF'}]}]},
    {id:'e4',date:'2026-09-30',category:'swim400',published:true,results:[{athlete:'a1',attempts:[{time:38680,status:'FINISHED'},{time:38145,status:'FINISHED'}]},{athlete:'a2',attempts:[{time:37990,status:'FINISHED'}]},{athlete:'a3',attempts:[{time:38145,status:'FINISHED'}]}]},
    {id:'e5',date:'2026-09-01',category:'swim100',published:true,results:[{athlete:'a1',attempts:[{time:7820,status:'FINISHED'}]},{athlete:'a2',attempts:[{time:7590,status:'FINISHED'}]}]},
    {id:'e6',date:'2026-09-10',category:'run5000',published:true,results:[{athlete:'a1',attempts:[{time:148230,status:'FINISHED'}]},{athlete:'a3',attempts:[{time:142010,status:'FINISHED'}]}]},
    {id:'draft',date:'2026-10-01',category:'swim400',published:false,results:[{athlete:'a1',attempts:[{time:30000,status:'FINISHED'}]}]}
  ];
  const official=r=>{const valid=r.attempts.filter(a=>a.status==='FINISHED'&&Number.isInteger(a.time)&&a.time>0);return valid.length?Math.min(...valid.map(a=>a.time)):null;};
  const history=(category,athlete)=>events.filter(e=>e.published&&e.category===category).flatMap(e=>e.results.filter(r=>r.athlete===athlete&&official(r)!==null).map(r=>({...e,time:official(r),attempts:r.attempts}))).sort((a,b)=>a.date.localeCompare(b.date));
  const rank=rows=>rows.sort((a,b)=>a.time-b.time||a.athlete.localeCompare(b.athlete)).map((r,i,all)=>({...r,rank:[...new Set(all.map(x=>x.time))].indexOf(r.time)+1}));
  const leaderboard=(category,mode,sex)=>{const matching=events.filter(e=>e.published&&e.category===category).sort((a,b)=>a.date.localeCompare(b.date));let rows=[];if(mode==='event'){const last=matching.at(-1);if(last)rows=last.results.filter(r=>official(r)!==null).map(r=>({athlete:r.athlete,time:official(r),date:last.date}));}else{rows=athletes.flatMap(a=>{const h=history(category,a.id);return h.length?[{athlete:a.id,time:Math.min(...h.map(r=>r.time)),date:''}]:[]});}return rank(rows.filter(r=>sex==='all'||athletes.find(a=>a.id===r.athlete).sex===sex));};
  const format=cs=>{const h=Math.floor(cs/360000),m=Math.floor(cs/6000)%60,s=Math.floor(cs/100)%60;return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(cs%100).padStart(2,'0');};
  const api={athletes,categories,events,official,history,leaderboard,format};if(typeof module!=='undefined')module.exports=api;else root.SV=api;
})(typeof window==='undefined'?globalThis:window);
