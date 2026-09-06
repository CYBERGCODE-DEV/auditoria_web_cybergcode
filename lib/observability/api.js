import crypto from 'node:crypto';

function requestId(req) {
  const supplied = String(req.headers?.['x-request-id'] || '').trim();
  return /^[A-Za-z0-9._:-]{8,100}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export function withApiObservability(route, handler) {
  return async function observedHandler(req, res) {
    const id = requestId(req);
    const started = performance.now();
    req.cybergcodeRequestId = id;
    res.setHeader('X-Request-ID', id);
    try {
      return await handler(req, res);
    } catch (error) {
      console.error(JSON.stringify({ type:'api_unhandled_error', requestId:id, route, method:req.method, error:error?.name || 'Error' }));
      if (!res.headersSent) return res.status(500).json({ error:'Error interno no controlado.', requestId:id });
      throw error;
    } finally {
      console.log(JSON.stringify({ type:'api_request', requestId:id, route, method:req.method, status:res.statusCode, durationMs:Math.round(performance.now() - started) }));
    }
  };
}
