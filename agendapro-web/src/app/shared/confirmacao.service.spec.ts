import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { ConfirmacaoService } from './confirmacao.service';

describe('ConfirmacaoService', () => {
  let service: ConfirmacaoService;
  let sobreposicao: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfirmacaoService);
    sobreposicao = TestBed.inject(OverlayContainer).getContainerElement();
  });

  // Abre a janela, espera ela aparecer e devolve o resultado que o usuário daria.
  async function abrir(): Promise<{ resultado: Promise<boolean> }> {
    const resultado = new Promise<boolean>((resolver) =>
      service
        .confirmar({ titulo: 'Remover horário', mensagem: 'Remover o horário de segunda?', confirmar: 'Remover' })
        .subscribe(resolver),
    );
    // Dá um instante para a janela ser desenhada na camada de sobreposição.
    await new Promise((resolver) => setTimeout(resolver));
    return { resultado };
  }

  function botao(texto: string): HTMLButtonElement {
    const encontrado = Array.from(sobreposicao.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(texto),
    );
    if (!encontrado) {
      throw new Error(`Botão "${texto}" não encontrado na janela.`);
    }
    return encontrado;
  }

  it('mostra título, mensagem e o verbo da ação', async () => {
    await abrir();

    expect(sobreposicao.textContent).toContain('Remover horário');
    expect(sobreposicao.textContent).toContain('Remover o horário de segunda?');
    expect(botao('Remover')).toBeTruthy();
  });

  it('devolve true quando o usuário confirma', async () => {
    const { resultado } = await abrir();

    botao('Remover').click();

    expect(await resultado).toBe(true);
  });

  it('devolve false quando o usuário volta', async () => {
    const { resultado } = await abrir();

    botao('Voltar').click();

    expect(await resultado).toBe(false);
  });
});
