"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { recordInviteOnSignup } from "@/domain/fans/invites";
import { z } from "zod";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { createSession, hashPassword, recordAttempt, requestMeta, tooManyRegistrations } from "@/lib/auth";
import { ageOn } from "@/lib/dates";
import { birthDateSchema, checkbox, formObject, passwordSchema, phoneSchema } from "@/lib/validation";
import { toActionError } from "@/lib/actions";
import type { ActionResult } from "@/components/ActionForm";

const schema = z.object({
  name: z.string().trim().min(2, "Indica o teu nome."),
  phone: phoneSchema,
  password: passwordSchema,
  birthDate: birthDateSchema,
  terms: checkbox("Tens de aceitar os Termos de Utilização."),
  privacy: checkbox("Tens de aceitar a Política de Privacidade."),
  next: z.string().optional(),
});

export async function registerAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let next = "/";
  try {
    // Campo escondido "armadilha": pessoas não o veem; robôs preenchem-no
    if (String(fd.get("website") ?? "") !== "") return { error: "Não foi possível criar a conta." };
    const data = schema.parse(formObject(fd));
    const { ip } = await requestMeta();
    if (await tooManyRegistrations(ip)) return { error: "Foram criadas muitas contas a partir desta ligação. Tenta mais tarde." };
    if (ageOn(data.birthDate) < business.minAgePublic)
      return { error: `Tens de ter pelo menos ${business.minAgePublic} anos para criar conta.` };
    if (await db.user.findUnique({ where: { phone: data.phone } }))
      return { error: "Já existe uma conta com este número. Entra com a tua palavra-passe." };
    const meta = await requestMeta();
    // "Vieram por ti": artista cujo link pessoal trouxe esta pessoa
    const jar = await cookies();
    const refId = jar.get("ref")?.value;
    const deviceId = jar.get("did")?.value?.slice(0, 64) ?? null;
    const inviteCode = jar.get("amigo")?.value?.slice(0, 16) ?? null;
    const referrer = refId ? await db.artistProfile.findFirst({ where: { id: refId, status: "APPROVED" }, select: { id: true } }) : null;
    const user = await db.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        passwordHash: await hashPassword(data.password),
        birthDate: data.birthDate,
        referredByArtistId: referrer?.id ?? null,
        signupDeviceId: deviceId,
        signupIp: ip,
        consents: {
          create: [
            { document: "TERMS", version: business.legalVersions.terms, ...meta },
            { document: "PRIVACY", version: business.legalVersions.privacy, ...meta },
          ],
        },
      },
    });
    await recordAttempt(data.phone, ip, "register", true);
    // Convite de um amigo (link com ?amigo=CODIGO)
    if (inviteCode) await recordInviteOnSignup(db, { inviteeId: user.id, code: inviteCode, deviceId, ip }).catch((e) => console.error("convite", e));
    await createSession(user.id);
    if (data.next?.startsWith("/") && !data.next.startsWith("//")) next = data.next;
  } catch (e) {
    return toActionError(e);
  }
  redirect(next);
}
