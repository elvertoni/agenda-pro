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

var app = builder.Build();

// Em Development a página de erro do desenvolvedor (automática) já mostra o stack trace.
// Fora dele, exceção não tratada vira ProblemDetails 500 genérico, sem vazar detalhes.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();

// Necessário para os testes de integração (WebApplicationFactory<Program>) enxergarem esta classe.
public partial class Program { }
