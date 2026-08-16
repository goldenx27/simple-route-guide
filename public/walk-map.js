(()=>{
  const WALK_SEGMENTS={
    'maor-home-school':['home-to-38283','38252-to-school'],
    'maor-school-home':['school-to-36743','33734-to-home']
  };
  const ROUTE_NEAR_METERS=90, START_NEAR_METERS=100, DEST_NEAR_METERS=75;
  let map=null,userMarker=null,routeHalo=null,routeLine=null,passedLine=null,signalLayer=null,mapWatch=null,lastFix=null,leafletLoading=null,signalsKey='';

  function addStyles(){if(document.getElementById('walkMapStyles'))return;const s=document.createElement('style');s.id='walkMapStyles';s.textContent=`
    #walkMiniMap{height:210px;border-radius:18px;overflow:hidden;margin:0 0 10px;direction:ltr;background:#edf1f4;box-shadow:inset 0 0 0 1px #dfe5ea;position:relative}
    #walkMiniMap.hidden{display:none!important}.leaflet-control-attribution{font-size:8px!important;opacity:.55}.leaflet-control-zoom{display:none}
    .maor-dot{width:26px;height:26px;border-radius:50%;background:#1677ff;border:4px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)}
    .route-signal{font-size:22px;filter:drop-shadow(0 1px 2px white)}
    #trip .content{position:relative}
    #trip .landmark-feedback{z-index:25;top:8px;left:50%;transform:translateX(-50%);width:min(78vw,340px);padding:10px;background:rgba(255,255,255,.98);box-shadow:0 12px 34px rgba(0,0,0,.24);border-radius:20px}
    #trip .landmark-feedback img{width:100%;height:min(42vw,230px);min-height:180px;object-fit:cover;border-radius:14px;display:block}
    #trip .landmark-feedback .ok{font-size:.9rem;margin-top:8px}
    #trip .landmark-feedback .where{font-size:.78rem;margin-top:5px}
    #trip .landmark-dots{margin-top:6px}
    #routeStartNotice{position:absolute;z-index:50;left:10px;right:10px;bottom:10px;background:#fff;border-radius:16px;padding:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);text-align:center;font-weight:800;direction:rtl}
  `;document.head.appendChild(s)}
  function loadLeaflet(){if(window.L)return Promise.resolve();if(leafletLoading)return leafletLoading;leafletLoading=new Promise((resolve,reject)=>{const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css);const js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';js.onload=resolve;js.onerror=reject;document.head.appendChild(js)});return leafletLoading}
  function point(p){return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))?{lat:Number(p.lat),lon:Number(p.lon)}:null}
  function pointsForRoute(){const segs=WALK_SEGMENTS[selectedRoute]||[];return segs.flatMap(k=>(routeRecordings[k]?.points||[]).map(point).filter(Boolean))}
  function activeWalkPoints(){if(current?.step?.type!=='walk')return[];const segs=WALK_SEGMENTS[selectedRoute]||[];const first=current?.trip?.current_step<=1?segs[0]:segs[1];const pts=(routeRecordings[first]?.points||[]).map(point).filter(Boolean);return pts.length?pts:pointsForRoute()}
  function nearest(here,pts){let best={distance:Infinity,index:-1};pts.forEach((p,i)=>{const d=distanceMeters(here,p);if(d<best.distance)best={distance:d,index:i}});return best}
  function ensureContainer(){const content=document.querySelector('#trip .content');if(!content)return null;let box=document.getElementById('walkMiniMap');if(!box){box=document.createElement('div');box.id='walkMiniMap';box.className='hidden';content.insertBefore(box,content.firstChild)}return box}
  async function ensureMap(){const box=ensureContainer();if(!box)return;await loadLeaflet();if(map)return;map=L.map(box,{zoomControl:false,attributionControl:true,dragging:false,doubleClickZoom:false,scrollWheelZoom:false,touchZoom:false,boxZoom:false,keyboard:false});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);signalLayer=L.layerGroup().addTo(map)}
  function markerIcon(){return L.divIcon({className:'',html:'<div class="maor-dot"></div>',iconSize:[26,26],iconAnchor:[13,13]})}
  function signalIcon(){return L.divIcon({className:'',html:'<div class="route-signal">🚦</div>',iconSize:[26,26],iconAnchor:[13,13]})}
  async function fetchSignals(pts){if(!pts.length||!signalLayer)return;const key=`${pts[0].lat.toFixed(3)}:${pts[0].lon.toFixed(3)}:${pts.at(-1).lat.toFixed(3)}:${pts.at(-1).lon.toFixed(3)}`;if(key===signalsKey)return;signalsKey=key;const lats=pts.map(p=>p.lat),lons=pts.map(p=>p.lon),pad=.002;const bbox=`${Math.min(...lats)-pad},${Math.min(...lons)-pad},${Math.max(...lats)+pad},${Math.max(...lons)+pad}`;try{const q=`[out:json][timeout:8];node[highway=traffic_signals](${bbox});out;`;const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:q});const d=await r.json();signalLayer.clearLayers();(d.elements||[]).forEach(x=>{const p={lat:x.lat,lon:x.lon};if(nearest(p,pts).distance<=45)L.marker([p.lat,p.lon],{icon:signalIcon(),interactive:false}).addTo(signalLayer)})}catch(e){console.warn('traffic signals unavailable',e)}}
  function clearRouteLines(){for(const l of [routeHalo,routeLine,passedLine])if(l)l.remove();routeHalo=routeLine=passedLine=null}
  async function paintMap(here){
    if(current?.step?.type!=='walk'){document.getElementById('walkMiniMap')?.classList.add('hidden');return}
    const pts=activeWalkPoints();if(pts.length<2)return;await ensureMap();
    const box=document.getElementById('walkMiniMap');box.classList.remove('hidden');
    clearRouteLines();
    const coords=pts.map(p=>[p.lat,p.lon]);
    routeHalo=L.polyline(coords,{weight:13,opacity:.92,color:'#fff',lineCap:'round',lineJoin:'round',interactive:false}).addTo(map);
    routeLine=L.polyline(coords,{weight:7,opacity:.95,color:'#1677ff',lineCap:'round',lineJoin:'round',interactive:false}).addTo(map);
    const near=nearest(here,pts);
    if(near.index>0){
      const passed=pts.slice(0,near.index+1).map(p=>[p.lat,p.lon]);
      passedLine=L.polyline(passed,{weight:7,opacity:.95,color:'#6b7280',lineCap:'round',lineJoin:'round',interactive:false}).addTo(map);
    }
    if(!userMarker)userMarker=L.marker([here.lat,here.lon],{icon:markerIcon(),interactive:false,zIndexOffset:1000}).addTo(map);else userMarker.setLatLng([here.lat,here.lon]);
    map.setView([here.lat,here.lon],18,{animate:false});setTimeout(()=>map.invalidateSize(false),20);fetchSignals(pts)
  }
  function onMapPosition(pos){if((pos.coords.accuracy||999)>80)return;const here={lat:pos.coords.latitude,lon:pos.coords.longitude};if(lastFix&&distanceMeters(lastFix,here)>250)return;lastFix=here;paintMap(here).catch(()=>{})}
  function startMapWatch(){if(mapWatch!=null||!navigator.geolocation)return;mapWatch=navigator.geolocation.watchPosition(onMapPosition,()=>{},{enableHighAccuracy:true,maximumAge:2000,timeout:15000})}
  function stopMapWatch(){if(mapWatch!=null)navigator.geolocation.clearWatch(mapWatch);mapWatch=null;lastFix=null}

  function getPosition(){return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(p=>resolve(p),()=>resolve(null),{enableHighAccuracy:true,maximumAge:3000,timeout:6000})})}
  function showStartNotice(text){let n=document.getElementById('routeStartNotice');if(!n){n=document.createElement('div');n.id='routeStartNotice';document.getElementById('home')?.appendChild(n)}n.textContent=text;setTimeout(()=>n.remove(),4500)}
  const originalStart=window.startTrip;
  if(typeof originalStart==='function')window.startTrip=async function(...args){const pos=await getPosition();const pts=pointsForRoute();if(!pos||pts.length<2)return originalStart.apply(this,args);const here={lat:pos.coords.latitude,lon:pos.coords.longitude},near=nearest(here,pts),startDist=distanceMeters(here,pts[0]),destDist=distanceMeters(here,pts.at(-1));if(destDist<=DEST_NEAR_METERS){showStartNotice(selectedRoute==='maor-school-home'?'אתה כבר בבית 🏠':'אתה כבר בבית הספר 🏫');return originalStart.apply(this,args)}if(startDist<=START_NEAR_METERS)return originalStart.apply(this,args);if(near.distance<=ROUTE_NEAR_METERS){sessionStorage.setItem('simpleRouteResumeIndex',String(near.index));showStartNotice('נראה שאתה כבר בדרך — מתחילים מהמיקום שלך 📍');return originalStart.apply(this,args)}showStartNotice('אתה לא ליד הדרך המוכרת. אפשר לבקש עזרה מאבא.');navigator.vibrate?.([180,100,180]);return null};

  setInterval(()=>{const tripVisible=!document.getElementById('trip')?.classList.contains('hidden');if(tripVisible&&current?.step?.type==='walk')startMapWatch();else{stopMapWatch();document.getElementById('walkMiniMap')?.classList.add('hidden')}},700);
  addStyles();ensureContainer();
})();
