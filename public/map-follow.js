(()=>{
  let map=null,watchId=null,lastPan=null,lastStable=null,samples=[],heading=0,wrap=null,stage=null;
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

  // Important: never rotate Leaflet's mapPane. Leaflet owns that transform and changing it
  // causes missing/grey tiles. Instead, place the whole Leaflet element inside an oversized
  // stage and rotate the stage. The stage is large enough to keep all four corners covered.
  function ensureViewport(){
    const box=document.getElementById('walkMiniMap');
    if(!box||box.dataset.headingViewport==='1')return;
    box.dataset.headingViewport='1';
    const parent=box.parentNode;if(!parent)return;
    wrap=document.createElement('div');wrap.id='walkHeadingViewport';
    wrap.style.cssText='position:relative;width:100%;height:230px;overflow:hidden;border-radius:18px;order:1;flex:0 0 230px;background:#edf1f4';
    parent.insertBefore(wrap,box);wrap.appendChild(box);
    box.style.cssText+=';position:absolute!important;left:50%!important;top:50%!important;width:150%!important;height:150%!important;max-width:none!important;margin:0!important;transform:translate(-50%,-50%)!important;border-radius:0!important;overflow:hidden!important;';
    stage=document.createElement('div');stage.id='walkHeadingStage';
    stage.style.cssText='position:absolute;inset:-25%;transform-origin:50% 50%;will-change:transform;pointer-events:none;';
    while(box.firstChild)stage.appendChild(box.firstChild);
    box.appendChild(stage);
    const style=document.createElement('style');style.id='walkHeadingViewportStyle';style.textContent='@media(max-height:760px){#walkHeadingViewport{height:195px!important;flex-basis:195px!important}}';document.head.appendChild(style);
  }
  function orientMap(){
    ensureViewport();
    if(!stage)return;
    stage.style.transition='transform .45s linear';
    stage.style.transform=`rotate(${-heading}deg) scale(1.08)`;
    const marker=document.querySelector('#walkMiniMap .maor-arrow');
    if(marker)marker.style.transform=`rotate(${heading}deg)`;
  }
  function captureLeaflet(){if(!window.L||window.__walkMapFactoryWrapped)return false;window.__walkMapFactoryWrapped=true;const original=window.L.map;window.L.map=function(container,...args){const m=original.call(this,container,...args);const el=typeof container==='string'?document.getElementById(container):container;if(el?.id==='walkMiniMap'){map=m;window.__walkMapInstance=m;setTimeout(()=>{ensureViewport();map.invalidateSize(false)},50)}return m};return true}
  function ensureLeaflet(){if(window.L){captureLeaflet();return}if(document.querySelector('script[data-map-follow-leaflet]'))return;if(!document.querySelector('link[href*="leaflet"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css)}const js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';js.dataset.mapFollowLeaflet='1';js.onload=captureLeaflet;document.head.appendChild(js)}
  function onPosition(pos){if(!walking()||!map)return;const accuracy=Number(pos.coords.accuracy||999);if(accuracy>75)return;const raw={lat:pos.coords.latitude,lon:pos.coords.longitude};const here=stablePoint(raw);let h=routeHeading(here);if(h==null&&lastStable&&dist(lastStable,here)>=4)h=bearing(lastStable,here);if(h==null&&Number.isFinite(Number(pos.coords.heading)))h=Number(pos.coords.heading);if(h!=null)smoothHeading(h);lastStable=here;const center={lat:map.getCenter().lat,lon:map.getCenter().lng};const fromLast=lastPan?dist(lastPan,here):Infinity;const fromCenter=dist(center,here);if(!(fromCenter<30&&fromLast<18)){lastPan=here;const zoom=Math.max(17,Math.min(18,map.getZoom()||18));map.setView([here.lat,here.lon],zoom,{animate:false})}requestAnimationFrame(orientMap)}
  function ensureWatch(){if(watchId!=null||!navigator.geolocation)return;watchId=navigator.geolocation.watchPosition(onPosition,()=>{},{enableHighAccuracy:true,maximumAge:1000,timeout:15000})}
  ensureLeaflet();
  setInterval(()=>{ensureLeaflet();map=window.__walkMapInstance||map;if(walking()){ensureWatch();orientMap()}else{samples=[];lastPan=null;lastStable=null;heading=0}},500);
})();
