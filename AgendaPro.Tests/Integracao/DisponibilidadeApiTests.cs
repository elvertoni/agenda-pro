using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using AgendaPro.Api.Dtos;
using AgendaPro.Api.Models;

namespace AgendaPro.Tests.Integracao;

// "Agora" do relógio falso é segunda 05/10/2026 09:00; 12/10/2026 (segunda) é futuro.
[Collection(ColecaoBanco.Nome)]
public class DisponibilidadeApiTests(AgendaProFactory factory)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly HttpClient _http = factory.CreateClient();

    // ---------- Consulta ----------

    [Fact]
    public async Task Consultar_SemAgendamentos_DevolveBlocosDoExpediente()
    {
        var profissionalId = await CriarProfissionalComExpedienteAsync(DayOfWeek.Monday, 8, 12);

        var disp = await ConsultarAsync(profissionalId, "2026-10-12", duracao: 60);

        Assert.Equal(4, disp.Horarios.Count);
        Assert.Equal(new TimeOnly(8, 0), disp.Horarios[0].Inicio);
        Assert.Equal(new TimeOnly(9, 0), disp.Horarios[0].Fim);
        Assert.Equal(new TimeOnly(11, 0), disp.Horarios[^1].Inicio);
        Assert.Equal(60, disp.DuracaoMinutos);
    }

    [Fact]
    public async Task Consultar_SemInformarDuracao_Usa30Minutos()
    {
        var profissionalId = await CriarProfissionalComExpedienteAsync(DayOfWeek.Monday, 8, 12);

        var resposta = await _http.GetAsync($"api/profissionais/{profissionalId}/disponibilidade?data=2026-10-12");

        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        var disp = await LerAsync<DisponibilidadeDto>(resposta);
        Assert.Equal(30, disp.DuracaoMinutos);
        Assert.Equal(8, disp.Horarios.Count);
    }

    [Fact]
    public async Task Consultar_DiaSemExpediente_DevolveListaVazia()
    {
        var profissionalId = await CriarProfissionalComExpedienteAsync(DayOfWeek.Monday, 8, 12);

        var disp = await ConsultarAsync(profissionalId, "2026-10-13"); // terça

        Assert.Empty(disp.Horarios);
    }

    // ---------- Relação com os agendamentos ----------

    [Fact]
    public async Task Consultar_DepoisDeAgendar_NaoOfereceOHorarioOcupado()
    {
        var profissionalId = await CriarProfissionalComExpedienteAsync(DayOfWeek.Monday, 8, 12);
        var clienteId = await CriarClienteAsync();
        await AgendarAsync(profissionalId, clienteId, "2026-10-12T10:00:00");

        var disp = await ConsultarAsync(profissionalId, "2026-10-12");

        Assert.Equal(7, disp.Horarios.Count);
        Assert.DoesNotContain(disp.Horarios, h => h.Inicio == new TimeOnly(10, 0));
        // Encostar não é conflito: 09:30 e 10:30 continuam livres.
        Assert.Contains(disp.Horarios, h => h.Inicio == new TimeOnly(9, 30));
        Assert.Contains(disp.Horarios, h => h.Inicio == new TimeOnly(10, 30));
    }

    [Fact]
    public async Task Consultar_DepoisDeCancelar_OHorarioVoltaALivre()
    {
        var profissionalId = await CriarProfissionalComExpedienteAsync(DayOfWeek.Monday, 8, 12);
        var clienteId = await CriarClienteAsync();
        var agendamento = await AgendarAsync(profissionalId, clienteId, "2026-10-12T10:00:00");

        var cancelar = await _http.PatchAsync($"api/agendamentos/{agendamento.Id}/cancelar", null);
        Assert.Equal(HttpStatusCode.OK, cancelar.StatusCode);

        var disp = await ConsultarAsync(profissionalId, "2026-10-12");

        Assert.Equal(8, disp.Horarios.Count);
        Assert.Contains(disp.Horarios, h => h.Inicio == new TimeOnly(10, 0));
    }

    [Fact]
    public async Task Consultar_QualquerHorarioOferecido_PodeSerAgendado()
    {
        // A disponibilidade e o POST usam as mesmas regras: o que é oferecido tem que ser aceito.
        var profissionalId = await CriarProfissionalComExpedienteAsync(DayOfWeek.Monday, 8, 12);
        var clienteId = await CriarClienteAsync();
        await AgendarAsync(profissionalId, clienteId, "2026-10-12T09:00:00");

        var disp = await ConsultarAsync(profissionalId, "2026-10-12");

        foreach (var horario in disp.Horarios)
            await AgendarAsync(profissionalId, clienteId, $"2026-10-12T{horario.Inicio:HH\\:mm\\:ss}");

        var depois = await ConsultarAsync(profissionalId, "2026-10-12");
        Assert.Empty(depois.Horarios);
    }

    // ---------- Hoje e passado ----------

    [Fact]
    public async Task Consultar_DataDeHoje_OfereceSoHorariosFuturos()
    {
        // Relógio falso: segunda 05/10/2026 09:00. Expediente 08–12 => só de 09:00 em diante.
        var profissionalId = await CriarProfissionalComExpedienteAsync(DayOfWeek.Monday, 8, 12);

        var disp = await ConsultarAsync(profissionalId, "2026-10-05");

        Assert.Equal(6, disp.Horarios.Count);
        Assert.Equal(new TimeOnly(9, 0), disp.Horarios[0].Inicio);
    }

    [Fact]
    public async Task Consultar_DataNoPassado_DevolveListaVazia()
    {
        var profissionalId = await CriarProfissionalComExpedienteAsync(DayOfWeek.Monday, 8, 12);

        var disp = await ConsultarAsync(profissionalId, "2026-09-28"); // segunda anterior

        Assert.Empty(disp.Horarios);
    }

    // ---------- Erros ----------

    [Fact]
    public async Task Consultar_SemData_Retorna400()
    {
        var profissionalId = await CriarProfissionalComExpedienteAsync(DayOfWeek.Monday, 8, 12);

        var resposta = await _http.GetAsync($"api/profissionais/{profissionalId}/disponibilidade");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(241)]
    public async Task Consultar_DuracaoForaDoIntervalo_Retorna400(int duracao)
    {
        var profissionalId = await CriarProfissionalComExpedienteAsync(DayOfWeek.Monday, 8, 12);

        var resposta = await _http.GetAsync(
            $"api/profissionais/{profissionalId}/disponibilidade?data=2026-10-12&duracaoMinutos={duracao}");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    [Fact]
    public async Task Consultar_ProfissionalInexistente_Retorna404()
    {
        var resposta = await _http.GetAsync("api/profissionais/999999/disponibilidade?data=2026-10-12");

        Assert.Equal(HttpStatusCode.NotFound, resposta.StatusCode);
    }

    [Fact]
    public async Task Consultar_ProfissionalInativo_Retorna400()
    {
        var profissionalId = await CriarProfissionalComExpedienteAsync(DayOfWeek.Monday, 8, 12);
        var desativar = await _http.PatchAsJsonAsync(
            $"api/profissionais/{profissionalId}/ativo", new { ativo = false }, Json);
        Assert.Equal(HttpStatusCode.OK, desativar.StatusCode);

        var resposta = await _http.GetAsync($"api/profissionais/{profissionalId}/disponibilidade?data=2026-10-12");

        Assert.Equal(HttpStatusCode.BadRequest, resposta.StatusCode);
    }

    // ---------- Helpers: criam os dados pela própria API ----------

    private async Task<DisponibilidadeDto> ConsultarAsync(int profissionalId, string data, int? duracao = null)
    {
        var url = $"api/profissionais/{profissionalId}/disponibilidade?data={data}";
        if (duracao is not null)
            url += $"&duracaoMinutos={duracao}";

        var resposta = await _http.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, resposta.StatusCode);
        return await LerAsync<DisponibilidadeDto>(resposta);
    }

    // Cada teste cria o seu profissional, assim os testes não interferem entre si.
    private async Task<int> CriarProfissionalComExpedienteAsync(DayOfWeek dia, int horaIni, int horaFim)
    {
        var resposta = await _http.PostAsJsonAsync("api/profissionais",
            new CriarProfissionalDto("Dr. Disponibilidade", "Clínica Geral"), Json);
        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        var profissional = await LerAsync<ProfissionalDto>(resposta);

        var horario = await _http.PostAsJsonAsync($"api/profissionais/{profissional.Id}/horarios",
            new CriarHorarioDto(dia, new TimeOnly(horaIni, 0), new TimeOnly(horaFim, 0)), Json);
        Assert.Equal(HttpStatusCode.Created, horario.StatusCode);

        return profissional.Id;
    }

    private async Task<int> CriarClienteAsync()
    {
        var resposta = await _http.PostAsJsonAsync("api/clientes",
            new CriarClienteDto("Cliente Disponibilidade", GeradorCpf.Novo(), null), Json);
        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        return (await LerAsync<ClienteDto>(resposta)).Id;
    }

    // Falha cedo se o agendamento de preparação não for criado (mostra o corpo do erro).
    private async Task<AgendamentoDto> AgendarAsync(int profissionalId, int clienteId, string inicio)
    {
        var resposta = await _http.PostAsJsonAsync("api/agendamentos",
            new { ProfissionalId = profissionalId, ClienteId = clienteId, DataHoraInicio = inicio }, Json);
        Assert.True(resposta.StatusCode == HttpStatusCode.Created,
            $"POST agendamento {inicio} -> {(int)resposta.StatusCode}: {await resposta.Content.ReadAsStringAsync()}");
        return await LerAsync<AgendamentoDto>(resposta);
    }

    private static async Task<T> LerAsync<T>(HttpResponseMessage resposta)
    {
        var valor = await resposta.Content.ReadFromJsonAsync<T>(Json);
        Assert.NotNull(valor);
        return valor;
    }
}
