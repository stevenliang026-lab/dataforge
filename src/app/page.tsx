"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";

/* ── Types ── */
type Format = "json" | "csv" | "tsv" | "yaml" | "xml";

const FORMAT_LABELS: Record<Format, string> = { json: "JSON", csv: "CSV", tsv: "TSV", yaml: "YAML", xml: "XML" };
const FORMAT_EXT: Record<Format, string> = { json: ".json", csv: ".csv", tsv: ".tsv", yaml: ".yaml", xml: ".xml" };

/* ── Sample Data ── */
const SAMPLES: Record<Format, string> = {
  json: `[
  { "name": "Alice", "age": 30, "city": "New York", "role": "Engineer", "active": true },
  { "name": "Bob", "age": 25, "city": "London", "role": "Designer", "active": false },
  { "name": "Carol", "age": 35, "city": "Tokyo", "role": "Manager", "active": true },
  { "name": "David", "age": 28, "city": "Paris", "role": "Developer", "active": true },
  { "name": "Eva", "age": 32, "city": "Berlin", "role": "Analyst", "active": false }
]`,
  csv: `name,age,city,role,active
Alice,30,New York,Engineer,true
Bob,25,London,Designer,false
Carol,35,Tokyo,Manager,true
David,28,Paris,Developer,true
Eva,32,Berlin,Analyst,false`,
  tsv: `name\tage\tcity\trole\tactive
Alice\t30\tNew York\tEngineer\ttrue
Bob\t25\tLondon\tDesigner\tfalse
Carol\t35\tTokyo\tManager\ttrue
David\t28\tParis\tDeveloper\ttrue
Eva\t32\tBerlin\tAnalyst\tfalse`,
  yaml: `- name: "Alice"
  age: 30
  city: "New York"
  role: "Engineer"
  active: true
- name: "Bob"
  age: 25
  city: "London"
  role: "Designer"
  active: false
- name: "Carol"
  age: 35
  city: "Tokyo"
  role: "Manager"
  active: true`,
  xml: `<records>
  <record>
    <name>Alice</name>
    <age>30</age>
    <city>New York</city>
    <role>Engineer</role>
    <active>true</active>
  </record>
  <record>
    <name>Bob</name>
    <age>25</age>
    <city>London</city>
    <role>Designer</role>
    <active>false</active>
  </record>
  <record>
    <name>Carol</name>
    <age>35</age>
    <city>Tokyo</city>
    <role>Manager</role>
    <active>true</active>
  </record>
</records>`,
};

/* ── Format Auto-Detection ── */
function detectFormat(text: string): Format | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try { JSON.parse(trimmed); return "json"; } catch { /* not json */ }
  }
  if (trimmed.startsWith("<")) return "xml";
  if (trimmed.startsWith("- ") || /^\w+:\s/.test(trimmed)) return "yaml";
  const firstLine = trimmed.split("\n")[0];
  if (firstLine.includes("\t") && firstLine.split("\t").length > 1) return "tsv";
  if (firstLine.includes(",") && firstLine.split(",").length > 1) return "csv";
  return null;
}

/* ── Parsers ── */
function parseCSVLike(text: string, delimiter: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(delimiter).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((v) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

function parseYAML(text: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("- ")) {
      if (current) items.push(current);
      current = {};
      const rest = trimmed.slice(2);
      const match = rest.match(/^(\w+):\s*(.*)$/);
      if (match) current[match[1]] = match[2].replace(/^"|"$/g, "");
    } else if (trimmed.includes(":") && current) {
      const match = trimmed.match(/^(\w+):\s*(.*)$/);
      if (match) current[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  }
  if (current) items.push(current);
  return items;
}

function parseXML(text: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  const recordRegex = /<record>([\s\S]*?)<\/record>/gi;
  let match;
  while ((match = recordRegex.exec(text)) !== null) {
    const content = match[1];
    const obj: Record<string, string> = {};
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(content)) !== null) {
      obj[fieldMatch[1]] = fieldMatch[2].trim();
    }
    items.push(obj);
  }
  return items;
}

/* ── Serializers ── */
function toCSVLike(data: Record<string, unknown>[], delimiter: string): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => {
    const v = String(row[h] ?? "");
    return v.includes(delimiter) || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(delimiter));
  return [headers.join(delimiter), ...rows].join("\n");
}

function toYAML(data: Record<string, unknown>[]): string {
  return data.map((item) => {
    const entries = Object.entries(item);
    return entries.map(([k, v], i) => {
      const val = typeof v === "string" ? `"${v}"` : String(v);
      return i === 0 ? `- ${k}: ${val}` : `  ${k}: ${val}`;
    }).join("\n");
  }).join("\n");
}

function toXML(data: Record<string, unknown>[]): string {
  const records = data.map((item) => {
    const fields = Object.entries(item).map(([k, v]) => `    <${k}>${String(v ?? "")}</${k}>`).join("\n");
    return `  <record>\n${fields}\n  </record>`;
  }).join("\n");
  return `<records>\n${records}\n</records>`;
}

/* ── Core Converter ── */
function convert(input: string, from: Format, to: Format): { result: string; error: string | null; rows: number } {
  try {
    let data: Record<string, unknown>[];
    switch (from) {
      case "json": data = JSON.parse(input); if (!Array.isArray(data)) data = [data]; break;
      case "csv": data = parseCSVLike(input, ","); break;
      case "tsv": data = parseCSVLike(input, "\t"); break;
      case "yaml": data = parseYAML(input); break;
      case "xml": data = parseXML(input); break;
    }

    let result: string;
    switch (to) {
      case "json": result = JSON.stringify(data, null, 2); break;
      case "csv": result = toCSVLike(data, ","); break;
      case "tsv": result = toCSVLike(data, "\t"); break;
      case "yaml": result = toYAML(data); break;
      case "xml": result = toXML(data); break;
    }
    return { result, error: null, rows: data.length };
  } catch (e) {
    return { result: "", error: e instanceof Error ? e.message : "Invalid input", rows: 0 };
  }
}

/* ── Syntax Highlighting (One Dark palette) ── */
// Keys/tags: #61afef (blue), Strings: #98c379 (green), Numbers: #d19a66 (orange),
// Booleans: #c678dd (purple), Null: #e06c75 (red), Punctuation: #56b6c2 (cyan)

function highlightJSON(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    const highlighted = line
      .replace(/"([^"]+)":/g, '<span style="color:#61afef">"$1"</span>:')
      .replace(/:\s*"([^"]*)"/g, ': <span style="color:#98c379">"$1"</span>')
      .replace(/:\s*(true|false)/g, ': <span style="color:#c678dd">$1</span>')
      .replace(/:\s*(\d+)/g, ': <span style="color:#d19a66">$1</span>')
      .replace(/:\s*(null)/g, ': <span style="color:#e06c75">$1</span>');
    return <div key={i} dangerouslySetInnerHTML={{ __html: highlighted || "&nbsp;" }} />;
  });
}

function highlightXML(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    const highlighted = line
      .replace(/(&lt;|<)(\/?\w+)(&gt;|>)/g, '<span style="color:#e06c75">&lt;$2&gt;</span>')
      .replace(/<span style="color:#e06c75">&lt;(\w+)&gt;<\/span>([^<]*)<span style="color:#e06c75">&lt;\/\1&gt;<\/span>/g,
        '<span style="color:#e06c75">&lt;$1&gt;</span><span style="color:#98c379">$2</span><span style="color:#e06c75">&lt;/$1&gt;</span>');
    return <div key={i} dangerouslySetInnerHTML={{ __html: highlighted || "&nbsp;" }} />;
  });
}

function highlightYAML(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    const highlighted = line
      .replace(/^(\s*-\s*)/, '<span style="color:#e06c75">$1</span>')
      .replace(/(\w+):/g, '<span style="color:#61afef">$1</span>:')
      .replace(/:\s*"([^"]*)"/g, ': <span style="color:#98c379">"$1"</span>')
      .replace(/:\s*(true|false)/g, ': <span style="color:#c678dd">$1</span>')
      .replace(/:\s*(\d+)$/g, ': <span style="color:#d19a66">$1</span>');
    return <div key={i} dangerouslySetInnerHTML={{ __html: highlighted || "&nbsp;" }} />;
  });
}

function highlightCSV(text: string, delimiter: string): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (i === 0) {
      return <div key={i} style={{ color: "#61afef", fontWeight: 600 }}>{line}</div>;
    }
    const cells = line.split(delimiter);
    return (
      <div key={i}>
        {cells.map((cell, j) => (
          <span key={j}>
            {j > 0 && <span style={{ color: "#4b5263" }}>{delimiter === "\t" ? "\u2192" : ","}</span>}
            <span style={{ color: j % 2 === 0 ? "#abb2bf" : "#98c379" }}>{cell}</span>
          </span>
        ))}
      </div>
    );
  });
}

function Highlighted({ text, format }: { text: string; format: Format }) {
  const nodes = useMemo(() => {
    switch (format) {
      case "json": return highlightJSON(text);
      case "xml": return highlightXML(text);
      case "yaml": return highlightYAML(text);
      case "csv": return highlightCSV(text, ",");
      case "tsv": return highlightCSV(text, "\t");
    }
  }, [text, format]);
  return <>{nodes}</>;
}

/* ── Table Preview ── */
function TablePreview({ data }: { data: Record<string, unknown>[] }) {
  if (data.length === 0) return <div className="text-center py-8 font-mono text-sm" style={{ color: "#4b5263" }}>-- empty result set --</div>;
  const headers = Object.keys(data[0]);

  return (
    <div className="overflow-auto max-h-80">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr style={{ borderBottom: "1px solid #2c313a" }}>
            <th className="px-3 py-2 text-left font-normal" style={{ color: "#4b5263" }}>#</th>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-normal" style={{ color: "#61afef" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="transition-colors" style={{ borderBottom: "1px solid #1e2127" }}>
              <td className="px-3 py-1.5" style={{ color: "#4b5263" }}>{i + 1}</td>
              {headers.map((h) => {
                const val = String(row[h] ?? "");
                const isNum = !isNaN(Number(val)) && val !== "";
                const isBool = val === "true" || val === "false";
                return (
                  <td key={h} className="px-3 py-1.5" style={{ color: isNum ? "#d19a66" : isBool ? "#c678dd" : "#abb2bf" }}>
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main ── */
export default function Home() {
  const [input, setInput] = useState(SAMPLES.json);
  const [fromFormat, setFromFormat] = useState<Format>("json");
  const [toFormat, setToFormat] = useState<Format>("csv");
  const [autoConvert, setAutoConvert] = useState(true);
  const [showTable, setShowTable] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<{ from: Format; to: Format; time: string; rows: number }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<Format | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { result: output, error, rows } = useMemo(() => convert(input, fromFormat, toFormat), [input, fromFormat, toFormat]);

  const parsedData = useMemo(() => {
    try {
      switch (fromFormat) {
        case "json": { const d = JSON.parse(input); return Array.isArray(d) ? d : [d]; }
        case "csv": return parseCSVLike(input, ",");
        case "tsv": return parseCSVLike(input, "\t");
        case "yaml": return parseYAML(input);
        case "xml": return parseXML(input);
      }
    } catch { return []; }
  }, [input, fromFormat]);

  useEffect(() => {
    const detected = detectFormat(input);
    setDetectedFormat(detected);
  }, [input]);

  const addHistory = useCallback(() => {
    if (!error) {
      setHistory((prev) => [
        { from: fromFormat, to: toFormat, time: new Date().toLocaleTimeString(), rows },
        ...prev.slice(0, 19),
      ]);
    }
  }, [fromFormat, toFormat, rows, error]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); addHistory(); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") { e.preventDefault(); handleDownload(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `converted.${toFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, toFormat]);

  const handleSwap = () => {
    setFromFormat(toFormat);
    setToFormat(fromFormat);
    setInput(output);
  };

  const handleLoadSample = () => setInput(SAMPLES[fromFormat]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setInput(text);
      const ext = file.name.split(".").pop()?.toLowerCase();
      const extMap: Record<string, Format> = { json: "json", csv: "csv", tsv: "tsv", yaml: "yaml", yml: "yaml", xml: "xml" };
      if (ext && extMap[ext]) {
        setFromFormat(extMap[ext]);
      } else {
        const detected = detectFormat(text);
        if (detected) setFromFormat(detected);
      }
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const inputLines = input.split("\n").length;
  const inputBytes = new Blob([input]).size;
  const outputLines = output.split("\n").length;
  const outputBytes = new Blob([output]).size;
  const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

  const allFormats: Format[] = ["json", "csv", "tsv", "yaml", "xml"];

  return (
    <div className="min-h-screen flex flex-col font-mono" style={{ background: "#0c0c0c", color: "#abb2bf" }}>

      {/* ── Title bar ── */}
      <header className="flex items-center justify-between px-4 py-2 select-none" style={{ background: "#16181d", borderBottom: "1px solid #2c313a" }}>
        <div className="flex items-center gap-3">
          <span style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, letterSpacing: "0.05em" }}>DATAFORGE</span>
          <span style={{ color: "#4b5263", fontSize: 11 }}>v1.0</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline" style={{ color: "#3e4451", fontSize: 11 }}>ctrl+enter convert | ctrl+shift+s save</span>
          <button onClick={handleLoadSample} className="transition-colors" style={{ color: "#4b5263", fontSize: 11 }} onMouseEnter={e => (e.currentTarget.style.color = "#abb2bf")} onMouseLeave={e => (e.currentTarget.style.color = "#4b5263")}>
            [sample]
          </button>
          <a href="https://github.com/stevenliang026-lab/dataforge" target="_blank" rel="noopener noreferrer" className="transition-colors" style={{ color: "#4b5263" }} onMouseEnter={e => (e.currentTarget.style.color = "#abb2bf")} onMouseLeave={e => (e.currentTarget.style.color = "#4b5263")}>
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
          </a>
        </div>
      </header>

      {/* ── Format selector bar (tabs) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-0" style={{ background: "#1b1d23", borderBottom: "1px solid #2c313a" }}>
        <div className="flex items-center">
          <span className="px-3 py-2 text-xs shrink-0" style={{ color: "#4b5263", minWidth: 40 }}>FROM</span>
          <div className="flex">
            {allFormats.map((f) => (
              <button
                key={`from-${f}`}
                onClick={() => setFromFormat(f)}
                className="relative px-3 py-2 text-xs transition-colors"
                style={{
                  color: fromFormat === f ? "#f59e0b" : "#4b5263",
                  background: fromFormat === f ? "#0c0c0c" : "transparent",
                  borderBottom: fromFormat === f ? "2px solid #f59e0b" : "2px solid transparent",
                }}
                onMouseEnter={e => { if (fromFormat !== f) e.currentTarget.style.color = "#abb2bf"; }}
                onMouseLeave={e => { if (fromFormat !== f) e.currentTarget.style.color = "#4b5263"; }}
              >
                {FORMAT_LABELS[f]}
                {detectedFormat === f && fromFormat !== f && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5" style={{ background: "#98c379" }} />
                )}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleSwap} className="px-3 py-2 transition-colors self-center" style={{ color: "#4b5263" }} onMouseEnter={e => (e.currentTarget.style.color = "#f59e0b")} onMouseLeave={e => (e.currentTarget.style.color = "#4b5263")} title="Swap formats">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </button>

        <div className="flex items-center">
          <span className="px-3 py-2 text-xs shrink-0" style={{ color: "#4b5263", minWidth: 24 }}>TO</span>
          <div className="flex">
            {allFormats.map((f) => (
              <button
                key={`to-${f}`}
                onClick={() => setToFormat(f)}
                className="px-3 py-2 text-xs transition-colors"
                style={{
                  color: toFormat === f ? "#f59e0b" : "#4b5263",
                  background: toFormat === f ? "#0c0c0c" : "transparent",
                  borderBottom: toFormat === f ? "2px solid #f59e0b" : "2px solid transparent",
                }}
                onMouseEnter={e => { if (toFormat !== f) e.currentTarget.style.color = "#abb2bf"; }}
                onMouseLeave={e => { if (toFormat !== f) e.currentTarget.style.color = "#4b5263"; }}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto px-3 py-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <div
              onClick={() => setAutoConvert(!autoConvert)}
              className="relative cursor-pointer"
              style={{ width: 28, height: 14, background: autoConvert ? "#f59e0b" : "#2c313a", borderRadius: 2 }}
            >
              <div className="absolute top-0.5 transition-transform" style={{ width: 10, height: 10, background: "#0c0c0c", borderRadius: 1, transform: autoConvert ? "translateX(16px)" : "translateX(2px)" }} />
            </div>
            <span className="text-xs" style={{ color: "#4b5263" }}>auto</span>
          </label>
          <button onClick={addHistory} className="px-3 py-1 text-xs transition-colors" style={{ color: "#0c0c0c", background: "#f59e0b", borderRadius: 1 }} onMouseEnter={e => (e.currentTarget.style.background = "#d97706")} onMouseLeave={e => (e.currentTarget.style.background = "#f59e0b")}>
            convert
          </button>
        </div>
      </div>

      {/* ── Detected format hint ── */}
      {detectedFormat && detectedFormat !== fromFormat && (
        <div className="px-4 py-1 flex items-center gap-2" style={{ background: "#1b1d23", borderBottom: "1px solid #2c313a" }}>
          <span style={{ color: "#4b5263", fontSize: 11 }}>detected:</span>
          <button
            onClick={() => setFromFormat(detectedFormat)}
            className="text-xs transition-colors"
            style={{ color: "#98c379" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#b5e890")}
            onMouseLeave={e => (e.currentTarget.style.color = "#98c379")}
          >
            {FORMAT_LABELS[detectedFormat]} -- click to apply
          </button>
        </div>
      )}

      {/* ── Split pane: input / output ── */}
      <main className="flex-1 flex flex-col lg:flex-row min-h-0">

        {/* Input pane */}
        <div
          className="flex-1 flex flex-col min-h-0 relative"
          style={{ borderRight: "1px solid #2c313a" }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Input pane header */}
          <div className="flex items-center justify-between px-3 py-1.5 shrink-0" style={{ background: "#16181d", borderBottom: "1px solid #2c313a" }}>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "#61afef" }}>input{FORMAT_EXT[fromFormat]}</span>
            </div>
            <div className="flex items-center gap-1">
              <input ref={fileInputRef} type="file" accept=".json,.csv,.tsv,.yaml,.yml,.xml,.txt" onChange={handleFileSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="px-2 py-0.5 text-xs transition-colors" style={{ color: "#4b5263" }} onMouseEnter={e => (e.currentTarget.style.color = "#abb2bf")} onMouseLeave={e => (e.currentTarget.style.color = "#4b5263")}>
                open
              </button>
              <span style={{ color: "#2c313a" }}>|</span>
              <button onClick={() => setInput("")} className="px-2 py-0.5 text-xs transition-colors" style={{ color: "#4b5263" }} onMouseEnter={e => (e.currentTarget.style.color = "#abb2bf")} onMouseLeave={e => (e.currentTarget.style.color = "#4b5263")}>
                clear
              </button>
            </div>
          </div>

          {/* Drag overlay */}
          {dragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: "rgba(12,12,12,0.9)" }}>
              <div className="text-center">
                <div className="text-sm" style={{ color: "#f59e0b" }}>drop file here</div>
                <div className="text-xs mt-1" style={{ color: "#4b5263" }}>.json .csv .tsv .yaml .xml</div>
              </div>
            </div>
          )}

          {/* Input editor */}
          <div className="flex-1 relative overflow-hidden" style={{ minHeight: 300 }}>
            <div className="absolute left-0 top-0 bottom-0 overflow-hidden pointer-events-none select-none" style={{ width: 40 }}>
              <div className="px-2 py-3 text-right text-xs leading-[1.625]" style={{ color: "#3e4451" }}>
                {Array.from({ length: inputLines }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-full py-3 pr-4 resize-none focus:outline-none text-xs leading-relaxed"
              style={{ background: "transparent", color: "#abb2bf", paddingLeft: 48, caretColor: "#f59e0b" }}
              placeholder={`paste ${FORMAT_LABELS[fromFormat]} data or drop a file...`}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Output pane */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Output pane header */}
          <div className="flex items-center justify-between px-3 py-1.5 shrink-0" style={{ background: "#16181d", borderBottom: "1px solid #2c313a" }}>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "#61afef" }}>output{FORMAT_EXT[toFormat]}</span>
              {error && <span className="text-xs" style={{ color: "#e06c75" }}>ERR</span>}
              {!error && rows > 0 && <span className="text-xs" style={{ color: "#4b5263" }}>{rows} records</span>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleCopy} disabled={!!error} className="px-2 py-0.5 text-xs transition-colors disabled:opacity-30" style={{ color: "#4b5263" }} onMouseEnter={e => { if (!error) e.currentTarget.style.color = "#abb2bf"; }} onMouseLeave={e => (e.currentTarget.style.color = "#4b5263")}>
                {copied ? "copied" : "copy"}
              </button>
              <span style={{ color: "#2c313a" }}>|</span>
              <button onClick={handleDownload} disabled={!!error} className="px-2 py-0.5 text-xs transition-colors disabled:opacity-30" style={{ color: "#4b5263" }} onMouseEnter={e => { if (!error) e.currentTarget.style.color = "#abb2bf"; }} onMouseLeave={e => (e.currentTarget.style.color = "#4b5263")}>
                save
              </button>
            </div>
          </div>

          {/* Output content */}
          {error ? (
            <div className="flex-1 flex items-center justify-center p-6" style={{ minHeight: 300 }}>
              <div className="text-center max-w-sm">
                <div className="text-xs mb-3" style={{ color: "#e06c75" }}>-- conversion error --</div>
                <pre className="text-xs whitespace-pre-wrap" style={{ color: "#abb2bf" }}>{error}</pre>
                <div className="text-xs mt-3" style={{ color: "#4b5263" }}>check that input is valid {FORMAT_LABELS[fromFormat]}</div>
              </div>
            </div>
          ) : (
            <div className="flex-1 relative overflow-hidden" style={{ minHeight: 300 }}>
              <div className="absolute left-0 top-0 bottom-0 overflow-hidden pointer-events-none select-none" style={{ width: 40 }}>
                <div className="px-2 py-3 text-right text-xs leading-[1.625]" style={{ color: "#3e4451" }}>
                  {Array.from({ length: outputLines }, (_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
              </div>
              <pre className="w-full h-full py-3 pr-4 text-xs overflow-auto whitespace-pre leading-relaxed" style={{ paddingLeft: 48 }}>
                <Highlighted text={output} format={toFormat} />
              </pre>
            </div>
          )}
        </div>
      </main>

      {/* ── Bottom panel: table / history ── */}
      <div style={{ borderTop: "1px solid #2c313a", background: "#16181d" }}>
        <div className="flex" style={{ borderBottom: "1px solid #2c313a" }}>
          <button
            onClick={() => setShowTable(true)}
            className="px-3 py-1.5 text-xs transition-colors"
            style={{
              color: showTable ? "#abb2bf" : "#4b5263",
              background: showTable ? "#0c0c0c" : "transparent",
              borderBottom: showTable ? "2px solid #f59e0b" : "2px solid transparent",
            }}
          >
            PREVIEW [{parsedData.length}]
          </button>
          <button
            onClick={() => setShowTable(false)}
            className="px-3 py-1.5 text-xs transition-colors"
            style={{
              color: !showTable ? "#abb2bf" : "#4b5263",
              background: !showTable ? "#0c0c0c" : "transparent",
              borderBottom: !showTable ? "2px solid #f59e0b" : "2px solid transparent",
            }}
          >
            HISTORY [{history.length}]
          </button>
        </div>

        <div className="p-2" style={{ background: "#0c0c0c", maxHeight: 220, overflowY: "auto" }}>
          {showTable ? (
            <TablePreview data={parsedData} />
          ) : history.length > 0 ? (
            <div className="space-y-0.5">
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-1 text-xs font-mono transition-colors" style={{ color: "#4b5263" }}>
                  <span style={{ color: "#3e4451", minWidth: 64 }}>{h.time}</span>
                  <span style={{ color: "#61afef" }}>{FORMAT_LABELS[h.from]}</span>
                  <span style={{ color: "#3e4451" }}>{"->"}</span>
                  <span style={{ color: "#98c379" }}>{FORMAT_LABELS[h.to]}</span>
                  <span style={{ color: "#3e4451" }}>{h.rows} records</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs py-4" style={{ color: "#3e4451" }}>no conversions recorded. press convert or ctrl+enter.</p>
          )}
        </div>
      </div>

      {/* ── Status bar ── */}
      <footer className="flex items-center justify-between px-3 py-1 text-xs select-none shrink-0" style={{ background: "#1b1d23", borderTop: "1px solid #2c313a", color: "#4b5263", fontSize: 11 }}>
        <div className="flex items-center gap-4">
          <span>{FORMAT_LABELS[fromFormat]} {"->"} {FORMAT_LABELS[toFormat]}</span>
          <span>{inputLines} ln</span>
          <span>{formatSize(inputBytes)}</span>
          {!error && rows > 0 && <span>{rows} records</span>}
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline">5 formats</span>
          <span className="hidden sm:inline">auto-detect</span>
          <span className="hidden sm:inline">drag-drop</span>
          <span className="hidden sm:inline">client-side</span>
          <span>&copy; {new Date().getFullYear()} DataForge</span>
        </div>
      </footer>
    </div>
  );
}
