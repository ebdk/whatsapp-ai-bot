const BLOCKED_PATTERNS: RegExp[] = [
  /ignore\s+previous/gi,
  /system\s*:/gi,
  /assistant\s*:/gi,
  /forget\s+your\s+instructions/gi,
  /<\|im_start\|>/gi,
  /<[^>]+>/g
];

export interface SanitizeResult {
  sanitized: string;
  wasSanitized: boolean;
}

export function sanitizeInput(input: string, maxTokens: number): SanitizeResult {
  let sanitized = input;
  let wasSanitized = false;

  for (const pattern of BLOCKED_PATTERNS) {
    const next = sanitized.replace(pattern, '');
    if (next !== sanitized) {
      sanitized = next;
      wasSanitized = true;
    }
  }

  const tokens = sanitized.split(/\s+/).filter(Boolean);
  if (tokens.length > maxTokens) {
    sanitized = tokens.slice(0, maxTokens).join(' ');
    wasSanitized = true;
  }

  return { sanitized: sanitized.trim(), wasSanitized };
}
