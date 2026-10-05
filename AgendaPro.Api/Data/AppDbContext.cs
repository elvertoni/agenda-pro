using AgendaPro.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AgendaPro.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Profissional> Profissionais => Set<Profissional>();
    public DbSet<HorarioTrabalho> HorariosTrabalho => Set<HorarioTrabalho>();
    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<Agendamento> Agendamentos => Set<Agendamento>();
    public DbSet<AuditoriaAgendamento> AuditoriaAgendamentos => Set<AuditoriaAgendamento>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<Profissional>(e =>
        {
            e.Property(p => p.Nome).HasMaxLength(100);
            e.Property(p => p.Especialidade).HasMaxLength(80);
        });

        mb.Entity<Cliente>(e =>
        {
            e.Property(c => c.Nome).HasMaxLength(100);
            e.Property(c => c.Cpf).HasMaxLength(11).IsFixedLength();
            e.HasIndex(c => c.Cpf).IsUnique();
        });

        mb.Entity<Agendamento>(e =>
        {
            e.Property(a => a.Status).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(a => new { a.ProfissionalId, a.DataHoraInicio });

            // Avisa o EF que a tabela tem trigger: sem isso, o SaveChanges falha com o erro
            // "OUTPUT clause cannot be used on a table with enabled triggers".
            e.ToTable(t => t.HasTrigger("trg_Agendamentos_Auditoria"));
        });

        mb.Entity<AuditoriaAgendamento>(e =>
        {
            e.Property(a => a.StatusAnterior).HasConversion<string>().HasMaxLength(20);
            e.Property(a => a.StatusNovo).HasConversion<string>().HasMaxLength(20);
            e.Property(a => a.UsuarioBanco).HasMaxLength(128);
            e.HasIndex(a => a.AgendamentoId);
        });
    }
}