(()=>{
  const DB_NAME='simple-route-guide';
  const STORE='routes';
  const RELOAD_KEY='routeCloudSyncReloaded';
  let lastCloud=[];
  let painting=false;

  function openDb(){
    return new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB_NAME,1);
      r.onupgradeneeded=()=>{
        if(!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE,{keyPath:'segment'});
      };
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error);
    });
  }

  async function getLocal(){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readonly');
        const req=tx.objectStore(STORE).getAll();
        req.onsuccess=()=>resolve(req.result||[]);
        req.onerror=()=>reject(req.error);
      });
    }finally{db.close()}
  }

  async function putLocal(rows){
    if(!rows.length)return 0;
    const db=await openDb();
    let count=0;
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        const store=tx.objectStore(STORE);
        for(const row of rows){if(row?.segment){store.put(row);count++}}
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
      });
      return count;
    }finally{db.close()}
  }

  async function fetchCloud(){
    const r=await fetch('/api/route-recordings',{cache:'no-store',headers:{'cache-control':'no-cache'}});
    if(!r.ok)throw new Error('cloud read '+r.status);
    const data=await r.json();
    return Array.isArray(data.recordings)?data.recordings:[];
  }

  async function upload(row){
    if(!row?.segment)return false;
    const r=await fetch('/api/route-recordings/'+encodeURIComponent(row.segment),{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(row)
    });
    return r.ok;
  }

  function configuredSegments(){
    const select=document.getElementById('segmentSelect');
    return new Set([...(select?.options||[])].map(o=>o.value).filter(Boolean));
  }

  function cloudText(cloud){
    const configured=configuredSegments();
    const covered=configured.size
      ? cloud.filter(x=>configured.has(x?.segment)).length
      : cloud.length;
    return configured.size
      ? `☁️ ${covered}/${configured.size} מקטעים מכוסים בענן`
      : `☁️ ${cloud.length} מקטעים שמורים בענן`;
  }

  function paint(cloud=lastCloud){
    lastCloud=Array.isArray(cloud)?cloud:lastCloud;
    const node=document.getElementById('routeDataState');
    if(!node)return;
    const text=cloudText(lastCloud);
    if(node.textContent===text)return;
    painting=true;
    node.textContent=text;
    node.dataset.source='cloud';
    painting=false;
  }

  function protectCloudStatus(){
    const node=document.getElementById('routeDataState');
    if(!node || node.dataset.cloudProtected==='1')return;
    node.dataset.cloudProtected='1';
    const observer=new MutationObserver(()=>{
      if(painting)return;
      const text=node.textContent||'';
      if(/טעונים|תמונות|נתוני מסלול/.test(text) || node.dataset.source!=='cloud'){
        paint(lastCloud);
      }
    });
    observer.observe(node,{childList:true,subtree:true,characterData:true});
    paint(lastCloud);
  }

  async function sync(){
    try{
      const local='indexedDB'in window?await getLocal():[];
      let cloud=await fetchCloud();

      // One-time migration only: bootstrap cloud from an old device if cloud is empty.
      // From this point onward the cloud is the single source of truth.
      if(!cloud.length && local.length){
        for(const row of local)await upload(row);
        cloud=await fetchCloud();
      }

      lastCloud=cloud;
      if('indexedDB'in window)await putLocal(cloud);
      protectCloudStatus();
      paint(cloud);
      sessionStorage.removeItem(RELOAD_KEY);
    }catch(err){
      console.warn('route cloud sync failed',err);
    }
  }

  window.refreshRouteCloudSync=sync;

  function boot(){
    sync();
    [100,300,800,1500,3000].forEach(ms=>setTimeout(()=>{protectCloudStatus();paint();},ms));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync();});
    window.addEventListener('focus',sync);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
