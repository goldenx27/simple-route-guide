(()=>{
  const REQUIRED=['home-to-38283','38252-to-school','school-to-36743','33734-to-home'];
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
    let added=0;
    try{
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE,'readwrite');
        const store=tx.objectStore(STORE);
        for(const row of rows){store.put(row);added++}
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
      });
      return added;
    }finally{db.close()}
  }

  async function fetchCloud(){
    const r=await fetch('/api/route-recordings',{cache:'no-store'});
    if(!r.ok)throw new Error('cloud read '+r.status);
    const data=await r.json();
    return Array.isArray(data.recordings)?data.recordings:[];
  }

  async function uploadMissing(local,cloud){
    const cloudSegments=new Set(cloud.map(x=>x.segment));
    let uploaded=0;
    for(const row of local){
      if(!REQUIRED.includes(row?.segment)||cloudSegments.has(row.segment))continue;
      const r=await fetch('/api/route-recordings/'+encodeURIComponent(row.segment),{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(row)
      });
      if(r.ok)uploaded++;
    }
    return uploaded;
  }

  function paint(text){
    const node=document.getElementById('routeDataState');
    if(node)node.textContent=text;
  }

  async function sync(){
    if(!('indexedDB'in window))return;
    try{
      const local=await getLocal();
      let cloud=await fetchCloud();
      const uploaded=await uploadMissing(local,cloud);
      if(uploaded)cloud=await fetchCloud();

      const localSegments=new Set(local.map(x=>x.segment));
      const missing=cloud.filter(x=>REQUIRED.includes(x?.segment)&&!localSegments.has(x.segment));
      const added=await putLocal(missing);
      const finalCount=new Set([...local.map(x=>x.segment),...cloud.map(x=>x.segment)]).size;

      if(finalCount>=4)paint('☁️ 4/4 מקטעים מסונכרנים מהענן');
      else if(uploaded)paint(`☁️ הועלו ${uploaded} מקטעים לענן · ${finalCount}/4`);

      if(added>0){
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

  sync();
})();
