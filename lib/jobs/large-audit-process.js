import { processLargeCrawlBatch } from '../audit/batch-crawler.js';
import { getJob, setJob, setJobChunk } from './job-store.js';
import { appendJobEvent, publicJob } from './large-audit-state.js';
import { acquireJobLock, releaseJobLock } from './distributed-lock.js';

const BATCH_SIZE = 20;
const MAX_BATCH_RETRIES = 4;

async function processLargeAuditJobUnlocked(id, { expectedRevision = null } = {}) {
  const job = await getJob(id);
  if (!job) throw new Error('Job no encontrado o expirado.');
  if (job.status === 'completed') return publicJob(job);
  if (job.status === 'failed' || job.status === 'cancelled') return publicJob(job);
  if (job.status === 'crawl-complete' || job.status === 'finalizing') return publicJob(job);
  if (Number.isFinite(expectedRevision) && Number(job.revision || 0) !== Number(expectedRevision)) return { ...publicJob(job), duplicateDelivery:true };

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
    next.consecutiveFailures = 0;
    next.lastBatchError = null;
    next.revision = Number(job.revision || 0) + 1;
    appendJobEvent(next, 'batch-complete', `Lote procesado: ${pages.length} HTML, ${errors.length} error(es).`, { processedCount:next.processedCount, queueRemaining:Array.isArray(next.queue) ? next.queue.length : 0 });
    await setJob(next);
    return publicJob(next);
  } catch (error) {
    job.processing = false;
    job.processingSince = null;
    job.retryCount = Number(job.retryCount || 0) + 1;
    job.consecutiveFailures = Number(job.consecutiveFailures || 0) + 1;
    job.lastBatchError = String(error?.message || error);
    job.updatedAt = new Date().toISOString();
    if (job.consecutiveFailures <= MAX_BATCH_RETRIES) {
      job.status = 'crawling';
      appendJobEvent(job, 'batch-retry', `Fallo temporal del lote; reintento ${job.consecutiveFailures}/${MAX_BATCH_RETRIES}.`, { error:job.lastBatchError });
      await setJob(job);
      const retryError = new Error(job.lastBatchError);
      retryError.retryable = true;
      retryError.job = publicJob(job);
      throw retryError;
    }
    job.status = 'failed';
    job.error = job.lastBatchError;
    appendJobEvent(job, 'failed', 'Se agotaron los reintentos del rastreo.', { error:job.error });
    await setJob(job);
    throw error;
  }
}

export async function processLargeAuditJob(id, options = {}) {
  const lock = await acquireJobLock(`large-audit:${id}`);
  if (!lock.acquired) {
    const job = await getJob(id);
    return { ...publicJob(job), busy:true, lockBackend:lock.backend };
  }
  try {
    return await processLargeAuditJobUnlocked(id, options);
  } finally {
    await releaseJobLock(lock);
  }
}
