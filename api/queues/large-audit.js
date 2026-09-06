import { handleCallback, send } from '@vercel/queue';
import { LARGE_AUDIT_QUEUE_TOPIC, setJobOrchestration } from '../../lib/jobs/queue-orchestrator.js';
import { finalizeLargeAuditJob, getLargeAuditJobStatus, processLargeAuditJob } from '../../lib/jobs/large-audit.js';

async function sendNext(jobId, step) {
  const status = await getLargeAuditJobStatus(jobId);
  const expectedRevision = Number(status?.revision || 0);
  const response = await send(LARGE_AUDIT_QUEUE_TOPIC, { jobId, step, expectedRevision, requestedAt:new Date().toISOString() }, { idempotencyKey:`${jobId}:${step}:${expectedRevision}` });
  await setJobOrchestration(jobId, {
    mode:'queue',
    status:'queued',
    topic:LARGE_AUDIT_QUEUE_TOPIC,
    lastStep:step,
    lastMessageId:response?.messageId || null,
    reason:null
  });
}

export const POST = handleCallback(async (message, metadata) => {
  const jobId = String(message?.jobId || '').trim();
  const step = message?.step === 'finalize' ? 'finalize' : 'process';
  if (!jobId) throw new Error('Mensaje de cola sin jobId.');

  let status = await getLargeAuditJobStatus(jobId);
  if (!status || ['completed','cancelled'].includes(status.status)) return;
  if (status.status === 'failed') throw new Error(status.error || `Job ${jobId} fallido.`);
  if (Number.isFinite(message?.expectedRevision) && Number(message.expectedRevision) !== Number(status.revision || 0)) return;

  await setJobOrchestration(jobId, {
    mode:'queue',
    status:'running',
    topic:LARGE_AUDIT_QUEUE_TOPIC,
    lastStep:step,
    lastDeliveryCount:metadata?.deliveryCount ?? null,
    lastMessageId:metadata?.messageId || null
  });

  if (step === 'finalize' || status.status === 'crawl-complete' || status.status === 'finalizing') {
    await finalizeLargeAuditJob(jobId);
    await setJobOrchestration(jobId, { mode:'queue', status:'completed', lastStep:'finalize' });
    return;
  }

  status = await processLargeAuditJob(jobId, { expectedRevision:Number.isFinite(message?.expectedRevision) ? Number(message.expectedRevision) : null });
  if (status?.busy || status?.duplicateDelivery) return;
  if (status.status === 'crawling') {
    await sendNext(jobId, 'process');
    return;
  }
  if (status.status === 'crawl-complete') {
    await sendNext(jobId, 'finalize');
  }
});
