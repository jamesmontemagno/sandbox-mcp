// Everything here is an enhancement: without JS the page shows the full transcript and the first tab of each set.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function setupTabs(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const select = (tab, focus) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    }
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.tabIndex = i === 0 ? 0 : -1;
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length], true);
    });
  });
}

function setupCopy(button) {
  const label = button.textContent;
  button.addEventListener('click', async () => {
    const text = button.parentElement.querySelector('code').textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Press Ctrl+C';
      getSelection().selectAllChildren(button.parentElement.querySelector('code'));
    }
    setTimeout(() => { button.textContent = label; }, 1800);
  });
}

// Replays the measured runs at a compressed pace. The gaps are for reading, not measured timings.
function setupReplay(stage) {
  const lines = [...stage.querySelectorAll('.l')];
  const replay = stage.querySelector('#replay');
  let timers = [];

  const play = () => {
    timers.forEach(clearTimeout);
    timers = [];
    stage.classList.add('js-playing');
    lines.forEach((l) => l.classList.remove('on'));
    replay.hidden = true;
    let t = 300;
    lines.forEach((line) => {
      const isCommand = line.classList.contains('cmd');
      const isResult = line.classList.contains('pass') || line.classList.contains('bad');
      t += isResult ? 1500 : isCommand ? 700 : 240;
      timers.push(setTimeout(() => line.classList.add('on'), t));
    });
    timers.push(setTimeout(() => { replay.hidden = false; }, t + 200));
  };

  replay.addEventListener('click', play);
  new IntersectionObserver((entries, observer) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    observer.disconnect();
    play();
  }, { threshold: 0.25 }).observe(stage);
}

document.querySelectorAll('[data-tabs]').forEach(setupTabs);
document.querySelectorAll('.copy').forEach(setupCopy);
if (!reduceMotion) setupReplay(document.getElementById('stage'));
