/**
 * Input Sanitization Middleware
 * Protects against NoSQL Injection and XSS attacks
 */

// Recursive function to strip Mongo operator keys starting with '$'
const sanitizeNoSQL = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeNoSQL(item));
  }

  const cleaned = {};
  for (const key of Object.keys(obj)) {
    // Strip keys starting with '$' or containing '.' to prevent NoSQL query operator injection
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    cleaned[key] = sanitizeNoSQL(obj[key]);
  }
  return cleaned;
};

// Strip basic dangerous HTML script tags for XSS safety
const sanitizeXSSString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/onerror=/gi, '')
    .replace(/onload=/gi, '');
};

const sanitizeXSS = (obj) => {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string') return sanitizeXSSString(obj);
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeXSS(item));
  }

  const cleaned = {};
  for (const key of Object.keys(obj)) {
    cleaned[key] = sanitizeXSS(obj[key]);
  }
  return cleaned;
};

const sanitizeInput = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeXSS(sanitizeNoSQL(req.body));
  }
  if (req.query) {
    req.query = sanitizeXSS(sanitizeNoSQL(req.query));
  }
  if (req.params) {
    req.params = sanitizeXSS(sanitizeNoSQL(req.params));
  }
  next();
};

module.exports = sanitizeInput;
