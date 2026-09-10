// __tests__/utils/formatUtils.test.ts
// Testes de utilitários de formatação global (utils/formatUtils.ts)

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { PhotoRecord } from '../../types';
import { downloadPhoto } from '../../utils/formatUtils';

function makePhoto(over: Partial<PhotoRecord> = {}): PhotoRecord {
  return {
    id: 'ph1',
    companyId: 'c1',
    patientId: 'p1',
    date: '2026-09-09',
    url: 'data:image/png;base64,QUJD',
    type: 'before',
    procedure: 'Limpeza de Pele',
    groupId: 'group_1',
    ...over,
  };
}

/**
 * downloadPhoto monta um <a download> e clica nele. Interceptamos o
 * createElement para capturar o anchor e inspecionar o nome de arquivo gerado.
 */
function captureDownload(photo: PhotoRecord): HTMLAnchorElement {
  const realCreate = document.createElement.bind(document);
  let anchor: HTMLAnchorElement | null = null;
  const createSpy = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        anchor = el as HTMLAnchorElement;
        anchor.click = vi.fn();
      }
      return el;
    });
  downloadPhoto(photo);
  createSpy.mockRestore();
  if (!anchor) throw new Error('nenhum anchor criado');
  return anchor;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('downloadPhoto — extensão do arquivo por tipo de imagem', () => {
  it.each([
    ['data:image/png;base64,QUJD', 'png'],
    ['data:image/jpeg;base64,QUJD', 'jpeg'],
    ['data:image/jpg;base64,QUJD', 'jpg'],
    ['data:image/gif;base64,QUJD', 'gif'],
    ['data:image/webp;base64,QUJD', 'webp'],
  ])('%s → extensão .%s', (url, ext) => {
    const anchor = captureDownload(makePhoto({ url }));
    expect(anchor.download.endsWith(`.${ext}`)).toBe(true);
  });

  it('URL hospedada (não data URL) → fallback para .jpg', () => {
    const anchor = captureDownload(
      makePhoto({ url: 'https://cdn.example.com/foto-sem-extensao' })
    );
    expect(anchor.download.endsWith('.jpg')).toBe(true);
  });
});

describe('downloadPhoto — slug do procedimento e fase', () => {
  it('remove acentos e caracteres especiais do nome do procedimento', () => {
    const anchor = captureDownload(
      makePhoto({ procedure: 'Preenchimento Labial (Ácido Hialurônico)!', type: 'before', date: '2026-01-02' })
    );
    // "Ácido Hialurônico" perde os acentos; espaços/parênteses viram hífen;
    // sem hífen sobrando nas pontas.
    expect(anchor.download).toBe('preenchimento-labial-cido-hialur-nico_antes_2026-01-02.png');
  });

  it('type "before" vira "antes" e "after" vira "depois" no nome', () => {
    expect(captureDownload(makePhoto({ type: 'before' })).download).toContain('_antes_');
    expect(captureDownload(makePhoto({ type: 'after' })).download).toContain('_depois_');
  });

  it('procedimento vazio usa "foto" como base do slug', () => {
    const anchor = captureDownload(makePhoto({ procedure: '', date: '2026-03-03' }));
    expect(anchor.download).toBe('foto_antes_2026-03-03.png');
  });
});
