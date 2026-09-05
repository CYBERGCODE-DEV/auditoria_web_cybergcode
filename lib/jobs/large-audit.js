import crypto from 'node:crypto';
import { COMPANY } from '../config/company.js';
import { resolveAuditConfig } from '../config/audit-modes.js';
import { initializeLargeCrawl, processLargeCrawlBatch } from '../audit/batch-crawler.js';
import { groupPagesByTemplate } from '../audit/template-grouping.js';
import { runAuditFromCrawl } from '../audit/engine.js';
import { runBrowserAudit } from '../browser/browser-audit.js';
import { getJob, setJob, setJobChunk, readAllJobPages, setJobResult, getJobResult, jobProgress } from './job-store.js';

const BATCH_SIZE = 20;
const MAX_REPRESENTATIVE_BROWSER_SAMPLES = 3;

function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    target: job.target,
    maxPages: job.maxPages,
    processedCount: job.processedCount || 0,
    successfulCount: job.successfulCount || 0,
    failedCount: job.failedCount || 0,
    discoveredCount: job.discoveredCount || 0,
    queueRemaining: Array.isArray(job.queue) ? job.queue.length : 0,
    chunkCount: job.chunkCount || 0,
    progress: jobProgress(job),
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt || null,
    error: job.error || null,
    crawlCompleteReason: job.crawlCompleteReason || null,
    cancelledAt: job.cancelledAt || null,
    config: job.config,
    templateSummary: job.templateSummary || null
  };
}

export async function createLargeAuditJob({ url, maxPages = 100, auditMode = 'complete', modules = {}, devices = {}, pageSpeed = true, stableMode = true, aiReview = false }) {
  const requested = Math.min(Math.max(Number(maxPages) || 100, 51), 500);
  const config = resolveAuditConfig({ auditMode, modules, devices, maxPages: requested, pageSpeed, aiReview });
  if (config.maxPages <= 50) throw new Error('Los jobs grandes están reservados para auditorías de más de 50 páginas.');
  const seed = await initializeLargeCrawl(url, { maxPages: config.maxPages });
  const now = new Date().toISOString();
  const id = `JOB-${now.slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const job = {
    id,
    status: 'crawling',
    target: seed.startUrl,
    origin: seed.origin,
    maxPages: seed.maxPages,
    queue: seed.queue,
    visitedKeys: [],
    processedCount: 0,
    successfulCount: 0,
    failedCount: 0,
    discoveredCount: seed.queue.length,
    chunkCount: 0,
    errors: [],
    discovery: seed.discovery,
    config,
    stableMode: Boolean(stableMode),
    startedAt: now,
    updatedAt: now,
    engineVersion: COMPANY.engineVersion
  };
  await setJob(job);
  return publicJob(job);
}

export async function processLargeAuditJob(id) {
  const job = await getJob(id);
  if (!job) throw new Error('Job no encontrado o expirado.');
  if (job.status === 'completed') return publicJob(job);
  if (job.status === 'failed' || job.status === 'cancelled') return publicJob(job);
  if (job.status === 'crawl-complete' || job.status === 'finalizing') return publicJob(job);

  const leaseAge = job.processingSince ? Date.now() - new Date(job.processingSince).getTime() : Infinity;
  if (job.processing === true && leaseAge < 90_000) return { ...publicJob(job), busy: true };
  job.processing = true;
  job.processingSince = new Date().toISOString();
  await setJob(job);

  try {
    const { pages, errors, next } = await processLargeCrawlBatch(job, { batchSize: BATCH_SIZE, concurrency: 5 });
    if (pages.length) {
      await setJobChunk(id, job.chunkCount || 0, pages);
      next.chunkCount = Number(job.chunkCount || 0) + 1;
    } else next.chunkCount = Number(job.chunkCount || 0);
    next.errors = [...(job.errors || []), ...errors].slice(-250);
    next.processing = false;
    next.processingSince = null;
    await setJob(next);
    return publicJob(next);
  } catch (error) {
    job.processing = false;
    job.processingSince = null;
    job.status = 'failed';
    job.error = String(error?.message || error);
    job.updatedAt = new Date().toISOString();
    await setJob(job);
    throw error;
  }
}

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
      note: 'HTML/SEO se rastrea por lotes; Chromium adicional se ejecuta únicamente sobre una muestra heurística de plantillas y no sustituye la puntuación principal.'
    };
    result.pages = compactLargePages(result.pages || []);

    await setJobResult(id, result);
    job = { ...job, status:'completed', processing:false, finishedAt:new Date().toISOString(), updatedAt:new Date().toISOString(), resultReady:true };
    await setJob(job);
    return { job: publicJob(job), result };
  } catch (error) {
    job.status = 'failed';
    job.error = String(error?.message || error);
    job.updatedAt = new Date().toISOString();
    await setJob(job);
    throw error;
  }
}

export async function getLargeAuditJobStatus(id) {
  return publicJob(await getJob(id));
}

export async function cancelLargeAuditJob(id) {
  const job = await getJob(id);
  if (!job) throw new Error('Job no encontrado o expirado.');
  if (job.status === 'completed') return publicJob(job);
  if (job.status === 'finalizing') throw new Error('El job ya está consolidando y no puede cancelarse en este momento.');
  const next = {
    ...job,
    status: 'cancelled',
    processing: false,
    processingSince: null,
    cancelledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null
  };
  await setJob(next);
  return publicJob(next);
}

export async function getLargeAuditResult(id) {
  const job = await getJob(id);
  if (!job) throw new Error('Job no encontrado o expirado.');
  if (job.status !== 'completed') return { job: publicJob(job), result: null };
  return { job: publicJob(job), result: await getJobResult(id) };
}
