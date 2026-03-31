"use client";

import { useState, useCallback } from "react";

type Format = "json" | "csv" | "tsv" | "yaml";

const sampleJSON = `[
  { "name": "Alice", "age": 30, "city": "New York", "active": true },
  { "name": "Bob", "age": 25, "city": "London", "active": false },
  { "name": "Carol", "age": 35, "city": "Tokyo", "active": true },
  { "name": "David", "age": 28, "city": "Paris", "active": true },
  { "name": "Eva", "age": 32, "city": "Berlin", "active": false }
]`;

const sampleCSV = `name,age,city,active
Alice,30,New York,true
Bob,25,London,false
Carol,35,Tokyo,true
David,28,Paris,true
Eva,32,Berlin,false`;

/* ─── Conversion Logic ─── */
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

function toCSVLike(data: Record<string, unknown>[], delimiter: string): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) => headers.map((h) => String(row[h] ?? "")).join(delimiter));
  return [headers.join(delimiter), ...rows].join("\n");
}

function toYAML(data: Record<string, unknown>[]): string {
  return data
    .map((item, i) => {
      const entries = Object.entries(item)
        .map(([k, v]) => {
          const val = typeof v === "string" ? `"${v}"` : String(v);
          return `  ${k}: ${val}`;
        })
        .join("\n");
      return `${i === 0 ? "" : "\n"}- ${entries.trimStart().replace("  ", "")}
${entries.split("\n").slice(1).join("\n")}`;
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n");
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

function convert(input: string, from: Format, to: Format): string {
  try {
    let data: Record<string, unknown>[];

    // Parse input
    switch (from) {
      case "json":
        data = JSON.parse(input);
        if (!Array.isArray(data)) data = [data];
        break;
      case "csv":
        data = parseCSVLike(input, ",");
        break;
      case "tsv":
        data = parseCSVLike(input, "\t");
        break;
      case "yaml":
        data = parseYAML(input);
        break;
    }

    // Convert output
    switch (to) {
      case "json":
        return JSON.stringify(data, null, 2);
      case "csv":
        return toCSVLike(data, ",");
      case "tsv":
        return toCSVLike(data, "\t");
      case "yaml":
        return toYAML(data);
    }
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : "Invalid input format"}`;
  }
}

/* ─── Format Button ─── */
function FormatBtn({ format, active, onClick }: { format: Format; active: boolean; onClick: () => void }) {
  const labels: Record<Format, string> = { json: "JSON", csv: "CSV", tsv: "TSV", yaml: "YAML" };
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-orange-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
      }`}
    >
      {labels[format]}
    </button>
  );
}

/* ─── Page ─── */
export default function Home() {
  const [input, setInput] = useState(sampleJSON);
  const [fromFormat, setFromFormat] = useState<Format>("json");
  const [toFormat, setToFormat] = useState<Format>("csv");
  const [output, setOutput] = useState(() => convert(sampleJSON, "json", "csv"));
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<{ from: Format; to: Format; time: string }[]>([]);

  const handleConvert = useCallback(() => {
    const result = convert(input, fromFormat, toFormat);
    setOutput(result);
    setHistory((prev) => [
      { from: fromFormat, to: toFormat, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 9),
    ]);
  }, [input, fromFormat, toFormat]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleDownload = useCallback(() => {
    const ext: Record<Format, string> = { json: "json", csv: "csv", tsv: "tsv", yaml: "yaml" };
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `converted.${ext[toFormat]}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, toFormat]);

  const handleLoadSample = () => {
    if (fromFormat === "json") {
      setInput(sampleJSON);
    } else if (fromFormat === "csv") {
      setInput(sampleCSV);
    } else if (fromFormat === "tsv") {
      setInput(sampleCSV.replace(/,/g, "\t"));
    } else {
      setInput(convert(sampleJSON, "json", "yaml"));
    }
  };

  const handleSwap = () => {
    setFromFormat(toFormat);
    setToFormat(fromFormat);
    setInput(output);
    setOutput(input);
  };

  const inputLines = input.split("\n").length;
  const inputBytes = new Blob([input]).size;
  const outputLines = output.split("\n").length;
  const outputBytes = new Blob([output]).size;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="text-lg font-bold">DataForge</span>
            <span className="text-xs text-zinc-500 hidden sm:inline">Data Conversion Tool</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleLoadSample} className="text-xs text-zinc-500 hover:text-white transition-colors">
              Load Sample
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
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Format selectors */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 w-12">From:</span>
              <div className="flex gap-1.5">
                {(["json", "csv", "tsv", "yaml"] as Format[]).map((f) => (
                  <FormatBtn key={f} format={f} active={fromFormat === f} onClick={() => setFromFormat(f)} />
                ))}
              </div>
            </div>

            <button onClick={handleSwap} className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors shrink-0">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 w-12">To:</span>
              <div className="flex gap-1.5">
                {(["json", "csv", "tsv", "yaml"] as Format[]).map((f) => (
                  <FormatBtn key={f} format={f} active={toFormat === f} onClick={() => setToFormat(f)} />
                ))}
              </div>
            </div>

            <button onClick={handleConvert} className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-400 transition-colors ml-auto">
              Convert
            </button>
          </div>

          {/* Editor panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                <span className="text-sm font-medium text-zinc-400">Input ({fromFormat.toUpperCase()})</span>
                <span className="text-xs text-zinc-600">{inputLines} lines | {inputBytes} bytes</span>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full h-96 p-4 bg-transparent text-sm font-mono text-zinc-300 resize-none focus:outline-none placeholder-zinc-700"
                placeholder={`Paste your ${fromFormat.toUpperCase()} data here...`}
                spellCheck={false}
              />
            </div>

            {/* Output */}
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                <span className="text-sm font-medium text-zinc-400">Output ({toFormat.toUpperCase()})</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600">{outputLines} lines | {outputBytes} bytes</span>
                  <button onClick={handleCopy} className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button onClick={handleDownload} className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                    Download
                  </button>
                </div>
              </div>
              <pre className="w-full h-96 p-4 text-sm font-mono text-emerald-400 overflow-auto whitespace-pre">
                {output}
              </pre>
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">Conversion History</h3>
              <div className="flex flex-wrap gap-2">
                {history.map((h, i) => (
                  <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-500">
                    {h.from.toUpperCase()} → {h.to.toUpperCase()} at {h.time}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            {[
              { title: "Instant Conversion", desc: "Convert between JSON, CSV, TSV, and YAML in milliseconds. No server needed.", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
              { title: "Privacy First", desc: "All processing happens in your browser. Your data never leaves your device.", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
              { title: "Download & Share", desc: "Copy to clipboard or download the converted file. Works offline too.", icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" },
            ].map((f, i) => (
              <div key={i} className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-orange-400 mb-3">
                  <path d={f.icon} />
                </svg>
                <h4 className="font-semibold text-sm mb-1">{f.title}</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-4 text-center text-xs text-zinc-600">
        &copy; {new Date().getFullYear()} DataForge. Built by Steven Liang.
      </footer>
    </div>
  );
}
