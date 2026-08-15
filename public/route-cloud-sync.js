(()=>{
  const DB_NAME='simple-route-guide';
  const STORE='routes';
  const RELOAD_KEY='routeCloudSyncReloaded';

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
    const r=await fetch('/api/route-recordings',{cache:'no-store'});
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

  function paint(cloud){
    const node=document.getElementById('routeDataState');
    if(!node)return;
    const configured=configuredSegments();
    const covered=configured.size
      ? cloud.filter(x=>configured.has(x?.segment)).length
      : cloud.length;
    node.textContent=configured.size
      ? `☁️ ${covered}/${configured.size} מקטעים מכוסים בענן`
      : `☁️ ${cloud.length} מקטעים שמורים בענן`;
  }

  async function sync(){
    if(!('indexedDB'in window))return;
    try{
      const local=await getLocal();
      let cloud=await fetchCloud();

      // One-time migration path: if the cloud is completely empty but this device
      // already has recordings, bootstrap them. Afterwards the cloud is authoritative.
      if(!cloud.length && local.length){
        for(const row of local)await upload(row);
        cloud=await fetchCloud();
      }

      const written=await putLocal(cloud);
      paint(cloud);

      if(written>0){
        if(sessionStorage.getItem(RELOAD_KEY)!=='1'){
          sessionStorage.setItem(RELOAD_KEY,'1');
          location.reload();
          return;
        }
      }else{
        sessionStorage.removeItem(RELOAD_KEY);
      }
    }catch(err){
      console.warn('route cloud sync failed',err);
    }
  }

  window.refreshRouteCloudSync=sync;
  sync();
})();
