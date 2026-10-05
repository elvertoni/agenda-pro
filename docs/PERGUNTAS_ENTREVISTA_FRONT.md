# Perguntas de entrevista — front-end (Angular)

Perguntas de entrevista de cada fase do front do AgendaPro, com respostas. Servem para estudar: **tente responder em voz alta antes de ler a resposta**.

> As respostas são um **rascunho escrito pelo Claude**. Refaça com as suas próprias palavras: na entrevista vale o que você consegue explicar sozinho. As perguntas do backend estão em [PERGUNTAS_ENTREVISTA.md](PERGUNTAS_ENTREVISTA.md).

## Fase F0 — Preparação

### 1. O que é um componente standalone e o que ele substitui em relação ao `NgModule`?

Um componente standalone **declara as próprias dependências**: tudo que o template usa (outros componentes, diretivas, pipes) entra no `imports` do próprio `@Component`. No projeto, o `app.ts` tem `imports: [RouterOutlet]` porque o template usa `<router-outlet>`.

Antes, todo componente precisava ser declarado em **exatamente um** `NgModule` (`declarations`), e era o módulo que importava o que os templates precisavam. Para saber de onde vinha uma diretiva, era preciso abrir outro arquivo. Com standalone, a resposta está no próprio componente.

O que muda na prática:

- A aplicação sobe com `bootstrapApplication(App, appConfig)` em vez de `AppModule`.
- A configuração global vira funções `provide...` em `app.config.ts` (`provideRouter(routes)`, `provideHttpClient()`), no lugar de `RouterModule.forRoot()` e `HttpClientModule`.
- O lazy loading aponta direto para o componente ou para um arquivo de rotas (`loadComponent`, `loadChildren`), sem um módulo por feature.

Standalone é o padrão desde o Angular 19: não é mais preciso escrever `standalone: true`.

### 2. Por que usar proxy no `ng serve` em vez de chamar `http://localhost:5251` direto? O que é CORS e quando ele entra em ação?

**Origem** é o trio protocolo + host + porta. `http://localhost:4200` (front) e `http://localhost:5251` (API) são origens **diferentes**, mesmo sendo a mesma máquina.

**CORS** é uma regra do **navegador**: o JavaScript de uma origem só pode ler a resposta de outra origem se o servidor autorizar com o cabeçalho `Access-Control-Allow-Origin`. Em requisições que alteram dados ou enviam JSON (POST, PUT, PATCH, DELETE), o navegador manda antes um `OPTIONS` de verificação (*preflight*). Como quem aplica a regra é o navegador, `curl` e Postman não são afetados: CORS **não protege a API** contra chamadas diretas, só impede que um site qualquer use o navegador do usuário para ler dados de outro site.

Com o proxy, o navegador chama `http://localhost:4200/api/...`, a mesma origem da página, e o servidor de desenvolvimento repassa para a porta 5251 **de servidor para servidor**. Para o navegador não existe outra origem, então o CORS nem entra em ação.

Por que escolhi o proxy, mesmo com o CORS da API já liberando a porta 4200:

- **Nenhuma URL da API no código.** O front usa caminhos relativos (`/api/profissionais`) e funciona igual em qualquer ambiente, sem arquivo de configuração por ambiente.
- **Desenvolvimento igual à produção.** No Docker, o nginx fará o mesmo papel do proxy.
- **Sem preflight** a cada requisição de escrita.

O proxy do `ng serve` existe **só em desenvolvimento**: o build de produção são arquivos estáticos, e quem encaminha o `/api` passa a ser o nginx.

## Fase F1 — Estrutura, navegação e base técnica

### 1. O que é um HTTP interceptor? Por que tratar os erros nele, e por que ele só avisa na tela em falha de conexão e erro 5xx?

Um interceptor é uma função por onde passam **todas** as requisições e respostas do `HttpClient`, parecido com um middleware do ASP.NET Core. Ele é registrado uma vez, em `app.config.ts`: `provideHttpClient(withInterceptors([erroInterceptor]))`. O `erroInterceptor` chama `next(req)`, que devolve um Observable com a resposta, e usa `catchError` para agir só quando a requisição falha.

**Por que centralizar:** sem ele, cada service ou componente teria que entender o `HttpErrorResponse` e o ProblemDetails da API. Com ele, toda tela recebe o mesmo tipo, `ApiError` (`status`, `title`, `detail` e `errosPorCampo`), e a conversão das chaves `Nome` para `nome` fica escrita em um lugar só.

**Por que ele não avisa nos 4xx:** o interceptor não sabe o contexto. Um 409 na tela de agendar significa "o horário acabou de ser ocupado, recarregue os horários"; no cadastro de cliente significa "CPF já cadastrado, mostre no campo". Só a tela sabe o que fazer. Se o interceptor também avisasse, o usuário veria **duas mensagens** para o mesmo erro.

**Por que ele avisa em falha de conexão e 5xx:** nenhuma tela resolve isso e a mensagem é igual em todas. Depois do aviso ele repassa o erro com `throwError`, para a tela ainda poder mostrar o próprio estado de erro.

Detalhe encontrado ao testar: com a API parada, quem responde é o proxy, com **502**, e não o status 0. Por isso 0, 502 e 504 contam como "não foi possível conectar".

### 2. Por que `toISOString()` e `new Date("2026-10-12")` dão o dia errado no Brasil? Como o projeto evita isso?

Um `Date` do JavaScript guarda um **instante** (milissegundos desde 1970 em UTC), não "um dia no calendário". O dia que aparece depende do fuso usado para ler esse instante.

- **Na ida:** `toISOString()` sempre escreve em UTC. O Brasil está em UTC-3, então 12/10 às 22h aqui já é 13/10 à 1h em UTC. `toISOString().slice(0, 10)` devolve `2026-10-13`: o agendamento iria para o **dia seguinte**.
- **Na volta:** `new Date("2026-10-12")`, com texto só de data, é lido como meia-noite **UTC**, que no Brasil é 11/10 às 21h. `getDate()` devolve 11: a tela mostraria o **dia anterior**.

A API trabalha com o horário local da clínica, sem fuso, então a data nunca pode passar por UTC. O `shared/datas.ts` monta o texto a partir das partes locais (`getFullYear()`, `getMonth() + 1`, `getDate()`, `getHours()`) e lê separando o texto e chamando `new Date(ano, mes - 1, dia)`, que cria a data no horário local. Nenhuma tela faz essa conta: todas usam essas funções.

Os testes cobrem o caso das 22h. Eles só provam algo fora de UTC: em UTC as duas formas dão o mesmo resultado. Nesta máquina (UTC-3) as versões com o bug devolvem dia 13 e dia 11, então os testes falhariam. No CI, o job do front deve rodar com `TZ=America/Sao_Paulo`.

## Fase F2 — Profissionais

### 1. O que são Reactive Forms tipados? Como a validação do front e o erro 400 do servidor convivem no mesmo campo?

**Reactive Forms:** o modelo do formulário vive na **classe** (`FormGroup` e `FormControl`) e o template só liga cada campo com `formControlName`. No Template-driven (`ngModel`) o estado vive no template. Com o modelo em código dá para validar, ler e testar o formulário sem abrir o navegador.

**Tipados:** `new FormControl('', { nonNullable: true })` é um `FormControl<string>`. Sem `nonNullable`, o tipo seria `string | null`, porque `reset()` volta o campo para `null`. Com os campos tipados, `form.getRawValue()` devolve `{ nome: string; especialidade: string }`, e `form.controls.nome` dá erro de compilação se o nome do campo for digitado errado. Com `form.get('nome')` isso não acontece.

**Validação nas duas pontas:** o front valida antes de enviar, para dar resposta imediata e poupar uma requisição. Os limites são os do backend (nome 100, especialidade 80). Um detalhe: `Validators.required` aceita um campo só com espaços, e a API recusa, então escrevi o `obrigatorioSemEspacos`. O front não substitui o servidor: ele continua validando sempre, porque alguém pode chamar a API sem passar pela tela.

**Quando o servidor recusa mesmo assim (400):** o interceptor entrega `errosPorCampo` (`nome`, em camelCase) e a função `aplicarErrosDoServidor` faz `controle.setErrors({ servidor: mensagem })` e `markAsTouched()`. O `mat-error` mostra a mensagem no próprio campo. Ela some quando o usuário edita o campo, porque o Angular revalida e troca os erros. O que não pertence a nenhum campo (regra de negócio) vai para um aviso geral.

### 2. Por que usar `takeUntilDestroyed` se o HttpClient já completa sozinho? O que acontece se duas buscas da lista se cruzarem?

**HttpClient completa sozinho**, então depois da resposta não sobra nada vazando. O problema é o **antes** da resposta. Se o usuário sai da tela enquanto a requisição está no ar, sem cancelar o callback ainda roda: mexe nos signals de um componente que já saiu e pode até navegar para outra tela de repente. Com `takeUntilDestroyed(destroyRef)`, a inscrição é desfeita quando o componente é destruído, e desinscrever de uma chamada do `HttpClient` **aborta a requisição**. Dentro do constructor dá para chamar `takeUntilDestroyed()` sem argumento; em um método chamado depois, é preciso passar o `DestroyRef` injetado, como na lista e nos formulários.

**Busca cruzada (condição de corrida):** o usuário clica em "Limpar" enquanto a primeira busca ainda não voltou. Saem duas requisições, e a resposta da primeira pode chegar **depois** da segunda e sobrescrever a lista com dados velhos. Por isso `carregar()` guarda a inscrição anterior e faz `unsubscribe()` antes de começar outra: a resposta atrasada é descartada. O teste que cobre isso falha se essa linha for removida (conferi quebrando o código de propósito). Na tela de clientes (F3) isso vira o operador `switchMap` do RxJS, que faz o mesmo cancelamento de forma declarativa.

Para estado derivado de um Observable que dura a vida do componente, o `toSignal` já cancela sozinho ao destruir (usado no `app.ts` para o tamanho da tela).

## Fase F3 — Clientes

### 1. Como funciona a busca por nome da lista de clientes? Para que servem `debounceTime`, `distinctUntilChanged` e `switchMap`, e por que o `catchError` fica dentro do `switchMap`?

O campo de busca é um `FormControl`, e `valueChanges` é um Observable que emite a cada tecla. Ligar isso direto no HTTP faria uma requisição por letra. A cadeia no `clientes-lista.ts` resolve isso em etapas:

- **`debounceTime(300)`:** só deixa passar o valor depois de 300 ms sem nova tecla. Quem digita "maria" gera uma busca, não cinco.
- **`map(trim)` + `distinctUntilChanged()`:** ignora espaços nas pontas e não busca de novo se o texto final for igual ao da busca anterior (por exemplo, o usuário digita um espaço no fim).
- **`switchMap`:** troca o fluxo de texto pelo fluxo da requisição e **cancela a requisição anterior** se um texto novo chegar antes da resposta. Isso evita a condição de corrida: a resposta atrasada de "ma" não sobrescreve a de "mar". Na F2 eu fazia isso à mão com `unsubscribe()`; aqui o operador faz de forma declarativa. Cancelar a assinatura de uma chamada do `HttpClient` aborta a requisição de verdade.

**Por que o `catchError` fica dentro do `switchMap`:** um Observable que dá erro **termina**. Se o `catchError` ficasse no fim da cadeia, o primeiro erro de rede encerraria o fluxo inteiro e a busca pararia de funcionar até recarregar a página. Dentro do `switchMap`, só a requisição interna termina: o erro vira `null` (que a tela mostra como estado de erro) e a cadeia de fora continua viva para a próxima digitação.

O "Tentar de novo" entra na mesma cadeia por um `Subject` com `merge`, para a lógica de busca ficar em um lugar só.

**Como testei o tempo:** `vi.useFakeTimers` troca só `setInterval`, `clearInterval` e `Date`, porque o `debounceTime` usa `setInterval` e confere o relógio com `Date.now`. O `setTimeout`, que o Angular usa para atualizar a tela, segue real. Meu primeiro teste falhou por esquecer o `Date`: o timer disparava, mas o RxJS via que "ainda não passou o tempo" e reagendava.

### 2. Como o CPF é tratado no front (máscara, validação, erro de duplicado)? Por que o CPF aparece mascarado e não pode ser editado?

**Máscara enquanto digita:** a função `formatarCpf` deixa só dígitos, corta em 11 e coloca pontos e traço (`529.982.247-25`). O campo chama essa função no evento `input`. Escrevi à mão, sem biblioteca, porque são poucas linhas e dá para explicar.

**Validador:** `cpfEhValido` repete o algoritmo do backend: recusa tamanho diferente de 11 e sequência repetida (`111.111.111-11` passa na conta, mas não é CPF real) e confere os dois dígitos verificadores (soma ponderada, resto da divisão por 11). Ele vira o validador de formulário `cpfValido`. Campo vazio não gera esse erro, porque quem avisa é o "obrigatório" do próprio campo. O front valida para dar resposta imediata, mas o **backend continua validando**: qualquer um pode chamar a API sem a tela. Ao enviar, o CPF vai só com números, o formato que a API grava.

**CPF duplicado (409):** a tela não adivinha. O backend responde 409 com a mensagem "Já existe um cliente com este CPF."; a tela coloca essa mensagem no **próprio campo CPF** (`setErrors({ servidor })` + `markAsTouched()`), que é onde o usuário vai corrigir. Ela some quando ele altera o CPF. O 409 não é tratado no interceptor justamente porque só a tela sabe o contexto.

**Mascarado e somente leitura:** a API nunca devolve o CPF completo (`***.982.247-**`): ele só entra, nunca sai, por privacidade (LGPD). Por isso na lista aparece como a API mandou. Na edição, o campo fica **desabilitado** (`control.disable()`), pelos dois motivos: o `PUT` não aceita CPF (o backend não permite alterar) e o valor mascarado nunca passaria no validador. Um controle desabilitado fica fora da validação do grupo, então o formulário continua válido.
