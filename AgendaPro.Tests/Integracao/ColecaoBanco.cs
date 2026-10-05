namespace AgendaPro.Tests.Integracao;

// Todas as classes de integração dividem UMA factory e UM banco (AgendaPro_Tests).
// Com IClassFixture cada classe criaria a sua factory, e o xUnit roda classes em paralelo:
// uma recriaria o banco enquanto a outra ainda estivesse usando.
[CollectionDefinition(Nome)]
public class ColecaoBanco : ICollectionFixture<AgendaProFactory>
{
    public const string Nome = "Banco de testes";
}
