"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ConsentDocument } from "@prisma/client";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { createSession, getCurrentUser, hashPassword, recordAttempt, requestMeta, tooManyRegistrations } from "@/lib/auth";
import { ageOn } from "@/lib/dates";
import { RESERVED_SLUGS, slugify } from "@/lib/slug";
import { birthDateSchema, checkbox, passwordSchema, phoneSchema, urlSchema } from "@/lib/validation";
import { toActionError } from "@/lib/actions";
import { newKey, putObject } from "@/domain/storage";
import type { ActionResult } from "@/components/ActionForm";
import { readValidatedFile } from "@/lib/filetype";
import { assignFounder } from "@/domain/artists/growth";

const artistSchema = z.object({
  stageName: z.string().trim().min(2, "Indica o nome artístico.").max(40),
  fullName: z.string().trim().min(5, "Indica o nome completo (como no BI).").max(100),
  biNumber: z.string().trim().toUpperCase().regex(/^\d{9}[A-Z]{2}\d{3}$/, "N.º do BI inválido (ex.: 001234567LA041)."),
  email: z.string().trim().email("E-mail inválido."),
  socialUrl: urlSchema,
  category: z.enum(["TERROR", "COMEDIA", "DRAMA", "MAKAS_FAMILIA", "ROMANCE", "ACAO", "OUTRO"]),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,30}$/, "O link só pode ter letras, números e hífen (3 a 30)."),
  c1: checkbox("Tens de autorizar a plataforma a mostrar as tuas séries (caixa 1)."),
  c2: checkbox("Tens de aceitar os episódios grátis (caixa 2)."),
  c3: checkbox("Tens de aceitar a forma como ganhas (caixa 3)."),
  c4: checkbox("Tens de confirmar as regras do conteúdo (caixa 4)."),
  c5: checkbox("Tens de aceitar as regras de levantamento (caixa 5)."),
  terms: checkbox("Tens de aceitar os Termos e a Política de Privacidade."),
});

const newUserSchema = z.object({ phone: phoneSchema, password: passwordSchema, birthDate: birthDateSchema });

const ARTIST_DOCS: ConsentDocument[] = [
  "ARTIST_SHOW_SERIES", "ARTIST_FREE_EPISODES", "ARTIST_REVENUE_SPLIT", "ARTIST_CONTENT_RULES", "ARTIST_WITHDRAWAL_RULES",
];

export async function registerArtistAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    if (String(fd.get("website") ?? "") !== "") return { error: "Não foi possível criar a conta." };
    const raw = Object.fromEntries(fd);
    const data = artistSchema.parse({ ...raw, slug: raw.slug || slugify(String(raw.stageName ?? "")) });
    if (RESERVED_SLUGS.has(data.slug)) return { error: "Esse link pessoal não está disponível. Escolhe outro." };
    if (await db.artistProfile.findUnique({ where: { slug: data.slug } }))
      return { error: "Esse link pessoal já está a ser usado. Escolhe outro." };

    const current = await getCurrentUser();
    if (current?.role === "ADMIN") return { error: "A conta de administração não pode ser artista." };
    if (current && (await db.artistProfile.findUnique({ where: { userId: current.id } })))
      return { error: "Já tens um registo de artista." };

    let userId: string;
    let birthDate: Date;
    let newUser: z.infer<typeof newUserSchema> | null = null;
    if (current) {
      userId = current.id;
      birthDate = current.birthDate;
    } else {
      newUser = newUserSchema.parse(raw);
      if (await tooManyRegistrations((await requestMeta()).ip)) return { error: "Foram criadas muitas contas a partir desta ligação. Tenta mais tarde." };
      if (await db.user.findUnique({ where: { phone: newUser.phone } }))
        return { error: "Já existe uma conta com este telefone. Entra primeiro e depois regista-te como artista." };
      birthDate = newUser.birthDate;
      userId = "";
    }
    if (ageOn(birthDate) < business.minAgeArtist) return { error: "Os artistas têm de ter 18 anos ou mais." };

    let photoKey: string | null = null;
    const photo = fd.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const f = await readValidatedFile(photo, ["jpeg", "png", "webp"], 3 * 1024 * 1024, "Foto").catch((e: Error) => ({ error: e.message }));
      if ("error" in f) return { error: `${f.error} Usa JPG, PNG ou WEBP.` };
      photoKey = newKey("artists", f.type === "jpeg" ? "jpg" : f.type!);
      await putObject("media", photoKey, f.bytes, `image/${f.type}`);
    }

    // "Traz um kamba": artista que convidou (link /artista/registar?convite=slug)
    const inviteSlug = String(fd.get("convite") ?? "").trim().toLowerCase();
    const inviter = inviteSlug ? await db.artistProfile.findUnique({ where: { slug: inviteSlug }, select: { id: true, userId: true } }) : null;

    const meta = await requestMeta();
    const v = business.legalVersions;
    await db.$transaction(async (tx) => {
      if (newUser) {
        const u = await tx.user.create({
          data: {
            name: data.fullName,
            phone: newUser.phone,
            email: data.email,
            passwordHash: await hashPassword(newUser.password),
            birthDate: newUser.birthDate,
            role: "ARTIST",
          },
        });
        userId = u.id;
      } else {
        await tx.user.update({ where: { id: userId }, data: { role: "ARTIST", email: data.email } });
      }
      await tx.consent.createMany({
        data: [
          { userId, document: "TERMS", version: v.terms, ...meta },
          { userId, document: "PRIVACY", version: v.privacy, ...meta },
          ...ARTIST_DOCS.map((document) => ({ userId, document, version: v.artistPolicy, ...meta })),
        ],
      });
      const created = await tx.artistProfile.create({
        data: {
          invitedByArtistId: inviter && inviter.userId !== userId ? inviter.id : null,
          userId,
          stageName: data.stageName,
          fullName: data.fullName,
          biNumber: data.biNumber,
          email: data.email,
          socialUrl: data.socialUrl,
          category: data.category,
          slug: data.slug,
          photoKey,
          // Fica ativo logo: pode criar séries e carregar vídeos. A verificação (BI + IBAN) é feita antes do primeiro levantamento.
          status: "APPROVED",
          approvedAt: new Date(),
        },
      });
      // Os primeiros 20 artistas são Artistas Fundadores
      await assignFounder(tx, created.id);
    });
    if (newUser) {
      await recordAttempt(newUser.phone, meta.ip, "register", true);
      await createSession(userId);
    }
  } catch (e) {
    return toActionError(e);
  }
  redirect("/artista");
}
