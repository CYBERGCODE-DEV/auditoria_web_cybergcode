import test from 'node:test';
import assert from 'node:assert/strict';
import auditHandler from '../api/audit.js';
import reportHandler from '../api/report.js';
import platformHandler from '../api/platform.js';

function response() {
  return {
    statusCode:200, headersSent:false, headers:{}, body:null,
    setHeader(key,value){this.headers[key]=value;},
    status(code){this.statusCode=code;return this;},
    json(body){this.body=body;this.headersSent=true;return this;},
    send(body){this.body=body;this.headersSent=true;return this;}
  };
}

test('Functions rechazan métodos incorrectos y entregan request ID', async () => {
  for (const handler of [auditHandler, reportHandler]) {
    const res = response();
    await handler({ method:'GET', headers:{} }, res);
    assert.equal(res.statusCode, 405);
    assert.match(res.headers['X-Request-ID'], /^[0-9a-f-]{36}$/i);
  }
});

test('estado de plataforma declara la base no configurada sin inventar conexión', async () => {
  const previousProvider = process.env.DB_PROVIDER;
  const previousUrl = process.env.DATABASE_URL;
  delete process.env.DB_PROVIDER;
  delete process.env.DATABASE_URL;
  try {
    const res = response();
    await platformHandler({ method:'GET', query:{ resource:'status' }, headers:{} }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.database.ready, false);
    assert.equal(res.body.access.required, true);
  } finally {
    if (previousProvider !== undefined) process.env.DB_PROVIDER = previousProvider;
    if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
  }
});
