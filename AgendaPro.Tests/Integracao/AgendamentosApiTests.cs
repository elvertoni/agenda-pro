using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AgendaPro.Api.Dtos;
using AgendaPro.Api.Models;

namespace AgendaPro.Tests.Integracao;

// Testes de ponta a ponta: HTTP -> controller -> service -> SQL Server (banco AgendaPro_Tests).
// "Agora" do relógio falso é 05/10/2026 (segunda), então 12/10/2026 (segunda) é sempre futuro.
public class AgendamentosApiTests(AgendaProFactory factory) : IClassFixture<AgendaProFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private static readonly DateTime Segunda = new(2026, 10, 12);

    private readonly HttpClient _http = factory.CreateClient();

    private static DateTime Em(int hora, int minuto = 0) => Segunda.AddHours(hora).AddMinutes(minuto);

    // ---------- Agendar: caminho feliz ----------

    [Fact]
    public async Task Agendar_NoExpedienteSemDuracao_Retorna201ComDuracaoPadrao()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();

        // Objeto anônimo sem DuracaoMinutos: o campo realmente não vai no JSON.
        var resposta = await _http.PostAsJsonAsync("api/agendamentos",
            new { ProfissionalId = profissionalId, ClienteId = clienteId, DataHoraInicio = Em(10) }, Json);

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);

        var agendamento = await LerAsync<AgendamentoDto>(resposta);
        Assert.Equal(StatusAgendamento.Agendado, agendamento.Status);
        Assert.Equal(30, agendamento.DuracaoMinutos);
        Assert.Equal(Em(10), agendamento.DataHoraInicio);
        Assert.Equal(Em(10, 30), agendamento.DataHoraFim);
    }

    // ---------- Agendar: conflitos ----------

    [Fact]
    public async Task Agendar_MesmoHorarioDuasVezes_Retorna409()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();
        await AgendarComSucessoAsync(profissionalId, clienteId, Em(10));

        var resposta = await PostAgendamentoAsync(profissionalId, clienteId, Em(10));

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
        // Erros de regra de negócio saem como ProblemDetails.
        Assert.Equal("application/problem+json", resposta.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Agendar_HorarioQueEncostaNoFimDeOutro_Retorna201()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();
        await AgendarComSucessoAsync(profissionalId, clienteId, Em(10)); // 10:00–10:30

        var resposta = await PostAgendamentoAsync(profissionalId, clienteId, Em(10, 30)); // 10:30–11:00

        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
    }

    [Fact]
    public async Task Agendar_SobreposicaoParcial_Retorna409()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();
        await AgendarComSucessoAsync(profissionalId, clienteId, Em(10)); // 10:00–10:30

        var resposta = await PostAgendamentoAsync(profissionalId, clienteId, Em(10, 15)); // 10:15–10:45

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
    }

    // ---------- Agendar: expediente e passado ----------

    [Fact]
    public async Task Agendar_ForaDoExpediente_Retorna400()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();

        var resposta = await PostAgendamentoAsync(profissionalId, clienteId, Em(13));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Agendar_TerminandoDepoisDoFimDoExpediente_Retorna400()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();

        // 11:45 + 30 min termina às 12:15, e o expediente acaba às 12:00.
        var resposta = await PostAgendamentoAsync(profissionalId, clienteId, Em(11, 45));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Agendar_DiaSemHorarioDeTrabalho_Retorna400()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();

        // O profissional só trabalha às segundas; 13/10/2026 é terça.
        var terca = new DateTime(2026, 10, 13, 10, 0, 0);
        var resposta = await PostAgendamentoAsync(profissionalId, clienteId, terca);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Agendar_NoPassado_Retorna400()
    {
        var profissionalId = await CriarProfissionalAsync();
        // 01/10/2026 é quinta: com horário nesse dia, o único problema é estar no passado.
        await CriarHorarioAsync(profissionalId, DayOfWeek.Thursday);
        var clienteId = await CriarClienteAsync();

        var resposta = await PostAgendamentoAsync(profissionalId, clienteId, new DateTime(2026, 10, 1, 10, 0, 0));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    // ---------- Cancelar e concluir ----------

    [Fact]
    public async Task Cancelar_AgendamentoAgendado_Retorna200ELiberaOHorario()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();
        var agendamento = await AgendarComSucessoAsync(profissionalId, clienteId, Em(10));

        var resposta = await _http.PatchAsync($"api/agendamentos/{agendamento.Id}/cancelar", null);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var cancelado = await LerAsync<AgendamentoDto>(resposta);
        Assert.Equal(StatusAgendamento.Cancelado, cancelado.Status);

        // Cancelado não ocupa mais o horário: dá para agendar de novo no mesmo lugar.
        var novo = await PostAgendamentoAsync(profissionalId, clienteId, Em(10));
        Assert.Equal(HttpStatusCode.Created, novo.StatusCode);
    }

    [Fact]
    public async Task Cancelar_AgendamentoJaCancelado_Retorna409()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();
        var agendamento = await AgendarComSucessoAsync(profissionalId, clienteId, Em(10));
        await _http.PatchAsync($"api/agendamentos/{agendamento.Id}/cancelar", null);

        var resposta = await _http.PatchAsync($"api/agendamentos/{agendamento.Id}/cancelar", null);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
    }

    [Fact]
    public async Task Concluir_AgendamentoCancelado_Retorna409()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();
        var agendamento = await AgendarComSucessoAsync(profissionalId, clienteId, Em(10));
        await _http.PatchAsync($"api/agendamentos/{agendamento.Id}/cancelar", null);

        var resposta = await _http.PatchAsync($"api/agendamentos/{agendamento.Id}/concluir", null);

        Assert.Equal(HttpStatusCode.Conflict, resposta.StatusCode);
    }

    [Fact]
    public async Task Concluir_AgendamentoAgendado_Retorna200ComStatusConcluido()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();
        var agendamento = await AgendarComSucessoAsync(profissionalId, clienteId, Em(10));

        var resposta = await _http.PatchAsync($"api/agendamentos/{agendamento.Id}/concluir", null);

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var concluido = await LerAsync<AgendamentoDto>(resposta);
        Assert.Equal(StatusAgendamento.Concluido, concluido.Status);
    }

    // ---------- Validações de entrada ----------

    [Fact]
    public async Task Agendar_ProfissionalInativo_Retorna400()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();
        var desativar = await _http.PatchAsync($"api/profissionais/{profissionalId}/ativo",
            JsonContent.Create(new AlterarAtivoDto(false), options: Json));
        desativar.EnsureSuccessStatusCode();

        var resposta = await PostAgendamentoAsync(profissionalId, clienteId, Em(10));

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Agendar_ProfissionalInexistente_Retorna404()
    {
        var clienteId = await CriarClienteAsync();

        var resposta = await PostAgendamentoAsync(999_999, clienteId, Em(10));

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [Fact]
    public async Task Agendar_ClienteInexistente_Retorna404()
    {
        var profissionalId = await CriarProfissionalAsync();
        await CriarHorarioAsync(profissionalId);

        var resposta = await PostAgendamentoAsync(profissionalId, 999_999, Em(10));

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [Fact]
    public async Task Agendar_DuracaoMenorQueOMinimo_Retorna400()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();

        var resposta = await PostAgendamentoAsync(profissionalId, clienteId, Em(10), duracaoMinutos: 5);

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
        Assert.Equal("application/problem+json", resposta.Content.Headers.ContentType?.MediaType);
    }

    // ---------- Consultas ----------

    [Fact]
    public async Task Obter_AgendamentoExistente_Retorna200()
    {
        var (profissionalId, clienteId) = await CriarProfissionalComExpedienteEClienteAsync();
        var criado = await AgendarComSucessoAsync(profissionalId, clienteId, Em(10));

        var resposta = await _http.GetAsync($"api/agendamentos/{criado.Id}");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var agendamento = await LerAsync<AgendamentoDto>(resposta);
        Assert.Equal(criado.Id, agendamento.Id);
        Assert.Equal(profissionalId, agendamento.ProfissionalId);
        Assert.Equal(clienteId, agendamento.ClienteId);
    }

    [Fact]
    public async Task Obter_AgendamentoInexistente_Retorna404()
    {
        var resposta = await _http.GetAsync("api/agendamentos/999999");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [Fact]
    public async Task Listar_FiltrandoPorProfissionalDataEStatus_RetornaSoOsEsperados()
    {
        var profissionalA = await CriarProfissionalAsync();
        var profissionalB = await CriarProfissionalAsync();
        await CriarHorarioAsync(profissionalA);
        await CriarHorarioAsync(profissionalB);
        var clienteId = await CriarClienteAsync();

        var esperado = await AgendarComSucessoAsync(profissionalA, clienteId, Em(9));
        var cancelado = await AgendarComSucessoAsync(profissionalA, clienteId, Em(10));
        await _http.PatchAsync($"api/agendamentos/{cancelado.Id}/cancelar", null);
        await AgendarComSucessoAsync(profissionalA, clienteId, Em(9).AddDays(7)); // outra segunda
        await AgendarComSucessoAsync(profissionalB, clienteId, Em(9));             // outro profissional

        var resposta = await _http.GetAsync(
            $"api/agendamentos?profissionalId={profissionalA}&data=2026-10-12&status=Agendado");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var lista = await LerAsync<List<AgendamentoDto>>(resposta);
        var unico = Assert.Single(lista);
        Assert.Equal(esperado.Id, unico.Id);
    }

    // ---------- Helpers: criam os dados pela própria API ----------

    private async Task<(int ProfissionalId, int ClienteId)> CriarProfissionalComExpedienteEClienteAsync()
    {
        var profissionalId = await CriarProfissionalAsync();
        await CriarHorarioAsync(profissionalId);
        var clienteId = await CriarClienteAsync();
        return (profissionalId, clienteId);
    }

    // Cada teste cria o seu próprio profissional, assim os testes não interferem entre si.
    private async Task<int> CriarProfissionalAsync()
    {
        var resposta = await _http.PostAsJsonAsync("api/profissionais",
            new CriarProfissionalDto("Dra. Teste", "Clínica Geral"), Json);
        resposta.EnsureSuccessStatusCode();

        var profissional = await LerAsync<ProfissionalDto>(resposta);
        return profissional.Id;
    }

    // Expediente padrão: 08:00–12:00.
    private async Task CriarHorarioAsync(int profissionalId, DayOfWeek dia = DayOfWeek.Monday)
    {
        var resposta = await _http.PostAsJsonAsync($"api/profissionais/{profissionalId}/horarios",
            new CriarHorarioDto(dia, new TimeOnly(8, 0), new TimeOnly(12, 0)), Json);

        // Se falhar, mostra o corpo da resposta: EnsureSuccessStatusCode sozinho não diz o motivo.
        Assert.True(resposta.IsSuccessStatusCode,
            $"POST {resposta.RequestMessage?.RequestUri} (id={profissionalId}) -> {(int)resposta.StatusCode}: " +
            $"{await resposta.Content.ReadAsStringAsync()} | {resposta.Headers}");
    }

    private async Task<int> CriarClienteAsync()
    {
        var resposta = await _http.PostAsJsonAsync("api/clientes",
            new CriarClienteDto("Cliente Teste", GeradorCpf.Novo(), null), Json);
        resposta.EnsureSuccessStatusCode();

        var cliente = await LerAsync<ClienteDto>(resposta);
        return cliente.Id;
    }

    // Duração opcional: sem ela, o campo nem vai no JSON (a API assume 30).
    private Task<HttpResponseMessage> PostAgendamentoAsync(
        int profissionalId, int clienteId, DateTime inicio, int? duracaoMinutos = null)
    {
        object corpo = duracaoMinutos is null
            ? new { ProfissionalId = profissionalId, ClienteId = clienteId, DataHoraInicio = inicio }
            : new { ProfissionalId = profissionalId, ClienteId = clienteId, DataHoraInicio = inicio, DuracaoMinutos = duracaoMinutos };

        return _http.PostAsJsonAsync("api/agendamentos", corpo, Json);
    }

    // Para montar o cenário do teste: falha cedo se o agendamento de preparação não for criado.
    private async Task<AgendamentoDto> AgendarComSucessoAsync(int profissionalId, int clienteId, DateTime inicio)
    {
        var resposta = await PostAgendamentoAsync(profissionalId, clienteId, inicio);
        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        return await LerAsync<AgendamentoDto>(resposta);
    }

    private static async Task<T> LerAsync<T>(HttpResponseMessage resposta)
    {
        var valor = await resposta.Content.ReadFromJsonAsync<T>(Json);
        Assert.NotNull(valor);
        return valor;
    }
}

// Gera CPFs válidos e únicos (a API valida os dígitos verificadores e o CPF é único no banco).
public static class GeradorCpf
{
    private static int _contador = 100_000_000;

    public static string Novo()
    {
        // Interlocked: seguro mesmo se testes rodarem em paralelo.
        var numero = Interlocked.Increment(ref _contador);
        var digitos = numero.ToString("D9").Select(c => c - '0').ToList();

        digitos.Add(CalcularDigito(digitos, pesoInicial: 10));
        digitos.Add(CalcularDigito(digitos, pesoInicial: 11));

        return string.Concat(digitos);
    }

    // Soma cada dígito vezes um peso decrescente; o dígito é 0 se o resto for < 2, senão 11 - resto.
    private static int CalcularDigito(List<int> digitos, int pesoInicial)
    {
        var soma = 0;
        for (var i = 0; i < digitos.Count; i++)
            soma += digitos[i] * (pesoInicial - i);

        var resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }
}
