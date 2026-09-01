import React, { useRef, useState } from 'react';
import { X, Upload, Download, CheckCircle, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportError {
  row: number;
  name: string;
  reason: string;
}

interface ImportResult {
  imported: number;
  updated: number;
  errors: ImportError[];
}

interface ImportCSVModalProps {
  title: string;
  templateFilename: string;
  templateHeaders: string[];
  templateSampleRows: string[][];
  onImport: (file: File) => Promise<{ success?: boolean; imported?: number; updated?: number; errors?: ImportError[]; error?: string }>;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'upload' | 'result';

function downloadTemplate(filename: string, headers: string[], rows: string[][]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, filename);
}

const ImportCSVModal: React.FC<ImportCSVModalProps> = ({
  title,
  templateFilename,
  templateHeaders,
  templateSampleRows,
  onImport,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileError, setFileError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError('');
    if (!file) return;
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setFileError('O arquivo deve ser CSV ou Excel (.csv, .xlsx)');
      return;
    }
    setSelectedFile(file);
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    try {
      const res = await onImport(selectedFile);
      if (res.error) {
        setFileError(res.error);
        setIsLoading(false);
        return;
      }
      // fetchApi envolve a resposta em { success, data } — os dados ficam em res.data
      const payload = (res as { data?: ImportResult }).data ?? (res as unknown as ImportResult);
      setResult({
        imported: payload.imported ?? 0,
        updated: payload.updated ?? 0,
        errors: payload.errors ?? [],
      });
      setStep('result');
      if ((payload.imported ?? 0) > 0 || (payload.updated ?? 0) > 0) {
        onSuccess?.();
      }
    } catch {
      setFileError('Erro ao enviar o arquivo. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-secondary-900">{title}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {step === 'upload' && (
            <>
              {/* Passo 1: Download do template */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-sm text-blue-800 font-medium mb-1">Passo 1 — Baixe o template</p>
                <p className="text-xs text-blue-600 mb-3">Preencha o arquivo modelo com seus dados e salve como CSV.</p>
                <button
                  onClick={() => downloadTemplate(templateFilename, templateHeaders, templateSampleRows)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Baixar template
                </button>
              </div>

              {/* Passo 2: Upload */}
              <div>
                <p className="text-sm font-medium text-secondary-800 mb-2">Passo 2 — Envie seu arquivo CSV</p>
                <div
                  onClick={() => inputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all"
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-primary-500" />
                      <p className="text-sm font-medium text-secondary-800">{selectedFile.name}</p>
                      <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB · Clique para trocar</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-slate-300" />
                      <p className="text-sm text-slate-500">Clique para selecionar o arquivo (.xlsx ou .csv)</p>
                    </div>
                  )}
                </div>
                {fileError && (
                  <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {fileError}
                  </p>
                )}
              </div>
            </>
          )}

          {step === 'result' && result && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                  <p className="text-xs text-green-700 font-medium mt-0.5">Importados</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                  <p className="text-xs text-blue-700 font-medium mt-0.5">Atualizados</p>
                </div>
                <div className={`border rounded-xl p-3 text-center ${result.errors.length > 0 ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                  <p className={`text-2xl font-bold ${result.errors.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>{result.errors.length}</p>
                  <p className={`text-xs font-medium mt-0.5 ${result.errors.length > 0 ? 'text-red-700' : 'text-slate-400'}`}>Erros</p>
                </div>
              </div>

              {/* Mensagem de sucesso */}
              {result.imported + result.updated > 0 && (
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <p className="text-sm font-medium">Importação concluída com sucesso!</p>
                </div>
              )}

              {/* Lista de erros */}
              {result.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-secondary-800 mb-2">Linhas com erro:</p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-red-700">Linha {err.row} — {err.name}:</span>{' '}
                          <span className="text-red-600">{err.reason}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          {step === 'upload' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={!selectedFile || isLoading}
                className="flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</> : <><Upload className="w-4 h-4" /> Importar</>}
              </button>
            </>
          )}
          {step === 'result' && (
            <button onClick={onClose} className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all">
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportCSVModal;
