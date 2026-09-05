export function canonicalCrawlKey(value) {
  const u = new URL(value);
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|msclkid|mc_[ce]id)/i.test(key)) u.searchParams.delete(key);
  }
  if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) u.port = '';
  return u.href.replace(/\/$/, '') || u.href;
}
