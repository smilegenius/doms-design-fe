// ── Carrying the practice into QuickCreate ───────────────────────────────────
// QuickCreate doesn't preselect the clinic from a draft (in the lab portal it
// leaves "Search or pick a clinic…" empty), so for email and LabLink drafts
// the sandbox searches QuickCreate's own picker for the practice, once. It
// picks the clinic only when exactly one matches; when several do (e.g.
// "Smile Genius Belfast 1" and "… 3") it leaves the choice to the lab and
// says which ones. Relies on the picker's markup: its placeholder, search box
// and option buttons (initials avatar, name, location line).

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface ClinicPick { picked: string | null; candidates: string[] }

export async function pickClinic(practice: string): Promise<ClinicPick> {
  const name = practice.trim();
  const none = { picked: null, candidates: [] };
  if (!name) return none;
  const placeholder = [...document.querySelectorAll<HTMLElement>('p')].find(p => p.textContent?.trim() === 'Search or pick a clinic…');
  const trigger = placeholder?.closest<HTMLElement>('button');
  if (!trigger) return none; // already chosen, or the form isn't there
  trigger.click();
  await wait(150);
  const search = document.querySelector<HTMLInputElement>('input[placeholder^="Search clinics"]');
  if (!search) { trigger.click(); return none; }
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, name);
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await wait(150);
  const lower = name.toLowerCase();
  const options = [...document.querySelectorAll<HTMLElement>('button')]
    .map(b => ({ b, label: [...b.querySelectorAll<HTMLElement>('*')].find(e => e.children.length === 0 && e.textContent?.trim().toLowerCase().startsWith(lower))?.textContent?.trim() }))
    .filter((o): o is { b: HTMLElement; label: string } => !!o.label && o.b !== trigger && !o.label.startsWith('Create new clinic'));
  const exact = options.find(o => o.label.toLowerCase() === lower);
  const choice = exact ?? (options.length === 1 ? options[0] : undefined);
  if (choice) { choice.b.click(); return { picked: choice.label, candidates: [] }; }
  trigger.click(); // close it again; the lab chooses
  return { picked: null, candidates: options.map(o => o.label) };
}

/** QuickCreate's case-level Order Type starts on NHS; set it to what the email / form said. */
export function setOrderType(value?: string): boolean {
  if (!value) return false;
  const label = [...document.querySelectorAll<HTMLElement>('span')].find(e => e.textContent?.trim() === 'Order Type');
  const select = label?.closest('label')?.parentElement?.querySelector<HTMLSelectElement>('select');
  if (!select || select.value === value || ![...select.options].some(o => o.value === value)) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
