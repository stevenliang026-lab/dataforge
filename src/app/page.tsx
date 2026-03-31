"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";

/* ─── Types ─── */
type Format = "json" | "csv" | "tsv" | "yaml" | "xml";

const FORMAT_LABELS: Record<Format, string> = { json: "JSON", csv: "CSV", tsv: "TSV", yaml: "YAML", xml: "XML" };
const FORMAT_COLORS: Record<Format, string> = {
  json: "text-yellow-400",
  csv: "text-emerald-400",
  tsv: "text-cyan-400",
  yaml: "text-purple-400",
  xml: "text-orange-400",
};

/* ─── Sample Data ─── */
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

/* ─── Format Auto-Detection ─── */
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

/* ─── Parsers ─── */
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

/* ─── Serializers ─── */
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
    return entries.map(([ k, v ], i) => {
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

/* ─── Core Converter ─── */
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

/* ─── Syntax Highlighting ─── */
function highlightJSON(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    const highlighted = line
      .replace(/"([^"]+)":/g, '<span class="text-blue-400">"$1"</span>:')
      .replace(/:\s*"([^"]*)"/g, ': <span class="text-emerald-400">"$1"</span>')
      .replace(/:\s*(true|false)/g, ': <span class="text-purple-400">$1</span>')
      .replace(/:\s*(\d+)/g, ': <span class="text-orange-400">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="text-red-400">$1</span>');
    return <div key={i} dangerouslySetInnerHTML={{ __html: highlighted || "&nbsp;" }} />;
  });
}

function highlightXML(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    const highlighted = line
      .replace(/(&lt;|<)(\/?\w+)(&gt;|>)/g, '<span class="text-red-400">&lt;$2&gt;</span>')
      .replace(/<span class="text-red-400">&lt;(\w+)&gt;<\/span>([^<]*)<span class="text-red-400">&lt;\/\1&gt;<\/span>/g,
        '<span class="text-red-400">&lt;$1&gt;</span><span class="text-emerald-400">$2</span><span class="text-red-400">&lt;/$1&gt;</span>');
    return <div key={i} dangerouslySetInnerHTML={{ __html: highlighted || "&nbsp;" }} />;
  });
}

function highlightYAML(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    const highlighted = line
      .replace(/^(\s*-\s*)/, '<span class="text-red-400">$1</span>')
      .replace(/(\w+):/g, '<span class="text-blue-400">$1</span>:')
      .replace(/:\s*"([^"]*)"/g, ': <span class="text-emerald-400">"$1"</span>')
      .replace(/:\s*(true|false)/g, ': <span class="text-purple-400">$1</span>')
      .replace(/:\s*(\d+)$/g, ': <span class="text-orange-400">$1</span>');
    return <div key={i} dangerouslySetInnerHTML={{ __html: highlighted || "&nbsp;" }} />;
  });
}

function highlightCSV(text: string, delimiter: string): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (i === 0) {
      return <div key={i} className="text-blue-400 font-semibold">{line}</div>;
    }
    const cells = line.split(delimiter);
    return (
      <div key={i}>
        {cells.map((cell, j) => (
          <span key={j}>
            {j > 0 && <span className="text-zinc-600">{delimiter === "\t" ? "→" : ","}</span>}
            <span className={j % 2 === 0 ? "text-zinc-300" : "text-emerald-400/80"}>{cell}</span>
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

/* ─── Table Preview ─── */
function TablePreview({ data }: { data: Record<string, unknown>[] }) {
  if (data.length === 0) return <div className="text-center text-zinc-500 py-8">No data to preview</div>;
  const headers = Object.keys(data[0]);

  return (
    <div className="overflow-auto max-h-80">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-700">
            <th className="px-3 py-2 text-left text-xs text-zinc-500 font-medium">#</th>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs text-zinc-400 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="px-3 py-2 text-xs text-zinc-600">{i + 1}</td>
              {headers.map((h) => {
                const val = String(row[h] ?? "");
                const isNum = !isNaN(Number(val)) && val !== "";
                const isBool = val === "true" || val === "false";
                return (
                  <td key={h} className={`px-3 py-2 text-xs ${isNum ? "text-orange-400" : isBool ? "text-purple-400" : "text-zinc-300"}`}>
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

/* ─── Format Button ─── */
function FormatBtn({ format, active, onClick, detected }: { format: Format; active: boolean; onClick: () => void; detected?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
          : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
      }`}
    >
      {FORMAT_LABELS[format]}
      {detected && !active && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      )}
    </button>
  );
}

/* ─── Main Page ─── */
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

  // Convert
  const { result: output, error, rows } = useMemo(() => convert(input, fromFormat, toFormat), [input, fromFormat, toFormat]);

  // Parse for table preview
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

  // Auto-detect format on input change
  useEffect(() => {
    const detected = detectFormat(input);
    setDetectedFormat(detected);
  }, [input]);

  // Track conversions
  const addHistory = useCallback(() => {
    if (!error) {
      setHistory((prev) => [
        { from: fromFormat, to: toFormat, time: new Date().toLocaleTimeString(), rows },
        ...prev.slice(0, 19),
      ]);
    }
  }, [fromFormat, toFormat, rows, error]);

  // Keyboard shortcuts
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

  // Drag & Drop
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
      // Auto-detect format from extension or content
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold">DataForge</span>
              <span className="text-xs text-zinc-500 ml-2 hidden sm:inline">Universal Data Converter</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-600 hidden sm:inline">Ctrl+Enter: Convert | Ctrl+Shift+S: Download</span>
            <button onClick={handleLoadSample} className="text-xs text-zinc-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-zinc-800">
              Sample Data
            </button>
            <a href="https://github.com/stevenliang026-lab/dataforge" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Controls bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500 font-medium w-10">From</span>
              {(["json", "csv", "tsv", "yaml", "xml"] as Format[]).map((f) => (
                <FormatBtn key={f} format={f} active={fromFormat === f} onClick={() => setFromFormat(f)} detected={detectedFormat === f && fromFormat !== f} />
              ))}
            </div>

            <button onClick={handleSwap} className="w-9 h-9 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800 transition-all shrink-0 self-center">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500 font-medium w-10">To</span>
              {(["json", "csv", "tsv", "yaml", "xml"] as Format[]).map((f) => (
                <FormatBtn key={f} format={f} active={toFormat === f} onClick={() => setToFormat(f)} />
              ))}
            </div>

            <div className="flex items-center gap-3 sm:ml-auto">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setAutoConvert(!autoConvert)}
                  className={`w-8 h-4.5 rounded-full relative transition-colors cursor-pointer ${autoConvert ? "bg-orange-500" : "bg-zinc-700"}`}
                  style={{ width: 32, height: 18 }}
                >
                  <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform shadow ${autoConvert ? "translate-x-[15px]" : "translate-x-0.5"}`} />
                </div>
                <span className="text-xs text-zinc-400">Auto</span>
              </label>
              <button onClick={addHistory} className="px-5 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-400 transition-all shadow-lg shadow-orange-500/20 text-sm">
                Convert
              </button>
            </div>
          </div>

          {/* Editor panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input panel */}
            <div
              className={`rounded-xl bg-zinc-900 border overflow-hidden transition-colors ${dragging ? "border-orange-500 bg-orange-500/5" : "border-zinc-800"}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${FORMAT_COLORS[fromFormat]}`}>
                    {FORMAT_LABELS[fromFormat]}
                  </span>
                  {detectedFormat && detectedFormat !== fromFormat && (
                    <button
                      onClick={() => setFromFormat(detectedFormat)}
                      className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      Detected: {FORMAT_LABELS[detectedFormat]}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600">{inputLines} lines | {formatSize(inputBytes)}</span>
                  <input ref={fileInputRef} type="file" accept=".json,.csv,.tsv,.yaml,.yml,.xml,.txt" onChange={handleFileSelect} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                    Open File
                  </button>
                  <button onClick={() => setInput("")} className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                    Clear
                  </button>
                </div>
              </div>

              {dragging ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="text-center">
                    <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="mx-auto text-orange-400 mb-3">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    <p className="text-orange-400 font-medium">Drop your file here</p>
                    <p className="text-xs text-zinc-500 mt-1">JSON, CSV, TSV, YAML, or XML</p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {/* Line numbers */}
                  <div className="absolute left-0 top-0 w-10 h-96 overflow-hidden pointer-events-none">
                    <div className="p-4 pr-2 text-right font-mono text-xs text-zinc-700 leading-[1.625]">
                      {Array.from({ length: inputLines }, (_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="w-full h-96 pl-12 pr-4 py-4 bg-transparent text-sm font-mono text-zinc-300 resize-none focus:outline-none placeholder-zinc-700 leading-relaxed"
                    placeholder={`Paste your ${FORMAT_LABELS[fromFormat]} data here, or drag & drop a file...`}
                    spellCheck={false}
                  />
                </div>
              )}
            </div>

            {/* Output panel */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${FORMAT_COLORS[toFormat]}`}>
                    {FORMAT_LABELS[toFormat]}
                  </span>
                  {error && <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400">Error</span>}
                  {!error && rows > 0 && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{rows} records</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600">{outputLines} lines | {formatSize(outputBytes)}</span>
                  <button onClick={handleCopy} disabled={!!error} className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-30">
                    {copied ? "\u2713 Copied" : "Copy"}
                  </button>
                  <button onClick={handleDownload} disabled={!!error} className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-30">
                    Download
                  </button>
                </div>
              </div>

              {error ? (
                <div className="h-96 flex items-center justify-center p-6">
                  <div className="text-center max-w-md">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                      <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-red-400">
                        <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                      </svg>
                    </div>
                    <p className="text-red-400 font-medium text-sm mb-2">Conversion Error</p>
                    <p className="text-xs text-zinc-500 leading-relaxed">{error}</p>
                    <p className="text-xs text-zinc-600 mt-3">Check that your input is valid {FORMAT_LABELS[fromFormat]}</p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {/* Line numbers */}
                  <div className="absolute left-0 top-0 w-10 h-96 overflow-hidden pointer-events-none">
                    <div className="p-4 pr-2 text-right font-mono text-xs text-zinc-700 leading-[1.625]">
                      {Array.from({ length: outputLines }, (_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                  </div>
                  <pre className="w-full h-96 pl-12 pr-4 py-4 text-sm font-mono overflow-auto whitespace-pre leading-relaxed">
                    <Highlighted text={output} format={toFormat} />
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Data Preview / History toggle */}
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setShowTable(true)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${showTable ? "text-white border-b-2 border-orange-500" : "text-zinc-500 hover:text-white"}`}
              >
                Data Preview ({parsedData.length} rows)
              </button>
              <button
                onClick={() => setShowTable(false)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${!showTable ? "text-white border-b-2 border-orange-500" : "text-zinc-500 hover:text-white"}`}
              >
                History ({history.length})
              </button>
            </div>

            <div className="p-4">
              {showTable ? (
                <TablePreview data={parsedData} />
              ) : history.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-auto">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
                      <span className="text-xs text-zinc-600 w-20">{h.time}</span>
                      <span className={`text-xs font-medium ${FORMAT_COLORS[h.from]}`}>{FORMAT_LABELS[h.from]}</span>
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-zinc-600"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                      <span className={`text-xs font-medium ${FORMAT_COLORS[h.to]}`}>{FORMAT_LABELS[h.to]}</span>
                      <span className="text-xs text-zinc-600">{h.rows} records</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-zinc-600 text-sm py-6">No conversions yet. Press Convert or Ctrl+Enter to start.</p>
              )}
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[
              { title: "5 Formats", desc: "JSON, CSV, TSV, YAML, XML", icon: "M4 6h16M4 12h16M4 18h16", color: "orange" },
              { title: "Auto-Detect", desc: "Smart format recognition", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", color: "emerald" },
              { title: "Drag & Drop", desc: "Drop files to convert", icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12", color: "cyan" },
              { title: "Privacy First", desc: "100% client-side", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", color: "purple" },
            ].map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors group">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className={`text-${f.color}-400 mb-2 group-hover:scale-110 transition-transform`}>
                  <path d={f.icon} />
                </svg>
                <h4 className="font-semibold text-xs mb-0.5">{f.title}</h4>
                <p className="text-[11px] text-zinc-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-3 text-center text-xs text-zinc-600">
        &copy; {new Date().getFullYear()} DataForge. Built by Steven Liang. All processing happens in your browser.
      </footer>
    </div>
  );
}
