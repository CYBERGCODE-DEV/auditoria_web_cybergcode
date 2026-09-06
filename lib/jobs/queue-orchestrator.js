import { getJob, setJob } from './job-store.js';

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
  const reason = 'client-batched-deployment-compatible';
  await setJobOrchestration(id, { mode:'client', status:'fallback', lastStep:step, reason });
  return { mode:'client', queued:false, reason };
}
