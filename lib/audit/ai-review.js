const ENDPOINT = 'https://api.openai.com/v1/responses';

function compactPage(page) {
  const h1 = (page.headings || []).find((h) => h.level === 1)?.text || '';
  return {
    url: page.url,
    title: page.title || '',
    description: page.description || '',
    h1,
    wordCount: page.content?.wordCount || 0,
    averageWordsPerSentence: page.content?.averageWordsPerSentence ?? null,
    longSentences: page.content?.longSentences || 0,
    ctaCount: page.content?.ctaCount || 0,
    genericAnchors: page.content?.genericAnchors || 0,
    topTerms: page.content?.topTerms || [],
    excerpt: Array.isArray(page.content?.paragraphs) ? page.content.paragraphs.slice(0, 4).join(' ').slice(0, 2200) : ''
  };
}

function schema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'pages'],
    properties: {
      summary: { type: 'string' },
      pages: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['url', 'observations'],
          properties: {
            url: { type: 'string' },
            observations: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['type', 'title', 'analysis', 'suggestion', 'confidence'],
                properties: {
                  type: { type: 'string', enum: ['heuristic', 'suggestion'] },
                  title: { type: 'string' },
                  analysis: { type: 'string' },
                  suggestion: { type: 'string' },
                  confidence: { type: 'number', minimum: 0, maximum: 1 }
                }
              }
            }
          }
        }
      }
    }
  };
}

function parseOutput(json) {
  if (typeof json?.output_text === 'string' && json.output_text.trim()) return JSON.parse(json.output_text);
  const texts = [];
  for (const item of json?.output || []) {
    for (const content of item?.content || []) if (content?.type === 'output_text' && content.text) texts.push(content.text);
  }
  if (!texts.length) throw new Error('La respuesta de IA no contiene output_text utilizable.');
  return JSON.parse(texts.join('\n'));
}

export async function runAiContentReview(pages = [], enabled = false) {
  if (!enabled) return { status: 'disabled', provider: 'OpenAI Responses API', model: null, review: null, note: 'Revisión IA no solicitada.' };
  if (!process.env.OPENAI_API_KEY) return { status: 'unavailable', provider: 'OpenAI Responses API', model: process.env.OPENAI_MODEL || null, review: null, note: 'OPENAI_API_KEY no configurada. No se generaron sugerencias IA.' };

  const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
  const selected = pages.slice(0, 8).map(compactPage);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: 'Eres un revisor de contenido web. Distingue hechos técnicos ya medidos de opiniones editoriales. No inventes datos, keywords, tráfico ni resultados SEO. Tus observaciones son heurísticas y no deben presentarse como errores técnicos. Responde en español.' }]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: `Revisa estas páginas públicas para claridad, intención, CTA, coherencia title/H1/copy, tono, redundancia y oportunidades de mejora. No afirmes posicionamiento ni tráfico. Datos:\n${JSON.stringify(selected)}` }]
          }
        ],
        text: { format: { type: 'json_schema', name: 'cybergcode_content_review', strict: true, schema: schema() } }
      })
    });
    const body = await response.text();
    let json;
    try { json = JSON.parse(body); } catch { throw new Error(`Respuesta IA no JSON (HTTP ${response.status}).`); }
    if (!response.ok) throw new Error(json?.error?.message || `OpenAI HTTP ${response.status}`);
    return { status: 'measured', provider: 'OpenAI Responses API', model, review: parseOutput(json), note: 'Sugerencias heurísticas generadas por IA; no modifican la puntuación objetiva.' };
  } catch (error) {
    return { status: 'unavailable', provider: 'OpenAI Responses API', model, review: null, note: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}
