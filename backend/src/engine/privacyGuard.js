/**
 * PrivacyGuard detects and redacts sensitive credentials, secrets, and PII
 * before persisting conversation memory or forwarding prompts to an external LLM.
 */

const SENSITIVE_PATTERNS = [
  {
    label: 'API Key / Token',
    regex: /\b(sk-[a-zA-Z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|ghp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[0-9A-Za-z-]{10,})\b/g,
    replacement: '[REDACTED_SECRET_TOKEN]'
  },
  {
    label: 'Bearer Token',
    regex: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    replacement: 'Bearer [REDACTED_TOKEN]'
  },
  {
    label: 'Password / Secret Assignment',
    regex: /\b(password|passwd|pwd|secret|api_key|apikey|access_token|private_key)\s*[:=]\s*(['"]?)[^\s'"]{4,}\2/gi,
    replacement: '$1=[REDACTED_CREDENTIAL]'
  },
  {
    label: 'SSN',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[REDACTED_SSN]'
  },
  {
    label: 'Payment Card Number',
    regex: /\b(?:\d[ -]*?){13,16}\b/g,
    replacement: (match) => {
      const digits = match.replace(/\D/g, '');
      // Avoid redacting timestamps/IDs unless length is typical card length 13-16 and passes Luhn
      if (digits.length < 13 || digits.length > 16 || !passesLuhn(digits)) {
        return match;
      }
      return '[REDACTED_CARD_NUMBER]';
    }
  }
];

function passesLuhn(digits) {
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number.parseInt(digits[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * Redacts sensitive information from user input.
 * @param {string} text
 * @returns {{ sanitizedText: string, redacted: boolean, findings: string[] }}
 */
export function inspectAndRedact(text) {
  if (typeof text !== 'string' || !text) {
    return { sanitizedText: '', redacted: false, findings: [] };
  }

  let sanitizedText = text;
  const findingsSet = new Set();

  for (const rule of SENSITIVE_PATTERNS) {
    const before = sanitizedText;
    sanitizedText = sanitizedText.replace(rule.regex, rule.replacement);
    if (sanitizedText !== before) {
      findingsSet.add(rule.label);
    }
  }

  return {
    sanitizedText,
    redacted: findingsSet.size > 0,
    findings: Array.from(findingsSet)
  };
}
