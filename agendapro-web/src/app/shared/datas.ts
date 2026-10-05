// Conversões de data e hora entre a tela e a API.
//
// A API trabalha com o horário local da clínica, sem fuso. Por isso nada aqui usa:
// - toISOString(): converte para UTC e, à noite no Brasil, troca o dia;
// - new Date("2026-10-12"): o JavaScript lê como meia-noite UTC, que no Brasil é o dia anterior.
// As funções montam e leem o texto a partir das partes locais da data (ano, mês, dia, hora).

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0');
}

// Date -> "2026-10-12" (DateOnly na API), usando o dia local.
export function paraDataApi(data: Date): string {
  // getMonth() começa em 0 (janeiro), por isso o + 1.
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

// Date -> "2026-10-12T14:30:00" (DateTime na API), usando o horário local.
export function paraDataHoraApi(data: Date): string {
  const hora = `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}:${doisDigitos(data.getSeconds())}`;
  return `${paraDataApi(data)}T${hora}`;
}

// "2026-10-12" -> Date à meia-noite local.
export function lerDataApi(texto: string): Date {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);

  if (!partes) {
    throw new Error(`Data inválida: "${texto}". Formato esperado: aaaa-MM-dd.`);
  }

  return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
}

// "2026-10-12T14:30:00" -> Date no horário local. Frações de segundo são ignoradas.
// Serve só para datas locais da clínica; não usar em campos UTC (como CriadoEm).
export function lerDataHoraApi(texto: string): Date {
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(texto);

  if (!partes) {
    throw new Error(`Data e hora inválidas: "${texto}". Formato esperado: aaaa-MM-ddTHH:mm:ss.`);
  }

  return new Date(
    Number(partes[1]),
    Number(partes[2]) - 1,
    Number(partes[3]),
    Number(partes[4]),
    Number(partes[5]),
    Number(partes[6]),
  );
}

// "09:00:00" (TimeOnly na API) -> "09:00" para exibir.
export function formatarHora(hora: string): string {
  return hora.slice(0, 5);
}

// "09:00" (campo da tela) -> "09:00:00", o formato que a API espera.
export function paraHoraApi(hora: string): string {
  return hora.length === 5 ? `${hora}:00` : hora;
}
