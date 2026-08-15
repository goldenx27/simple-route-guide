(() => {
  let cloudCovered = new Set();
  let busy = false;

  function addStyles() {
    if (document.getElementById('parentWizardStyles')) return;
    const style = document.createElement('style');
    style.id = 'parentWizardStyles';
    style.textContent = `
      #recorder .parent-wizard{display:grid;gap:12px}
      #recorder .wizard-page{display:none;background:#f7f8fa;border-radius:20px;padding:14px;gap:12px}
      #recorder .wizard-page.active{display:grid}
      #recorder .wizard-page-title{font-size:1.08rem;font-weight:900;color:#17202a}
      #recorder .wizard-help{font-size:.84rem;line-height:1.45;color:#52606d;background:#fff;border-radius:14px;padding:10px 12px}
      #recorder .wizard-segment-list{display:grid;gap:8px}
      #recorder .wizard-segment-row{width:100%;display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;text-align:right;padding:13px 14px;border-radius:15px;background:#fff;color:#17202a;border:1px solid #e5eaee}
      #recorder .wizard-segment-row.covered{background:#eef9f1;border-color:#cdebd6}
      #recorder .wizard-segment-row .name{font-weight:900;font-size:.94rem}
      #recorder .wizard-segment-row .state{font-size:.78rem;font-weight:900;white-space:nowrap;color:#7a8792}
      #recorder .wizard-segment-row.covered .state{color:#176b36}
      #recorder .wizard-current-segment{display:grid;gap:4px;text-align:center;background:#eaf1f6;border-radius:15px;padding:11px 12px}
      #recorder .wizard-current-segment .kicker{font-size:.72rem;color:#52606d;font-weight:800}
      #recorder .wizard-current-segment .name{font-size:1rem;font-weight:900;color:#17202a}
      #recorder .wizard-nav{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #recorder .wizard-nav.single{grid-template-columns:1fr}
      #recorder .wizard-nav button{margin:0;min-height:52px}
      #recorder .wizard-upload{min-height:58px!important}
      #recorder .wizard-upload.uploading{opacity:.65}
      #recorder .wizard-page .parent-section{background:transparent!important;padding:0!important;border-radius:0!important}
      #recorder .wizard-page .parent-section-title{display:none!important}
      #recorder .wizard-page .rec-log{max-height:330px}
      #recorder .wizard-summary{padding:11px 12px;border-radius:14px;background:#eef3f7;text-align:center;font-size:.84rem;font-weight:900}
      #recorder .wizard-summary.complete{background:#e8f5ec;color:#176b36}
      #recorder .wizard-maintenance{margin-top:2px}
      #recorder .wizard-maintenance summary{cursor:pointer;font-weight:900;color:#52606d;padding:12px 4px;list-style:none}
      #recorder .wizard-maintenance summary::-webkit-details-marker{display:none}
      #recorder .wizard-maintenance summary::before{content:'▾ ';}
      #recorder .wizard-maintenance[open] summary::before{content:'▴ ';}
      #recorder .wizard-maintenance-body{display:grid;gap:10px;padding-top:4px}
      #recorder #segmentSelect,#recorder #exportButton{display:none!important}
      @media(max-width:380px){#recorder .wizard-nav{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function segments() {
    const select = document.getElementById('segmentSelect');
    return [...(select?.options || [])].map(o => ({ value:o.value, label:o.textContent?.trim() || o.value }));
  }

  function currentSegment() {
    const select = document.getElementById('segmentSelect');
    const item = segments().find(s => s.value === select?.value);
    return item || segments()[0] || { value:'', label:'מקטע' };
  }

  function setPage(name) {
    document.querySelectorAll('#recorder .wizard-page').forEach(p => p.classList.toggle('active', p.dataset.page === name));
    document.getElementById('recorder')?.scrollTo({ top:0, behavior:'smooth' });
    paint();
  }

  function selectSegment(value) {
    const select = document.getElementById('segmentSelect');
    if (!select) return;
    resetDraft();
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles:true }));
    setPage('record');
    setTimeout(() => document.getElementById('recordButton')?.scrollIntoView({ behavior:'smooth', block:'center' }), 50);
  }

  function getDraftData() {
    const segment = currentSegment().value;
    try {
      const points = typeof recPoints !== 'undefined' && Array.isArray(recPoints) ? recPoints : [];
      const landmarks = typeof recLandmarks !== 'undefined' && Array.isArray(recLandmarks) ? recLandmarks : [];
      return {
        segment,
        recordedAt: new Date().toISOString(),
        points: JSON.parse(JSON.stringify(points)),
        landmarks: JSON.parse(JSON.stringify(landmarks)),
      };
    } catch (e) {
      return { segment, recordedAt:new Date().toISOString(), points:[], landmarks:[] };
    }
  }

  function resetDraft() {
    try {
      if (typeof recWatch !== 'undefined' && recWatch != null && navigator.geolocation) navigator.geolocation.clearWatch(recWatch);
      if (typeof recTimer !== 'undefined' && recTimer) clearInterval(recTimer);
      if (typeof recWatch !== 'undefined') recWatch = null;
      if (typeof recTimer !== 'undefined') recTimer = null;
      if (typeof recStarted !== 'undefined') recStarted = null;
      if (typeof recPoints !== 'undefined') recPoints = [];
      if (typeof recLandmarks !== 'undefined') recLandmarks = [];
      if (typeof pendingLandmark !== 'undefined') pendingLandmark = null;
    } catch (e) {}

    const points = document.getElementById('recPoints'); if (points) points.textContent = '0';
    const time = document.getElementById('recTime'); if (time) time.textContent = '00:00';
    const accuracy = document.getElementById('recAccuracy'); if (accuracy) accuracy.textContent = '—';
    const status = document.getElementById('recStatus'); if (status) status.textContent = 'מוכן להתחלה';
    const log = document.getElementById('recLog'); if (log) log.innerHTML = '<div class="small">התמונות יוקטנו ויידחסו אוטומטית. לכל נקודה אפשר לצרף כמה תמונות.</div>';
    const record = document.getElementById('recordButton'); if (record) { record.textContent = '● התחל הקלטה'; record.className = 'primary'; }
    const landmark = document.getElementById('landmarkButton'); if (landmark) landmark.disabled = true;
    const exportBtn = document.getElementById('exportButton'); if (exportBtn) exportBtn.disabled = true;
    const clearBtn = document.getElementById('clearRecordingButton'); if (clearBtn) clearBtn.disabled = true;
  }

  async function fetchCoverage() {
    try {
      const res = await fetch('/api/route-recordings', { cache:'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      cloudCovered = new Set((data.recordings || []).map(r => r?.segment).filter(Boolean));
    } catch (e) {
      console.warn('coverage read failed', e);
    }
    paint();
  }

  async function uploadCurrent() {
    if (busy) return;
    const data = getDraftData();
    if (!data.segment || !data.points.length) {
      const status = document.getElementById('recStatus');
      if (status) status.textContent = 'אין עדיין נקודות GPS לשמירה';
      return;
    }

    busy = true;
    paint();
    try {
      const res = await fetch('/api/route-recordings/' + encodeURIComponent(data.segment), {
        method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(data)
      });
      if (!res.ok) throw new Error('upload ' + res.status);

      if (typeof saveRouteData === 'function') await saveRouteData(data);
      try {
        if (typeof routeRecordings !== 'undefined') routeRecordings[data.segment] = data;
      } catch (e) {}

      cloudCovered.add(data.segment);
      resetDraft();
      await fetchCoverage();
      setPage('list');
    } catch (e) {
      console.error('route upload failed', e);
      const status = document.getElementById('recStatus');
      if (status) status.textContent = '❌ ההעלאה לענן נכשלה. נסה שוב.';
    } finally {
      busy = false;
      paint();
    }
  }

  function isRecording() {
    const b = document.getElementById('recordButton');
    return !!b && /סיים/.test(b.textContent || '');
  }

  function recordingFinished() {
    const exportBtn = document.getElementById('exportButton');
    return !!exportBtn && !exportBtn.disabled && !isRecording();
  }

  function paint() {
    const list = document.getElementById('wizardSegmentList');
    const items = segments();
    if (list) {
      list.innerHTML = '';
      for (const s of items) {
        const covered = cloudCovered.has(s.value);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'wizard-segment-row' + (covered ? ' covered' : '');
        b.innerHTML = `<span class="name">${s.label}</span><span class="state">${covered ? '✅ מכוסה בענן' : '○ עדיין לא הוקלט'}</span>`;
        b.addEventListener('click', () => selectSegment(s.value));
        list.appendChild(b);
      }
    }

    const summary = document.getElementById('wizardCoverageSummary');
    const coveredCount = items.filter(s => cloudCovered.has(s.value)).length;
    if (summary) {
      summary.textContent = items.length ? `${coveredCount} מתוך ${items.length} מקטעים מכוסים בענן` : 'אין מקטעים מוגדרים';
      summary.classList.toggle('complete', items.length > 0 && coveredCount === items.length);
    }

    document.querySelectorAll('#recorder [data-segment-name]').forEach(n => n.textContent = currentSegment().label);
    const upload = document.getElementById('wizardUploadButton');
    if (upload) {
      upload.disabled = busy || !recordingFinished();
      upload.classList.toggle('uploading', busy);
      upload.textContent = busy ? '☁️ מעלה לענן…' : isRecording() ? 'קודם מסיימים את ההקלטה' : recordingFinished() ? '☁️ סיים מקטע והעלה לענן' : 'התחל וסיים הקלטה כדי להעלות';
    }

    const hint = document.getElementById('wizardLiveHint');
    if (hint) hint.textContent = isRecording()
      ? '🟢 ההקלטה פעילה. בכל מקום חשוב לחץ “סמן נקודה”, ואפשר לצרף תמונות.'
      : recordingFinished()
        ? '✅ ההקלטה הסתיימה. לחץ למטה כדי להעלות את המקטע לענן ולסמן אותו כמכוסה.'
        : 'לחץ “התחל הקלטה”, המתן ל-GPS ואז צא לדרך.';

    const state = document.getElementById('routeDataState');
    if (state && items.length) state.textContent = `☁️ ${coveredCount}/${items.length} מקטעים מכוסים בענן`;
  }

  function build() {
    const recorder = document.getElementById('recorder');
    const header = recorder?.querySelector('.parent-header');
    if (!recorder || !header || recorder.dataset.genericWizard === '1') return false;

    const priority = recorder.querySelector('.parent-priority-status');
    const routeSection = [...recorder.querySelectorAll('.parent-section')].find(s => s.querySelector('#segmentSelect'));
    const statusSection = [...recorder.querySelectorAll('.parent-section')].find(s => s.querySelector('.rec-panel'));
    const recordSection = [...recorder.querySelectorAll('.parent-section')].find(s => s.querySelector('#recLog'));
    const dataSection = [...recorder.querySelectorAll('.parent-section')].find(s => s.querySelector('.route-data-tools') || s.querySelector('#exportButton'));
    const danger = recorder.querySelector('.parent-danger-zone');
    const photoInput = document.getElementById('photoInput');
    const routeFilesInput = document.getElementById('routeFilesInput');
    if (!routeSection || !statusSection || !recordSection || !dataSection) return false;

    recorder.dataset.genericWizard = '1';
    recorder.dataset.wizard = '1';
    addStyles();

    const wizard = document.createElement('div'); wizard.className = 'parent-wizard';

    const listPage = document.createElement('section');
    listPage.className = 'wizard-page active'; listPage.dataset.page = 'list';
    listPage.innerHTML = '<div class="wizard-page-title">מקטעי המסלול</div><div class="wizard-help">בחר מקטע לעבודה. מקטע שמסומן בירוק כבר שמור בענן. אפשר לפתוח אותו שוב, להקליט מחדש ולעדכן את הגרסה בענן.</div><div id="wizardCoverageSummary" class="wizard-summary"></div><div id="wizardSegmentList" class="wizard-segment-list"></div>';

    const recordPage = document.createElement('section');
    recordPage.className = 'wizard-page'; recordPage.dataset.page = 'record';
    recordPage.innerHTML = '<div class="wizard-page-title">הקלטת מקטע</div><div class="wizard-current-segment"><div class="kicker">עובדים עכשיו על</div><div class="name" data-segment-name></div></div><div id="wizardLiveHint" class="wizard-help"></div>';
    recordPage.appendChild(statusSection);
    recordPage.appendChild(recordSection);
    const nav = document.createElement('div'); nav.className = 'wizard-nav';
    const back = document.createElement('button'); back.type='button'; back.className='secondary'; back.textContent='→ חזרה לרשימת המקטעים'; back.onclick=()=>{ if(!isRecording()){ resetDraft(); setPage('list'); } };
    const upload = document.createElement('button'); upload.id='wizardUploadButton'; upload.type='button'; upload.className='primary wizard-upload'; upload.onclick=uploadCurrent;
    nav.append(back, upload); recordPage.appendChild(nav);

    wizard.append(listPage, recordPage);

    const maintenance = document.createElement('details'); maintenance.className='wizard-maintenance parent-section';
    const summary = document.createElement('summary'); summary.textContent='כלים מתקדמים ותחזוקה';
    const body = document.createElement('div'); body.className='wizard-maintenance-body';
    const dataTools = dataSection.querySelector('.route-data-tools');
    if (dataTools) {
      const loadBtn = dataTools.querySelector('button.secondary');
      if (loadBtn) loadBtn.textContent = '📂 טען קבצי הקלטה';
      body.appendChild(dataTools);
    }
    if (danger) body.appendChild(danger);
    maintenance.append(summary, body);

    const select = document.getElementById('segmentSelect');
    if (select) recorder.appendChild(select);
    if (photoInput) recorder.appendChild(photoInput);
    if (routeFilesInput) recorder.appendChild(routeFilesInput);
    document.getElementById('exportButton')?.remove();
    routeSection.remove();
    if (dataSection.isConnected) dataSection.remove();

    priority?.insertAdjacentElement('afterend', wizard) || header.insertAdjacentElement('afterend', wizard);
    wizard.insertAdjacentElement('afterend', maintenance);

    // Only the record button state changes the wizard flow. GPS updates recStatus,
    // recPoints and recTime continuously; observing those caused repeated full
    // list rebuilds on mobile and could starve the UI thread while recording.
    const recordButton = document.getElementById('recordButton');
    if (recordButton) {
      const observer = new MutationObserver(() => paint());
      observer.observe(recordButton, { childList:true, subtree:true, characterData:true });
      recordButton.addEventListener('click',()=>setTimeout(paint,80));
    }
    document.getElementById('landmarkButton')?.addEventListener('click',()=>setTimeout(paint,80));

    fetchCoverage();
    paint();
    return true;
  }

  function install() {
    if (build()) return;
    let tries = 0;
    const timer = setInterval(() => { tries++; if (build() || tries > 40) clearInterval(timer); }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
