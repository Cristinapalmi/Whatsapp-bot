"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { business } from "@config/business";
import { db } from "@/lib/db";
import { createSession, hashPassword, requestMeta } from "@/lib/auth";
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
    const data = schema.parse(formObject(fd));
    if (ageOn(data.birthDate) < business.minAgePublic)
      return { error: `Tens de ter pelo menos ${business.minAgePublic} anos para criar conta.` };
    if (await db.user.findUnique({ where: { phone: data.phone } }))
      return { error: "Já existe uma conta com este número. Entra com a tua palavra-passe." };
    const meta = await requestMeta();
    const user = await db.user.create({
      data: {
        name: data.name,
        phone: data.phone,
        passwordHash: await hashPassword(data.password),
        birthDate: data.birthDate,
        consents: {
          create: [
            { document: "TERMS", version: business.legalVersions.terms, ...meta },
            { document: "PRIVACY", version: business.legalVersions.privacy, ...meta },
          ],
        },
      },
    });
    await createSession(user.id);
    if (data.next?.startsWith("/") && !data.next.startsWith("//")) next = data.next;
  } catch (e) {
    return toActionError(e);
  }
  redirect(next);
}
