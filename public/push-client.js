(() => {
  const PARENT_PHONE = '0546187090';
  const sentArrivals = new Set();

  function b64ToBytes(value) {
    const padded = value + '='.repeat((4 - value.length % 4) % 4);
    const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    await navigator.serviceWorker.register('/sw.js');
    return navigator.serviceWorker.ready;
  }

  async function subscribeParent() {
    if (!('Notification' in window) || !('PushManager' in window)) { alert('המכשיר או הדפדפן הזה לא תומך בהתראות Push.'); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { alert('צריך לאפשר התראות כדי לקבל התראות ממאור.'); return; }
      const reg = await registerServiceWorker();
      const keyRes = await fetch('/api/push/public-key'); const keyData = await keyRes.json();
      if (!keyRes.ok) throw new Error(keyData.detail || 'Push עדיין לא הוגדר ב-Cloudflare');
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:b64ToBytes(keyData.publicKey) });
      const res = await fetch('/api/push/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(sub.toJSON())});
      if (!res.ok) throw new Error('לא הצלחתי לרשום את המכשיר להתראות');
      localStorage.setItem('simpleRouteParentPush','on'); paintPushButton();
      alert('✅ הטלפון הזה רשום לקבלת התראות חירום והגעה של מאור.');
    } catch (err) { alert('לא הצלחתי להפעיל התראות: ' + (err?.message || err)); }
  }

  function paintPushButton() {
    const b=document.getElementById('parentPushButton'); if(!b)return;
    const on=localStorage.getItem('simpleRouteParentPush')==='on' && Notification?.permission==='granted';
    b.textContent=on?'✅ התראות הורה פעילות בטלפון הזה':'🔔 הפעל התראות הורה בטלפון הזה'; b.className=on?'secondary':'primary';
  }

  function installParentButton() {
    const recorder=document.getElementById('recorder'); if(!recorder||document.getElementById('parentPushButton'))return;
    const actions=recorder.querySelector('.actions'); if(!actions)return;
    const b=document.createElement('button'); b.id='parentPushButton';b.type='button';b.onclick=subscribeParent;
    const back=[...actions.querySelectorAll('button')].find(x=>x.textContent.includes('חזרה למסך מאור'));
    if(back)actions.insertBefore(b,back);else actions.appendChild(b); paintPushButton();
  }

  async function sendEmergencyLocation(position) {
    const step=document.getElementById('message')?.textContent||document.getElementById('title')?.textContent||'';
    return fetch('/api/push/emergency',{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({lat:position.coords.latitude,lon:position.coords.longitude,accuracy:position.coords.accuracy,step})}).catch(()=>null);
  }

  function getEmergencyPosition() { return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(pos=>resolve(pos),()=>resolve(null),{enableHighAccuracy:true,maximumAge:10000,timeout:3000});}); }

  window.sendHelp=async function(){navigator.vibrate?.([180,100,180]);const ok=confirm('🆘 צריך עזרה?\n\nלחץ אישור כדי לשלוח לאבא את המיקום ולהתקשר אליו עכשיו.');if(!ok)return;const pos=await getEmergencyPosition();if(pos)await Promise.race([sendEmergencyLocation(pos),new Promise(resolve=>setTimeout(resolve,1200))]);window.location.href='tel:'+PARENT_PHONE;};

  async function notifyArrival(data) {
    const trip=data?.trip, step=data?.step;
    if(!trip?.id || trip.status!=='completed' || step?.type!=='arrival' || sentArrivals.has(trip.id)) return;
    const storageKey=`simpleRouteArrival:${trip.id}`;
    if(sessionStorage.getItem(storageKey)==='sent') return;
    sentArrivals.add(trip.id); sessionStorage.setItem(storageKey,'sent');
    fetch('/api/push/arrival',{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({trip_id:trip.id,route_id:trip.route_id,child:'מאור',destination:data?.route_info?.destination?.name||''})}).catch(()=>{});
  }

  // Observe the app's trip state without changing route/GPS behavior.
  let lastSeen='';
  setInterval(()=>{
    try{
      const data=window.current;
      if(!data?.trip)return;
      const key=`${data.trip.id}:${data.trip.status}:${data.step?.type||''}`;
      if(key===lastSeen)return; lastSeen=key; notifyArrival(data);
    }catch(e){}
  },500);

  registerServiceWorker().catch(()=>{});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installParentButton);else installParentButton();
})();
