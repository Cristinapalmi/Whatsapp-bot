/**
 * DADOS DE EXEMPLO — corre com: npm run db:seed
 *
 * Cria:
 *  - 1 conta de administração (telefone/palavra-passe do .env: ADMIN_PHONE / ADMIN_PASSWORD)
 *  - 1 conta de artista de teste:  +244 900 000 002 / artista123
 *  - 1 conta de fã de teste:       +244 900 000 003 / fa123456
 *  - 6 artistas fictícios e 6 séries com episódios, ganchos e preços
 *
 * Para NÃO criar os dados de exemplo (só a conta admin), define SEED_DEMO=false.
 * Pode ser corrido várias vezes: não duplica nada.
 */
import { PrismaClient, type Category, type ConsentDocument } from "@prisma/client";
import bcrypt from "bcryptjs";

try {
  process.loadEnvFile?.(".env");
} catch {}

const db = new PrismaClient();
const VERSION = "2026-11-v1";

const ARTIST_DOCS: ConsentDocument[] = [
  "TERMS", "PRIVACY", "ARTIST_SHOW_SERIES", "ARTIST_FREE_EPISODES", "ARTIST_REVENUE_SPLIT", "ARTIST_CONTENT_RULES", "ARTIST_WITHDRAWAL_RULES",
];

type Demo = {
  artist: { stageName: string; fullName: string; slug: string; phone: string; category: Category; social: string; bi: string };
  series: { title: string; slug: string; category: Category; priceKz: number; free: number; synopsis: string; featured?: boolean };
  episodes: string[];
  hook: string;
};

const DEMOS: Demo[] = [
  {
    artist: { stageName: "Mana Zinha", fullName: "Teresa Domingos Zinha", slug: "manazinha", phone: "+244900000002", category: "TERROR", social: "https://www.tiktok.com/@manazinha.demo", bi: "001234567LA041" },
    series: { title: "A Kianda do Mussulo", slug: "a-kianda-do-mussulo", category: "TERROR", priceKz: 100, free: 2, featured: true,
      synopsis: "Um grupo de amigos aluga uma casa no Mussulo para o fim de semana. À meia-noite, alguém começa a cantar dentro da água…" },
    episodes: ["A casa na ponta", "Cantos na maré", "Quem abriu a porta?", "O pescador sem sombra", "A oferenda"],
    hook: "A voz chamou o nome da Joana. Mas a Joana estava ao lado deles…",
  },
  {
    artist: { stageName: "Tio Gingas", fullName: "Gilberto Inácio Gingas", slug: "tiogingas", phone: "+244900000012", category: "COMEDIA", social: "https://www.instagram.com/tiogingas.demo", bi: "002345678LA042" },
    series: { title: "As Makas da Tia Bela", slug: "as-makas-da-tia-bela", category: "COMEDIA", priceKz: 50, free: 3,
      synopsis: "A Tia Bela sabe tudo o que acontece no prédio — e o que não sabe, inventa. Esta semana, o alvo é o vizinho novo do 4.º andar." },
    episodes: ["O vizinho do 4.º", "O grupo do WhatsApp", "A festa sem convite", "A sogra chegou", "Bela contra todos"],
    hook: "A Tia Bela abriu a porta… e o vizinho novo era o ex-marido dela.",
  },
  {
    artist: { stageName: "Kota Bento", fullName: "Bento Manuel Kota", slug: "kotabento", phone: "+244900000013", category: "TERROR", social: "https://www.tiktok.com/@kotabento.demo", bi: "003456789LA043" },
    series: { title: "O Candongueiro Assombrado", slug: "o-candongueiro-assombrado", category: "TERROR", priceKz: 100, free: 2,
      synopsis: "O Zé arranja trabalho num azul e branco barato. Só há um problema: depois das 22h, entra sempre um passageiro que ninguém vê." },
    episodes: ["Última volta", "O passageiro do banco de trás", "Paragem do cemitério", "O cobrador desaparecido", "Fim da linha"],
    hook: "O Zé olhou pelo retrovisor. O banco de trás estava vazio — mas alguém disse: «Pára aqui, motorista».",
  },
  {
    artist: { stageName: "Nayara K.", fullName: "Nayara Kiala Kissanga", slug: "nayarak", phone: "+244900000014", category: "DRAMA", social: "https://www.instagram.com/nayarak.demo", bi: "004567890LA044" },
    series: { title: "Traição no Kilamba", slug: "traicao-no-kilamba", category: "DRAMA", priceKz: 150, free: 2,
      synopsis: "Um casal perfeito, um apartamento novo no Kilamba e uma mensagem que não devia ter chegado. Nada é o que parece." },
    episodes: ["A mensagem", "O jantar de família", "A melhor amiga", "O vídeo", "A escolha"],
    hook: "No telemóvel dele, a última mensagem dizia: «Ela ainda não sabe de nada.»",
  },
  {
    artist: { stageName: "DJ Malamba", fullName: "Mário Lázaro Malamba", slug: "djmalamba", phone: "+244900000015", category: "COMEDIA", social: "https://www.tiktok.com/@djmalamba.demo", bi: "005678901LA045" },
    series: { title: "O Kudurista Falido", slug: "o-kudurista-falido", category: "COMEDIA", priceKz: 75, free: 2,
      synopsis: "Já foi rei das festas, hoje não tem saldo nem para o táxi. Agora quer voltar ao topo — custe o que custar." },
    episodes: ["Sem saldo", "O show na rua", "O produtor de Viana", "Viral por engano", "O grande regresso"],
    hook: "O vídeo explodiu na internet… mas pelas piores razões.",
  },
  {
    artist: { stageName: "Mamã Rosa", fullName: "Rosa Bernardo Kitoko", slug: "mamarosa", phone: "+244900000016", category: "MAKAS_FAMILIA", social: "https://www.instagram.com/mamarosa.demo", bi: "006789012LA046" },
    series: { title: "A Herança do Avô Kitoko", slug: "a-heranca-do-avo-kitoko", category: "MAKAS_FAMILIA", priceKz: 100, free: 2,
      synopsis: "O avô Kitoko deixou uma casa, um terreno e um testamento escondido. Os netos já começaram a guerra." },
    episodes: ["O óbito", "O testamento", "O primo de Benguela", "O terreno no Zango", "A verdade do avô"],
    hook: "O notário leu a última linha: «E a casa fica para o filho que vocês não conhecem.»",
  },
];

const hash = (pw: string) => bcrypt.hash(pw, 10);

async function main() {
  // ---------- Administração ----------
  const adminPhone = process.env.ADMIN_PHONE ?? "+244900000001";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  await db.user.upsert({
    where: { phone: adminPhone },
    update: { role: "ADMIN" },
    create: { name: "Administração", phone: adminPhone, passwordHash: await hash(adminPassword), birthDate: new Date("1990-01-01"), role: "ADMIN" },
  });
  console.log(`Admin: ${adminPhone}`);

  if (process.env.SEED_DEMO === "false") return;

  // ---------- Fã de teste ----------
  await db.user.upsert({
    where: { phone: "+244900000003" },
    update: {},
    create: {
      name: "Fã de Teste",
      phone: "+244900000003",
      passwordHash: await hash("fa123456"),
      birthDate: new Date("2000-05-10"),
      consents: { create: [{ document: "TERMS", version: VERSION }, { document: "PRIVACY", version: VERSION }] },
    },
  });

  // ---------- Artistas e séries ----------
  for (const d of DEMOS) {
    const isTestArtist = d.artist.phone === "+244900000002";
    const user = await db.user.upsert({
      where: { phone: d.artist.phone },
      update: {},
      create: {
        name: d.artist.fullName,
        phone: d.artist.phone,
        email: `${d.artist.slug}@exemplo.ao`,
        passwordHash: await hash(isTestArtist ? "artista123" : `demo-${Math.random()}`),
        birthDate: new Date("1994-03-15"),
        role: "ARTIST",
        consents: { create: ARTIST_DOCS.map((document) => ({ document, version: VERSION })) },
      },
    });
    const artist = await db.artistProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        stageName: d.artist.stageName,
        fullName: d.artist.fullName,
        biNumber: d.artist.bi,
        email: `${d.artist.slug}@exemplo.ao`,
        socialUrl: d.artist.social,
        category: d.artist.category,
        slug: d.artist.slug,
        status: "APPROVED",
        approvedAt: new Date(),
      },
    });

    if (await db.series.findUnique({ where: { slug: d.series.slug } })) continue;
    await db.series.create({
      data: {
        artistId: artist.id,
        title: d.series.title,
        slug: d.series.slug,
        synopsis: d.series.synopsis,
        category: d.series.category,
        coverKey: `/covers/${d.series.slug}.svg`,
        socialUrl: d.artist.social,
        plannedEpisodes: d.episodes.length,
        priceCents: d.series.priceKz * 100,
        freeEpisodes: d.series.free,
        featured: !!d.series.featured,
        status: "PUBLISHED",
        publishedAt: new Date(),
        episodes: {
          create: d.episodes.map((title, i) => ({
            number: i + 1,
            title,
            videoKey: "/samples/demo-360.mp4",
            videoKeyHd: "/samples/demo-480.mp4",
            subtitlesKey: "/samples/demo.vtt",
            durationSec: 15,
            endsWithHook: i + 1 === d.series.free,
            hookText: i + 1 === d.series.free ? d.hook : null,
            published: true,
          })),
        },
      },
    });
    console.log(`Série: ${d.series.title}`);
  }

  // Uma série enviada por artista, ainda em análise (para testar o painel admin)
  const test = await db.artistProfile.findUnique({ where: { slug: "manazinha" } });
  if (test && !(await db.series.findUnique({ where: { slug: "o-segredo-da-ilha" } }))) {
    await db.series.create({
      data: {
        artistId: test.id, title: "O Segredo da Ilha", slug: "o-segredo-da-ilha", category: "TERROR",
        socialUrl: "https://www.tiktok.com/@manazinha.demo", plannedEpisodes: 6, status: "IN_REVIEW",
      },
    });
  }
  console.log("Contas de teste: artista +244900000002 / artista123 · fã +244900000003 / fa123456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
