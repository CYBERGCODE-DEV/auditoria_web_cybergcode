import { launchAuditBrowser, installSafeRequestGuard } from './browser.js';
import { RULES } from '../config/rules.js';
import { createFinding } from '../audit/finding.js';
import { assertPublicUrl, resolvePublicUrl } from '../security/url-guard.js';
import axeCore from 'axe-core';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function compactScreenshot(base64, viewport) {
  return base64 ? { mime: 'image/jpeg', base64, viewport } : null;
}

const axeSeverity = (impact) => ({ critical: 'critical', serious: 'high', moderate: 'medium', minor: 'low' }[impact] || 'low');
const axePenalty = (impact) => ({ critical: 18, serious: 8, moderate: 3, minor: 1 }[impact] || 1);


const TRACKER_SIGNATURES = [
  ['google-analytics.com', 'Google Analytics'], ['googletagmanager.com', 'Google Tag Manager'], ['doubleclick.net', 'Google Ads / DoubleClick'],
  ['connect.facebook.net', 'Meta Pixel SDK'], ['facebook.com', 'Meta/Facebook'], ['hotjar.com', 'Hotjar'], ['clarity.ms', 'Microsoft Clarity'],
  ['analytics.tiktok.com', 'TikTok'], ['snap.licdn.com', 'LinkedIn Insight'], ['segment.com', 'Segment'], ['mixpanel.com', 'Mixpanel'], ['amplitude.com', 'Amplitude']
];

function summarizeNetwork(target, requestUrls, cookies = []) {
  const firstHost = new URL(target).hostname.replace(/^www\./, '');
  const hosts = new Map();
  const trackers = new Map();
  for (const raw of requestUrls) {
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase();
      hosts.set(host, (hosts.get(host) || 0) + 1);
      for (const [signature, vendor] of TRACKER_SIGNATURES) {
        if (host === signature || host.endsWith(`.${signature}`)) trackers.set(vendor, (trackers.get(vendor) || 0) + 1);
      }
    } catch { /* ignored */ }
  }
  const thirdParty = [...hosts.entries()].filter(([host]) => !(host === firstHost || host.endsWith(`.${firstHost}`))).sort((a,b) => b[1]-a[1]);
  const safeCookies = cookies.slice(0, 80).map((c) => ({ name:c.name, domain:c.domain, path:c.path, secure:Boolean(c.secure), httpOnly:Boolean(c.httpOnly), sameSite:c.sameSite || null, session:Boolean(c.session), expires:c.expires || null }));
  return {
    requestCount: requestUrls.length,
    uniqueHosts: hosts.size,
    thirdPartyHosts: thirdParty.length,
    thirdPartyTop: thirdParty.slice(0, 20).map(([host,count]) => ({ host, count })),
    trackers: [...trackers.entries()].map(([vendor,count]) => ({ vendor, count })),
    cookies: safeCookies,
    cookieCount: cookies.length
  };
}

function buildNetworkFindings(target, network) {
  const findings = [];
  const sensitiveName = /(session|sess|auth|token|jwt|sid|login|account)/i;
  for (const cookie of network.cookies || []) {
    if (!sensitiveName.test(cookie.name)) continue;
    if (target.startsWith('https://') && !cookie.secure) findings.push(createFinding({
      rule: RULES.infrastructure.insecureSessionCookie, category:'security', title:'Cookie sensible sin atributo Secure', url:target,
      selector:`cookie:${cookie.name}`, evidence:`${cookie.name} (${cookie.domain}) tiene Secure=false.`, impact:'Una cookie sensible sin Secure puede exponerse si llega a existir un flujo HTTP o una configuración incorrecta.', source:'Chromium cookie jar'
    }));
    if (!cookie.httpOnly) findings.push(createFinding({
      rule: RULES.infrastructure.missingHttpOnly, category:'security', title:'Cookie sensible accesible desde JavaScript', url:target,
      selector:`cookie:${cookie.name}`, evidence:`${cookie.name} (${cookie.domain}) tiene HttpOnly=false.`, impact:'Una cookie de sesión accesible desde JavaScript aumenta el impacto potencial de un XSS.', source:'Chromium cookie jar'
    }));
    if (!cookie.sameSite) findings.push(createFinding({
      rule: RULES.infrastructure.missingSameSite, category:'security', title:'Cookie sensible sin SameSite explícito', url:target,
      selector:`cookie:${cookie.name}`, evidence:`${cookie.name} (${cookie.domain}) no declara SameSite de forma observable.`, impact:'Una política SameSite explícita ayuda a controlar el envío cross-site según el flujo de autenticación.', source:'Chromium cookie jar', type:'advisory', confidence:0.9
    }));
  }
  if ((network.trackers || []).length) findings.push(createFinding({
    rule: RULES.infrastructure.thirdPartyTracking, category:'compliance', title:'Trackers o plataformas de medición cargados en la visita inicial', url:target,
    evidence:`Detectados: ${network.trackers.map((x)=>`${x.vendor} (${x.count})`).join(', ')}.`, expected:'Inventariar terceros y activar tecnologías no necesarias conforme a la política de privacidad/consentimiento aplicable.', impact:'Los terceros pueden implicar tratamiento de identificadores, analítica o marketing y requieren revisión de privacidad y configuración.', source:'Chromium network requests', type:'advisory', confidence:0.92
  }));
  return findings;
}

async function runAxeAudit(page, target) {
  try {
    await page.evaluate(axeCore.source);
    const result = await page.evaluate(async () => {
      const options = {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
        resultTypes: ['violations', 'incomplete', 'passes', 'inapplicable']
      };
      const report = await window.axe.run(document, options);
      const compact = (item) => ({
        id: item.id,
        impact: item.impact,
        tags: item.tags,
        description: item.description,
        help: item.help,
        helpUrl: item.helpUrl,
        nodes: item.nodes.slice(0, 8).map((node) => ({
          impact: node.impact,
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary
        })),
        nodeCount: item.nodes.length
      });
      return {
        violations: report.violations.map(compact),
        incomplete: report.incomplete.map(compact),
        passes: report.passes.length,
        inapplicable: report.inapplicable.length,
        testEngine: report.testEngine
      };
    });

    const findings = result.violations.map((violation) => {
      const sample = violation.nodes?.[0];
      const selector = Array.isArray(sample?.target) ? sample.target.join(' ') : null;
      const failure = clean(sample?.failureSummary || violation.description || violation.help);
      return createFinding({
        rule: {
          id: `A11Y-AXE-${String(violation.id).toUpperCase()}`,
          severity: axeSeverity(violation.impact),
          penalty: axePenalty(violation.impact),
          type: 'objective'
        },
        category: 'accessibility',
        title: violation.help || `Problema de accesibilidad: ${violation.id}`,
        url: target,
        selector,
        evidence: `${violation.nodeCount} nodo(s) afectado(s). ${failure}`,
        expected: `Cumplir las reglas automatizables asociadas a: ${(violation.tags || []).filter((tag) => tag.startsWith('wcag')).join(', ') || 'accesibilidad web'}.`,
        impact: violation.description || `axe-core clasificó este hallazgo como ${violation.impact || 'sin impacto declarado'}.`,
        recommendation: violation.help || 'Corregir la condición reportada por axe-core.',
        solution: failure || violation.help || 'Modificar el elemento afectado para que cumpla el criterio automático reportado.',
        remediationSteps: [
          'Abrir el selector o elemento reportado.',
          clean(sample?.failureSummary || 'Aplicar la corrección indicada por la regla de axe-core.'),
          'Comprobar el componente con teclado y tecnología de asistencia cuando corresponda.',
          'Ejecutar nuevamente la auditoría automática.'
        ],
        acceptanceCriteria: `La regla ${violation.id} debe devolver 0 nodos en estado violation para esta URL; los casos que requieran juicio humano deben revisarse manualmente.`,
        codeExample: sample?.html || null,
        effort: violation.nodeCount > 10 ? 'Media/Alta' : 'Baja/Media',
        source: `axe-core ${result.testEngine?.version || '4.13.0'} · ${violation.helpUrl || 'WCAG automated checks'}`,
        confidence: 0.98
      });
    });

    return {
      status: 'measured',
      data: {
        violations: result.violations.length,
        violationNodes: result.violations.reduce((sum, item) => sum + item.nodeCount, 0),
        incomplete: result.incomplete.length,
        passes: result.passes,
        inapplicable: result.inapplicable,
        engineVersion: result.testEngine?.version || null,
        samples: result.violations.slice(0, 12)
      },
      findings
    };
  } catch (error) {
    return { status: 'unavailable', data: null, findings: [], error: clean(error?.message || error) };
  }
}

function buildBrowserFindings(target, rendered) {
  const findings = [];
  if (rendered.contrast?.failed > 0) {
    const sample = rendered.contrast.samples?.[0];
    findings.push(createFinding({
      rule: RULES.accessibility.contrast,
      category: 'accessibility',
      title: 'Contraste de texto insuficiente detectado',
      url: target,
      selector: sample?.selector || null,
      evidence: `${rendered.contrast.failed} combinación(es) por debajo del umbral evaluado.${sample ? ` Ejemplo: ${sample.ratio}:1` : ''}`,
      expected: 'WCAG AA: 4.5:1 texto normal o 3:1 texto grande.',
      impact: 'El contenido puede resultar difícil de leer para personas con baja visión o en determinadas condiciones de visualización.',
      recommendation: 'Ajustar color de texto o fondo hasta alcanzar el contraste mínimo aplicable.',
      source: 'Rendered DOM / computed styles'
    }));
  }

  if (rendered.responsive?.horizontalOverflow) {
    findings.push(createFinding({
      rule: RULES.accessibility.horizontalOverflow,
      category: 'accessibility',
      title: 'Desbordamiento horizontal en viewport móvil',
      url: target,
      selector: rendered.responsive.overflowSelectors?.[0] || 'html',
      evidence: `scrollWidth ${rendered.responsive.scrollWidth}px > viewport ${rendered.responsive.viewportWidth}px.`,
      impact: 'Puede obligar a desplazamiento horizontal y ocultar contenido o controles en móvil.',
      recommendation: 'Revisar anchos fijos, posicionamiento, tablas, imágenes y elementos que exceden el viewport.',
      source: 'Rendered DOM / mobile viewport'
    }));
  }

  if (rendered.responsive?.smallTargets > 0) {
    findings.push(createFinding({
      rule: RULES.accessibility.targetSize,
      category: 'accessibility',
      title: 'Objetivos táctiles pequeños',
      url: target,
      selector: rendered.responsive.smallTargetSamples?.[0]?.selector || null,
      evidence: `${rendered.responsive.smallTargets} control(es) visibles por debajo de 24×24 CSS px.`,
      impact: 'Controles pequeños pueden ser difíciles de activar con precisión en dispositivos táctiles.',
      recommendation: 'Aumentar el área interactiva o el espaciado para alcanzar al menos 24×24 CSS px cuando aplique.',
      source: 'Rendered DOM / mobile viewport',
      type: 'advisory',
      confidence: 0.95
    }));
  }

  if (rendered.console?.pageErrors > 0) {
    findings.push(createFinding({
      rule: RULES.technical.runtimeErrors,
      category: 'technical',
      title: 'Errores JavaScript durante el renderizado',
      url: target,
      evidence: `${rendered.console.pageErrors} error(es) de ejecución. ${rendered.console.samples?.[0] || ''}`,
      impact: 'Los errores en cliente pueden romper componentes, interacciones o contenido generado con JavaScript.',
      recommendation: 'Revisar la consola del navegador y corregir las excepciones reproducibles.',
      source: 'Chromium pageerror'
    }));
  }
  return findings;
}

async function inspectViewport(page, viewport) {
  await page.setViewport(viewport);
  await new Promise((resolve) => setTimeout(resolve, 350));
  return page.evaluate(() => {
    const visible = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
    };
    const selectorFor = (el) => {
      if (!el) return null;
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts = [];
      let current = el;
      while (current && current.nodeType === 1 && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        if (current.classList?.length) part += `.${[...current.classList].slice(0,2).map((c) => CSS.escape(c)).join('.')}`;
        parts.unshift(part);
        current = current.parentElement;
      }
      return parts.join(' > ');
    };
    const parseColor = (value) => {
      const m = String(value).match(/rgba?\((\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s/]+([\d.]+))?\)/i);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] == null ? 1 : Number(m[4])] : null;
    };
    const luminance = ([r,g,b]) => {
      const c = [r,g,b].map((v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
    };
    const ratio = (a,b) => {
      const l1 = luminance(a), l2 = luminance(b);
      return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
    };
    const backgroundFor = (el) => {
      let current = el;
      while (current) {
        const c = parseColor(getComputedStyle(current).backgroundColor);
        if (c && c[3] >= 0.95) return c;
        current = current.parentElement;
      }
      return [255,255,255,1];
    };

    const palette = new Map();
    const fonts = new Map();
    const contrastSamples = [];
    let contrastChecked = 0;
    let contrastFailed = 0;
    const elements = [...document.querySelectorAll('body *')].filter(visible).slice(0, 1800);

    for (const el of elements) {
      const style = getComputedStyle(el);
      for (const value of [style.color, style.backgroundColor, style.borderTopColor]) {
        const c = parseColor(value);
        if (!c || c[3] < 0.05) continue;
        const key = `#${c.slice(0,3).map((x) => Math.round(x).toString(16).padStart(2,'0')).join('').toUpperCase()}`;
        palette.set(key, (palette.get(key) || 0) + 1);
      }
      const family = style.fontFamily?.split(',')[0]?.replace(/["']/g,'').trim();
      if (family) fonts.set(family, (fonts.get(family) || 0) + 1);

      const ownText = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(' ').trim();
      if (!ownText || contrastChecked >= 500) continue;
      const fg = parseColor(style.color);
      const bg = backgroundFor(el);
      if (!fg || fg[3] < 0.95 || !bg) continue;
      const fontSize = parseFloat(style.fontSize) || 16;
      const weight = Number(style.fontWeight) || 400;
      const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
      const threshold = large ? 3 : 4.5;
      const value = ratio(fg, bg);
      contrastChecked++;
      if (value + 0.01 < threshold) {
        contrastFailed++;
        if (contrastSamples.length < 8) contrastSamples.push({ selector: selectorFor(el), ratio: Number(value.toFixed(2)), threshold, text: ownText.slice(0, 90) });
      }
    }

    const interactive = [...document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[tabindex]:not([tabindex="-1"])')].filter(visible);
    const small = interactive.map((el) => ({ el, rect: el.getBoundingClientRect() })).filter(({rect}) => rect.width < 24 || rect.height < 24);
    const overflow = elements.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.right > innerWidth + 2 || r.left < -2;
    }).slice(0, 8).map(selectorFor);

    const top = (map, limit=8) => [...map.entries()].sort((a,b) => b[1]-a[1]).slice(0,limit).map(([value,count]) => ({ value, count }));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      colors: top(palette, 12),
      fonts: top(fonts, 8),
      contrast: { checked: contrastChecked, failed: contrastFailed, samples: contrastSamples },
      responsive: {
        viewportWidth: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
        overflowSelectors: overflow,
        interactive: interactive.length,
        smallTargets: small.length,
        smallTargetSamples: small.slice(0,8).map(({el,rect}) => ({ selector: selectorFor(el), width: Math.round(rect.width), height: Math.round(rect.height) }))
      }
    };
  });
}

export async function runBrowserAudit(target, { devices = { mobile: true, desktop: true }, accessibility = true, visual = true } = {}) {
  const resolvedTarget = await resolvePublicUrl(target);
  let browser;
  try {
    browser = await launchAuditBrowser({ hostMapping:{ hostname:resolvedTarget.url.hostname, address:(resolvedTarget.records.find((record) => record.family === 4) || resolvedTarget.records[0]).address } });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 CYBERGCODE-Audit/0.16.1');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-PE,es;q=0.9,en;q=0.7' });
    await page.emulateTimezone('America/Lima').catch(() => {});
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]).catch(() => {});
    await page.setCacheEnabled(false);
    await page.evaluateOnNewDocument(() => {
      window.__cgPerf = { lcp: null, cls: 0, longTasks: [], errors: [] };
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (!last) return;
          const el = last.element;
          window.__cgPerf.lcp = {
            startTime: Number(last.startTime) || null,
            renderTime: Number(last.renderTime) || null,
            loadTime: Number(last.loadTime) || null,
            size: Number(last.size) || null,
            tag: el?.tagName || null,
            id: el?.id || null,
            className: typeof el?.className === 'string' ? el.className.slice(0, 180) : null,
            url: last.url || (el?.currentSrc || el?.src || null)
          };
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (error) { window.__cgPerf.errors.push(`lcp:${error.message}`); }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cgPerf.cls += Number(entry.value) || 0;
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (error) { window.__cgPerf.errors.push(`cls:${error.message}`); }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__cgPerf.longTasks.push({ startTime: Number(entry.startTime) || 0, duration: Number(entry.duration) || 0 });
          if (window.__cgPerf.longTasks.length > 100) window.__cgPerf.longTasks = window.__cgPerf.longTasks.slice(-100);
        }).observe({ type: 'longtask', buffered: true });
      } catch (error) { window.__cgPerf.errors.push(`longtask:${error.message}`); }
    });
    const requestUrls = [];
    page.on('request', (request) => { if (requestUrls.length < 4000) requestUrls.push(request.url()); });
    await installSafeRequestGuard(page);
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(15000);

    const consoleSamples = [];
    let pageErrors = 0;
    page.on('pageerror', (error) => {
      pageErrors += 1;
      if (consoleSamples.length < 6) consoleSamples.push(clean(error?.message).slice(0, 180));
    });

    const started = Date.now();
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 500));
    const finalUrl = page.url();
    await assertPublicUrl(finalUrl);

    const rendered = await page.evaluate(() => {
      const text = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim() || '';
      const canonical = document.querySelector('link[rel="canonical"]')?.href || null;
      const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((el) => ({ level: Number(el.tagName.slice(1)), tag: el.tagName.toLowerCase(), text: (el.textContent || '').replace(/\s+/g,' ').trim() }));
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const bytes = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
      const encodedBytes = resources.reduce((sum, r) => sum + (r.encodedBodySize || 0), 0);
      const decodedBytes = resources.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0);
      const byType = {};
      for (const r of resources) byType[r.initiatorType || 'other'] = (byType[r.initiatorType || 'other'] || 0) + 1;
      const codeResources = resources.map((r) => ({
        url:r.name,
        initiatorType:r.initiatorType || 'other',
        transferBytes:Math.round(r.transferSize || 0),
        encodedBodyBytes:Math.round(r.encodedBodySize || 0),
        decodedBodyBytes:Math.round(r.decodedBodySize || 0)
      })).filter((r) => /\.(?:m?js|css|json|wasm)(?:[?#]|$)/i.test(r.url) || ['script','link','css','fetch','xmlhttprequest'].includes(r.initiatorType)).slice(0, 500);
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0] || null;
      const observed = window.__cgPerf || {};
      const longTasks = Array.isArray(observed.longTasks) ? observed.longTasks : [];
      const topSlowResources = [...resources].sort((a,b) => (b.duration || 0) - (a.duration || 0)).slice(0, 12).map((r) => ({ name:r.name, type:r.initiatorType || 'other', durationMs:Math.round(r.duration || 0), transferBytes:Math.round(r.transferSize || 0) }));
      const topTransferResources = [...resources].filter((r) => (r.transferSize || 0) > 0).sort((a,b) => (b.transferSize || 0) - (a.transferSize || 0)).slice(0, 12).map((r) => ({ name:r.name, type:r.initiatorType || 'other', durationMs:Math.round(r.duration || 0), transferBytes:Math.round(r.transferSize || 0) }));
      const scripts = [...document.scripts].filter((el) => el.src);
      const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')];
      const renderBlockingScripts = scripts.filter((el) => !el.async && !el.defer && el.parentElement?.tagName === 'HEAD').length;

      const cssAudit = (() => {
        const allElements = [...document.querySelectorAll('body *')].slice(0, 1500);
        const inlineStyleElements = allElements.filter((el) => el.hasAttribute('style')).length;
        let accessibleStylesheets = 0;
        let inaccessibleStylesheets = 0;
        let accessibleSelectors = 0;
        let unusedSelectors = 0;
        let customPropertyDeclarations = 0;
        const states = { hover:false, focus:false, focusVisible:false, disabled:false, checked:false };
        const selectorSamples = [];
        const walkRules = (rules) => {
          for (const rule of [...(rules || [])]) {
            // CSSStyleRule exposes cssRules for nesting in modern Chromium, even
            // when that list is empty. Recurse only through grouping rules.
            if (rule.cssRules?.length && !rule.selectorText) { walkRules(rule.cssRules); continue; }
            const selectorText = rule.selectorText || '';
            if (rule.style) {
              for (const name of [...rule.style]) if (String(name).startsWith('--')) customPropertyDeclarations += 1;
            }
            if (!selectorText) continue;
            if (/:hover\b/.test(selectorText)) states.hover = true;
            if (/:focus\b/.test(selectorText)) states.focus = true;
            if (/:focus-visible\b/.test(selectorText)) states.focusVisible = true;
            if (/:disabled\b/.test(selectorText)) states.disabled = true;
            if (/:checked\b/.test(selectorText)) states.checked = true;
            // Para cobertura observable usamos solo selectores estáticos; pseudoestados/clases dinámicas no se declaran "unused".
            for (const selector of selectorText.split(',').map((v) => v.trim()).filter(Boolean)) {
              if (selector.includes(':')) continue;
              accessibleSelectors += 1;
              let matched = true;
              try { matched = Boolean(document.querySelector(selector)); } catch { continue; }
              if (!matched) {
                unusedSelectors += 1;
                if (selectorSamples.length < 12) selectorSamples.push(selector.slice(0, 180));
              }
            }
          }
        };
        for (const sheet of [...document.styleSheets]) {
          try { accessibleStylesheets += 1; walkRules(sheet.cssRules); }
          catch { inaccessibleStylesheets += 1; }
        }

        const visible = allElements.filter((el) => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        }).slice(0, 450);
        const countValues = (values, limit = 16) => Object.entries(values.reduce((acc, value) => {
          if (!value) return acc;
          acc[value] = (acc[value] || 0) + 1;
          return acc;
        }, {})).sort((a,b) => b[1]-a[1]).slice(0, limit).map(([value,count]) => ({ value, count }));
        const fontFamiliesRaw = [];
        const fontSizesRaw = [];
        const fontWeightsRaw = [];
        const radiiRaw = [];
        const spacingRaw = [];
        for (const el of visible) {
          const style = getComputedStyle(el);
          fontFamiliesRaw.push(style.fontFamily);
          fontSizesRaw.push(style.fontSize);
          fontWeightsRaw.push(style.fontWeight);
          radiiRaw.push(style.borderRadius);
          spacingRaw.push(style.marginTop, style.marginRight, style.marginBottom, style.marginLeft, style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft);
        }
        const families = [...new Set(fontFamiliesRaw.filter(Boolean))].slice(0, 12);
        return {
          stylesheets: document.styleSheets.length,
          accessibleStylesheets,
          inaccessibleStylesheets,
          accessibleSelectors,
          unusedSelectors,
          unusedSelectorRatio: accessibleSelectors ? Number((unusedSelectors / accessibleSelectors).toFixed(4)) : null,
          unusedSelectorSamples: selectorSamples,
          customPropertyDeclarations,
          inlineStyleElements,
          sampledElements: allElements.length,
          inlineStyleRatio: allElements.length ? Number((inlineStyleElements / allElements.length).toFixed(4)) : 0,
          visibleElementsSampled: visible.length,
          interactiveElements: document.querySelectorAll('a[href],button,input,select,textarea,[role="button"],[tabindex]').length,
          states,
          fontFamilies: families,
          fontSizes: countValues(fontSizesRaw),
          fontWeights: countValues(fontWeightsRaw),
          borderRadii: countValues(radiiRaw),
          spacingValues: countValues(spacingRaw.filter((value) => value && value !== '0px'))
        };
      })();

      const runtimeImages = [...document.images].slice(0, 80).map((img) => {
        const rect = img.getBoundingClientRect();
        return {
          src: img.currentSrc || img.src || null,
          alt: img.getAttribute('alt'),
          naturalWidth: img.naturalWidth || null,
          naturalHeight: img.naturalHeight || null,
          renderedWidth: Math.round(rect.width || 0),
          renderedHeight: Math.round(rect.height || 0),
          loading: img.loading || null,
          decoding: img.decoding || null,
          visible: rect.width > 0 && rect.height > 0
        };
      });
      const backgroundImages = [...document.querySelectorAll('body *')].filter((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return false;
        const bg = getComputedStyle(el).backgroundImage || '';
        return bg && bg !== 'none' && /url\(/i.test(bg);
      }).slice(0, 40).map((el) => {
        const rect = el.getBoundingClientRect();
        const bg = getComputedStyle(el).backgroundImage || '';
        const urls = [...bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]);
        return {
          selectorHint: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.classList?.length ? `.${[...el.classList].slice(0,2).join('.')}` : ''}`,
          urls: urls.slice(0, 4),
          renderedWidth: Math.round(rect.width || 0),
          renderedHeight: Math.round(rect.height || 0)
        };
      }).filter((item) => item.urls.length);
      const privacyPattern = /(privacidad|privacy|protecci[oó]n\s+de\s+datos|data\s+protection)/i;
      const cookiePattern = /cookies?/i;
      const termsPattern = /(t[eé]rminos|condiciones|terms|conditions)/i;
      const consentPattern = /(consent|acepto|autorizo|privacidad|privacy|marketing|comercial)/i;
      const claimsPattern = /(libro\s+de\s+reclamaciones|reclamo|reclamaciones|complaints?)/i;
      const commercePattern = /(carrito|cart|checkout|comprar|buy now|pagar|payment|precio|price|suscripci[oó]n|subscription)/i;
      const optionalPattern = /(marketing|newsletter|bolet[ií]n|promoci[oó]n|suscripci[oó]n|subscription|oferta|comercial|addon|adicional)/i;
      const piiPattern = /(email|e-mail|correo|phone|telefono|tel[eé]fono|mobile|celular|name|nombre|apellido|surname|dni|document|documento|address|direcci[oó]n|company|empresa|ruc)/i;
      const anchors = [...document.querySelectorAll('a[href]')];
      const forms = [...document.querySelectorAll('form')];
      const fields = [...document.querySelectorAll('form input, form select, form textarea')];
      const piiFields = fields.filter((el) => ['email','tel','password'].includes((el.type || '').toLowerCase()) || piiPattern.test(`${el.name || ''} ${el.id || ''} ${el.placeholder || ''} ${el.autocomplete || ''}`)).length;
      const consentControls = fields.filter((el) => (el.type || '').toLowerCase() === 'checkbox' && consentPattern.test(`${el.name || ''} ${el.id || ''} ${el.parentElement?.textContent || ''}`)).length;
      const precheckedOptionalControls = fields.filter((el) => (el.type || '').toLowerCase() === 'checkbox' && el.checked && !el.required && optionalPattern.test(`${el.name || ''} ${el.id || ''} ${el.parentElement?.textContent || ''}`)).length;
      const visibleText = (document.body?.innerText || '').slice(0, 150000);
      const buttonText = [...document.querySelectorAll('button,[role="button"]')].map((el) => (el.textContent || '').trim()).join(' ');
      const privacy = {
        privacyLinks: anchors.filter((a) => privacyPattern.test(`${a.textContent || ''} ${a.href || ''}`)).length,
        cookieLinks: anchors.filter((a) => cookiePattern.test(`${a.textContent || ''} ${a.href || ''}`)).length,
        termsLinks: anchors.filter((a) => termsPattern.test(`${a.textContent || ''} ${a.href || ''}`)).length,
        claimsBookLinks: anchors.filter((a) => claimsPattern.test(`${a.textContent || ''} ${a.href || ''}`)).length,
        forms: forms.length,
        piiFields,
        consentControls,
        precheckedOptionalControls,
        ecommerceSignals: commercePattern.test(visibleText) || anchors.some((a) => commercePattern.test(`${a.textContent || ''} ${a.href || ''}`)),
        cookieConsentUi: cookiePattern.test(visibleText) && /(acept|accept|rechaz|reject|preferenc|configur|manage)/i.test(buttonText)
      };
      return {
        title: document.title || '',
        description: text('meta[name="description"]'),
        canonical,
        lang: document.documentElement.lang || '',
        headings,
        bodyTextChars: (document.body?.innerText || '').length,
        domNodes: document.getElementsByTagName('*').length,
        privacy,
        performance: {
          navigationMs: nav ? Math.round(nav.duration) : null,
          domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
          loadEventMs: nav ? Math.round(nav.loadEventEnd) : null,
          responseStartMs: nav ? Math.round(nav.responseStart) : null,
          ttfbMs: nav ? Math.round(Math.max(0, nav.responseStart - nav.requestStart)) : null,
          fcpMs: fcpEntry ? Math.round(fcpEntry.startTime) : null,
          lcpMs: Number.isFinite(observed.lcp?.startTime) ? Math.round(observed.lcp.startTime) : null,
          lcpElement: observed.lcp || null,
          cls: Number.isFinite(observed.cls) ? Number(observed.cls.toFixed(4)) : null,
          longTaskCount: longTasks.length,
          longTaskTotalMs: Math.round(longTasks.reduce((sum, item) => sum + (item.duration || 0), 0)),
          resourceCount: resources.length,
          transferBytes: Math.round(bytes),
          encodedBodyBytes: Math.round(encodedBytes),
          decodedBodyBytes: Math.round(decodedBytes),
          scripts: scripts.length,
          stylesheets: stylesheets.length,
          renderBlockingScripts,
          topSlowResources,
          topTransferResources,
          codeResources,
          observerErrors: observed.errors || [],
          byType
        },
        runtimeImages,
        backgroundImages,
        cssAudit
      };
    });

    const axe = accessibility ? await runAxeAudit(page, finalUrl) : { status: 'skipped', data: null, findings: [], error: null };

    const needViewportInspection = Boolean(visual || accessibility);
    let desktopVisual = null;
    let mobileVisual = null;
    let desktopShot = null;
    let mobileShot = null;
    if (devices?.desktop && needViewportInspection) {
      desktopVisual = await inspectViewport(page, { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
      if (visual) desktopShot = await page.screenshot({ type: 'jpeg', quality: 48, fullPage: false, encoding: 'base64' });
    }
    if (devices?.mobile && needViewportInspection) {
      mobileVisual = await inspectViewport(page, { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      if (visual) mobileShot = await page.screenshot({ type: 'jpeg', quality: 48, fullPage: false, encoding: 'base64' });
    }
    const cookies = await browser.cookies().catch(() => []);
    const network = summarizeNetwork(finalUrl, requestUrls, cookies);

    const merged = {
      ...rendered,
      finalUrl,
      status: response?.status() || null,
      browserWallMs: Date.now() - started,
      console: { pageErrors, samples: consoleSamples },
      axe: axe.data ? { ...axe.data, moduleStatus: axe.status } : { moduleStatus: axe.status, error: axe.error },
      visual: { desktop: desktopVisual, mobile: mobileVisual },
      contrast: mobileVisual?.contrast || desktopVisual?.contrast || null,
      responsive: mobileVisual?.responsive || desktopVisual?.responsive || null,
      network,
      auditProfile: {
        id: 'CG-STABLE-6',
        userAgent: 'Chrome 149 / CYBERGCODE Audit',
        locale: 'es-PE',
        timezone: 'America/Lima',
        desktopViewport: devices?.desktop ? { width: 1366, height: 768, deviceScaleFactor: 1 } : null,
        mobileViewport: devices?.mobile ? { width: 390, height: 844, deviceScaleFactor: 1 } : null,
        cacheDisabled: true,
        reducedMotion: true
      },
      screenshots: {
        desktop: desktopShot ? compactScreenshot(desktopShot, { width: 1366, height: 768 }) : null,
        mobile: mobileShot ? compactScreenshot(mobileShot, { width: 390, height: 844 }) : null
      }
    };

    return { status: 'measured', data: merged, findings: [...buildBrowserFindings(target, merged), ...buildNetworkFindings(finalUrl, network), ...(axe.findings || [])], error: null };
  } catch (error) {
    return { status: 'unavailable', data: null, findings: [], error: clean(error?.message || error) };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
