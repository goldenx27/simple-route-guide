(()=>{
  let map=null,watchId=null,lastPan=null,lastStable=null,samples=[],heading=0,wrap=null;
  const SEGMENTS={
    'maor-home-school':['home-to-38283','38252-to-school'],
    'maor-school-home':['school-to-36743','33734-to-home']
  };
  const FINAL_WALK_STEP={'maor-home-school':5,'maor-school-home':4};
  function walking(){return current?.step?.type==='walk'&&!document.getElementById('trip')?.classList.contains('hidden')}
  function dist(a,b){return typeof distanceMeters==='function'?distanceMeters(a,b):Infinity}
  function median(values){const a=[...values].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]}
  function stablePoint(here){samples.push(here);if(samples.length>5)samples.shift();return{lat:median(samples.map(p=>p.lat)),lon:median(samples.map(p=>p.lon))}}
  function point(p){return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))?{lat:Number(p.lat),lon:Number(p.lon)}:null}
  function activePoints(){const segs=SEGMENTS[selectedRoute]||[];if(!segs.length)return[];const final=Number(current?.trip?.current_step)===FINAL_WALK_STEP[selectedRoute];return(routeRecordings[final?segs[1]:segs[0]]?.points||[]).map(point).filter(Boolean)}
  function bearing(a,b){const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;return(Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))*180/Math.PI+360)%360}
  function routeHeading(here){const pts=activePoints();if(pts.length<2)return null;let best=Infinity,idx=-1;for(let i=0;i<pts.length;i++){const d=dist(here,pts[i]);if(d<best){best=d;idx=i}}if(idx<0||best>120)return null;let look=Math.min(pts.length-1,idx+5);while(look<pts.length-1&&dist(pts[idx],pts[look])<10)look++;return look>idx?bearing(pts[idx],pts[look]):null}
  function smoothHeading(next){const delta=((next-heading+540)%360)-180;heading=(heading+delta*.22+360)%360}

  // Rotate only the Leaflet root container, never mapPane/tilePane and never re-parent
  // Leaflet's internal nodes. Leaflet owns those nodes and their transforms.
  function ensureViewport(){
    const box=document.getElementById('walkMiniMap');
    if(!box)return;
    if(box.parentElement?.id==='walkHeadingViewport'){wrap=box.parentElement;return}
    const parent=box.parentNode;if(!parent)return;
    wrap=document.createElement('div');wrap.id='walkHeadingViewport';
    wrap.style.cssText='position:relative;width:100%;height:230px;overflow:hidden;border-radius:18px;order:1;flex:0 0 230px;background:#edf1f4';
    parent.insertBefore(wrap,box);wrap.appendChild(box);
    box.style.setProperty('position','absolute','important');
    box.style.setProperty('left','50%','important');
    box.style.setProperty('top','50%','important');
    box.style.setProperty('width','150%','important');
    box.style.setProperty('height','150%','important');
    box.style.setProperty('max-width','none','important');
    box.style.setProperty('margin','0','important');
    box.style.setProperty('border-radius','0','important');
    box.style.setProperty('overflow','hidden','important');
    box.style.setProperty('transform-origin','50% 50%','important');
    const style=document.getElementById('walkHeadingViewportStyle')||document.createElement('style');
    style.id='walkHeadingViewportStyle';
    style.textContent='@media(max-height:760px){#walkHeadingViewport{height:195px!important;flex-basis:195px!important}}';
    if(!style.isConnected)document.head.appendChild(style);
    setTimeout(()=>map?.invalidateSize(false),80);
  }
  function orientMap(){
    ensureViewport();
    const box=document.getElementById('walkMiniMap');if(!box)return;
    box.style.setProperty('transition','transform .45s linear','important');
    box.style.setProperty('transform',`translate(-50%,-50%) rotate(${-heading}deg) scale(1.05)`,'important');
    // walk-map.js already rotates the arrow by the route bearing. Rotating the whole
    // map by the opposite bearing naturally leaves the arrow pointing toward screen-up.
  }
  function captureLeaflet(){if(!window.L||window.__walkMapFactoryWrapped)return false;window.__walkMapFactoryWrapped=true;const original=window.L.map;window.L.map=function(container,...args){const m=original.call(this,container,...args);const el=typeof container==='string'?document.getElementById(container):container;if(el?.id==='walkMiniMap'){map=m;window.__walkMapInstance=m;setTimeout(()=>{ensureViewport();map.invalidateSize(false)},80)}return m};return true}
  function ensureLeaflet(){if(window.L){captureLeaflet();return}if(document.querySelector('script[data-map-follow-leaflet]'))return;if(!document.querySelector('link[href*="leaflet"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css)}const js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';js.dataset.mapFollowLeaflet='1';js.onload=captureLeaflet;document.head.appendChild(js)}
  function onPosition(pos){if(!walking()||!map)return;const accuracy=Number(pos.coords.accuracy||999);if(accuracy>75)return;const raw={lat:pos.coords.latitude,lon:pos.coords.longitude};const here=stablePoint(raw);let h=routeHeading(here);if(h==null&&lastStable&&dist(lastStable,here)>=4)h=bearing(lastStable,here);if(h==null&&Number.isFinite(Number(pos.coords.heading)))h=Number(pos.coords.heading);if(h!=null)smoothHeading(h);lastStable=here;const center={lat:map.getCenter().lat,lon:map.getCenter().lng};const fromLast=lastPan?dist(lastPan,here):Infinity;const fromCenter=dist(center,here);if(!(fromCenter<25&&fromLast<14)){lastPan=here;const zoom=Math.max(17,Math.min(18,map.getZoom()||18));map.setView([here.lat,here.lon],zoom,{animate:false})}requestAnimationFrame(orientMap)}
  function ensureWatch(){if(watchId!=null||!navigator.geolocation)return;watchId=navigator.geolocation.watchPosition(onPosition,()=>{},{enableHighAccuracy:true,maximumAge:1000,timeout:15000})}
  ensureLeaflet();
  setInterval(()=>{ensureLeaflet();map=window.__walkMapInstance||map;if(walking()){ensureWatch();orientMap()}else{samples=[];lastPan=null;lastStable=null;heading=0}},500);
})();
