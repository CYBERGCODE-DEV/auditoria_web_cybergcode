import { platformDatabaseStatus } from '../lib/platform/database.js';

const status = await platformDatabaseStatus();
console.log(JSON.stringify(status, null, 2));
if (status.configured && !status.ready) process.exitCode = 1;
