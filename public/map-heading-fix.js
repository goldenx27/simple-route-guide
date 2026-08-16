(()=>{
  let watchId=null,lastHeading=0,lastPos=null;
  const SEGMENTS={
    'maor-home-school':['home-to-38283','38252-to-school'],
    'maor-school-home':['school-to-36743','33734-to-home']
  };
  function walking(){return current?.step?.type==='walk'&&!document.getElementById('trip')?.classList.contains('hidden')}
  function point(p){return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))?{lat:Number(p.lat),lon:Number(p.lon)}:null}
  function segment(){const s=current?.trip?.current_step??0,segs=SEGMENTS[selectedRoute]||[];if(!segs.length)return null;return s<=1?segs[0]:segs[1]}
  function points(){const k=segment();return (routeRecordings[k]?.points||[]).map(point).filter(Boolean)}
  function nearestIndex(here,pts){let idx=-1,best=Infinity;for(let i=0;i<pts.length;i++){const d=distanceMeters(here,pts[i]);if(d<best){best=d;idx=i}}return idx}
  function bearing(a,b){const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;return(Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))*180/Math.PI+360)%360}
  function targetHeading(here){const pts=points();if(pts.length<2)return null;const idx=nearestIndex(here,pts);if(idx<0)return null;const look=Math.min(pts.length-1,idx+Math.max(3,Math.round(pts.length/35)));if(look===idx)return null;return bearing(here,pts[look])}
  function smooth(next){const delta=((next-lastHeading+540)%360)-180;lastHeading=(lastHeading+delta*.4+360)%360;return lastHeading}
  function apply(){if(!walking())return;const pane=document.querySelector('#walkMiniMap .leaflet-map-pane');if(!pane)return;let base=pane.style.transform||'';base=base.replace(/\s*rotate\([^)]*\)/g,'').replace(/\s*scale\([^)]*\)/g,'').trim();pane.style.transformOrigin='50% 50%';pane.style.transition='transform .35s linear';pane.style.transform=`${base} rotate(${-lastHeading}deg) scale(1.32)`}
  function onPosition(pos){if(!walking()||(pos.coords.accuracy||999)>80)return;const here={lat:pos.coords.latitude,lon:pos.coords.longitude};let h=targetHeading(here);if(h==null&&lastPos&&distanceMeters(lastPos,here)>=4)h=bearing(lastPos,here);lastPos=here;if(h!=null)smooth(h);setTimeout(apply,60)}
  function ensureWatch(){if(watchId!=null||!navigator.geolocation)return;watchId=navigator.geolocation.watchPosition(onPosition,()=>{},{enableHighAccuracy:true,maximumAge:1500,timeout:15000})}
  setInterval(()=>{if(walking()){ensureWatch();apply()}else{lastPos=null}},450);
})();
