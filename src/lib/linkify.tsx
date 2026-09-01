import type { ReactNode } from "react";

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'\\]+/gi;

type TextPart =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

function countChar(value: string, char: string) {
  let n = 0;
  for (const c of value) if (c === char) n += 1;
  return n;
}

function peelTrailing(raw: string): { matched: string; trailing: string } {
  let matched = raw;
  let trailing = "";
  const punct = matched.match(/[.,;:!?]+$/);
  if (punct) {
    matched = matched.slice(0, -punct[0].length);
    trailing = punct[0];
  }
  while (
    matched.endsWith(")") &&
    countChar(matched, "(") < countChar(matched, ")")
  ) {
    trailing = `)${trailing}`;
    matched = matched.slice(0, -1);
  }
  while (
    matched.endsWith("]") &&
    countChar(matched, "[") < countChar(matched, "]")
  ) {
    trailing = `]${trailing}`;
    matched = matched.slice(0, -1);
  }
  return { matched, trailing };
}

function hrefForUrl(raw: string): string | null {
  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const { matched, trailing } = peelTrailing(match[0]);
    const href = hrefForUrl(matched);
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }
    if (href && matched) {
      parts.push({ type: "link", value: matched, href });
      if (trailing) parts.push({ type: "text", value: trailing });
    } else {
      parts.push({ type: "text", value: match[0] });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  return parts;
}

export function LinkifiedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const nodes: ReactNode[] = splitLinks(text).map((part, index) =>
    part.type === "link" ? (
      <a
        key={index}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all underline decoration-outline underline-offset-[3px] hover:decoration-on-surface"
      >
        {part.value}
      </a>
    ) : (
      part.value
    ),
  );
  return <p className={className}>{nodes}</p>;
}
