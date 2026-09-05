import { platformDatabaseStatus } from '../lib/platform/database.js';
import { hasPlatformAccess, platformAccessConfigured } from '../lib/platform/access.js';
import { listProjects } from '../lib/platform/repository.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') return res.status(405).json({ error:'Método no permitido.' });
  const database = await platformDatabaseStatus();
  const accessConfigured = platformAccessConfigured();
  const authorized = accessConfigured && hasPlatformAccess(req);
  const projects = database.ready && authorized ? await listProjects({ limit:5 }).catch(()=>[]) : [];
  return res.status(200).json({ database, access:{ configured:accessConfigured, authorized, required:true }, projectCount:authorized ? projects.length : null, recentProjects:projects });
}
