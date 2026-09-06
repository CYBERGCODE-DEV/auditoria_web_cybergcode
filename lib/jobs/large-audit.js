import { groupPagesByTemplate } from '../audit/template-grouping.js';
import { runAuditFromCrawl } from '../audit/engine.js';
import { runBrowserAudit } from '../browser/browser-audit.js';
import { getJob, setJob, readAllJobPages, setJobResult, getJobResult } from './job-store.js';
import { persistAuditResult } from '../platform/repository.js';
import { attachReportAuthorization } from '../report/integrity.js';
import { auditPersistenceAllowed } from '../security/api-access.js';
import { appendJobEvent, publicJob } from './large-audit-state.js';

const BATCH_SIZE = 20;
const MAX_REPRESENTATIVE_BROWSER_SAMPLES = 3;
const MAX_FINALIZE_RETRIES = 3;

async function representativeBrowserSamples(grouping, config, target) {
  if (!config.modules.browser) return { status: 'skipped', samples: [], note: 'Chromium no fue seleccionado.' };
  const candidates = grouping.representatives.filter((item) => item.url !== target).slice(0, MAX_REPRESENTATIVE_BROWSER_SAMPLES);
  const samples = [];
  for (const item of candidates) {
    try {
      const audit = await runBrowserAudit(item.url, { devices: { mobile:false, desktop:false }, accessibility:false, visual:false });
      samples.push({
        templateId: item.templateId,
        label: item.label,
        url: item.url,
        representedPages: item.count,
        status: audit.status,
        httpStatus: audit.data?.status ?? null,
        finalUrl: audit.data?.finalUrl || item.url,
        domNodes: audit.data?.domNodes ?? null,
        resources: audit.data?.resources ?? null,
        transferBytes: audit.data?.transferBytes ?? null,
        performance: audit.data?.performance ? {
          ttfbMs: audit.data.performance.ttfbMs ?? null,
          fcpMs: audit.data.performance.fcpMs ?? null,
          lcpMs: audit.data.performance.lcpMs ?? null,
          cls: audit.data.performance.cls ?? null,
          longTaskCount: audit.data.performance.longTaskCount ?? null
        } : null,
        error: audit.error || null
      });
    } catch (error) {
      samples.push({ templateId:item.templateId, label:item.label, url:item.url, representedPages:item.count, status:'unavailable', error:String(error?.message || error) });
    }
  }
  return { status: samples.some((s) => s.status === 'measured') ? 'measured' : (samples.length ? 'unavailable' : 'not-needed'), samples, note: 'Muestreo Chromium no puntuable por plantilla; el score principal conserva las fuentes configuradas para la URL objetivo.' };
}

function compactLargePages(pages) {
  return pages.map((page) => ({
    ...page,
    headings: (page.headings || []).slice(0, 12),
    images: (page.images || []).slice(0, 6),
    hreflang: (page.hreflang || []).slice(0, 8),
    technologies: (page.technologies || []).slice(0, 12)
  }));
}

export async function finalizeLargeAuditJob(id) {
  let job = await getJob(id);
  if (!job) throw new Error('Job no encontrado o expirado.');
  if (job.status === 'completed') return { job: publicJob(job), result: await getJobResult(id) };
  if (job.status !== 'crawl-complete') throw new Error(`El rastreo aún no está listo para consolidar (${job.status}).`);

  job.status = 'finalizing';
  job.updatedAt = new Date().toISOString();
  appendJobEvent(job, 'finalizing', 'Consolidando resultados y muestras representativas.');
  await setJob(job);
  try {
    const pages = await readAllJobPages(job);
    if (!pages.length) throw new Error('El job no contiene páginas HTML procesadas.');
    const grouping = groupPagesByTemplate(pages, { representativeLimit: 8 });
    job.templateSummary = grouping.coverage;
    await setJob(job);

    const crawl = {
      startUrl: job.target,
      pages,
      errors: job.errors || [],
      discovered: job.discoveredCount || pages.length,
      limit: job.maxPages,
      discovery: job.discovery
    };
    const result = await runAuditFromCrawl({
      crawl,
      pageSpeed: job.config.pageSpeed,
      stableMode: job.stableMode,
      aiReview: job.config.aiReview,
      auditMode: job.config.mode,
      modules: job.config.modules,
      devices: job.config.devices,
      resolvedConfig: job.config,
      startedAt: job.startedAt
    });
    const representativeSamples = await representativeBrowserSamples(grouping, job.config, job.target);
    result.templateSampling = { ...grouping, browserSamples: representativeSamples };
    result.meta.largeAudit = {
      enabled: true,
      jobId: job.id,
      batchSize: BATCH_SIZE,
      requestedPages: job.maxPages,
      processedUrls: job.processedCount,
      successfulPages: pages.length,
      failedUrls: job.failedCount,
      crawlCompleteReason: job.crawlCompleteReason,
      detailStorage: 'chunked-runtime-cache',
      orchestration: job.orchestration?.mode || 'client',
      retryCount: Number(job.retryCount || 0),
      finalizeRetryCount: Number(job.finalizeRetryCount || 0),
      jobEvents: (job.events || []).slice(-20),
      note: 'HTML/SEO se rastrea por lotes; Chromium adicional se ejecuta únicamente sobre una muestra heurística de plantillas y no sustituye la puntuación principal.'
    };
    result.pages = compactLargePages(result.pages || []);
    try {
      if (!auditPersistenceAllowed()) throw Object.assign(new Error('anonymous-persistence-disabled'), { expected:true });
      const stored = await persistAuditResult(result);
      result.meta.platform = stored.status === 'stored'
        ? { status:'stored', project:stored.project ? { id:stored.project.id, domain:stored.project.domain } : null, auditId:stored.audit?.id || result.meta.id, fullResultStored:stored.fullResultStored }
        : { status:'unavailable', reason:stored.reason || 'database-not-configured' };
    } catch (platformError) {
      if (!platformError?.expected) console.warn('[large-audit/platform]', platformError);
      result.meta.platform = { status:platformError?.expected ? 'disabled' : 'unavailable', reason:String(platformError?.message || platformError) };
    }
    attachReportAuthorization(result);

    await setJobResult(id, result);
    job = { ...job, status:'completed', processing:false, finishedAt:new Date().toISOString(), updatedAt:new Date().toISOString(), resultReady:true, consecutiveFailures:0, lastFinalizeError:null };
    appendJobEvent(job, 'completed', 'Auditoría grande completada y resultado persistido temporalmente.');
    await setJob(job);
    return { job: publicJob(job), result };
  } catch (error) {
    job.finalizeRetryCount = Number(job.finalizeRetryCount || 0) + 1;
    job.lastFinalizeError = String(error?.message || error);
    job.updatedAt = new Date().toISOString();
    if (job.finalizeRetryCount <= MAX_FINALIZE_RETRIES) {
      job.status = 'crawl-complete';
      appendJobEvent(job, 'finalize-retry', `Fallo temporal al consolidar; reintento ${job.finalizeRetryCount}/${MAX_FINALIZE_RETRIES}.`, { error:job.lastFinalizeError });
      await setJob(job);
      const retryError = new Error(job.lastFinalizeError);
      retryError.retryable = true;
      retryError.job = publicJob(job);
      throw retryError;
    }
    job.status = 'failed';
    job.error = job.lastFinalizeError;
    appendJobEvent(job, 'failed', 'Se agotaron los reintentos de consolidación.', { error:job.error });
    await setJob(job);
    throw error;
  }
}
