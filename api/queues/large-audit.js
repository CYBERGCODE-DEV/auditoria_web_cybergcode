// El trigger experimental de Vercel Queues fue retirado para evitar que el
// deployment falle al registrar sus outputs. Las auditorías grandes siguen
// ejecutándose mediante los endpoints /api/jobs/* en lotes coordinados por el
// cliente. Esta respuesta explícita evita que una URL antigua ejecute trabajo.
export default function handler(_request, response) {
  response.status(410).json({
    error: 'QUEUE_TRIGGER_DISABLED',
    message: 'El procesamiento usa el modo compatible por lotes desde el cliente.'
  });
}
