function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  s = esc(s);
  s = s.replace(/`([^`\n]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s;
}

export function md(src: string): string {
  const lines = String(src).split("\n");
  let out = "";
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];
  let i = 0;

  const flushP = () => {
    if (para.length) {
      out += `<p>${inline(para.join("\n")).replace(/\n/g, "<br>")}</p>`;
      para = [];
    }
  };
  const flushL = () => {
    if (list) {
      out += `</${list}>`;
      list = null;
    }
  };

  while (i < lines.length) {
    const l = lines[i];

    if (/^\s*```/.test(l)) {
      flushP();
      flushL();
      const lang = l.replace(/^\s*```/, "").trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out += `<pre><div class="head"><span>${esc(lang || "code")}</span><button type="button" class="copy-code-btn" onclick="navigator.clipboard.writeText(this.closest('pre').querySelector('code').innerText)">Nusxalash</button></div><code>${esc(buf.join("\n"))}</code></pre>`;
      continue;
    }

    const h = l.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushP();
      flushL();
      const level = h[1].length;
      out += `<h${level}>${inline(h[2])}</h${level}>`;
      i++;
      continue;
    }

    const ul = l.match(/^\s*[-*+]\s+(.*)$/);
    const ol = l.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushP();
      const want: "ul" | "ol" = ul ? "ul" : "ol";
      if (list !== want) {
        flushL();
        out += `<${want}>`;
        list = want;
      }
      out += `<li>${inline((ul || ol)![1])}</li>`;
      i++;
      continue;
    }

    if (!l.trim()) {
      flushP();
      flushL();
      i++;
      continue;
    }

    flushL();
    para.push(l);
    i++;
  }
  flushP();
  flushL();
  return out || "<p></p>";
}
