import { getJob, setJob } from './job-store.js';

export const LARGE_AUDIT_QUEUE_TOPIC = 'cybergcode-large-audit';

function queueAllowed() {
  if (process.env.CYBERGCODE_QUEUE_DISABLED === '1') return false;
  return Boolean(process.env.VERCEL);
}

export async function setJobOrchestration(id, patch = {}) {
  const job = await getJob(id);
  if (!job) return null;
  const next = {
    ...job,
    orchestration: {
      mode: 'client',
      status: 'ready',
      ...(job.orchestration || {}),
      ...patch,
      updatedAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  };
  await setJob(next);
  return next;
}

export async function enqueueLargeAuditStep(id, step = 'process') {
  if (!queueAllowed()) {
    await setJobOrchestration(id, {
      mode: 'client',
      status: 'fallback',
      reason: process.env.CYBERGCODE_QUEUE_DISABLED === '1' ? 'queue-disabled' : 'not-vercel'
    });
    return { mode:'client', queued:false, reason:process.env.CYBERGCODE_QUEUE_DISABLED === '1' ? 'queue-disabled' : 'not-vercel' };
  }

  try {
    const { send } = await import('@vercel/queue');
    const response = await send(LARGE_AUDIT_QUEUE_TOPIC, {
      jobId: id,
      step,
      requestedAt: new Date().toISOString()
    });
    await setJobOrchestration(id, {
      mode: 'queue',
      status: 'queued',
      topic: LARGE_AUDIT_QUEUE_TOPIC,
      lastStep: step,
      lastMessageId: response?.messageId || null,
      reason: null
    });
    return { mode:'queue', queued:true, topic:LARGE_AUDIT_QUEUE_TOPIC, messageId:response?.messageId || null };
  } catch (error) {
    const reason = String(error?.message || error);
    console.warn('[queue-orchestrator] Vercel Queue no disponible; se mantiene fallback cliente:', reason);
    await setJobOrchestration(id, { mode:'client', status:'fallback', reason });
    return { mode:'client', queued:false, reason };
  }
}
