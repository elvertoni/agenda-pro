using AgendaPro.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace AgendaPro.Tests.Integracao;

// Sobe a API inteira em memória, mas apontando para um banco SÓ de testes e com relógio fixo.
public class AgendaProFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private const string BancoDeTestes = "AgendaPro_Tests";

    // Lida uma vez: se faltar a configuração, o erro aparece logo, com instrução clara.
    private readonly string _connectionStringTestes = LerConnectionStringTestes();

    // "Agora" de mentira: segunda-feira, 05/10/2026, 09:00 UTC (TimeZoneInfo.Utc => hora local = 09:00).
    private static readonly DateTimeOffset AgoraFalso = new(2026, 10, 5, 9, 0, 0, TimeSpan.Zero);

    private static string LerConnectionStringTestes()
    {
        // user-secrets no PC do desenvolvedor; variável de ambiente ConnectionStrings__Tests no CI.
        var config = new ConfigurationBuilder()
            .AddUserSecrets<AgendaProFactory>()
            .AddEnvironmentVariables()
            .Build();

        var conexao = config["ConnectionStrings:Tests"];

        if (string.IsNullOrWhiteSpace(conexao))
            throw new InvalidOperationException(
                "Connection string de testes não configurada. " +
                "Defina 'ConnectionStrings:Tests' nos user-secrets do projeto AgendaPro.Tests " +
                "(dotnet user-secrets set \"ConnectionStrings:Tests\" \"<sua connection string>\" --project AgendaPro.Tests) " +
                "ou a variável de ambiente ConnectionStrings__Tests. " +
                $"O banco usado deve se chamar exatamente {BancoDeTestes}.");

        return conexao;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            // O EF Core 9+ registra DUAS coisas para o DbContext. Se só uma for removida,
            // o banco de desenvolvimento continuaria sendo usado.
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<AppDbContext>>();
            services.AddDbContext<AppDbContext>(o => o.UseSqlServer(_connectionStringTestes));

            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(new RelogioFalso(AgoraFalso));
        });
    }

    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Trava de segurança: confere o banco que o DbContext REALMENTE usa antes de apagar qualquer coisa.
        var nomeDoBanco = db.Database.GetDbConnection().Database;
        if (nomeDoBanco != BancoDeTestes)
            throw new InvalidOperationException(
                $"Os testes só podem apagar o banco '{BancoDeTestes}'. " +
                "O DbContext está apontando para outro banco; confira ConnectionStrings:Tests.");

        // Banco limpo a cada execução da suíte.
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
    }

    // WebApplicationFactory também tem DisposeAsync (ValueTask), então a do xUnit é explícita.
    // O banco não é apagado aqui: assim dá para inspecioná-lo depois de uma falha.
    async Task IAsyncLifetime.DisposeAsync() => await base.DisposeAsync();
}

// Relógio que sempre devolve o mesmo instante.
public class RelogioFalso(DateTimeOffset agora) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => agora;

    public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
}
