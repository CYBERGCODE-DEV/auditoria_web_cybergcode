export const RULES = Object.freeze({
  seo: {
    missingTitle: { id: 'SEO-TITLE-001', severity: 'high', penalty: 8 },
    missingDescription: { id: 'SEO-DESC-001', severity: 'medium', penalty: 3 },
    missingH1: { id: 'SEO-H-001', severity: 'high', penalty: 6 },
    multipleH1: { id: 'SEO-H-002', severity: 'low', penalty: 1, type: 'advisory' },
    emptyHeading: { id: 'SEO-H-003', severity: 'medium', penalty: 2 },
    headingSkip: { id: 'SEO-H-004', severity: 'low', penalty: 1 },
    missingCanonical: { id: 'SEO-CAN-001', severity: 'low', penalty: 1 },
    duplicateTitle: { id: 'SEO-TITLE-002', severity: 'medium', penalty: 3 },
    duplicateDescription: { id: 'SEO-DESC-002', severity: 'low', penalty: 1, type: 'advisory' },
    duplicateH1: { id: 'SEO-H-005', severity: 'low', penalty: 1, type: 'advisory' },
    missingLang: { id: 'SEO-LANG-001', severity: 'low', penalty: 1, type: 'advisory' },
    missingViewport: { id: 'TECH-VIEWPORT-001', severity: 'medium', penalty: 2 },
    externalCanonical: { id: 'SEO-CAN-002', severity: 'medium', penalty: 2, type: 'advisory' }
  },
  images: {
    missingAlt: { id: 'IMG-ALT-001', severity: 'medium', penalty: 2 },
    suspiciousAlt: { id: 'IMG-ALT-002', severity: 'low', penalty: 1 },
    missingDimensions: { id: 'IMG-DIM-001', severity: 'low', penalty: 1 },
    renderedOversize: { id: 'IMG-DIM-002', severity: 'low', penalty: 1, type: 'advisory' },
    brokenAsset: { id: 'IMG-BROKEN-001', severity: 'high', penalty: 6 },
    oversized: { id: 'IMG-WEIGHT-001', severity: 'medium', penalty: 2, type: 'advisory' },
    modernFormat: { id: 'IMG-FORMAT-001', severity: 'low', penalty: 1, type: 'advisory' }
  },
  content: {
    thinContent: { id: 'CONTENT-THIN-001', severity: 'low', penalty: 1, type: 'advisory' },
    longSentences: { id: 'CONTENT-READ-001', severity: 'low', penalty: 1, type: 'advisory' },
    genericAnchors: { id: 'CONTENT-LINK-001', severity: 'low', penalty: 1, type: 'advisory' },
    titleH1Alignment: { id: 'CONTENT-ALIGN-001', severity: 'low', penalty: 1, type: 'advisory' },
    duplicateParagraph: { id: 'CONTENT-DUP-001', severity: 'low', penalty: 1, type: 'advisory' }
  },
  security: {
    httpOnly: { id: 'SEC-HTTPS-001', severity: 'critical', penalty: 18 },
    missingHsts: { id: 'SEC-HSTS-001', severity: 'medium', penalty: 3 },
    missingCsp: { id: 'SEC-CSP-001', severity: 'high', penalty: 8 },
    missingNosniff: { id: 'SEC-NOSNIFF-001', severity: 'medium', penalty: 3 },
    missingReferrer: { id: 'SEC-REF-001', severity: 'low', penalty: 1 },
    missingPermissions: { id: 'SEC-PERM-001', severity: 'low', penalty: 1 },
    serverDisclosure: { id: 'SEC-DISC-001', severity: 'low', penalty: 1 },
    mixedContent: { id: 'SEC-MIXED-001', severity: 'high', penalty: 8 }
  },
  technical: {
    serverError: { id: 'HTTP-5XX-001', severity: 'critical', penalty: 18 },
    clientError: { id: 'HTTP-4XX-001', severity: 'high', penalty: 8 },
    excessiveRedirects: { id: 'HTTP-REDIR-001', severity: 'medium', penalty: 3 },
    runtimeErrors: { id: 'DOM-JS-001', severity: 'medium', penalty: 3 },
    clientRenderedMeta: { id: 'DOM-META-001', severity: 'low', penalty: 1, type: 'advisory' },
    clientRenderedStructure: { id: 'DOM-STRUCT-001', severity: 'low', penalty: 1, type: 'advisory' },
    inlineStyles: { id: 'CSS-INLINE-001', severity: 'low', penalty: 1, type: 'advisory' },
    unusedCss: { id: 'CSS-UNUSED-001', severity: 'low', penalty: 1, type: 'advisory' },
    fontSprawl: { id: 'CSS-FONT-001', severity: 'low', penalty: 1, type: 'advisory' }
  },
  accessibility: {
    contrast: { id: 'A11Y-CONTRAST-AA', severity: 'high', penalty: 8 },
    horizontalOverflow: { id: 'A11Y-REFLOW-001', severity: 'medium', penalty: 3 },
    targetSize: { id: 'A11Y-TARGET-001', severity: 'low', penalty: 1, type: 'advisory' },
    focusStyleReview: { id: 'A11Y-FOCUS-001', severity: 'low', penalty: 1, type: 'advisory' }
  },
  performance: {
    lcp: { id: 'PERF-LCP-001', severity: 'high', penalty: 8 },
    cls: { id: 'PERF-CLS-001', severity: 'high', penalty: 8 },
    tbt: { id: 'PERF-TBT-001', severity: 'medium', penalty: 3 },
    inp: { id: 'PERF-INP-001', severity: 'high', penalty: 8 },
    longTasks: { id: 'PERF-LONGTASK-001', severity: 'medium', penalty: 3, type: 'advisory' },
    ttfb: { id: 'PERF-TTFB-001', severity: 'medium', penalty: 3, type: 'advisory' }
  },
  ux: {
    noPrimaryCta: { id: 'UX-CTA-001', severity: 'low', penalty: 1, type: 'advisory' },
    longForm: { id: 'UX-FORM-001', severity: 'medium', penalty: 3, type: 'advisory' },
    unlabeledFormControls: { id: 'UX-FORM-LABEL-001', severity: 'medium', penalty: 3 },
    genericLinks: { id: 'UX-LINK-001', severity: 'low', penalty: 1, type: 'advisory' },
    missingContactChannel: { id: 'UX-TRUST-001', severity: 'low', penalty: 1, type: 'advisory' },
    deepPage: { id: 'UX-NAV-001', severity: 'low', penalty: 1, type: 'advisory' }
  },
  compliance: {
    missingPrivacyNotice: { id: 'ISO-29184-PRIVACY-001', severity: 'high', penalty: 5 },
    missingConsentSignal: { id: 'ISO-29184-CONSENT-001', severity: 'medium', penalty: 3, type: 'advisory' },
    missingVulnerabilityDisclosure: { id: 'ISO-29147-VDP-001', severity: 'low', penalty: 0, type: 'advisory' },
    missingClaimsBook: { id: 'PE-CONSUMER-LR-001', severity: 'high', penalty: 5, type: 'advisory' },
    privacyPolicyMissing: { id: 'PE-PRIVACY-001', severity: 'high', penalty: 5, type: 'advisory' },
    trackingConsentReview: { id: 'PE-COOKIE-001', severity: 'medium', penalty: 2, type: 'advisory' },
    darkPatternReview: { id: 'PE-CONSUMER-DARK-001', severity: 'medium', penalty: 2, type: 'advisory' }
  },
  infrastructure: {
    tlsInvalid: { id: 'INFRA-TLS-001', severity: 'critical', penalty: 18 },
    tlsExpired: { id: 'INFRA-TLS-002', severity: 'critical', penalty: 18 },
    tlsExpiring: { id: 'INFRA-TLS-003', severity: 'medium', penalty: 3, type: 'advisory' },
    domainExpired: { id: 'INFRA-DOMAIN-001', severity: 'critical', penalty: 18 },
    domainExpiring: { id: 'INFRA-DOMAIN-002', severity: 'high', penalty: 6, type: 'advisory' },
    missingCaa: { id: 'INFRA-DNS-CAA-001', severity: 'low', penalty: 1, type: 'advisory' },
    missingDnssec: { id: 'INFRA-DNSSEC-001', severity: 'low', penalty: 1, type: 'advisory' },
    missingSpf: { id: 'INFRA-MAIL-SPF-001', severity: 'medium', penalty: 3 },
    missingDmarc: { id: 'INFRA-MAIL-DMARC-001', severity: 'high', penalty: 6 },
    dkimEvidence: { id: 'INFRA-MAIL-DKIM-001', severity: 'info', penalty: 0, type: 'advisory' },
    insecureSessionCookie: { id: 'INFRA-COOKIE-SECURE-001', severity: 'high', penalty: 6 },
    missingHttpOnly: { id: 'INFRA-COOKIE-HTTPONLY-001', severity: 'medium', penalty: 3 },
    missingSameSite: { id: 'INFRA-COOKIE-SAMESITE-001', severity: 'medium', penalty: 2, type: 'advisory' },
    thirdPartyTracking: { id: 'INFRA-TRACKER-001', severity: 'medium', penalty: 1, type: 'advisory' }
  }
});

export const CATEGORY_WEIGHTS = Object.freeze({
  security: 0.20,
  performance: 0.18,
  seo: 0.15,
  content: 0.12,
  accessibility: 0.12,
  ux: 0.08,
  images: 0.05,
  technical: 0.05,
  compliance: 0.05
});
