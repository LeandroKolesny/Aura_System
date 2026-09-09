// aura-backend/src/__tests__/lib/csvParser.test.ts
//
// Cobre o parser usado por todas as importações CSV/XLSX (pacientes,
// transações, procedimentos, estoque): detecção de encoding, remoção de BOM,
// detecção automática de delimitador, normalização de headers e o dispatch
// CSV vs XLSX.
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { decodeCSVFile, parseCSV, parseXLSX, parseImportFile } from '@/lib/csvParser'

function makeFile(content: string | Uint8Array, name = 'dados.csv', type = 'text/csv') {
  return new File([content as never], name, { type })
}

describe('decodeCSVFile', () => {
  it('decodifica UTF-8 simples corretamente', async () => {
    const file = makeFile('nome,email\nAna Paula,ana@x.com')
    const text = await decodeCSVFile(file)
    expect(text).toBe('nome,email\nAna Paula,ana@x.com')
  })

  it('remove o BOM UTF-8 (EF BB BF) do início do arquivo', async () => {
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
    const body = new TextEncoder().encode('nome,email\nJoão,joao@x.com')
    const bytes = new Uint8Array(bom.length + body.length)
    bytes.set(bom, 0)
    bytes.set(body, bom.length)

    const file = makeFile(bytes)
    const text = await decodeCSVFile(file)

    expect(text.startsWith('﻿')).toBe(false)
    expect(text).toBe('nome,email\nJoão,joao@x.com')
  })

  it('preserva acentos em UTF-8 sem BOM (ex: "José", "María")', async () => {
    const file = makeFile('nome\nJosé\nMaría')
    const text = await decodeCSVFile(file)
    expect(text).toBe('nome\nJosé\nMaría')
  })
})

describe('parseCSV', () => {
  it('faz parse de CSV separado por vírgula com header em qualquer caixa', () => {
    const rows = parseCSV('Nome,Email\nAna Silva,ana@x.com\nJoão Souza,joao@x.com')
    expect(rows).toEqual([
      { nome: 'Ana Silva', email: 'ana@x.com' },
      { nome: 'João Souza', email: 'joao@x.com' },
    ])
  })

  it('detecta automaticamente delimitador ; (padrão Excel pt-BR)', () => {
    const rows = parseCSV('nome;email\nAna Silva;ana@x.com')
    expect(rows).toEqual([{ nome: 'Ana Silva', email: 'ana@x.com' }])
  })

  it('remove a diretiva "sep=;" que o Excel adiciona no início do arquivo', () => {
    const rows = parseCSV('sep=;\nnome;email\nAna Silva;ana@x.com')
    expect(rows).toEqual([{ nome: 'Ana Silva', email: 'ana@x.com' }])
  })

  it('ignora linhas vazias', () => {
    const rows = parseCSV('nome,email\nAna,ana@x.com\n\n\nJoão,joao@x.com')
    expect(rows).toHaveLength(2)
  })

  it('remove espaços em branco nas bordas de cada valor', () => {
    const rows = parseCSV('nome,email\n  Ana Silva  ,  ana@x.com  ')
    expect(rows[0]).toEqual({ nome: 'Ana Silva', email: 'ana@x.com' })
  })

  it('normaliza headers com espaços e caixa alta para minúsculo sem espaços extras', () => {
    const rows = parseCSV('  NOME  , E-MAIL \nAna,ana@x.com')
    expect(Object.keys(rows[0])).toEqual(['nome', 'e-mail'])
  })

  it('arquivo vazio (só header) → array vazio', () => {
    const rows = parseCSV('nome,email')
    expect(rows).toEqual([])
  })
})

describe('parseXLSX', () => {
  function makeXlsxFile(rows: Record<string, unknown>[]) {
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    return new File([buffer], 'dados.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }

  it('lê a primeira aba e normaliza headers para minúsculo', async () => {
    const file = makeXlsxFile([{ Nome: 'Ana Silva', Email: 'ana@x.com' }])
    const rows = await parseXLSX(file)
    expect(rows).toEqual([{ nome: 'Ana Silva', email: 'ana@x.com' }])
  })

  it('células vazias viram string vazia (defval)', async () => {
    const file = makeXlsxFile([{ Nome: 'Ana', Telefone: '' }])
    const rows = await parseXLSX(file)
    expect(rows[0].telefone).toBe('')
  })

  it('múltiplas linhas são todas retornadas', async () => {
    const file = makeXlsxFile([{ Nome: 'Ana' }, { Nome: 'João' }, { Nome: 'Maria' }])
    const rows = await parseXLSX(file)
    expect(rows).toHaveLength(3)
  })
})

describe('parseImportFile (dispatch por extensão)', () => {
  it('arquivo .csv → usa o parser de CSV', async () => {
    const file = makeFile('nome,email\nAna,ana@x.com', 'pacientes.csv')
    const rows = await parseImportFile(file)
    expect(rows).toEqual([{ nome: 'Ana', email: 'ana@x.com' }])
  })

  it('arquivo .xlsx → usa o parser de XLSX', async () => {
    const ws = XLSX.utils.json_to_sheet([{ Nome: 'Ana' }])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const file = new File([buffer], 'pacientes.xlsx')

    const rows = await parseImportFile(file)
    expect(rows).toEqual([{ nome: 'Ana' }])
  })

  it('extensão em caixa alta (.CSV) ainda é reconhecida', async () => {
    const file = makeFile('nome\nAna', 'PACIENTES.CSV')
    const rows = await parseImportFile(file)
    expect(rows).toEqual([{ nome: 'Ana' }])
  })
})
