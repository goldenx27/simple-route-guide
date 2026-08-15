(() => {
  let currentStep = 1;

  function addStyles() {
    if (document.getElementById('parentWizardStyles')) return;
    const style = document.createElement('style');
    style.id = 'parentWizardStyles';
    style.textContent = `
      #recorder .parent-wizard{display:grid;gap:12px}
      #recorder .wizard-progress{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
      #recorder .wizard-step-chip{border:0;border-radius:14px;padding:9px 5px;background:#eef3f7;color:#52606d;font-size:.76rem;font-weight:800;line-height:1.2}
      #recorder .wizard-step-chip.active{background:#17202a;color:#fff}
      #recorder .wizard-step-chip.done{background:#e8f5ec;color:#176b36}
      #recorder .wizard-page{display:none;background:#f7f8fa;border-radius:20px;padding:14px;gap:12px}
      #recorder .wizard-page.active{display:grid}
      #recorder .wizard-page-title{font-size:1.05rem;font-weight:900;color:#17202a}
      #recorder .wizard-help{font-size:.84rem;line-height:1.45;color:#52606d;background:#fff;border-radius:14px;padding:10px 12px}
      #recorder .wizard-nav{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px}
      #recorder .wizard-nav.single{grid-template-columns:1fr}
      #recorder .wizard-nav button{margin:0;min-height:52px}
      #recorder .wizard-page .parent-section{background:transparent!important;padding:0!important;border-radius:0!important}
      #recorder .wizard-page .parent-section-title{display:none!important}
      #recorder .wizard-page .rec-log{max-height:330px}
      #recorder .wizard-maintenance{margin-top:2px}
      #recorder .wizard-maintenance summary{cursor:pointer;font-weight:900;color:#52606d;padding:12px 4px;list-style:none}
      #recorder .wizard-maintenance summary::-webkit-details-marker{display:none}
      #recorder .wizard-maintenance summary::before{content:'▾ ';}
      #recorder .wizard-maintenance[open] summary::before{content:'▴ ';}
      #recorder .wizard-maintenance-body{display:grid;gap:10px;padding-top:4px}
      #recorder .wizard-finish-note{text-align:center;font-size:.84rem;color:#52606d;padding:8px}
      #recorder #segmentSelect{display:block!important;width:100%!important;min-height:52px!important;font-size:1rem!important;background:#fff!important}
      @media(max-width:380px){#recorder .wizard-step-chip{font-size:.7rem;padding:8px 3px}#recorder .wizard-nav{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function button(label, className, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  function setStep(step) {
    currentStep = Math.max(1, Math.min(3, step));
    document.querySelectorAll('#recorder .wizard-page').forEach((p, i) => p.classList.toggle('active', i + 1 === currentStep));
    document.querySelectorAll('#recorder .wizard-step-chip').forEach((c, i) => {
      c.classList.toggle('active', i + 1 === currentStep);
      c.classList.toggle('done', i + 1 < currentStep);
    });
    document.getElementById('recorder')?.scrollTo({ top: 0, behavior: 'smooth' });
    refreshState();
  }

  function refreshState() {
    const record = document.getElementById('recordButton');
    const exportBtn = document.getElementById('exportButton');
    const step2Next = document.getElementById('wizardStep2Next');
    const recording = !!record && /סיים/.test(record.textContent || '');
    const hasFinishedRecording = !!exportBtn && !exportBtn.disabled;

    if (step2Next) {
      step2Next.disabled = !hasFinishedRecording;
      const wanted = recording
        ? 'קודם מסיימים את ההקלטה'
        : hasFinishedRecording
          ? 'המשך לבדיקה ושמירה ←'
          : 'התחל וסיים הקלטה כדי להמשיך';
      if (step2Next.textContent !== wanted) step2Next.textContent = wanted;
    }

    const liveHint = document.getElementById('wizardLiveHint');
    if (liveHint) {
      const wanted = recording
        ? '🟢 ההקלטה פעילה. הולכים במסלול, ובכל מקום חשוב לוחצים “סמן נקודה”. אחרי הסימון אפשר לצרף תמונה.'
        : hasFinishedRecording
          ? '✅ ההקלטה הסתיימה. אפשר לעבור לשלב הבא, לבדוק ולשמור.'
          : 'לחץ “התחל הקלטה”, המתן ל-GPS, ואז צא לדרך.';
      if (liveHint.textContent !== wanted) liveHint.textContent = wanted;
    }
  }

  function build() {
    const recorder = document.getElementById('recorder');
    const header = recorder?.querySelector('.parent-header');
    if (!recorder || !header || recorder.dataset.wizard === '1') return false;

    const priority = recorder.querySelector('.parent-priority-status');
    const routeSection = [...recorder.querySelectorAll('.parent-section')].find(s => s.querySelector('#segmentSelect'));
    const statusSection = [...recorder.querySelectorAll('.parent-section')].find(s => s.querySelector('.rec-panel'));
    const recordSection = [...recorder.querySelectorAll('.parent-section')].find(s => s.querySelector('#recLog'));
    const dataSection = [...recorder.querySelectorAll('.parent-section')].find(s => s.querySelector('.route-data-tools') || s.querySelector('#exportButton'));
    const danger = recorder.querySelector('.parent-danger-zone');
    const photoInput = document.getElementById('photoInput');
    const routeFilesInput = document.getElementById('routeFilesInput');

    if (!routeSection || !statusSection || !recordSection || !dataSection) return false;
    recorder.dataset.wizard = '1';
    addStyles();

    const wizard = document.createElement('div');
    wizard.className = 'parent-wizard';

    const progress = document.createElement('div');
    progress.className = 'wizard-progress';
    ['1. בוחרים מקטע', '2. מקליטים ומצלמים', '3. בודקים ושומרים'].forEach((text, i) => {
      const c = button(text, 'wizard-step-chip', () => {
        if (i + 1 < currentStep) setStep(i + 1);
      });
      progress.appendChild(c);
    });
    wizard.appendChild(progress);

    const p1 = document.createElement('section');
    p1.className = 'wizard-page active';
    p1.innerHTML = '<div class="wizard-page-title">שלב 1 — איזה חלק של הדרך מקליטים?</div><div class="wizard-help">בחר מקטע אחד בלבד. כל הקלטה שייכת לקטע מסוים בין הבית, התחנות ובית הספר.</div>';
    p1.appendChild(routeSection);
    const nav1 = document.createElement('div'); nav1.className = 'wizard-nav single';
    nav1.appendChild(button('המשך להקלטה ←', 'primary', () => setStep(2)));
    p1.appendChild(nav1);

    const p2 = document.createElement('section');
    p2.className = 'wizard-page';
    p2.innerHTML = '<div class="wizard-page-title">שלב 2 — מקליטים את הדרך</div><div id="wizardLiveHint" class="wizard-help">לחץ “התחל הקלטה”, המתן ל-GPS, ואז צא לדרך.</div>';
    p2.appendChild(statusSection);
    p2.appendChild(recordSection);
    const nav2 = document.createElement('div'); nav2.className = 'wizard-nav';
    nav2.appendChild(button('→ חזרה לבחירת מקטע', 'secondary', () => setStep(1)));
    const next2 = button('התחל וסיים הקלטה כדי להמשיך', 'primary', () => setStep(3));
    next2.id = 'wizardStep2Next'; next2.disabled = true; nav2.appendChild(next2); p2.appendChild(nav2);

    const p3 = document.createElement('section');
    p3.className = 'wizard-page';
    p3.innerHTML = '<div class="wizard-page-title">שלב 3 — בדיקה ושמירה</div><div class="wizard-help">בדוק את הנקודות והתמונות שצירפת. שמירת קובץ ההקלטה יוצרת גיבוי JSON שאפשר לטעון מחדש בעת הצורך.</div>';
    const exportBtn = document.getElementById('exportButton');
    if (exportBtn) p3.appendChild(exportBtn);
    const finishNote = document.createElement('div'); finishNote.className = 'wizard-finish-note'; finishNote.textContent = 'לאחר השמירה אפשר לחזור למסך הראשי או להקליט מקטע נוסף.'; p3.appendChild(finishNote);
    const nav3 = document.createElement('div'); nav3.className = 'wizard-nav';
    nav3.appendChild(button('→ חזרה להקלטה', 'secondary', () => setStep(2)));
    nav3.appendChild(button('✅ סיימתי — חזרה לראשי', 'primary', () => window.closeRecorder?.()));
    p3.appendChild(nav3);

    wizard.append(p1, p2, p3);

    const maintenance = document.createElement('details');
    maintenance.className = 'wizard-maintenance parent-section';
    const summary = document.createElement('summary'); summary.textContent = 'כלים מתקדמים ותחזוקה';
    const maintenanceBody = document.createElement('div'); maintenanceBody.className = 'wizard-maintenance-body';
    const dataTools = dataSection.querySelector('.route-data-tools');
    if (dataTools) maintenanceBody.appendChild(dataTools);
    if (danger) maintenanceBody.appendChild(danger);
    maintenance.append(summary, maintenanceBody);

    if (photoInput) recorder.appendChild(photoInput);
    if (routeFilesInput) recorder.appendChild(routeFilesInput);

    if (dataSection.isConnected && !dataSection.contains(exportBtn) && !dataSection.querySelector('.route-data-tools')) dataSection.remove();

    priority?.insertAdjacentElement('afterend', wizard) || header.insertAdjacentElement('afterend', wizard);
    wizard.insertAdjacentElement('afterend', maintenance);

    // Watch only content changes. Watching attributes here caused a feedback loop:
    // refreshState() changed attributes which immediately retriggered the observer.
    const observer = new MutationObserver(() => refreshState());
    ['recordButton','recStatus','recPoints','recTime'].forEach(id => {
      const node = document.getElementById(id);
      if (node) observer.observe(node, { childList:true, subtree:true, characterData:true });
    });

    document.getElementById('recordButton')?.addEventListener('click', () => setTimeout(refreshState, 50));
    document.getElementById('landmarkButton')?.addEventListener('click', () => setTimeout(refreshState, 50));
    refreshState();
    return true;
  }

  function install() {
    if (build()) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (build() || tries > 40) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
