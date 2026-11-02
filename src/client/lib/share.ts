export interface ShareActivityInput {
  title: string;
  startsAt?: number | null;
  endsAt?: number | null;
  location?: string | null;
  description?: string | null;
  path: string;
  label?: string;
}

function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

export function formatActivityDate(startsAt?: number | null, endsAt?: number | null): string | null {
  if (!startsAt) return null;
  const start = new Date(startsAt * 1000);
  const date = new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(start);

  if (!endsAt) return date;
  const end = new Date(endsAt * 1000);
  const sameDay = start.toDateString() === end.toDateString();
  if (!sameDay) return date;
  const endTime = new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(end);
  return date + ' – ' + endTime;
}

export function shareWhatsAppText(title: string, body: string, path: string): void {
  const url = absoluteUrl(path);
  const text = '🐉 *SkF · ' + title + '*' + (body ? '\n' + body : '') + '\n\n' + url;
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
}

export function shareActivityWhatsApp(input: ShareActivityInput): void {
  const lines: string[] = [];
  const when = formatActivityDate(input.startsAt, input.endsAt);
  if (when) lines.push('📅 ' + when);
  if (input.location) lines.push('📍 ' + input.location);
  if (input.description) lines.push('', input.description.trim());
  shareWhatsAppText(input.label || input.title, lines.join('\n'), input.path);
}


export async function sharePlayerProfile(input: {
  name: string;
  rank?: string | null;
  elo?: number | null;
  path: string;
}): Promise<void> {
  const url = absoluteUrl(input.path);
  const parts = [input.rank || null, input.elo != null ? `ELO ${Math.round(input.elo)}` : null].filter(Boolean);
  const text = `🐉 ${input.name} · SkF Clan${parts.length ? ' · ' + parts.join(' · ') : ''}`;

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `${input.name} · SkF Clan`, text, url });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  window.open(
    'https://wa.me/?text=' + encodeURIComponent(text + '\n\n' + url),
    '_blank',
    'noopener,noreferrer',
  );
}
