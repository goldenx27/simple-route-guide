(()=>{
  let map=null,watchId=null,lastPan=null,samples=[];
  function walking(){return current?.step?.type==='walk'&&!document.getElementById('trip')?.classList.contains('hidden')}
  function dist(a,b){return typeof distanceMeters==='function'?distanceMeters(a,b):Infinity}
  function median(values){const a=[...values].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]}
  function stablePoint(here){samples.push(here);if(samples.length>5)samples.shift();return{lat:median(samples.map(p=>p.lat)),lon:median(samples.map(p=>p.lon))}}
  function captureLeaflet(){
    if(!window.L||window.__walkMapFactoryWrapped)return false;
    window.__walkMapFactoryWrapped=true;
    const original=window.L.map;
    window.L.map=function(container,...args){const m=original.call(this,container,...args);const el=typeof container==='string'?document.getElementById(container):container;if(el?.id==='walkMiniMap'){map=m;window.__walkMapInstance=m}return m};
    return true;
  }
  function ensureLeaflet(){
    if(window.L){captureLeaflet();return}
    if(document.querySelector('script[data-map-follow-leaflet]'))return;
    if(!document.querySelector('link[href*="leaflet"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css)}
    const js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';js.dataset.mapFollowLeaflet='1';js.onload=captureLeaflet;document.head.appendChild(js)
  }
  function onPosition(pos){
    if(!walking()||!map)return;
    const accuracy=Number(pos.coords.accuracy||999);if(accuracy>75)return;
    const raw={lat:pos.coords.latitude,lon:pos.coords.longitude};
    const here=stablePoint(raw);
    const center={lat:map.getCenter().lat,lon:map.getCenter().lng};
    const fromLast=lastPan?dist(lastPan,here):Infinity;
    const fromCenter=dist(center,here);
    if(fromCenter<30&&fromLast<18)return;
    lastPan=here;
    const zoom=Math.max(17,Math.min(18,map.getZoom()||18));
    map.setView([here.lat,here.lon],zoom,{animate:false});
  }
  function ensureWatch(){if(watchId!=null||!navigator.geolocation)return;watchId=navigator.geolocation.watchPosition(onPosition,()=>{},{enableHighAccuracy:true,maximumAge:1000,timeout:15000})}
  ensureLeaflet();
  const timer=setInterval(()=>{
    ensureLeaflet();
    map=window.__walkMapInstance||map;
    if(walking())ensureWatch();else{samples=[];lastPan=null}
  },500);
})();
