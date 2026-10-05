using AgendaPro.Api.Data;
using AgendaPro.Api.Services;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
// Add services to the container.

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// "Agora" vem do TimeProvider injetado: nos testes dá para trocar por um relógio falso.
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddScoped<AgendamentoService>();

// Padroniza as respostas de erro no formato ProblemDetails (RFC 9457).
builder.Services.AddProblemDetails();

// CORS: só as origens listadas em Cors:Origins (appsettings) podem chamar a API pelo navegador.
// Sem a configuração, nenhuma origem é liberada: o padrão é fechado, não aberto.
const string PoliticaCors = "Frontend";
var origensPermitidas = builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [];
builder.Services.AddCors(opcoes => opcoes.AddPolicy(PoliticaCors, politica =>
    politica.WithOrigins(origensPermitidas).AllowAnyHeader().AllowAnyMethod()));

// Health check: além de "a API está de pé", confere se o banco responde.
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>();

var app = builder.Build();

// Em Development a página de erro do desenvolvedor (automática) já mostra o stack trace.
// Fora dele, exceção não tratada vira ProblemDetails 500 genérico, sem vazar detalhes.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler();
}

// Respostas de erro SEM corpo (rota inexistente = 404, método errado = 405) também viram ProblemDetails.
// Usa o AddProblemDetails() registrado acima; assim todo erro da API tem o mesmo formato.
app.UseStatusCodePages();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

// Antes da autorização, para a resposta ao "preflight" (OPTIONS) do navegador sair com os cabeçalhos de CORS.
app.UseCors(PoliticaCors);

app.UseAuthorization();

app.MapControllers();

// Responde 200 "Healthy" ou 503 "Unhealthy"; o texto não revela detalhes do banco.
app.MapHealthChecks("/health");

app.Run();

// Necessário para os testes de integração (WebApplicationFactory<Program>) enxergarem esta classe.
public partial class Program { }
