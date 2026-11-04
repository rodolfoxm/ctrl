import { call } from '../lib/api.js';

// The subset of Markdown the release notes use: headings, lists (two levels), rules, quotes, **bold**,
// `code` and links. Everything becomes React elements, never raw HTML; links open in the browser
// through the main process, which only accepts https.

function inline(text, key) {
  const parts = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const k = `${key}-${m.index}`;
    if (m[1]) parts.push(<strong key={k}>{inline(m[1], k)}</strong>);
    else if (m[2]) parts.push(<code key={k}>{m[2]}</code>);
    else parts.push(<a key={k} href={m[4]} onClick={(e) => { e.preventDefault(); call('shell:open', m[4]); }}>{m[3]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function Markdown({ text }) {
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) blocks.push(<ul key={`ul-${blocks.length}`}>{list}</ul>);
    list = null;
  };
  text.replace(/\r/g, '').split('\n').forEach((line, i) => {
    const item = line.match(/^(\s*)[-*] (.+)$/);
    if (item) {
      list ??= [];
      list.push(<li key={i} className={item[1].length >= 2 ? 'sub' : undefined}>{inline(item[2], i)}</li>);
      return;
    }
    flush();
    const h = line.match(/^(#{2,4}) (.+)$/);
    if (h) blocks.push(<h5 key={i}>{inline(h[2], i)}</h5>);
    else if (/^-{3,}$/.test(line.trim())) blocks.push(<hr key={i} />);
    else if (line.startsWith('> ')) blocks.push(<blockquote key={i}>{inline(line.slice(2), i)}</blockquote>);
    else if (line.trim()) blocks.push(<p key={i}>{inline(line, i)}</p>);
  });
  flush();
  return <div className="md">{blocks}</div>;
}
