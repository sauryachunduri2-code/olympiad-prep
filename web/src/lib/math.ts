import katex from 'katex';

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(text: string): string {
  return text
    .split(/(\$[^$]+\$)/g)
    .map((part) =>
      part.startsWith('$') && part.endsWith('$') && part.length > 1
        ? katex.renderToString(part.slice(1, -1), { throwOnError: true })
        : escapeHtml(part),
    )
    .join('');
}

/** Render stem or solution text: $...$ becomes KaTeX, lines starting "- " become a list. */
export function rich(text: string): string {
  const out: string[] = [];
  let items: string[] = [];
  const flush = () => {
    if (items.length) out.push(`<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`);
    items = [];
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('- ')) items.push(inline(line.slice(2)));
    else {
      flush();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  flush();
  return out.join('');
}

/** Render a short fragment (an answer choice) without a paragraph wrapper. */
export const richInline = inline;
