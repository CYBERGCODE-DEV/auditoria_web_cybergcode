export const RULES = Object.freeze({
  seo: {
    missingTitle: { id: 'SEO-TITLE-001', severity: 'high', penalty: 8 },
    missingDescription: { id: 'SEO-DESC-001', severity: 'medium', penalty: 3 },
    missingH1: { id: 'SEO-H-001', severity: 'high', penalty: 6 },
    multipleH1: { id: 'SEO-H-002', severity: 'low', penalty: 1, type: 'advisory' },
    emptyHeading: { id: 'SEO-H-003', severity: 'medium', penalty: 2 },
    headingSkip: { id: 'SEO-H-004', severity: 'low', penalty: 1 },
    missingCanonical: { id: 'SEO-CAN-001', severity: 'low', penalty: 1 }
  },
  images: {
    missingAlt: { id: 'IMG-ALT-001', severity: 'medium', penalty: 2 },
    suspiciousAlt: { id: 'IMG-ALT-002', severity: 'low', penalty: 1 },
    missingDimensions: { id: 'IMG-DIM-001', severity: 'low', penalty: 1 }
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
    excessiveRedirects: { id: 'HTTP-REDIR-001', severity: 'medium', penalty: 3 }
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
