import crypto from 'node:crypto';
import { getJob, setJob, getJobResult, jobProgress } from './job-store.js';

export function appendJobEvent(job, type, message, data = null) {
  const event = { at:new Date().toISOString(), type, message, data };
  job.events = [...(job.events || []), event].slice(-40);
  return job;
}

export function publicJob(job) {
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
    templateSummary: job.templateSummary || null,
    orchestration: job.orchestration || { mode:'client', status:'ready' },
    retryCount: Number(job.retryCount || 0),
    revision: Number(job.revision || 0),
    consecutiveFailures: Number(job.consecutiveFailures || 0),
    finalizeRetryCount: Number(job.finalizeRetryCount || 0),
    lastBatchError: job.lastBatchError || null,
    lastFinalizeError: job.lastFinalizeError || null,
    events: (job.events || []).slice(-12)
  };
}

export function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

export async function assertLargeAuditJobAccess(id, token, actor = null) {
  const job = await getJob(id);
  if (!job) throw new Error('Job no encontrado o expirado.');
  const actual = Buffer.from(tokenHash(token), 'hex');
  const expected = Buffer.from(String(job.accessTokenHash || ''), 'hex');
  if (!expected.length || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    const error = new Error('Token de acceso al job inválido.');
    error.code = 'JOB_ACCESS_DENIED';
    throw error;
  }
  if (actor?.id && (String(job.ownerUserId || 'legacy') !== String(actor.id) || String(job.organizationId || 'legacy') !== String(actor.organizationId))) {
    const error = new Error('El job no pertenece a esta cuenta.');
    error.code = 'JOB_ACCESS_DENIED';
    throw error;
  }
  return job;
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
  appendJobEvent(next, 'cancelled', 'Auditoría cancelada por el usuario.');
  await setJob(next);
  return publicJob(next);
}

export async function getLargeAuditResult(id) {
  const job = await getJob(id);
  if (!job) throw new Error('Job no encontrado o expirado.');
  if (job.status !== 'completed') return { job: publicJob(job), result: null };
  return { job: publicJob(job), result: await getJobResult(id) };
}
