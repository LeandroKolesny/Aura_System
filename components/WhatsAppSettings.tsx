import React, { useState, useEffect, useCallback } from 'react'
import { MessageCircle, CheckCircle, XCircle, Loader2, RefreshCw, LogOut, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { whatsappApi } from '../services/api'
import { useApp } from '../context/AppContext'
import { UserRole } from '../types'

type WaStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'

const WhatsAppSettings: React.FC = () => {
  const { user } = useApp()
  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<WaStatus>('DISCONNECTED')
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [termsChecked, setTermsChecked] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canManage = user?.role === UserRole.ADMIN || user?.role === UserRole.OWNER

  const loadStatus = useCallback(async () => {
    const res = await whatsappApi.getStatus()
    if (res.success && res.data) {
      setStatus(res.data.status)
      setPhoneNumber(res.data.phoneNumber ?? null)
      if (res.data.qrCode) setQrCode(res.data.qrCode)
      if (res.data.status === 'CONNECTED') setQrCode(null)
    }
  }, [])

  useEffect(() => {
    if (isOpen) loadStatus()
  }, [isOpen, loadStatus])

  useEffect(() => {
    if (status !== 'CONNECTING') return
    const interval = setInterval(loadStatus, 5000)
    return () => clearInterval(interval)
  }, [status, loadStatus])

  const handleConnect = async () => {
    if (!termsChecked) return
    setLoading(true)
    const res = await whatsappApi.connect(true)
    if (res.success && res.data) {
      setStatus('CONNECTING')
      setQrCode(res.data.qrCode)
    }
    setLoading(false)
  }

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o WhatsApp? As confirmações automáticas serão pausadas.')) return
    setLoading(true)
    await whatsappApi.disconnect()
    setStatus('DISCONNECTED')
    setQrCode(null)
    setPhoneNumber(null)
    setTermsChecked(false)
    setLoading(false)
  }

  const statusBadge = {
    CONNECTED:    <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle className="w-4 h-4" /> Conectado</span>,
    CONNECTING:   <span className="flex items-center gap-1.5 text-yellow-600 text-sm font-medium"><Loader2 className="w-4 h-4 animate-spin" /> Aguardando scan...</span>,
    DISCONNECTED: <span className="flex items-center gap-1.5 text-gray-400 text-sm font-medium"><XCircle className="w-4 h-4" /> Desconectado</span>,
  }

  return (
    <div className="border border-secondary-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-secondary-900">WhatsApp — Confirmações</p>
            <p className="text-xs text-secondary-500">Envio automático de confirmações e lembretes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {statusBadge[status]}
          {isOpen ? <ChevronUp className="w-4 h-4 text-secondary-400" /> : <ChevronDown className="w-4 h-4 text-secondary-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-secondary-100 space-y-5">
          {status === 'CONNECTED' && (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 rounded-xl flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">WhatsApp conectado!</p>
                  {phoneNumber && <p className="text-xs text-green-600">{phoneNumber}</p>}
                </div>
              </div>
              <div className="text-xs text-secondary-500 space-y-1">
                <p className="font-semibold text-secondary-700">Mensagens automáticas ativas:</p>
                <p>Confirmação imediata ao confirmar agendamento</p>
                <p>Lembrete 24h antes do horário</p>
              </div>
              {canManage && (
                <button onClick={handleDisconnect} disabled={loading}
                  className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-50">
                  <LogOut className="w-4 h-4" /> Desconectar WhatsApp
                </button>
              )}
            </div>
          )}

          {status === 'CONNECTING' && qrCode && (
            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 rounded-xl text-sm text-yellow-800">
                <p className="font-semibold mb-1">Escaneie o QR Code abaixo</p>
                <p className="text-xs">Abra o WhatsApp → três pontos → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong></p>
              </div>
              <div className="flex justify-center">
                <img src={qrCode} alt="QR Code WhatsApp" className="w-48 h-48 rounded-xl border border-secondary-200" />
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-secondary-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Aguardando conexão...
                <button onClick={loadStatus} className="text-primary-500 hover:underline ml-1">
                  <RefreshCw className="w-3 h-3 inline" /> atualizar
                </button>
              </div>
            </div>
          )}

          {status === 'CONNECTING' && !qrCode && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-yellow-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Gerando QR Code...
            </div>
          )}

          {status === 'DISCONNECTED' && canManage && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">Use um número dedicado exclusivo para esta função.</p>
                    <p>Não utilize seu número pessoal ou comercial principal.</p>
                    <p>O Aura System <strong>não se responsabiliza</strong> por eventual bloqueio do WhatsApp neste número.</p>
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded accent-primary-500"
                  checked={termsChecked}
                  onChange={e => setTermsChecked(e.target.checked)}
                />
                <span className="text-xs text-secondary-600">
                  Entendi e aceito os termos acima. Usarei um chip/número dedicado para esta integração.
                </span>
              </label>

              <button
                onClick={handleConnect}
                disabled={!termsChecked || loading}
                className="w-full py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando QR Code...</>
                  : <><MessageCircle className="w-4 h-4" /> Conectar WhatsApp</>
                }
              </button>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wider">Preview das mensagens automáticas</p>
                <div className="bg-[#dcf8c6] rounded-xl p-3 text-xs text-secondary-800 space-y-1 border border-green-200">
                  <p className="font-semibold text-secondary-500 text-[10px] uppercase mb-1">Confirmação (imediato)</p>
                  <p>Olá [Nome]!</p>
                  <p>Aqui é o sistema de confirmações da <strong>[Clínica]</strong>.</p>
                  <p>Agendamento <strong>confirmado</strong>: [Data] às [Hora]</p>
                  <p>[Procedimento] · [Profissional]</p>
                  <p>Por favor, <strong>salve este número</strong> nos contatos!</p>
                </div>
                <div className="bg-[#dcf8c6] rounded-xl p-3 text-xs text-secondary-800 space-y-1 border border-green-200">
                  <p className="font-semibold text-secondary-500 text-[10px] uppercase mb-1">Lembrete (24h antes)</p>
                  <p>Olá [Nome]! Lembrete da <strong>[Clínica]</strong>:</p>
                  <p>Agendamento <strong>amanhã</strong> — [Data] às [Hora]</p>
                  <p>[Procedimento] · Te esperamos!</p>
                </div>
              </div>
            </div>
          )}

          {!canManage && status === 'DISCONNECTED' && (
            <p className="text-xs text-secondary-400 text-center py-2">
              Apenas administradores podem configurar o WhatsApp.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default WhatsAppSettings
