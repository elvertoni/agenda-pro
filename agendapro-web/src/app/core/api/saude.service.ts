import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SaudeService {
  private readonly http = inject(HttpClient);

  // O /health responde texto puro ("Healthy"), não JSON: sem o responseType o HttpClient
  // tentaria ler como JSON e trataria a resposta como erro.
  verificar(): Observable<string> {
    return this.http.get('/health', { responseType: 'text' });
  }
}
