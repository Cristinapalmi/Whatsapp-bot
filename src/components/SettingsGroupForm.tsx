import { getInts, settingsInGroup, type IntSettingKey } from "@/domain/settings";
import { db } from "@/lib/db";
import { saveSettingsGroupAction } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "./ActionForm";

/** Formulário do admin para um grupo de regras numéricas. */
export async function SettingsGroupForm({ group }: { group: string }) {
  const defs = settingsInGroup(group);
  const values = await getInts(db, defs.map((d) => d.key as IntSettingKey));
  return (
    <ActionForm action={saveSettingsGroupAction} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="group" value={group} />
      {defs.map((d) => (
        <div key={d.key}>
          <label className="label" htmlFor={`set-${d.key}`}>{d.label}</label>
          <input className="input" id={`set-${d.key}`} name={d.key} type="number" min={d.min} max={d.max} defaultValue={values[d.key as IntSettingKey]} required />
          {d.hint && <p className="hint">{d.hint}</p>}
        </div>
      ))}
      <div className="sm:col-span-2"><SubmitButton className="btn-primary">Guardar</SubmitButton></div>
    </ActionForm>
  );
}
