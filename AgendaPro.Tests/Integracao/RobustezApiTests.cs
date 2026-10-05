using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using AgendaPro.Api.Data;
using AgendaPro.Api.Dtos;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace AgendaPro.Tests.Integracao;

// "Agora" do relógio falso é segunda 05/10/2026; 12/10/2026 (segunda) é futuro.
[Collection(ColecaoBanco.Nome)]
public class RobustezApiTests(AgendaProFactory factory)
{
    private readonly HttpClient _http = factory.CreateClient();
    private readonly ApiHelper _api = new(factory.CreateClient());

    // ---------- Health check ----------

    [Fact]
    public async Task Health_ComBancoNoAr_Retorna200Healthy()
    {
        var resposta = await _http.GetAsync("health");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        Assert.Equal("Healthy", await resposta.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Health_ComBancoIndisponivel_Retorna503SemVazarDetalhes()
    {
        // Mesma API, mas apontando para um servidor que não existe.
        using var fabricaSemBanco = factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(o => o.UseSqlServer(
                "Server=localhost,1;Database=nao_existe;User Id=sem_acesso;Connect Timeout=2;TrustServerCertificate=True"));
        }));

        var resposta = await fabricaSemBanco.CreateClient().GetAsync("health");
        var corpo = await resposta.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.ServiceUnavailable, resposta.StatusCode);
        Assert.Equal("Unhealthy", corpo);
        Assert.DoesNotContain("localhost", corpo); // nada da connection string ou da exceção na resposta
    }

    // ---------- CORS ----------

    [Fact]
    public async Task Cors_Preflight_DaOrigemPermitida_LiberaOsCabecalhos()
    {
        var pedido = new HttpRequestMessage(HttpMethod.Options, "api/profissionais");
        pedido.Headers.Add("Origin", "http://localhost:4200");
        pedido.Headers.Add("Access-Control-Request-Method", "POST");
        pedido.Headers.Add("Access-Control-Request-Headers", "content-type");

        var resposta = await _http.SendAsync(pedido);

        Assert.True(resposta.IsSuccessStatusCode, $"preflight devolveu {(int)resposta.StatusCode}");
        Assert.Equal("http://localhost:4200", Assert.Single(resposta.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Fact]
    public async Task Cors_RequisicaoDaOrigemPermitida_RecebeOCabecalho()
    {
        var pedido = new HttpRequestMessage(HttpMethod.Get, "api/profissionais");
        pedido.Headers.Add("Origin", "http://localhost:4200");

        var resposta = await _http.SendAsync(pedido);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        Assert.Equal("http://localhost:4200", Assert.Single(resposta.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [Theory]
    [InlineData("http://site-malicioso.com")]
    [InlineData("http://localhost:3000")]  // outra porta já é outra origem
    [InlineData("https://localhost:4200")] // outro protocolo também
    public async Task Cors_OrigemNaoPermitida_NaoRecebeOCabecalho(string origem)
    {
        var pedido = new HttpRequestMessage(HttpMethod.Options, "api/profissionais");
        pedido.Headers.Add("Origin", origem);
        pedido.Headers.Add("Access-Control-Request-Method", "POST");

        var resposta = await _http.SendAsync(pedido);

        Assert.False(resposta.Headers.Contains("Access-Control-Allow-Origin"),
            $"a origem {origem} não deveria ser liberada");
    }

    // ---------- CPF mascarado ----------

    [Fact]
    public async Task Clientes_TodasAsRespostas_DevolvemOCpfMascarado()
    {
        var cpf = GeradorCpf.Novo();
        var mascaraEsperada = $"***.{cpf.Substring(3, 3)}.{cpf.Substring(6, 3)}-**";

        // POST
        var criar = await _http.PostAsJsonAsync("api/clientes", new CriarClienteDto("Cliente Mascara", cpf, null), ApiHelper.Json);
        var corpoCriar = await criar.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.Created, criar.StatusCode);
        var id = (await criar.Content.ReadFromJsonAsync<ClienteDto>(ApiHelper.Json))!.Id;

        // GET por id, GET lista (com filtro) e PUT
        var obter = await _http.GetStringAsync($"api/clientes/{id}");
        var lista = await _http.GetStringAsync("api/clientes?nome=Cliente Mascara");
        var atualizar = await _http.PutAsJsonAsync($"api/clientes/{id}", new AtualizarClienteDto("Cliente Mascara", null), ApiHelper.Json);
        var corpoAtualizar = await atualizar.Content.ReadAsStringAsync();

        foreach (var corpo in new[] { corpoCriar, obter, lista, corpoAtualizar })
        {
            Assert.Contains(mascaraEsperada, corpo);
            Assert.DoesNotContain(cpf, corpo); // o CPF completo nunca sai
        }
    }

    [Fact]
    public async Task Clientes_CpfJaCadastrado_AindaBarraPeloCpfCompleto()
    {
        // Mascarar a saída não pode mudar a entrada: o CPF completo continua valendo para validar e deduplicar.
        var cpf = GeradorCpf.Novo();
        var primeiro = await _http.PostAsJsonAsync("api/clientes", new CriarClienteDto("Cliente Um", cpf, null), ApiHelper.Json);
        var segundo = await _http.PostAsJsonAsync("api/clientes", new CriarClienteDto("Cliente Dois", cpf, null), ApiHelper.Json);

        Assert.Equal(HttpStatusCode.Created, primeiro.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, segundo.StatusCode);
    }

    // ---------- Logs estruturados ----------

    [Fact]
    public async Task Logs_AgendamentoCriadoConflitoECancelamento_SaemEstruturadosESemDadosPessoais()
    {
        var coletor = new ColetorDeLogs();
        using var fabrica = factory.WithWebHostBuilder(b =>
            b.ConfigureTestServices(services => services.AddLogging(l => l.AddProvider(coletor))));
        var http = fabrica.CreateClient();
        var api = new ApiHelper(http);

        var cpf = GeradorCpf.Novo();
        const string nomeDoCliente = "Cliente Sigiloso Do Log";
        var profissionalId = await api.CriarProfissionalComExpedienteAsync("Dr. Sigiloso Do Log");
        var clienteResposta = await http.PostAsJsonAsync("api/clientes", new CriarClienteDto(nomeDoCliente, cpf, "(41) 98888-7777"), ApiHelper.Json);
        var clienteId = (await clienteResposta.Content.ReadFromJsonAsync<ClienteDto>(ApiHelper.Json))!.Id;

        var criado = await api.AgendarAsync(profissionalId, clienteId, "2026-10-12T10:00:00");
        var conflito = await http.PostAsJsonAsync("api/agendamentos",
            new { ProfissionalId = profissionalId, ClienteId = clienteId, DataHoraInicio = "2026-10-12T10:00:00" }, ApiHelper.Json);
        Assert.Equal(HttpStatusCode.Conflict, conflito.StatusCode);
        await api.MudarStatusAsync(criado.Id, "cancelar");

        var doServico = coletor.Registros
            .Where(r => r.Categoria.EndsWith("AgendamentoService"))
            .ToList();

        // criado (Information), com os valores como campos nomeados e não só dentro do texto
        var registroCriado = Assert.Single(doServico, r => r.Mensagem.Contains("criado"));
        Assert.Equal(LogLevel.Information, registroCriado.Nivel);
        Assert.Equal(criado.Id, registroCriado.Campos["AgendamentoId"]);
        Assert.Equal(profissionalId, registroCriado.Campos["ProfissionalId"]);
        Assert.Equal(clienteId, registroCriado.Campos["ClienteId"]);

        // conflito rejeitado (Warning)
        var registroConflito = Assert.Single(doServico, r => r.Mensagem.Contains("Conflito"));
        Assert.Equal(LogLevel.Warning, registroConflito.Nivel);
        Assert.Equal(profissionalId, registroConflito.Campos["ProfissionalId"]);

        // cancelamento (Information)
        var registroCancelado = Assert.Single(doServico, r => r.Campos.ContainsKey("NovoStatus"));
        Assert.Equal(LogLevel.Information, registroCancelado.Nivel);
        Assert.Equal(criado.Id, registroCancelado.Campos["AgendamentoId"]);

        // Nenhum log de nenhuma categoria (inclusive EF e ASP.NET) pode conter CPF, nome ou telefone.
        foreach (var registro in coletor.Registros)
        {
            var tudo = registro.Mensagem + " " + string.Join(" ", registro.Campos.Values.Select(v => v?.ToString()));
            Assert.DoesNotContain(cpf, tudo);
            Assert.DoesNotContain("Sigiloso", tudo);
            Assert.DoesNotContain("98888-7777", tudo);
        }
    }

    // ---------- Erros sempre em ProblemDetails ----------

    [Theory]
    [InlineData("api/profissionais/999999")]
    [InlineData("api/clientes/999999")]
    [InlineData("api/agendamentos/999999")]
    [InlineData("api/agendamentos/999999/auditoria")]
    [InlineData("api/profissionais/999999/horarios")]
    [InlineData("api/profissionais/999999/disponibilidade?data=2026-10-12")]
    public async Task Erro404_SaiComoProblemDetails(string url)
    {
        var resposta = await _http.GetAsync(url);

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
        Assert.Equal("application/problem+json", resposta.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Erro404_DeRotaInexistente_SaiComoProblemDetails()
    {
        var resposta = await _http.GetAsync("nao-existe");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
        Assert.Equal("application/problem+json", resposta.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Erro405_DeMetodoNaoPermitido_SaiComoProblemDetails()
    {
        var resposta = await _http.DeleteAsync("api/profissionais"); // só existem GET e POST nessa rota

        Assert.Equal(HttpStatusCode.MethodNotAllowed, resposta.StatusCode);
        Assert.Equal("application/problem+json", resposta.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Erro400_DeValidacaoSaiComoProblemDetails()
    {
        var resposta = await _http.PostAsJsonAsync("api/clientes", new CriarClienteDto("", "123", null), ApiHelper.Json);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal("application/problem+json", resposta.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Erro409_DeRegraDeNegocioSaiComoProblemDetails()
    {
        var profissionalId = await _api.CriarProfissionalComExpedienteAsync();
        var clienteId = await _api.CriarClienteAsync();
        await _api.AgendarAsync(profissionalId, clienteId, "2026-10-12T09:00:00");

        var resposta = await _http.PostAsJsonAsync("api/agendamentos",
            new { ProfissionalId = profissionalId, ClienteId = clienteId, DataHoraInicio = "2026-10-12T09:00:00" }, ApiHelper.Json);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
        Assert.Equal("application/problem+json", resposta.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task ProblemDetails_NaoVazaStackTraceNemTextoDoBanco()
    {
        var resposta = await _http.GetAsync("api/agendamentos/999999");
        var corpo = await resposta.Content.ReadAsStringAsync();

        Assert.DoesNotMatch(new Regex(@"\bat [A-Z]\w+\.", RegexOptions.None), corpo); // linha de stack trace
        Assert.DoesNotContain("SqlException", corpo);
    }
}

public record RegistroDeLog(string Categoria, LogLevel Nivel, string Mensagem, Dictionary<string, object?> Campos);

// Guarda tudo o que a API loga durante um teste, com os campos nomeados (ex.: ProfissionalId), para conferir.
public class ColetorDeLogs : ILoggerProvider
{
    public ConcurrentQueue<RegistroDeLog> Registros { get; } = new();

    public ILogger CreateLogger(string categoria) => new Logger(categoria, Registros);

    public void Dispose() { }

    private class Logger(string categoria, ConcurrentQueue<RegistroDeLog> fila) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel nivel) => true;

        public void Log<TState>(LogLevel nivel, EventId id, TState state, Exception? excecao,
            Func<TState, Exception?, string> formatador)
        {
            var campos = new Dictionary<string, object?>();
            if (state is IEnumerable<KeyValuePair<string, object?>> pares)
                foreach (var par in pares)
                    campos[par.Key] = par.Value;

            fila.Enqueue(new RegistroDeLog(categoria, nivel, formatador(state, excecao), campos));
        }
    }
}
