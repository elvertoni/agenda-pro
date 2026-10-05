# Perguntas de entrevista

Perguntas de entrevista de cada fase do AgendaPro, com respostas. Servem para estudar: **tente responder em voz alta antes de ler a resposta**.

> As respostas são um **rascunho escrito pelo Claude**. Refaça com as suas próprias palavras: na entrevista vale o que você consegue explicar sozinho. O contexto de cada fase está no [README](../README.md) e no guia do Notion.

## Fase 0 — Preparação

### 1. Por que injetar `TimeProvider` em vez de chamar `DateTime.Now` direto? O que muda no teste?

A hora atual é uma **dependência externa**, como o banco. Se o código chama `DateTime.Now`, o teste não controla o "agora": um teste que agenda para 12/10/2026 passa hoje e quebra quando essa data virar passado, sem o código ter mudado.

Com `TimeProvider` entrando pelo construtor, a API recebe o relógio real (`TimeProvider.System`) e o teste recebe um relógio falso travado em uma data. O resultado fica **determinístico**.

### 2. Por que não devolver stack trace em produção? O que o ProblemDetails resolve?

O stack trace mostra o interior do sistema (classes, caminhos, versões, às vezes SQL e nomes de tabela): para o cliente da API não serve, para um atacante é um mapa. O detalhe fica no **log do servidor**; o `traceId` na resposta liga as duas pontas.

O **ProblemDetails** (RFC 9457) é o formato padrão de erro em API (`type`, `title`, `status`, `detail`). Sem ele, cada endpoint inventa um formato e o front precisa tratar cada um. Com ele, 400, 404, 409 e 500 chegam iguais e o consumidor trata todos do mesmo jeito.

## Fase 1 — Clientes

### 1. Por que checar o CPF duplicado com `AnyAsync` e também tratar a `DbUpdateException` do índice único? Só um dos dois não bastaria?

Os dois resolvem problemas diferentes. O `AnyAsync` dá a resposta amigável (409 com mensagem) no caso comum e evita o custo de uma exceção. Mas ele **não é seguro sozinho**: entre o `AnyAsync` e o `SaveChanges` existe uma janela, e duas requisições com o mesmo CPF podem passar pela checagem ao mesmo tempo.

O **índice único é a garantia final**: o banco nunca aceita dois CPFs iguais. Só com o índice, o dado fica correto, mas o usuário receberia um 500 em vez de um 409. Por isso o `catch` converte a violação do índice em 409.

Detalhe que mostra cuidado: o `catch` filtra os códigos 2601 e 2627 do SQL Server, para que outro erro (banco fora do ar, por exemplo) não vire "CPF duplicado".

### 2. Por que o CPF é guardado só com números? O que quebraria no índice único se guardasse com máscara?

O índice único compara o **texto**. "529.982.247-25" e "52998224725" são textos diferentes, então o mesmo CPF poderia ser cadastrado duas vezes, com e sem máscara. Além disso, a coluna é `char(11)` e a versão com máscara tem 14 caracteres.

Normalizar na entrada (e só mascarar na saída, para exibição) deixa **uma única forma canônica** no banco: a busca, o índice e a validação passam a concordar.

## Fase 2 — Completar Profissionais e Horários

### 1. Por que 10:00–10:30 e 10:30–11:00 não conflitam? Como a condição garante isso? O que mudaria com `<=`?

A condição de sobreposição é: **cada intervalo começa antes de o outro terminar**, ou seja, `inicioA < fimB` e `fimA > inicioB`.

Com A = 10:00–10:30 e B = 10:30–11:00: `fimA > inicioB` vira `10:30 > 10:30`, que é falso. Logo, não há sobreposição. Tratamos os intervalos como **semiabertos** (o início conta, o fim não): o atendimento que termina às 10:30 libera o profissional exatamente nesse instante.

Com `<=` e `>=`, encostar viraria conflito, e não seria possível marcar dois atendimentos seguidos. Seria um bug de negócio, não de código.

### 2. Por que o PATCH de ativo usa `bool?` com `[Required]` em vez de `bool`? O que acontece com o corpo `{}`?

Um `bool` tem valor padrão `false`. Com o corpo `{}`, o campo faltaria e o binder preencheria `false`: a API **desativaria o profissional silenciosamente**, sem o cliente ter pedido.

Com `bool?`, o campo ausente vira `null`, e o `[Required]` transforma isso em **400**. A ideia geral: em operações que alteram estado, um campo ausente não pode ser confundido com um valor válido.

## Fase 3 — Agendamentos (o coração do projeto)

### 1. Duas requisições simultâneas tentam agendar o mesmo horário. O que acontecia, por quê, e qual a solução (cite pelo menos duas)?

**O que acontecia:** o fluxo é "1) checar conflito, 2) gravar", e entre os dois passos existe uma janela. As duas requisições liam o banco, ambas viam o horário livre e ambas gravavam: dupla reserva, sem erro. Foi comprovado com um teste de 12 requisições simultâneas: **12 agendamentos criados** no mesmo horário.

**Soluções possíveis:**

- **Travar a linha do profissional dentro de uma transação** (`UPDLOCK`), que foi a escolhida: quem disputa o mesmo profissional espera na fila e, na sua vez, relê e vê o conflito (409).

- **Transação com isolamento `Serializable`:** funciona, mas usa locks de intervalo no índice e pode gerar deadlock.

- **Restrição no banco:** um índice único filtrado em `(ProfissionalId, DataHoraInicio)` evita o mesmo início exato, mas **não** pega sobreposição parcial (10:00–10:30 e 10:15–10:45).

- **Concorrência otimista** (coluna `rowversion` em uma linha que todos atualizam): o segundo recebe erro e tenta de novo.

- **Lock na aplicação** (`SemaphoreSlim` por profissional): só funciona com uma única instância da API.

### 2. Por que o `AgendamentoService` devolve um `Resultado` em vez de chamar `Problem(...)` ou lançar exceção?

- **Separação de responsabilidades:** `Problem(...)` é coisa do controller (HTTP). O service não deve conhecer status code nem `ControllerBase`.

- **Testabilidade:** dá para testar a regra verificando `resultado.Erro.Status` sem subir servidor.

- **Falha esperada não é exceção:** "horário ocupado" é um resultado normal do negócio, não uma situação excepcional. Exceções escondem o fluxo (o leitor não vê no tipo que pode falhar) e são mais caras. O `Resultado` torna a possibilidade de erro **explícita na assinatura**.

- O controller só traduz: erro vira ProblemDetails com o status certo; sucesso vira 201 ou 200.

## Proteção contra agendamentos simultâneos (extra)

### Por que travar a linha do profissional em vez de usar `Serializable`? O que acontece com um profissional diferente enquanto outro está sendo agendado?

Com `Serializable`, o SQL Server cria locks de **intervalo** no índice para impedir que apareçam linhas novas no intervalo lido. Duas transações lendo o mesmo intervalo seguram, cada uma, um lock compartilhado; depois ambas tentam inserir, e a inserção de uma é bloqueada pelo lock da outra: **deadlock**. Uma é escolhida como vítima e falha com erro 1205.

O `UPDLOCK` na linha do profissional é um lock **exclusivo para atualização**: a segunda transação espera já na primeira instrução, sem nunca segurar um lock que a outra precise. Resultado: fila em vez de deadlock. E, quando chega a vez, ela relê os agendamentos já confirmados e devolve 409.

Com **outro profissional**, nada muda: o lock está na linha de cada profissional, então os agendamentos de profissionais diferentes seguem em paralelo.

## Fase 4 — Disponibilidade

### 1. Por que a disponibilidade reaproveita `TemConflito` e `EstaNoPassado` em vez de ter lógica própria? Que bug isso evita?

Evita **duas fontes da verdade**. Se a disponibilidade tivesse seu próprio cálculo, as duas lógicas poderiam divergir com o tempo: a API ofereceria um horário como livre e o POST responderia 409 (ou o contrário, escondendo um horário que poderia ser marcado).

Reaproveitando as mesmas funções, uma mudança de regra (por exemplo, permitir agendar com 15 minutos de antecedência) vale nos dois lugares ao mesmo tempo. O teste que agenda todos os horários oferecidos prova essa garantia.

### 2. Expediente 08:00–12:00 e duração de 90 minutos: quais horários são gerados e por quê? E se já houver um agendamento às 10:15?

Os blocos partem das 08:00: 08:00–09:30 (cabe), 09:30–11:00 (cabe), 11:00–12:30 (termina depois das 12:00, então é descartado). Horários gerados: **08:00 e 09:30**.

Se houver um agendamento às 10:15 (digamos, 30 minutos, até 10:45), ele invade o bloco 09:30–11:00 (começa antes de 11:00 e termina depois de 09:30). Esse bloco sai e sobra só **08:00**. O custo é o alinhamento fixo: parte do tempo livre (por exemplo, 09:30–10:15) deixa de ser oferecida.

## Fase 5 — SQL Server de verdade (trigger e procedure)

### 1. Por que o trigger usa `inserted` e `deleted` com JOIN em vez de cursor ou WHILE linha a linha? O que acontece se um único UPDATE atinge 500 agendamentos?

Um trigger de `AFTER UPDATE` dispara **uma vez por comando**, não uma vez por linha. As tabelas `inserted` (valores novos) e `deleted` (valores antigos) trazem **todas** as linhas afetadas. O `JOIN` pelo `Id` pareia cada linha nova com a antiga, e um único `INSERT ... SELECT` grava a auditoria de todas de uma vez: é **set-based**, o jeito que o SQL Server faz bem.

Um cursor ou `WHILE` processaria linha a linha: muito mais lento e, por rodar dentro da transação do UPDATE, seguraria locks por mais tempo.

Com 500 linhas, o trigger roda **uma vez** e gera até 500 linhas de auditoria (só as que mudaram de status, por causa do `WHERE i.Status <> d.Status`).

O erro clássico é escrever o trigger assumindo uma linha só (`SELECT @id = Id FROM inserted`): ele audita apenas uma das 500. Há um teste com `UPDATE` em 3 linhas justamente para pegar isso.

### 2. A auditoria registra `SUSER_SNAME()`. Por que isso não identifica quem cancelou na prática? Como resolver para saber o usuário final?

`SUSER_SNAME()` devolve o **login do banco** da conexão. A API usa uma única credencial para falar com o SQL Server (e o pool de conexões a reaproveita), então todas as linhas mostram o mesmo login, mesmo que dezenas de pessoas usem o sistema. O banco não sabe quem é o usuário final.

**Como resolver:**

- Gravar o usuário na própria linha (coluna `AlteradoPor`) a cada alteração; o trigger copia de `inserted`.

- Usar `SESSION_CONTEXT`: a aplicação grava o id do usuário na sessão (`sp_set_session_context`) ao abrir a conexão, e o trigger lê com `SESSION_CONTEXT(N'UsuarioId')`.

- Fazer a auditoria na aplicação (por exemplo, sobrescrevendo o `SaveChanges` do EF), que conhece o usuário autenticado. O custo é perder a cobertura de alterações feitas fora da API.

## Fase 6 — Performance (prova de que o índice funciona)

### 1. Qual a diferença entre Index Seek e Index Scan? Como você prova que uma consulta está usando o índice?

**Scan** lê o índice ou a tabela inteiros e filtra depois; **Seek** usa a estrutura em árvore (B-tree) para ir direto ao ponto procurado. Seek lê poucas páginas; Scan lê todas.

**Como provar, com números:** olhar o **plano de execução** (aparece `Index Seek` ou `Clustered Index Scan`) e ligar `SET STATISTICS IO ON`, que mostra as **leituras lógicas**. No projeto, a consulta de conflito lê **1.913 páginas sem o índice** (a tabela inteira, Scan) e **35 com ele** (Seek), numa tabela de 200 mil linhas, para devolver 8 linhas. Em tempo, de cerca de 18 ms para cerca de 0,1 ms.

Detalhe que mostra maturidade: comparei **leituras lógicas**, que não variam entre execuções, e usei a média de 300 execuções para o tempo, porque o tempo de uma execução isolada oscila.

### 2. Por que a ordem das colunas de um índice composto importa? E o que é um covering index: quando vale a pena?

**Ordem:** o índice é ordenado pela primeira coluna e, dentro dela, pela segunda. Ele só consegue ir direto ao trecho certo usando as colunas **da esquerda para a direita**. Regra prática: colunas com filtro de **igualdade** primeiro (profissional), coluna com filtro de **intervalo** depois (data). Medido: para a agenda de um mês de um profissional, o índice (Profissional, Data) fez **4 leituras** e o (Data, Profissional) fez **56**, 14 vezes mais, porque lê o mês de todos os profissionais e descarta os outros.

**Covering index:** é um índice que contém todas as colunas que a consulta pede (as da chave mais as do `INCLUDE`), então o SQL Server não precisa voltar à tabela (sem **Key Lookup**). No projeto, `INCLUDE (DuracaoMinutos, Status)` baixou de 35 para 3 leituras na consulta enxuta.

**Quando vale a pena:** quando a consulta é muito frequente, devolve **muitas linhas** (cada linha custa um lookup) e pede poucas colunas. **Quando não:** aqui o ganho de tempo foi desprezível (a consulta devolve 8 linhas), o índice ficou **mais que o dobro do tamanho** (556 para 1.197 páginas) e cada escrita passaria a custar mais. Por isso foi medido e **não adotado**: índice não é de graça.

## Fase 7 — Robustez

### 1. Para que serve o CORS? Por que a política é restrita a uma origem em vez de liberar todas? O CORS protege a API?

**O que é:** um mecanismo do **navegador**. Por padrão, o JavaScript de uma página só pode ler respostas do mesmo site de onde ela veio (a *same-origin policy*). O CORS é o jeito de o **servidor dizer ao navegador** quais outras origens podem ler as suas respostas, por meio do cabeçalho `Access-Control-Allow-Origin`. Origem é protocolo mais domínio mais porta: `http://localhost:3000` e `https://localhost:4200` são origens **diferentes** de `http://localhost:4200` (há teste para isso).

**Preflight:** antes de um POST com JSON ou com cabeçalho personalizado, o navegador envia uma requisição `OPTIONS` perguntando se pode. O `UseCors` fica antes da autorização para essa pergunta não ser barrada.

**Por que restrito:** liberar todas as origens deixaria qualquer site aberto no navegador do usuário ler as respostas da API. Hoje a API não tem login, mas o hábito certo é abrir só o que precisa (o front em `localhost:4200`), e configurável por ambiente.

**Não é segurança da API:** o CORS **não impede** `curl`, Postman, outro servidor ou um script mal-intencionado: são clientes que não aplicam essa regra. Quem protege a API é autenticação e autorização. O CORS protege o **usuário no navegador**.

### 2. O que são logs estruturados e por que não logar CPF, nome ou telefone? Como você garante isso?

**Estruturado:** a mensagem é um modelo com campos nomeados (`"Agendamento {AgendamentoId} criado: profissional {ProfissionalId}"`), e o provedor de log guarda o **modelo** e os **valores separados**. Isso permite filtrar (`ProfissionalId = 25`), agrupar e criar alertas. Com texto concatenado, cada evento vira uma frase única, impossível de agrupar. Também é mais barato: se o nível de log está desligado, o texto nem é montado.

**Sem dados pessoais:** CPF, nome e telefone são dados pessoais (LGPD). Log é copiado para muitos lugares (arquivos, ferramentas de monitoramento, backups), guardado por muito tempo e lido por muita gente. Por minimização, o log leva **ids** (`ClienteId`), que só significam algo para quem tem acesso ao banco. O mesmo raciocínio justifica mascarar o CPF na saída da API.

**Como garantir:** não dá para confiar só em disciplina. Um teste captura **todos** os logs de um fluxo (inclusive os do EF Core e do ASP.NET) e falha se algum conter o CPF, o nome ou o telefone. Detalhe do EF: ele não loga os valores dos parâmetros SQL por padrão; isso só mudaria se alguém ligasse `EnableSensitiveDataLogging`, que nunca deve ir para produção.

## Fase 8 — Docker

### 1. Por que usar um Dockerfile multi-stage? E por que rodar o container com usuário não-root?

**Multi-stage:** o Dockerfile tem várias etapas (`FROM`) e só a **última** vira a imagem final. A primeira usa o SDK, que é grande, para compilar e publicar; a última usa a imagem `aspnet`, só com o necessário para rodar, e copia dela apenas o resultado do `publish`. A imagem fica menor, sobe mais rápido e tem menos programas dentro (menos superfície de ataque). Como o `.csproj` é copiado antes do código, o `restore` fica em cache e os rebuilds são rápidos.

**Não-root:** por padrão o processo dentro do container roda como root. Se alguém explorar uma falha na API, ele já teria poder total *dentro* do container, e uma configuração mais frouxa (volume montado, capacidade extra) poderia levar isso ao host. Com um usuário comum, o estrago possível é bem menor. É o princípio do **menor privilégio**. Efeito prático: usuário comum não pode abrir a porta 80, por isso a API escuta na 8080.

### 2. Como as migrations são aplicadas no Docker, e por que não chamar `Database.Migrate()` ao iniciar a API?

**Como:** um serviço `migrator` no compose roda o `efbundle` (gerado por `dotnet ef migrations bundle`), que é um executável autônomo que aplica as migrations pendentes e termina. A `api` só inicia depois que ele concluiu com sucesso, e o `migrator` só roda depois que o `db` passou no healthcheck. A migração é idempotente: rodar de novo não faz nada se já está tudo aplicado.

**Por que não `Migrate()` no startup:** (1) com várias instâncias da API, todas migrariam ao mesmo tempo; (2) a API precisaria de permissão para alterar o esquema, e o ideal é a aplicação ter só o acesso que usa no dia a dia; (3) uma migration lenta ou com erro derruba ou atrasa a subida da API de um jeito difícil de enxergar; (4) mudanças de esquema devem ser um passo explícito e revisável do deploy. Em desenvolvimento local, `dotnet ef database update` resolve.

## Fase 9 — CI (GitHub Actions)

### 1. O que é integração contínua (CI) e o que ela te dá neste projeto?

**O que é:** a cada mudança enviada ao repositório, um servidor limpo baixa o código, compila e roda os testes automaticamente. Se algo quebra, você descobre na hora, no commit que causou, e não dias depois.

**Neste projeto:** pega o clássico "na minha máquina funciona" (o CI parte de uma máquina limpa, sem os meus user-secrets nem arquivos esquecidos); bloqueia um pull request que quebra os testes; e documenta, em um arquivo versionado, como o projeto é compilado e testado. O badge no README mostra o estado da `main`.

### 2. Por que os testes de integração rodam em um SQL Server de verdade no CI, em vez de um banco em memória? Como a senha foi tratada?

**Por que real:** o EF Core InMemory não executa SQL, trigger, stored procedure, índice único nem transação com `UPDLOCK`; um teste que passa nele pode falhar no banco de verdade. Como as regras mais delicadas do projeto (auditoria por trigger, concorrência, relatório por procedure) vivem no SQL Server, só um SQL Server real as prova.

**Senha:** o container do banco é criado e destruído dentro da execução do CI, então a senha é descartável e fica no workflow. O que **nunca** vai para o Git são as credenciais de bancos que persistem (desenvolvimento, produção): essas ficam em user-secrets ou em variáveis de ambiente.
