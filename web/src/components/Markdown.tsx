import { type ReactNode } from "react";

/**
 * A small, dependency-free, safe Markdown renderer for viewing skill/rule/memory content. Handles the
 * subset that shows up in Claude config — frontmatter, headings, lists, code fences, blockquotes, and
 * inline code/bold/italic. Builds React nodes (text is auto-escaped), so no HTML injection risk.
 */
export function Markdown({ text }: { text: string }) {
  return <div className="md">{render(text)}</div>;
}

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("`")) nodes.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function render(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const k = () => `b${key++}`;

  // optional YAML-ish frontmatter
  if (lines[0]?.trim() === "---") {
    const buf: string[] = [];
    i = 1;
    while (i < lines.length && lines[i].trim() !== "---") buf.push(lines[i++]);
    i++; // closing ---
    out.push(
      <pre key={k()} className="md-frontmatter">
        {buf.join("\n")}
      </pre>,
    );
  }

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (line.trim().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) buf.push(lines[i++]);
      i++; // closing fence
      out.push(
        <pre key={k()} className="md-code">
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(h[1].length, 4);
      const Tag = (["h2", "h2", "h3", "h4"][level - 1] ?? "h4") as "h2" | "h3" | "h4";
      out.push(<Tag key={k()}>{inline(h[2], k())}</Tag>);
      i++;
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push(<hr key={k()} />);
      i++;
      continue;
    }

    // blockquote
    if (line.trim().startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(
        <blockquote key={k()}>{inline(buf.join(" "), k())}</blockquote>,
      );
      continue;
    }

    // lists (unordered / ordered)
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ul || ol) {
      const ordered = !!ol;
      const itemsBuf: string[] = [];
      while (i < lines.length) {
        const m2 = ordered
          ? lines[i].match(/^\s*\d+\.\s+(.*)$/)
          : lines[i].match(/^\s*[-*]\s+(.*)$/);
        if (!m2) break;
        itemsBuf.push(m2[1]);
        i++;
      }
      const lis = itemsBuf.map((t, idx) => <li key={idx}>{inline(t, `${k()}-${idx}`)}</li>);
      out.push(ordered ? <ol key={k()}>{lis}</ol> : <ul key={k()}>{lis}</ul>);
      continue;
    }

    // blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // paragraph (gather consecutive non-blank, non-special lines)
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(">") &&
      !lines[i].match(/^\s*[-*]\s+/) &&
      !lines[i].match(/^\s*\d+\.\s+/)
    ) {
      buf.push(lines[i++]);
    }
    out.push(<p key={k()}>{inline(buf.join(" "), k())}</p>);
  }

  return out;
}
