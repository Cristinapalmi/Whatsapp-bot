import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatKz } from "@/lib/money";
import { defaultEpisodePriceCoins, packBonusPercent } from "@/domain/coins/service";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { saveCoinPackAction, saveGiftTypeAction } from "../actions";
import { SettingsGroupForm } from "@/components/SettingsGroupForm";

export const metadata: Metadata = { title: "Moedas" };

export default async function AdminCoins() {
  const [price, packs, gifts] = await Promise.all([
    defaultEpisodePriceCoins(db),
    db.coinPack.findMany({ orderBy: [{ sortOrder: "asc" }, { priceKz: "asc" }] }),
    db.giftType.findMany({ orderBy: [{ sortOrder: "asc" }, { priceCoins: "asc" }] }),
  ]);
  const activePacks = packs.filter((p) => p.active);
  const base = activePacks.reduce((a, p) => (p.priceKz < a.priceKz ? p : a), activePacks[0] ?? { priceKz: 1, coins: 1 });

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Moedas</h1>

      <section className="card mt-4">
        <h2 className="font-bold">Preços por nível</h2>
        <p className="text-sm text-muted">Os primeiros 3 episódios de cada série são sempre grátis. As séries novas começam em Entrada e sobem sozinhas a Normal; Premium só tu decides (na página da série). O que já foi desbloqueado fica desbloqueado.</p>
        <SettingsGroupForm group="precos" />
        {activePacks[0] && <p className="mt-2 text-xs text-muted">No pacote mais pequeno, {price} moedas (Normal) ≈ {formatKz(Math.round((base.priceKz * 100 * price) / base.coins))}.</p>}
      </section>

      <section className="card mt-4">
        <h2 className="font-bold">Oferta de boas-vindas</h2>
        <p className="text-sm text-muted">Só para quem nunca comprou moedas. Aparece com uma contagem real que começa na 1.ª vez que a pessoa a vê e nunca recomeça. As moedas extra contam no valor real (o lote vale o que a pessoa pagou).</p>
        <SettingsGroupForm group="ofertas" />
      </section>

      <h2 className="mt-8 text-lg font-bold">Pacotes da Loja</h2>
      <p className="text-sm text-muted">O bónus (+%) é calculado automaticamente em relação ao pacote mais barato ativo.</p>
      <ul className="mt-3 space-y-2">
        {packs.map((p) => (
          <li key={p.id} className="card">
            <ActionForm action={saveCoinPackAction} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_90px_auto_auto]">
              <input type="hidden" name="id" value={p.id} />
              <div><label className="label" htmlFor={`pk-${p.id}`}>Preço (Kz)</label><input className="input" id={`pk-${p.id}`} name="priceKz" type="number" min={100} defaultValue={p.priceKz} required /></div>
              <div><label className="label" htmlFor={`pc-${p.id}`}>Moedas</label><input className="input" id={`pc-${p.id}`} name="coins" type="number" min={1} defaultValue={p.coins} required /></div>
              <div><label className="label" htmlFor={`po-${p.id}`}>Ordem</label><input className="input" id={`po-${p.id}`} name="sortOrder" type="number" min={0} defaultValue={p.sortOrder} /></div>
              <label className="flex min-h-tap items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} className="checkbox mt-0" /> Ativo</label>
              <SubmitButton className="btn-secondary">Guardar</SubmitButton>
              <p className="col-span-full text-xs text-muted">{p.active ? `Bónus: +${packBonusPercent(p, base)}%` : "Inativo (não aparece na Loja)"}</p>
            </ActionForm>
          </li>
        ))}
      </ul>
      <ActionForm action={saveCoinPackAction} className="card mt-3 grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_90px_auto]" resetOnSuccess>
        <div><label className="label" htmlFor="new-pk">Novo pacote: preço (Kz)</label><input className="input" id="new-pk" name="priceKz" type="number" min={100} required /></div>
        <div><label className="label" htmlFor="new-pc">Moedas</label><input className="input" id="new-pc" name="coins" type="number" min={1} required /></div>
        <div><label className="label" htmlFor="new-po">Ordem</label><input className="input" id="new-po" name="sortOrder" type="number" min={0} defaultValue={packs.length + 1} /></div>
        <SubmitButton className="btn-primary">Adicionar</SubmitButton>
      </ActionForm>

      <h2 className="mt-8 text-lg font-bold">Presentes</h2>
      <p className="text-sm text-muted">Os fãs pagam com moedas; o artista ganha 50% do valor real dessas moedas.</p>
      <ul className="mt-3 space-y-2">
        {gifts.map((g) => (
          <li key={g.code} className="card">
            <ActionForm action={saveGiftTypeAction} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[70px_1fr_110px_80px_auto_auto]">
              <input type="hidden" name="code" value={g.code} />
              <div><label className="label" htmlFor={`ge-${g.code}`}>Emoji</label><input className="input text-center text-xl" id={`ge-${g.code}`} name="emoji" defaultValue={g.emoji} required /></div>
              <div><label className="label" htmlFor={`gl-${g.code}`}>Nome</label><input className="input" id={`gl-${g.code}`} name="label" defaultValue={g.label} required /></div>
              <div><label className="label" htmlFor={`gp-${g.code}`}>Moedas</label><input className="input" id={`gp-${g.code}`} name="priceCoins" type="number" min={1} defaultValue={g.priceCoins} required /></div>
              <div><label className="label" htmlFor={`go-${g.code}`}>Ordem</label><input className="input" id={`go-${g.code}`} name="sortOrder" type="number" min={0} defaultValue={g.sortOrder} /></div>
              <label className="flex min-h-tap items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={g.active} className="checkbox mt-0" /> Ativo</label>
              <SubmitButton className="btn-secondary">Guardar</SubmitButton>
            </ActionForm>
          </li>
        ))}
      </ul>
      <ActionForm action={saveGiftTypeAction} className="card mt-3 grid grid-cols-2 items-end gap-3 sm:grid-cols-[120px_70px_1fr_110px_auto]" resetOnSuccess>
        <input type="hidden" name="isNew" value="1" />
        <div><label className="label" htmlFor="ng-c">Código</label><input className="input uppercase" id="ng-c" name="code" placeholder="ABRACO" required /></div>
        <div><label className="label" htmlFor="ng-e">Emoji</label><input className="input text-center text-xl" id="ng-e" name="emoji" required /></div>
        <div><label className="label" htmlFor="ng-l">Nome</label><input className="input" id="ng-l" name="label" required /></div>
        <div><label className="label" htmlFor="ng-p">Moedas</label><input className="input" id="ng-p" name="priceCoins" type="number" min={1} required /></div>
        <SubmitButton className="btn-primary">Adicionar</SubmitButton>
      </ActionForm>
    </div>
  );
}
