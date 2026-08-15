(() => {
  const PARENT_PHONE = '0546187090';
  const sentArrivals = new Set();
  let routeRunId = null;
  let tripWasVisible = false;

  function b64ToBytes(value) {
    const padded = value + '='.repeat((4 - value.length % 4) % 4);
    const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }
  async function registerServiceWorker(){if(!('serviceWorker'in navigator))return null;await navigator.serviceWorker.register('/sw.js');return navigator.serviceWorker.ready;}

  async function subscribeParent() {
    if (!('Notification' in window) || !('PushManager' in window)) { alert('המכשיר או הדפדפן הזה לא תומך בהתראות Push.'); return; }
    try {
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){alert('צריך לאפשר התראות כדי לקבל התראות ממאור.');return;}
      const reg=await registerServiceWorker();
      const keyRes=await fetch('/api/push/public-key'),keyData=await keyRes.json();
      if(!keyRes.ok)throw new Error(keyData.detail||'Push עדיין לא הוגדר ב-Cloudflare');
      let sub=await reg.pushManager.getSubscription();
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(keyData.publicKey)});
      const res=await fetch('/api/push/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role:'parent',subscription:sub.toJSON()})});
      if(!res.ok)throw new Error('לא הצלחתי לרשום את המכשיר להתראות');
      localStorage.setItem('simpleRouteParentPush','on');paintPushButton();
      alert('✅ הטלפון הזה הוגדר כמכשיר הורה ויקבל התראות חירום והגעה של מאור.');
    }catch(err){alert('לא הצלחתי להפעיל התראות: '+(err?.message||err));}
  }

  function paintPushButton(){const b=document.getElementById('parentPushButton');if(!b)return;const on=localStorage.getItem('simpleRouteParentPush')==='on'&&Notification?.permission==='granted';b.textContent=on?'✅ התראות הורה פעילות בטלפון הזה':'🔔 הפעל התראות הורה בטלפון הזה';b.className=(on?'secondary ':'primary ')+'parent-device-state';}
  function ensurePriorityArea(recorder){let priority=recorder.querySelector('.parent-priority-status');if(priority)return priority;const header=recorder.querySelector('.parent-header');if(!header)return null;priority=document.createElement('div');priority.className='parent-priority-status';header.insertAdjacentElement('afterend',priority);return priority;}
  function installParentButton(){const recorder=document.getElementById('recorder');if(!recorder)return false;const priority=ensurePriorityArea(recorder);if(!priority)return false;let b=document.getElementById('parentPushButton');if(!b){b=document.createElement('button');b.id='parentPushButton';b.type='button';b.onclick=subscribeParent;}if(b.parentElement!==priority)priority.appendChild(b);paintPushButton();return true;}

  async function sendEmergencyLocation(position){const step=document.getElementById('message')?.textContent||document.getElementById('title')?.textContent||'';return fetch('/api/push/emergency',{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({lat:position.coords.latitude,lon:position.coords.longitude,accuracy:position.coords.accuracy,step})}).catch(()=>null);}
  function getEmergencyPosition(){return new Promise(resolve=>{if(!navigator.geolocation)return resolve(null);navigator.geolocation.getCurrentPosition(pos=>resolve(pos),()=>resolve(null),{enableHighAccuracy:true,maximumAge:10000,timeout:3000});});}
  window.sendHelp=async function(){navigator.vibrate?.([180,100,180]);const ok=confirm('🆘 צריך עזרה?\n\nלחץ אישור כדי לשלוח לאבא את המיקום ולהתקשר אליו עכשיו.');if(!ok)return;const pos=await getEmergencyPosition();if(pos)await Promise.race([sendEmergencyLocation(pos),new Promise(resolve=>setTimeout(resolve,1200))]);window.location.href='tel:'+PARENT_PHONE;};

  function destinationFromScreen(){const text=((document.getElementById('message')?.textContent||'')+' '+(document.getElementById('title')?.textContent||'')).trim();if(text.includes('הביתה')||text.includes('הגעת הביתה'))return'הביתה';if(text.includes('בית הספר')||text.includes('רמון'))return'לבית הספר';return'ליעד';}

  function updateRouteRun(){
    const trip=document.getElementById('trip');
    const visible=!!trip&&!trip.classList.contains('hidden');
    if(visible&&!tripWasVisible){
      routeRunId=(crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`);
    }
    if(!visible&&tripWasVisible){
      routeRunId=null;
    }
    tripWasVisible=visible;
    return visible;
  }

  async function notifyArrivalFromScreen(){
    const tripScreen=document.getElementById('trip'),icon=document.getElementById('icon')?.textContent?.trim(),title=document.getElementById('title')?.textContent?.trim()||'',message=document.getElementById('message')?.textContent?.trim()||'',visible=tripScreen&&!tripScreen.classList.contains('hidden'),arrived=visible&&(icon==='🎉'||title.includes('הגעת')||message.includes('הגעת'));
    if(!arrived||!routeRunId)return;
    const destination=destinationFromScreen();
    const key=routeRunId;
    if(sentArrivals.has(key))return;
    sentArrivals.add(key);
    await fetch('/api/push/arrival',{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({trip_id:routeRunId,child:'מאור',destination})}).catch(()=>{});
  }

  function cleanArrivalUi(){const trip=document.getElementById('trip');if(!trip||trip.classList.contains('hidden'))return;const icon=document.getElementById('icon'),title=document.getElementById('title'),message=document.getElementById('message');if(icon?.textContent?.trim()!=='🎉')return;const t=title?.textContent?.trim()||'',m=message?.textContent?.trim()||'';if(t&&m&&(t===m||(t.includes('הגעת')&&m.includes('הגעת'))))title.style.display='none';}

  let lastArrivalSignature='';
  setInterval(()=>{
    try{
      const visible=updateRouteRun();
      cleanArrivalUi();
      const signature=visible?`${routeRunId}|${document.getElementById('icon')?.textContent||''}|${document.getElementById('title')?.textContent||''}|${document.getElementById('message')?.textContent||''}`:'';
      if(signature&&signature!==lastArrivalSignature){lastArrivalSignature=signature;notifyArrivalFromScreen();}
      if(!signature)lastArrivalSignature='';
    }catch(e){}
  },400);

  function bootUi(){[0,50,150,350,800,1500,3000].forEach(ms=>setTimeout(installParentButton,ms));}
  registerServiceWorker().catch(()=>{});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootUi);else bootUi();
})();
