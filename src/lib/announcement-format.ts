import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'li',
  'mark',
  'ol',
  'p',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
  'ul',
];

const ALLOWED_STYLE_PROPERTIES = new Set([
  'background-color',
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'text-align',
  'text-decoration',
]);

let hooksConfigured = false;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeInlineStyles(styleText: string) {
  return styleText
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const colonIndex = declaration.indexOf(':');
      if (colonIndex === -1) return null;

      const property = declaration.slice(0, colonIndex).trim().toLowerCase();
      const value = declaration.slice(colonIndex + 1).trim();
      if (!ALLOWED_STYLE_PROPERTIES.has(property)) return null;
      if (/url\s*\(/i.test(value) || /expression\s*\(/i.test(value)) return null;

      return `${property}: ${value}`;
    })
    .filter((declaration): declaration is string => Boolean(declaration))
    .join('; ');
}

function configureDomPurify() {
  if (hooksConfigured) return;

  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style') {
      const cleaned = sanitizeInlineStyles(data.attrValue || '');
      if (cleaned) {
        data.attrValue = cleaned;
      } else {
        data.keepAttr = false;
      }
    }

    if (data.attrName === 'target' && data.attrValue !== '_blank') {
      data.keepAttr = false;
    }
  });

  hooksConfigured = true;
}

function normalizePlainTextToHtml(input: string) {
  return input
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export function sanitizeAnnouncementHtml(input: string) {
  configureDomPurify();

  return DOMPurify.sanitize(input, {
    ALLOWED_ATTR: ['href', 'rel', 'style', 'target'],
    ALLOWED_TAGS,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style'],
  });
}

export function getAnnouncementHtml(input: string | null | undefined) {
  const trimmed = input?.trim();
  if (!trimmed) return '';

  const hasMarkup = /<\/?[a-z][\s\S]*>/i.test(trimmed);
  return sanitizeAnnouncementHtml(hasMarkup ? trimmed : normalizePlainTextToHtml(trimmed));
}