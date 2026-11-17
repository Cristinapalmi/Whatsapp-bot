import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";


/**
 * Base de dados de TESTE (nunca a de produção!). É apagada e recriada antes dos testes.
 * Define TEST_DATABASE_URL no ficheiro .env.
 */
export function testDbUrl() {
  // carrega .env se existir
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    process.loadEnvFile?.(".env");
  } catch {}
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Define TEST_DATABASE_URL no .env para correr os testes de base de dados.");
  if (process.env.DATABASE_URL && url === process.env.DATABASE_URL && !url.includes("test"))
    throw new Error("TEST_DATABASE_URL não pode ser igual à base de dados principal.");
  return url;
}

export async function resetTestDb(): Promise<PrismaClient> {
  const url = testDbUrl();
  // Segurança: só apaga bases de dados cujo nome contém "test".
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.includes("test")) throw new Error(`Recuso apagar "${dbName}": o nome da BD de teste tem de conter "test".`);
  const client = new PrismaClient({ datasourceUrl: url });
  await client.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await client.$executeRawUnsafe("CREATE SCHEMA public");
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: "ignore",
  });
  return client;
}

let counter = 0;
const uniq = () => `${Date.now()}${counter++}`;

export async function makeUser(db: PrismaClient, role: "PUBLIC" | "ARTIST" | "ADMIN" = "PUBLIC") {
  const n = uniq();
  return db.user.create({
    data: {
      name: `Teste ${n}`,
      phone: `+2449${n.slice(-8).padStart(8, "0")}`,
      passwordHash: "x",
      birthDate: new Date("1995-01-01"),
      role,
    },
  });
}

export async function makeArtistWithSeries(db: PrismaClient, opts: { priceCents?: number; freeEpisodes?: number } = {}) {
  const user = await makeUser(db, "ARTIST");
  const n = uniq();
  const artist = await db.artistProfile.create({
    data: {
      userId: user.id,
      stageName: `Artista ${n}`,
      fullName: "Nome Completo",
      biNumber: "000000000LA000",
      email: "a@b.ao",
      socialUrl: "https://tiktok.com/@x",
      category: "COMEDIA",
      slug: `artista-${n}`,
      status: "APPROVED",
    },
  });
  const series = await db.series.create({
    data: {
      artistId: artist.id,
      title: `Série ${n}`,
      slug: `serie-${n}`,
      category: "COMEDIA",
      priceCents: opts.priceCents ?? 10000,
      freeEpisodes: opts.freeEpisodes ?? 2,
      status: "PUBLISHED",
      episodes: {
        create: [1, 2, 3, 4].map((number) => ({ number, title: `Ep ${number}`, published: true, durationSec: 120 })),
      },
    },
    include: { episodes: { orderBy: { number: "asc" } } },
  });
  return { user, artist, series, episodes: series.episodes };
}

export const randomHash = () => `hash-${uniq()}-${Math.random()}`;
