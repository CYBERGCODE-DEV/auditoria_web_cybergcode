function finite(value) { return Number.isFinite(value) ? Number(value) : null; }

function severityCounts(audit) {
  const source = audit?.summary?.severity || {};
  return {
    critical:Number(source.critical || 0), high:Number(source.high || 0), medium:Number(source.medium || 0),
    low:Number(source.low || 0), info:Number(source.info || 0)
  };
}

function metricFromPerformance(audit, device, key) {
  const item = audit?.performance?.[device];
  const direct = item?.[key];
  if (Number.isFinite(direct)) return Number(direct);
  const audits = item?.audits || {};
  const aliases = {
    lcp:['largest-contentful-paint','lcp'], cls:['cumulative-layout-shift','cls'], inp:['interaction-to-next-paint','inp'],
    fcp:['first-contentful-paint','fcp'], tbt:['total-blocking-time','tbt']
  };
  for (const alias of aliases[key] || [key]) {
    const candidate = audits?.[alias]?.numericValue ?? audits?.[alias]?.value ?? audits?.[alias];
    if (Number.isFinite(candidate)) return Number(candidate);
  }
  return null;
}

export function buildAuditSnapshot(audit) {
  const seo = audit?.seo || {};
  const meta = seo.metadata || {};
  const coverage = seo.coverage || {};
  const headingInfo = seo.headings || {};
  const headingTotals = headingInfo.totals || {};
  const links = seo.links || {};
  const images = audit?.imageSummary || {};
  const content = audit?.content || {};
  const categories = audit?.scores?.categories || {};
  return {
    auditId:audit?.meta?.id || null,
    target:audit?.meta?.target || null,
    engineVersion:audit?.meta?.engineVersion || null,
    completedAt:audit?.meta?.finishedAt || new Date().toISOString(),
    scores:{
      global:finite(audit?.scores?.global),
      categories:Object.fromEntries(Object.entries(categories).map(([key,value]) => [key, finite(value)]))
    },
    severity:severityCounts(audit),
    coverage:{
      pagesCrawled:Number(audit?.summary?.pagesCrawled || 0),
      pagesDiscovered:Number(audit?.summary?.pagesDiscovered || 0),
      findingsTotal:Number(audit?.summary?.findingsTotal || 0),
      templatesObserved:Number(audit?.summary?.templatesObserved || 0)
    },
    seo:{
      indexable:Number(coverage.indexable || 0), noindex:Number(coverage.noindex || 0),
      missingTitle:Number(meta.missingTitles || 0), duplicateTitles:Number(meta.duplicateTitleGroups || 0),
      missingDescription:Number(meta.missingDescriptions || 0), duplicateDescriptions:Number(meta.duplicateDescriptionGroups || 0),
      missingCanonical:Number(meta.missingCanonicals || 0), missingH1:Number(headingInfo.pagesMissingH1 || 0), multipleH1:Number(headingInfo.pagesMultipleH1 || 0),
      internalLinks:Number(links.internal || 0), externalLinks:Number(links.external || 0), brokenInternalLinks:Number(links.brokenInternalObserved || 0),
      schemaTypes:Array.isArray(seo.schemaTypes) ? seo.schemaTypes.length : 0
    },
    headings:{
      h1:Number(headingTotals.h1 || 0), h2:Number(headingTotals.h2 || 0), h3:Number(headingTotals.h3 || 0),
      h4:Number(headingTotals.h4 || 0), h5:Number(headingTotals.h5 || 0), h6:Number(headingTotals.h6 || 0)
    },
    images:{
      references:Number(images.totalReferences || 0), uniqueAssets:Number(images.uniqueAssets || 0), missingAlt:Number(images.missingAlt || 0), emptyAlt:Number(images.emptyAlt || 0),
      missingDimensions:Number(images.missingDimensions || 0), lazy:Number(images.lazy || 0), srcset:Number(images.withSrcset || 0), over500kb:Number(images.oversized || 0),
      httpErrors:Number(images.broken || 0), knownBytes:Number(images.knownBytes || 0)
    },
    content:{
      words:Number(content.wordsTotal || 0), paragraphs:Number(content.paragraphsTotal || 0), sentences:Number(content.sentencesTotal || 0),
      ctas:Number(content.ctasDetected || 0), genericLinks:Number(content.genericAnchors || 0), thinPages:Number(content.thinPages?.length || 0)
    },
    performance:{
      mobile:{
        performance:finite(audit?.performance?.mobile?.categories?.performance), accessibility:finite(audit?.performance?.mobile?.categories?.accessibility), seo:finite(audit?.performance?.mobile?.categories?.seo),
        lcp:metricFromPerformance(audit,'mobile','lcp'), cls:metricFromPerformance(audit,'mobile','cls'), inp:metricFromPerformance(audit,'mobile','inp'), fcp:metricFromPerformance(audit,'mobile','fcp'), tbt:metricFromPerformance(audit,'mobile','tbt')
      },
      desktop:{
        performance:finite(audit?.performance?.desktop?.categories?.performance), accessibility:finite(audit?.performance?.desktop?.categories?.accessibility), seo:finite(audit?.performance?.desktop?.categories?.seo),
        lcp:metricFromPerformance(audit,'desktop','lcp'), cls:metricFromPerformance(audit,'desktop','cls'), inp:metricFromPerformance(audit,'desktop','inp'), fcp:metricFromPerformance(audit,'desktop','fcp'), tbt:metricFromPerformance(audit,'desktop','tbt')
      }
    },
    modules:audit?.modules || {}
  };
}

function delta(after, before, lowerIsBetter = false) {
  if (!Number.isFinite(after) || !Number.isFinite(before)) return null;
  const change = Number(after) - Number(before);
  return { before:Number(before), after:Number(after), change, improved:lowerIsBetter ? change < 0 : change > 0, unchanged:change === 0 };
}

export function compareAuditSnapshots(before, after) {
  const categoryKeys = [...new Set([...Object.keys(before?.scores?.categories || {}), ...Object.keys(after?.scores?.categories || {})])];
  return {
    before:{ id:before?.auditId || null, completedAt:before?.completedAt || null },
    after:{ id:after?.auditId || null, completedAt:after?.completedAt || null },
    scores:{ global:delta(after?.scores?.global, before?.scores?.global), categories:Object.fromEntries(categoryKeys.map((key) => [key, delta(after?.scores?.categories?.[key], before?.scores?.categories?.[key])])) },
    findings:{ total:delta(after?.coverage?.findingsTotal, before?.coverage?.findingsTotal, true), critical:delta(after?.severity?.critical, before?.severity?.critical, true), high:delta(after?.severity?.high, before?.severity?.high, true), medium:delta(after?.severity?.medium, before?.severity?.medium, true) },
    seo:{
      missingTitle:delta(after?.seo?.missingTitle, before?.seo?.missingTitle, true), duplicateTitles:delta(after?.seo?.duplicateTitles, before?.seo?.duplicateTitles, true),
      missingDescription:delta(after?.seo?.missingDescription, before?.seo?.missingDescription, true), missingCanonical:delta(after?.seo?.missingCanonical, before?.seo?.missingCanonical, true),
      missingH1:delta(after?.seo?.missingH1, before?.seo?.missingH1, true), brokenInternalLinks:delta(after?.seo?.brokenInternalLinks, before?.seo?.brokenInternalLinks, true)
    },
    performance:{
      mobile:{ score:delta(after?.performance?.mobile?.performance, before?.performance?.mobile?.performance), lcp:delta(after?.performance?.mobile?.lcp, before?.performance?.mobile?.lcp, true), cls:delta(after?.performance?.mobile?.cls, before?.performance?.mobile?.cls, true), inp:delta(after?.performance?.mobile?.inp, before?.performance?.mobile?.inp, true) },
      desktop:{ score:delta(after?.performance?.desktop?.performance, before?.performance?.desktop?.performance), lcp:delta(after?.performance?.desktop?.lcp, before?.performance?.desktop?.lcp, true), cls:delta(after?.performance?.desktop?.cls, before?.performance?.desktop?.cls, true), inp:delta(after?.performance?.desktop?.inp, before?.performance?.desktop?.inp, true) }
    }
  };
}
