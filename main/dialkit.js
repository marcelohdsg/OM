/* ─────────────────────────────────────────────────────────
 * DialKit — Live CSS Inspector & Editor
 *
 * Toggle: Ctrl+Shift+D (or Cmd+Shift+D on Mac)
 * Click any element to select it, then tweak its properties
 * in real time via the floating panel.
 * ───────────────────────────────────────────────────────── */

;(function() {
  'use strict';

  let active = false;
  let selectedEl = null;
  let panelEl = null;
  let highlightEl = null;
  let hoverHighlightEl = null;

  // ── Helpers ──────────────────────────────────────────────

  function px(v) { return parseFloat(v) || 0; }

  function getLabel(el) {
    if (el.tagName === 'NAV') return 'nav';
    if (el.tagName === 'SECTION') return 'section';
    const cls = Array.from(el.classList).find(c =>
      !c.startsWith('bg-') && !c.startsWith('text-') && !c.startsWith('flex') &&
      !c.startsWith('items-') && !c.startsWith('justify-') && !c.startsWith('p-') &&
      !c.startsWith('h-') && !c.startsWith('w-') && !c.startsWith('gap-') &&
      !c.startsWith('leading-') && !c.startsWith('whitespace') && !c.startsWith('inline') &&
      !c.startsWith('max-') && !c.startsWith('hidden') && !c.startsWith('hero-') &&
      !c.startsWith('font-') && !c.startsWith('border-') && !c.startsWith('relative') &&
      !c.startsWith('absolute') && !c.startsWith('overflow') && !c.startsWith('z-') &&
      !c.startsWith('object-') && !c.startsWith('fixed') && !c.startsWith('top-') &&
      !c.startsWith('left-') && !c.startsWith('right-') && !c.startsWith('inset-') &&
      !c.startsWith('pt-') && !c.startsWith('px-') && !c.startsWith('md:') &&
      !c.startsWith('xl:') && !c.startsWith('2xl:') && !c.startsWith('sm:') &&
      c.length > 1
    );
    const tag = el.tagName.toLowerCase();
    const text = el.textContent?.trim().slice(0, 20);
    if (cls) return `${tag}.${cls}`;
    if (tag === 'a' && text) return `a "${text}"`;
    if (tag === 'h1') return 'h1';
    if (tag === 'p' && text) return `p "${text.slice(0, 30)}…"`;
    if (tag === 'img') return `img[${el.alt || el.src.split('/').pop()}]`;
    if (tag === 'span') return `span "${text}"`;
    if (tag === 'div') return `div`;
    return tag;
  }

  // ── Highlight Overlays ───────────────────────────────────

  function createHighlight(color, dashed) {
    const h = document.createElement('div');
    h.style.cssText = `
      position: fixed; pointer-events: none; z-index: 99998;
      border: 2px ${dashed ? 'dashed' : 'solid'} ${color};
      background: ${color}11;
      transition: all 80ms ease;
    `;
    return h;
  }

  function positionHighlight(h, el) {
    if (!el) { h.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    h.style.display = 'block';
    h.style.top = r.top + 'px';
    h.style.left = r.left + 'px';
    h.style.width = r.width + 'px';
    h.style.height = r.height + 'px';
  }

  // ── Panel Construction ───────────────────────────────────

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'dialkit-panel';
    panel.innerHTML = `
      <div class="dk-header">
        <span class="dk-title">DialKit</span>
        <span class="dk-element-name">Click an element</span>
        <button class="dk-close" title="Close (Ctrl+Shift+D)">&times;</button>
      </div>
      <div class="dk-pinned"></div>
      <div class="dk-body"></div>
    `;
    document.body.appendChild(panel);

    // ── Pinned: Progress Bar dials ──
    if (window.__uspParams) {
      const pinned = panel.querySelector('.dk-pinned');
      const { group, content } = makeGroup('⏱ Progress Bar');

      content.appendChild(makeSlider(
        'cycle (s)', window.__uspParams.cycleDuration, 5, 180, 1, 's',
        v => { window.__uspParams.cycleDuration = v; }
      ));

      content.appendChild(makeSlider(
        'thickness', window.__uspParams.barHeight, 1, 12, 0.5, 'px',
        v => { window.__uspParams.barHeight = v; }
      ));

      pinned.appendChild(group);
    }

    // Make draggable
    let dragging = false, dx = 0, dy = 0;
    const header = panel.querySelector('.dk-header');
    header.addEventListener('mousedown', e => {
      if (e.target.classList.contains('dk-close')) return;
      dragging = true;
      dx = e.clientX - panel.offsetLeft;
      dy = e.clientY - panel.offsetTop;
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      panel.style.left = (e.clientX - dx) + 'px';
      panel.style.top = (e.clientY - dy) + 'px';
      panel.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => dragging = false);

    panel.querySelector('.dk-close').addEventListener('click', toggle);

    return panel;
  }

  // ── Control Builders ─────────────────────────────────────

  function makeSlider(label, value, min, max, step, unit, onChange) {
    const row = document.createElement('div');
    row.className = 'dk-row';
    row.innerHTML = `
      <label class="dk-label">${label}</label>
      <input type="range" class="dk-slider" min="${min}" max="${max}" step="${step}" value="${value}">
      <span class="dk-value">${Math.round(value * 100) / 100}${unit}</span>
    `;
    const slider = row.querySelector('.dk-slider');
    const display = row.querySelector('.dk-value');
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      display.textContent = Math.round(v * 100) / 100 + unit;
      onChange(v);
    });
    return row;
  }

  function makeColor(label, value, onChange) {
    const row = document.createElement('div');
    row.className = 'dk-row';
    row.innerHTML = `
      <label class="dk-label">${label}</label>
      <input type="color" class="dk-color" value="${rgbToHex(value)}">
      <span class="dk-value">${value}</span>
    `;
    const input = row.querySelector('.dk-color');
    const display = row.querySelector('.dk-value');
    input.addEventListener('input', () => {
      display.textContent = input.value;
      onChange(input.value);
    });
    return row;
  }

  function makeSelect(label, options, current, onChange) {
    const row = document.createElement('div');
    row.className = 'dk-row';
    row.innerHTML = `
      <label class="dk-label">${label}</label>
      <select class="dk-select">${options.map(o => `<option value="${o}" ${o === current ? 'selected' : ''}>${o}</option>`).join('')}</select>
    `;
    row.querySelector('.dk-select').addEventListener('change', e => onChange(e.target.value));
    return row;
  }

  function makeText(label, value, onChange) {
    const row = document.createElement('div');
    row.className = 'dk-row';
    row.innerHTML = `
      <label class="dk-label">${label}</label>
      <input type="text" class="dk-text" value="${value}">
    `;
    row.querySelector('.dk-text').addEventListener('input', e => onChange(e.target.value));
    return row;
  }

  function makeGroup(title) {
    const g = document.createElement('div');
    g.className = 'dk-group';
    const header = document.createElement('div');
    header.className = 'dk-group-header';
    header.innerHTML = `<span>${title}</span><span class="dk-chevron">▾</span>`;
    const content = document.createElement('div');
    content.className = 'dk-group-content';
    header.addEventListener('click', () => {
      content.classList.toggle('dk-collapsed');
      header.querySelector('.dk-chevron').textContent = content.classList.contains('dk-collapsed') ? '▸' : '▾';
    });
    g.appendChild(header);
    g.appendChild(content);
    return { group: g, content };
  }

  // ── RGB to Hex ───────────────────────────────────────────

  function rgbToHex(rgb) {
    if (rgb.startsWith('#')) return rgb.length > 7 ? rgb.slice(0, 7) : rgb;
    const match = rgb.match(/(\d+)/g);
    if (!match || match.length < 3) return '#000000';
    return '#' + match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  // ── Build Controls for Selected Element ──────────────────

  function buildControls(el) {
    const body = panelEl.querySelector('.dk-body');
    body.innerHTML = '';
    const cs = getComputedStyle(el);

    // ── SPACING ────────────────────────────
    const { group: spacingG, content: spacingC } = makeGroup('Spacing');
    ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach(prop => {
      spacingC.appendChild(makeSlider(
        prop.replace('padding', 'pad-').toLowerCase(),
        px(cs[prop]), 0, 120, 1, 'px',
        v => el.style[prop] = v + 'px'
      ));
    });
    ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'].forEach(prop => {
      spacingC.appendChild(makeSlider(
        prop.replace('margin', 'mar-').toLowerCase(),
        px(cs[prop]), -60, 120, 1, 'px',
        v => el.style[prop] = v + 'px'
      ));
    });
    spacingC.appendChild(makeSlider('gap', px(cs.gap), 0, 80, 1, 'px', v => el.style.gap = v + 'px'));
    body.appendChild(spacingG);

    // ── LAYOUT ─────────────────────────────
    const { group: layoutG, content: layoutC } = makeGroup('Layout');
    layoutC.appendChild(makeSelect('display',
      ['block', 'flex', 'inline-flex', 'grid', 'inline', 'none', 'hidden'],
      cs.display, v => el.style.display = v
    ));
    layoutC.appendChild(makeSelect('flex-direction',
      ['row', 'row-reverse', 'column', 'column-reverse'],
      cs.flexDirection, v => el.style.flexDirection = v
    ));
    layoutC.appendChild(makeSelect('align-items',
      ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
      cs.alignItems, v => el.style.alignItems = v
    ));
    layoutC.appendChild(makeSelect('justify-content',
      ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
      cs.justifyContent, v => el.style.justifyContent = v
    ));
    layoutC.appendChild(makeSelect('flex-wrap',
      ['nowrap', 'wrap', 'wrap-reverse'],
      cs.flexWrap, v => el.style.flexWrap = v
    ));
    body.appendChild(layoutG);

    // ── SIZE ───────────────────────────────
    const { group: sizeG, content: sizeC } = makeGroup('Size');
    sizeC.appendChild(makeSlider('width', px(cs.width), 0, 2000, 1, 'px', v => el.style.width = v + 'px'));
    sizeC.appendChild(makeSlider('height', px(cs.height), 0, 1200, 1, 'px', v => el.style.height = v + 'px'));
    sizeC.appendChild(makeText('max-width', cs.maxWidth, v => el.style.maxWidth = v));
    sizeC.appendChild(makeText('max-height', cs.maxHeight, v => el.style.maxHeight = v));
    body.appendChild(sizeG);

    // ── POSITION ──────────────────────────
    const { group: posG, content: posC } = makeGroup('Position');
    posC.appendChild(makeSelect('position',
      ['static', 'relative', 'absolute', 'fixed', 'sticky'],
      cs.position, v => el.style.position = v
    ));
    ['top', 'right', 'bottom', 'left'].forEach(prop => {
      posC.appendChild(makeSlider(prop, px(cs[prop]), -200, 400, 1, 'px', v => el.style[prop] = v + 'px'));
    });
    posC.appendChild(makeSlider('z-index', parseInt(cs.zIndex) || 0, -10, 200, 1, '', v => el.style.zIndex = v));
    body.appendChild(posG);

    // ── APPEARANCE ────────────────────────
    const { group: appG, content: appC } = makeGroup('Appearance');
    appC.appendChild(makeColor('background', cs.backgroundColor, v => el.style.backgroundColor = v));
    appC.appendChild(makeColor('color', cs.color, v => el.style.color = v));
    appC.appendChild(makeSlider('opacity', parseFloat(cs.opacity), 0, 1, 0.01, '', v => el.style.opacity = v));
    appC.appendChild(makeSlider('border-radius', px(cs.borderRadius), 0, 60, 1, 'px', v => el.style.borderRadius = v + 'px'));
    appC.appendChild(makeSlider('border-width', px(cs.borderWidth), 0, 10, 1, 'px', v => el.style.borderWidth = v + 'px'));
    appC.appendChild(makeColor('border-color', cs.borderColor, v => el.style.borderColor = v));
    appC.appendChild(makeSelect('overflow',
      ['visible', 'hidden', 'scroll', 'auto'],
      cs.overflow, v => el.style.overflow = v
    ));
    body.appendChild(appG);

    // ── TYPOGRAPHY ────────────────────────
    const { group: typoG, content: typoC } = makeGroup('Typography');
    typoC.appendChild(makeSlider('font-size', px(cs.fontSize), 8, 96, 1, 'px', v => el.style.fontSize = v + 'px'));
    typoC.appendChild(makeSelect('font-weight',
      ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
      cs.fontWeight, v => el.style.fontWeight = v
    ));
    typoC.appendChild(makeSlider('line-height', parseFloat(cs.lineHeight) / px(cs.fontSize) || 1.5, 0.8, 3, 0.05, '', v => el.style.lineHeight = v));
    typoC.appendChild(makeSlider('letter-spacing', px(cs.letterSpacing), -5, 10, 0.1, 'px', v => el.style.letterSpacing = v + 'px'));
    typoC.appendChild(makeSelect('text-align',
      ['left', 'center', 'right', 'justify'],
      cs.textAlign, v => el.style.textAlign = v
    ));
    body.appendChild(typoG);

    // ── ANIMATION ─────────────────────────
    const { group: animG, content: animC } = makeGroup('Animation');
    animC.appendChild(makeText('animation', cs.animation?.split(',')[0] || 'none', v => el.style.animation = v));
    animC.appendChild(makeText('transition', cs.transition?.split(',')[0] || 'none', v => el.style.transition = v));
    animC.appendChild(makeText('transform', el.style.transform || 'none', v => el.style.transform = v === 'none' ? '' : v));
    body.appendChild(animG);

    // ── ACTIONS ────────────────────────────
    const actions = document.createElement('div');
    actions.className = 'dk-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'dk-action-btn';
    copyBtn.textContent = 'Copy Inline Styles';
    copyBtn.addEventListener('click', () => {
      const styles = el.style.cssText;
      if (styles) {
        navigator.clipboard.writeText(styles);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy Inline Styles', 1500);
      }
    });
    actions.appendChild(copyBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'dk-action-btn dk-action-reset';
    resetBtn.textContent = 'Reset Inline Styles';
    resetBtn.addEventListener('click', () => {
      el.style.cssText = '';
      buildControls(el);
    });
    actions.appendChild(resetBtn);

    body.appendChild(actions);
  }

  // ── Event Handlers ───────────────────────────────────────

  function onHover(e) {
    if (!active) return;
    const t = e.target;
    if (panelEl?.contains(t)) return;
    positionHighlight(hoverHighlightEl, t);
  }

  function onClick(e) {
    if (!active) return;
    const t = e.target;
    if (panelEl?.contains(t)) return;
    e.preventDefault();
    e.stopPropagation();
    selectedEl = t;
    positionHighlight(highlightEl, t);
    panelEl.querySelector('.dk-element-name').textContent = getLabel(t);
    buildControls(t);
  }

  // ── Toggle Activation ────────────────────────────────────

  function toggle() {
    active = !active;
    if (active) {
      panelEl = createPanel();
      highlightEl = createHighlight('#4a8eff', false);
      hoverHighlightEl = createHighlight('#80c4f4', true);
      document.body.appendChild(highlightEl);
      document.body.appendChild(hoverHighlightEl);
      document.addEventListener('mouseover', onHover, true);
      document.addEventListener('click', onClick, true);
      document.body.style.cursor = 'crosshair';
    } else {
      document.removeEventListener('mouseover', onHover, true);
      document.removeEventListener('click', onClick, true);
      document.body.style.cursor = '';
      panelEl?.remove();
      highlightEl?.remove();
      hoverHighlightEl?.remove();
      panelEl = null;
      highlightEl = null;
      hoverHighlightEl = null;
      selectedEl = null;
    }
  }

  // ── Keyboard Shortcut: Ctrl/Cmd + Shift + D ──────────────

  document.addEventListener('keydown', e => {
    if (e.key === 'D' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggle();
    }
  });

  // ── Update highlight position on scroll/resize ───────────

  let raf;
  function syncHighlights() {
    if (selectedEl) positionHighlight(highlightEl, selectedEl);
    if (active) raf = requestAnimationFrame(syncHighlights);
  }
  const origToggle = toggle;

  // ── Inject Styles ────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    #dialkit-panel {
      position: fixed;
      top: 16px;
      right: 16px;
      width: 300px;
      max-height: calc(100vh - 32px);
      background: #1a1e2d;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      z-index: 99999;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 11px;
      color: #e0e0e0;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
    }
    .dk-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #252937;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      cursor: move;
    }
    .dk-title {
      font-weight: 700;
      font-size: 12px;
      color: #80c4f4;
      flex-shrink: 0;
    }
    .dk-element-name {
      flex: 1;
      text-align: right;
      color: #979797;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 10px;
    }
    .dk-close {
      background: none;
      border: none;
      color: #979797;
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
    }
    .dk-close:hover { color: #fff; }
    .dk-pinned {
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .dk-pinned:empty { display: none; }
    .dk-body {
      overflow-y: auto;
      flex: 1;
      padding: 4px 0;
    }
    .dk-body::-webkit-scrollbar { width: 4px; }
    .dk-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
    .dk-group { border-bottom: 1px solid rgba(255,255,255,0.06); }
    .dk-group:last-child { border-bottom: none; }
    .dk-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      font-weight: 600;
      font-size: 11px;
      color: #80c4f4;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .dk-group-header:hover { background: rgba(255,255,255,0.03); }
    .dk-chevron { font-size: 10px; color: #979797; }
    .dk-group-content { padding: 0 12px 8px; }
    .dk-group-content.dk-collapsed { display: none; }
    .dk-row {
      display: grid;
      grid-template-columns: 80px 1fr 50px;
      align-items: center;
      gap: 6px;
      padding: 3px 0;
    }
    .dk-label {
      color: #979797;
      font-size: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dk-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 4px;
      background: rgba(255,255,255,0.12);
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }
    .dk-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #4a8eff;
      cursor: pointer;
      border: 2px solid #1a1e2d;
    }
    .dk-slider::-webkit-slider-thumb:hover {
      background: #80c4f4;
    }
    .dk-value {
      color: #ccc;
      font-size: 10px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .dk-color {
      width: 100%;
      height: 22px;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      padding: 0;
    }
    .dk-color::-webkit-color-swatch-wrapper { padding: 1px; }
    .dk-color::-webkit-color-swatch { border: none; border-radius: 3px; }
    .dk-select, .dk-text {
      width: 100%;
      height: 22px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 4px;
      color: #e0e0e0;
      font-size: 10px;
      font-family: inherit;
      padding: 0 4px;
      outline: none;
    }
    .dk-select:focus, .dk-text:focus {
      border-color: #4a8eff;
    }
    .dk-actions {
      display: flex;
      gap: 6px;
      padding: 8px 12px 12px;
    }
    .dk-action-btn {
      flex: 1;
      height: 28px;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px;
      background: rgba(255,255,255,0.06);
      color: #e0e0e0;
      font-size: 10px;
      font-family: inherit;
      cursor: pointer;
      transition: background 120ms ease;
    }
    .dk-action-btn:hover { background: rgba(255,255,255,0.12); }
    .dk-action-reset { border-color: rgba(255,100,100,0.3); color: #ff9999; }
    .dk-action-reset:hover { background: rgba(255,100,100,0.12); }
  `;
  document.head.appendChild(style);

  // ── Scroll sync ──────────────────────────────────────────
  const origActivate = toggle;
  const _origToggle = toggle;
  window.addEventListener('scroll', () => {
    if (!active) return;
    if (selectedEl) positionHighlight(highlightEl, selectedEl);
  }, true);

  // ── Auto-start hint ──────────────────────────────────────
  console.log('%c[DialKit] %cPress Ctrl+Shift+D to toggle inspector', 'color:#80c4f4;font-weight:bold', 'color:#979797');

})();
