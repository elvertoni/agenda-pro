import { formatDate } from '@angular/common';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { appConfig } from './app.config';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('cria a moldura do sistema', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('mostra a marca com link para o início', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const marca = (fixture.nativeElement as HTMLElement).querySelector('a.marca');

    expect(marca?.textContent).toContain('AgendaPro');
    expect(marca?.getAttribute('href')).toBe('/');
  });

  it('mostra os quatro itens do menu, na ordem, com o endereço de cada um', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('mat-nav-list a'));

    // Lê só o rótulo: o textContent do link inteiro traria junto o nome do ícone.
    const rotulos = links.map((link) => link.querySelector('[matListItemTitle]')?.textContent?.trim());

    expect(rotulos).toEqual(['Profissionais', 'Clientes', 'Agendar', 'Agendamentos']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/profissionais',
      '/clientes',
      '/agendar',
      '/agendamentos',
    ]);
  });
});

describe('configuração de idioma (app.config)', () => {
  it('formata datas em português do Brasil', () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });

    const idioma = TestBed.inject(LOCALE_ID);

    expect(idioma).toBe('pt-BR');
    expect(formatDate(new Date(2026, 9, 12), 'fullDate', idioma)).toBe('segunda-feira, 12 de outubro de 2026');
    expect(formatDate(new Date(2026, 9, 12), 'shortDate', idioma)).toBe('12/10/2026');
  });
});
