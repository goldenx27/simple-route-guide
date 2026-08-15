(()=>{
  let testMode=false;
  const realFetch=window.fetch.bind(window);

  function reroute(input){
    if(!testMode)return input;
    if(typeof input!=='string')return input;
    if(input==='/api/route-recordings')return '/api/route-recordings/test';
    const m=input.match(/^\/api\/route-recordings\/([^/]+)$/);
    if(m && m[1]!=='test')return '/api/route-recordings/test/'+m[1];
    return input;
  }

  window.fetch=(input,init)=>realFetch(reroute(input),init);

  function addStyles(){
    if(document.getElementById('parentTestModeStyles'))return;
    const s=document.createElement('style');
    s.id='parentTestModeStyles';
    s.textContent=`
      #recorder .parent-test-panel{display:grid;gap:10px;margin:10px 0 12px;padding:14px;border-radius:18px;background:#f7f8fa;border:1px solid #e4e9ed}
      #recorder .parent-test-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      #recorder .parent-test-title{font-weight:900;font-size:1rem;color:#17202a}
      #recorder .parent-test-state{font-size:.76rem;font-weight:900;padding:6px 9px;border-radius:999px;background:#e9eef3;color:#52606d;white-space:nowrap}
      #recorder .parent-test-state.active{background:#fff1b8;color:#6d5100}
      #recorder .parent-test-help{font-size:.82rem;line-height:1.45;color:#52606d;background:#fff;border-radius:13px;padding:10px 11px}
      #recorder .parent-test-actions{display:grid;gap:8px}
      #recorder .parent-test-toggle{min-height:48px;background:#eef3f7;color:#17202a}
      #recorder .parent-test-toggle.active{background:#fff1b8;color:#6d5100}
      #recorder .parent-test-banner{display:none;padding:10px 11px;border-radius:13px;background:#fff8d7;color:#6d5100;font-weight:900;text-align:center;font-size:.82rem;line-height:1.35}
      #recorder .parent-test-banner.active{display:block}
      #recorder .parent-test-clear{display:none;background:#ffe6e6;color:#9c1c1c;min-height:44px}
      #recorder .parent-test-clear.active{display:block}
    `;
    document.head.appendChild(s);
  }

  async function refreshWizardCoverage(){
    try{
      const url=testMode?'/api/route-recordings/test':'/api/route-recordings';
      await realFetch(url,{cache:'no-store'});
      const recorder=document.getElementById('recorder');
      if(recorder&&!recorder.classList.contains('hidden')){
        document.querySelectorAll('#recorder .wizard-segment-row').forEach(b=>b.remove());
        const summary=document.getElementById('wizardCoverageSummary');
        if(summary)summary.textContent=testMode?'טוען נתוני בדיקה…':'טוען נתונים אמיתיים…';
        realFetch(reroute('/api/route-recordings'),{cache:'no-store'}).then(r=>r.json()).then(data=>{
          const covered=new Set((data.recordings||[]).map(x=>x?.segment).filter(Boolean));
          const select=document.getElementById('segmentSelect');
          const list=document.getElementById('wizardSegmentList');
          const items=[...(select?.options||[])];
          if(list){
            list.innerHTML='';
            for(const o of items){
              const c=covered.has(o.value);
              const b=document.createElement('button');
              b.type='button';b.className='wizard-segment-row'+(c?' covered':'');
              b.innerHTML=`<span class="name">${o.textContent?.trim()||o.value}</span><span class="state">${c?'✅ מכוסה בענן':'○ עדיין לא הוקלט'}</span>`;
              b.onclick=()=>{
                select.value=o.value;select.dispatchEvent(new Event('change',{bubbles:true}));
                const pages=document.querySelectorAll('#recorder .wizard-page');
                pages.forEach(p=>p.classList.toggle('active',p.dataset.page==='record'));
                document.querySelectorAll('#recorder [data-segment-name]').forEach(n=>n.textContent=o.textContent?.trim()||o.value);
              };
              list.appendChild(b);
            }
          }
          if(summary)summary.textContent=`${covered.size} מתוך ${items.length} מקטעים ${testMode?'מכוסים בענן הבדיקה':'מכוסים בענן'}`;
          const state=document.getElementById('routeDataState');
          if(state)state.textContent=testMode?`🧪 ${covered.size}/${items.length} מקטעים בענן הבדיקה`:`☁️ ${covered.size}/${items.length} מקטעים מכוסים בענן`;
        }).catch(()=>{});
      }
    }catch(e){}
  }

  function paint(){
    const btn=document.getElementById('parentTestToggle');
    const banner=document.getElementById('parentTestBanner');
    const clear=document.getElementById('parentTestClear');
    const state=document.getElementById('parentTestState');
    if(btn){btn.classList.toggle('active',testMode);btn.textContent=testMode?'כבה מצב בדיקה':'🧪 הפעל מצב בדיקה';}
    if(state){state.classList.toggle('active',testMode);state.textContent=testMode?'פעיל':'כבוי';}
    banner?.classList.toggle('active',testMode);
    clear?.classList.toggle('active',testMode);
  }

  async function clearTest(){
    if(!confirm('למחוק את כל הקלטות הבדיקה מהענן? ההקלטות האמיתיות לא ייפגעו.'))return;
    const r=await realFetch('/api/route-recordings/test',{method:'DELETE'});
    if(r.ok)await refreshWizardCoverage();
  }

  function install(){
    const recorder=document.getElementById('recorder');
    const header=recorder?.querySelector('.parent-header');
    if(!recorder||!header)return false;
    if(document.getElementById('parentTestToggle'))return true;
    addStyles();

    const panel=document.createElement('section');panel.className='parent-test-panel';
    const head=document.createElement('div');head.className='parent-test-head';
    const title=document.createElement('div');title.className='parent-test-title';title.textContent='🧪 מצב בדיקה';
    const state=document.createElement('div');state.id='parentTestState';state.className='parent-test-state';
    head.append(title,state);

    const help=document.createElement('div');help.className='parent-test-help';help.textContent='מאפשר לבדוק הקלטות והעלאה לענן בלי לשנות את המסלולים האמיתיים. מצב הבדיקה מתאפס אחרי רענון.';

    const actions=document.createElement('div');actions.className='parent-test-actions';
    const btn=document.createElement('button');btn.id='parentTestToggle';btn.type='button';btn.className='parent-test-toggle';
    btn.onclick=async()=>{testMode=!testMode;paint();await refreshWizardCoverage();};

    const banner=document.createElement('div');banner.id='parentTestBanner';banner.className='parent-test-banner';banner.textContent='🧪 פעיל עכשיו — העלאות נשמרות בענן בדיקה נפרד בלבד.';
    const clear=document.createElement('button');clear.id='parentTestClear';clear.type='button';clear.className='parent-test-clear';clear.textContent='🗑️ מחק את כל נתוני הבדיקה';clear.onclick=clearTest;

    actions.append(btn,banner,clear);
    panel.append(head,help,actions);
    header.insertAdjacentElement('afterend',panel);
    paint();
    return true;
  }

  function boot(){if(install())return;let n=0;const t=setInterval(()=>{if(install()||++n>40)clearInterval(t)},100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
