namespace AgendaPro.Api.Services;

// Funções puras (sem banco, sem relógio): fáceis de testar e reutilizadas em Horários e Agendamentos.
public static class Intervalos
{
    // Dois intervalos se sobrepõem quando cada um começa antes de o outro terminar.
    // Estritamente menor/maior de propósito: encostar (10:00–10:30 e 10:30–11:00) NÃO é sobreposição.
    // Genérico para servir tanto a TimeOnly (horários de trabalho) quanto a DateTime (agendamentos).
    public static bool Sobrepoe<T>(T inicioA, T fimA, T inicioB, T fimB) where T : IComparable<T> =>
        inicioA.CompareTo(fimB) < 0 && fimA.CompareTo(inicioB) > 0;
}
