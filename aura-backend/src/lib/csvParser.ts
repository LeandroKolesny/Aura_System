import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Detecta encoding do arquivo CSV e decodifica corretamente.
// Excel no Windows salva como Windows-1252; arquivos modernos usam UTF-8 com ou sem BOM.
export async function decodeCSVFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Detecta UTF-8 BOM (EF BB BF) — remove antes de decodificar
  const hasBom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;
  const sliced = hasBom ? buffer.slice(3) : buffer;

  // TextDecoder com fatal:false substitui bytes inválidos por U+FFFD (replacement char)
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(sliced);

  // Se não há replacement char, o arquivo é UTF-8 válido
  if (!utf8.includes('�')) return utf8;

  // Fallback: Windows-1252 (padrão do Excel em pt-BR sem BOM)
  try {
    return new TextDecoder('windows-1252').decode(sliced);
  } catch {
    return utf8;
  }
}

// Faz parse do CSV usando papaparse — detecta delimitador (`,` ou `;`) automaticamente,
// ignora a linha `sep=` do Excel, remove BOM e normaliza headers para lowercase.
export function parseCSV(text: string): Record<string, string>[] {
  // Remove diretiva sep= que o Excel adiciona (ex: "sep=;")
  const cleaned = text.replace(/^sep=.*[\r\n]+/im, '');

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    delimiter: '',        // auto-detect: papaparse detecta , ; \t automaticamente
    transformHeader: (h) => h.trim().toLowerCase().replace(/﻿/g, ''), // strip BOM residual
    transform: (v) => v.trim(),
  });

  return result.data;
}

// Faz parse de arquivo .xlsx — lê a primeira aba e normaliza headers para lowercase.
export async function parseXLSX(file: File): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  return raw.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k.trim().toLowerCase().replace(/﻿/g, ''),
        String(v).trim(),
      ])
    )
  );
}

// Ponto de entrada unificado: aceita .csv ou .xlsx
export async function parseImportFile(file: File): Promise<Record<string, string>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseXLSX(file);
  }
  const text = await decodeCSVFile(file);
  return parseCSV(text);
}
