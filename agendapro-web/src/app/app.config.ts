import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localePt from '@angular/common/locales/pt';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { erroInterceptor } from './core/interceptors/erro.interceptor';

// Carrega os dados de formatação do português (nomes de meses e dias, separadores de número).
// Sem isso, os pipes de data e número só conhecem o inglês.
registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    // withComponentInputBinding: parâmetros e "data" da rota chegam ao componente como input().
    provideRouter(routes, withComponentInputBinding()),

    provideHttpClient(withInterceptors([erroInterceptor])),

    // Idioma padrão dos pipes (date, number, currency).
    { provide: LOCALE_ID, useValue: 'pt-BR' },

    // Datepicker do Material: usa o Date nativo e mostra as datas como dd/MM/aaaa.
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },

    // O index.html carrega a fonte Material Symbols; o padrão do mat-icon seria a antiga Material Icons.
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ],
};
