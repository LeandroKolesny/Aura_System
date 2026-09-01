import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

type DialogVariant = 'danger' | 'warning' | 'info' | 'success';

interface DialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: DialogVariant;
}

interface DialogState extends DialogOptions {
  type: 'confirm' | 'alert';
  message: string;
  resolve: (value: boolean) => void;
}

interface DialogContextValue {
  confirm: (message: string, options?: DialogOptions) => Promise<boolean>;
  showAlert: (message: string, options?: Pick<DialogOptions, 'title' | 'variant'>) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

const VARIANT_CONFIG: Record<DialogVariant, { icon: React.ReactNode; iconBg: string; confirmBtn: string; title: string }> = {
  danger: {
    icon: <AlertTriangle className="w-6 h-6 text-red-500" />,
    iconBg: 'bg-red-50',
    confirmBtn: 'bg-red-600 hover:bg-red-700 text-white',
    title: 'Confirmar exclusão',
  },
  warning: {
    icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
    iconBg: 'bg-amber-50',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
    title: 'Atenção',
  },
  info: {
    icon: <Info className="w-6 h-6 text-blue-500" />,
    iconBg: 'bg-blue-50',
    confirmBtn: 'bg-primary-600 hover:bg-primary-700 text-white',
    title: 'Informação',
  },
  success: {
    icon: <CheckCircle className="w-6 h-6 text-emerald-500" />,
    iconBg: 'bg-emerald-50',
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    title: 'Sucesso',
  },
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((message: string, options: DialogOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ type: 'confirm', message, resolve, variant: 'danger', ...options });
    });
  }, []);

  const showAlert = useCallback((message: string, options: Pick<DialogOptions, 'title' | 'variant'> = {}): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        type: 'alert',
        message,
        resolve: () => resolve(),
        variant: options.variant ?? 'info',
        title: options.title,
      });
    });
  }, []);

  const handleClose = (confirmed: boolean) => {
    dialog?.resolve(confirmed);
    setDialog(null);
  };

  const cfg = dialog ? VARIANT_CONFIG[dialog.variant ?? 'info'] : null;

  return (
    <DialogContext.Provider value={{ confirm, showAlert }}>
      {children}
      {dialog && cfg && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className={`w-9 h-9 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                  {cfg.icon}
                </span>
                <h2 className="text-base font-semibold text-secondary-900">
                  {dialog.title ?? cfg.title}
                </h2>
              </div>
              <button onClick={() => handleClose(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 leading-relaxed">{dialog.message}</p>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              {dialog.type === 'confirm' ? (
                <>
                  <button
                    onClick={() => handleClose(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    {dialog.cancelLabel ?? 'Cancelar'}
                  </button>
                  <button
                    onClick={() => handleClose(true)}
                    className={`px-5 py-2 text-sm font-medium rounded-xl shadow-sm transition-all ${cfg.confirmBtn}`}
                  >
                    {dialog.confirmLabel ?? 'Confirmar'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleClose(true)}
                  className={`px-5 py-2 text-sm font-medium rounded-xl shadow-sm transition-all ${cfg.confirmBtn}`}
                >
                  {dialog.confirmLabel ?? 'Ok'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextValue => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog deve ser usado dentro de DialogProvider');
  return ctx;
};
