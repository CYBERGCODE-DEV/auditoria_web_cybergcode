const DEFAULT_STOPWORDS = new Set(`a al algo algunas algunos ante antes como con contra cual cuando de del desde donde durante e el ella ellas ellos en entre era erais eran eras eres es esa esas ese eso esos esta estaba estaban estado estas este esto estos fue fueron ha hacia hasta hay la las le les lo los más me mi mis muy no nos o para pero por porque que se ser si sin sobre su sus te tiene tu tus un una uno unos unas y ya the and or to of in for on with from is are be this that these those your you our we`.split(/\s+/));

export const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

export function tokenize(value) {
  return cleanText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9ñáéíóúü]{2,}/gi)?.map((token) => token.toLowerCase()) || [];
}

function meaningfulTokens(value) {
  return tokenize(value).filter((token) => token.length > 2 && !DEFAULT_STOPWORDS.has(token));
}

function sentenceParts(text) {
  return cleanText(text).split(/(?<=[.!?…])\s+|\n+/).map(cleanText).filter((part) => meaningfulTokens(part).length >= 2);
}

function topTerms(tokens, limit = 10) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return [...counts.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([term,count]) => ({ term, count }));
}

export function tokenOverlap(a, b) {
  const left = new Set(meaningfulTokens(a));
  const right = new Set(meaningfulTokens(b));
  if (!left.size || !right.size) return null;
  let common = 0;
  for (const token of left) if (right.has(token)) common += 1;
  return common / Math.max(1, Math.min(left.size, right.size));
}

export function analyzeContent({ bodyText = '', paragraphs = [], title = '', h1 = '', links = [], buttons = [] }) {
  const text = cleanText(bodyText);
  const words = tokenize(text);
  const meaningful = meaningfulTokens(text);
  const sentences = sentenceParts(text);
  const genericAnchorPattern = /^(aqui|aquí|click|clic|haz click|haz clic|leer mas|leer más|ver mas|ver más|más|more|read more|click here)$/i;
  const ctaPattern = /(comprar|cotizar|solicitar|contactar|contacto|reservar|agendar|descargar|probar|empezar|registrar|suscribir|personalizar|ver productos|explorar|buy|contact|download|start|book|subscribe)/i;
  const paragraphTexts = paragraphs.map(cleanText).filter(Boolean);
  const averageWordsPerSentence = sentences.length ? words.length / sentences.length : null;
  const longSentences = sentences.filter((sentence) => tokenize(sentence).length > 30).length;
  const genericAnchors = links.filter((link) => genericAnchorPattern.test(cleanText(link.text))).length;
  const ctas = [...links.map((link) => link.text), ...buttons].filter((label) => ctaPattern.test(cleanText(label))).length;
  return {
    wordCount: words.length,
    meaningfulWordCount: meaningful.length,
    paragraphCount: paragraphTexts.length,
    sentenceCount: sentences.length,
    averageWordsPerSentence: Number.isFinite(averageWordsPerSentence) ? Number(averageWordsPerSentence.toFixed(1)) : null,
    longSentences,
    genericAnchors,
    ctaCount: ctas,
    titleH1Overlap: tokenOverlap(title, h1),
    topTerms: topTerms(meaningful, 10),
    paragraphs: paragraphTexts.filter((p) => p.length >= 60).slice(0, 80)
  };
}
