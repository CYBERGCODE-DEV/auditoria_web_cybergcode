import crypto from 'node:crypto';
import { COMPANY } from '../config/company.js';
import { resolveAuditConfig } from '../config/audit-modes.js';
import { initializeLargeCrawl } from '../audit/batch-crawler.js';
import { setJob } from './job-store.js';
import { appendJobEvent, publicJob, tokenHash } from './large-audit-state.js';

export async function createLargeAuditJob({ url, maxPages = 100, auditMode = 'complete', modules = {}, devices = {}, pageSpeed = true, stableMode = true, aiReview = false }) {
  const requested = Math.min(Math.max(Number(maxPages) || 100, 51), 500);
  const config = resolveAuditConfig({ auditMode, modules, devices, maxPages: requested, pageSpeed, aiReview });
  if (config.maxPages <= 50) throw new Error('Los jobs grandes están reservados para auditorías de más de 50 páginas.');
  const seed = await initializeLargeCrawl(url, { maxPages: config.maxPages });
  const now = new Date().toISOString();
  const id = `JOB-${crypto.randomUUID().toUpperCase()}`;
  const accessToken = crypto.randomBytes(32).toString('base64url');
  const job = {
    id,
    accessTokenHash: tokenHash(accessToken),
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
    engineVersion: COMPANY.engineVersion,
    retryCount: 0,
    revision: 0,
    consecutiveFailures: 0,
    finalizeRetryCount: 0,
    orchestration: { mode:'client', status:'ready', updatedAt:now },
    events: []
  };
  appendJobEvent(job, 'created', 'Job de auditoría creado.', { maxPages:job.maxPages });
  await setJob(job);
  return { ...publicJob(job), accessToken };
}
