/**
 * Miko rules: item validation, Talismans, rites (Kannagara and Miasma), Favor, and rest.
 */
import { openRollDialog } from './rolls.mjs';
import { promptTrainingWeek } from './training.mjs';

const escape = (value) => Handlebars.escapeExpression(String(value ?? ''));

/** Item types that only a Miko may own. */
export const MIKO_ITEM_TYPES = ['talisman', 'rite', 'mikoAbility'];

/* -------------------------------------------- */
/*  Validation                                  */
/* -------------------------------------------- */

/**
 * A tradition ability may only be owned by a Miko of that tradition.
 * @returns {string|null} An error message, or null when allowed
 */
function validateAbilityTradition(actor, system, name) {
  if (!system.tradition || system.tradition === actor.system.tradition) return null;
  const traditions = CONFIG.CASUSBELLI.mikoTraditions;
  return `${name} belongs to the ${traditions[system.tradition] ?? system.tradition} tradition, but ${actor.name} follows the ${traditions[actor.system.tradition] ?? actor.system.tradition} tradition.`;
}

/**
 * Validate adding a Miko item to an actor.
 * @param {Actor} actor
 * @param {Item} item  The item being created
 * @returns {string|null}
 */
export function validateMikoItemCreate(actor, item) {
  if (actor.type !== 'character' || !actor.system.isMiko) {
    return `${actor.name} must have the Miko class to have ${item.name}.`;
  }
  if (item.type === 'rite' && item.system.kind === 'miasma' && !actor.system.wieldsMiasma) {
    return `${item.name} is a Miasma, and ${actor.name} does not wield Miasma.`;
  }
  if (item.type === 'mikoAbility') return validateAbilityTradition(actor, item.system, item.name);
  return null;
}

/**
 * Validate an update to an owned Miko item.
 * @param {Actor} actor
 * @param {Item} item
 * @param {object} changed  The update delta
 * @returns {string|null}
 */
export function validateMikoItemUpdate(actor, item, changed) {
  const sys = changed.system ?? {};
  if (item.type === 'mikoAbility' && 'tradition' in sys) {
    return validateAbilityTradition(actor, { tradition: sys.tradition }, item.name);
  }
  return null;
}

/**
 * Validate a change of tradition: abilities of the old tradition must be removed first.
 * @param {Actor} actor
 * @param {string} tradition  The new tradition
 * @returns {string|null}
 */
export function validateTraditionChange(actor, tradition) {
  const current = actor.system.tradition;
  if (tradition === current) return null;
  const owned = actor.items.some((i) => i.type === 'mikoAbility' && i.system.tradition === current);
  if (!owned) return null;
  return `Remove ${actor.name}'s ${CONFIG.CASUSBELLI.mikoTraditions[current]} abilities before changing their tradition.`;
}

/* -------------------------------------------- */
/*  Derived totals                              */
/* -------------------------------------------- */

/**
 * Talisman slots in use: etched Ofuda plus active Miasma (each holds a slot while active).
 * @param {Actor} actor
 * @returns {{used: number, max: number}}
 */
export function talismanSlots(actor) {
  let used = 0;
  for (const item of actor.items) {
    if (item.type === 'talisman') used += item.system.prepared ?? 0;
    else if (item.type === 'rite' && item.system.kind === 'miasma' && item.system.active) used += 1;
  }
  return { used, max: actor.system.talismanSlots ?? 0 };
}

/**
 * A Miasma or Ofuda needs a free slot; Beloved Above All may draw on the Kami for one.
 * @param {Actor} actor
 * @param {string} name  What is being prepared
 * @returns {Promise<'free'|'kami'|null>} How the slot is paid for, or null when refused
 */
async function claimTalismanSlot(actor, name) {
  const slots = talismanSlots(actor);
  if (slots.used < slots.max) return 'free';
  if (!actor.system.belovedAboveAll) {
    ui.notifications.warn(`${name} needs a free Talisman slot, and all ${slots.max} are in use.`);
    return null;
  }
  const ok = await Dialog.confirm({
    title: 'Beloved Above All',
    content: `<p>Preparing ${escape(name)} beyond your single Talisman draws on the Kami's power: +1 Pain and +1 Stress.</p><p>Continue?</p>`,
    options: { classes: ['casus-belli', 'casus-belli-roll-dialog'] },
  });
  return ok ? 'kami' : null;
}

/**
 * Kannagara maintenance capacity in use by active rites.
 * @param {Actor} actor
 * @returns {{used: number, max: number}}
 */
export function maintenanceCapacity(actor) {
  const used = actor.items
    .filter((i) => i.type === 'rite' && i.system.active)
    .reduce((sum, i) => sum + (i.system.maintenance ?? 0), 0);
  return { used, max: actor.system.kannagaraCapacity ?? 0 };
}

/* -------------------------------------------- */
/*  Beloved Above All                           */
/* -------------------------------------------- */

const KAMI_WOUND_FLAG = 'kamiWound';

/** Wound severity for a given amount of Kami's-wound Pain (2 Major, 4 Critical, 8 Lethal). */
function kamiWoundSeverity(pain) {
  if (pain >= 8) return 'lethal';
  if (pain >= 4) return 'critical';
  if (pain >= 2) return 'major';
  return 'minor';
}

/**
 * The actor's wound inflicted by Beloved Above All, if any.
 * @param {Actor} actor
 * @returns {Item|null}
 */
export function getKamiWound(actor) {
  return actor.items.find((i) => i.type === 'wound' && i.getFlag('casus-belli', KAMI_WOUND_FLAG)) ?? null;
}

/**
 * Draw on the Kami's power: each point adds one Pain to the Kami's wound and one Stress.
 * The wound's severity rises with its Pain, and its week-long healing timer restarts.
 * @param {Actor} actor
 * @param {number} points
 * @param {string} reason  What the power was drawn for (shown in chat)
 */
export async function inflictKamiWound(actor, points, reason) {
  if (points <= 0) return;
  const wound = getKamiWound(actor);
  const pain = (wound?.system.fixedPain ?? 0) + points;
  const system = {
    fixedPain: pain,
    severity: kamiWoundSeverity(pain),
    bodyLocation: 'Chest',
    treated: false,
  };

  if (wound) {
    await wound.update({ system, [`flags.casus-belli.${KAMI_WOUND_FLAG}`]: { increasedAt: game.time.worldTime } });
  } else {
    await actor.createEmbeddedDocuments('Item', [{
      name: "Kami's Wound",
      type: 'wound',
      system: {
        ...system,
        description: '<p>Internal injury from Beloved Above All. It cannot be treated or healed by any magic short of a god\'s, and its Pain cannot be reduced except by spending ten Favor per point. Its bleeding will never kill you unless it reaches Lethal. It heals a week after its Pain last increased.</p>',
      },
      flags: { 'casus-belli': { [KAMI_WOUND_FLAG]: { increasedAt: game.time.worldTime } } },
    }]);
  }

  await actor.update({ 'system.stress.value': (actor.system.stress?.value ?? 0) + points });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="casus-belli-ninja-note">
        <h3>Beloved Above All</h3>
        <p>${escape(reason)}: the Kami's power tears at ${escape(actor.name)}, who coughs up blood.</p>
        <p>+${points} Pain and +${points} Stress. The Kami's wound is now <strong>${system.severity}</strong> (${pain} Pain), and will heal a week from now.</p>
      </div>`,
  });
}

/**
 * Spend ten Favor to reduce the Kami's wound by one Pain (removing it at zero).
 * @param {Actor} actor
 */
export async function reduceKamiWound(actor) {
  const wound = getKamiWound(actor);
  if (!wound) return;
  const cost = CONFIG.CASUSBELLI.miko.restFavorCost;
  const favor = actor.system.favor?.value ?? 0;
  if (favor < cost) {
    ui.notifications.warn(`${actor.name} needs ${cost} Favor (has ${favor}).`);
    return;
  }
  await actor.update({ 'system.favor.value': favor - cost });
  const pain = Math.max(0, (wound.system.fixedPain ?? 1) - 1);
  if (pain === 0) {
    await wound.delete();
    ui.notifications.info("The Kami's wound has closed.");
  } else {
    await wound.update({ 'system.fixedPain': pain, 'system.severity': kamiWoundSeverity(pain) });
    ui.notifications.info(`The Kami's wound eases to ${pain} Pain.`);
  }
}

/* -------------------------------------------- */
/*  Chat and rolls                              */
/* -------------------------------------------- */

async function postCard(actor, item, { title, meta = '', html = '', lines = [] }) {
  const body = html
    ? await TextEditor.enrichHTML(html, { secrets: actor.isOwner, async: true, rollData: actor.getRollData(), relativeTo: item })
    : '';
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="casus-belli-ninja-note technique-card">
        <h3>${escape(title)}</h3>
        ${meta ? `<p class="technique-meta">${escape(meta)}</p>` : ''}
        ${lines.map((l) => `<p>${l}</p>`).join('')}
        ${body}
      </div>`,
  });
}

/**
 * Open a casting roll: Spiritualism + Will.
 * @param {Actor} actor
 * @param {string} label
 */
export function castingRoll(actor, label) {
  return openRollDialog(actor, {
    key: 'spiritualism',
    value: Number(actor.system.spiritualism?.value ?? 0),
    label,
    defaultSecond: 'wil',
  });
}

/* -------------------------------------------- */
/*  Talismans                                   */
/* -------------------------------------------- */

/**
 * Use a Talisman. Omamori are free; an Ofuda consumes one etched copy.
 * @param {Item} item
 * @param {'omamori'|'ofuda'} variant
 */
export async function useTalisman(item, variant) {
  const actor = item.actor;
  if (!actor) return;
  const tal = item.system;
  const isOfuda = variant === 'ofuda';

  if (!tal.learned) {
    ui.notifications.warn(`${item.name} is still being learned.`);
    return;
  }
  if (isOfuda) {
    if ((tal.prepared ?? 0) <= 0) {
      ui.notifications.warn(`No ${item.name} Ofuda is etched. Etch one into a Talisman slot first.`);
      return;
    }
    await item.update({ 'system.prepared': tal.prepared - 1 });
  }

  await postCard(actor, item, {
    title: item.name,
    meta: isOfuda ? 'Ofuda' : 'Omamori',
    html: isOfuda ? tal.ofuda : tal.omamori,
  });

  if (isOfuda ? tal.ofudaRoll : tal.omamoriRoll) {
    await castingRoll(actor, `${item.name} (${isOfuda ? 'Ofuda' : 'Omamori'})`);
  }
}

/**
 * Etch or erase an Ofuda of a Talisman.
 * @param {Item} item
 * @param {number} delta  +1 to etch, -1 to erase
 */
export async function etchTalisman(item, delta) {
  const actor = item.actor;
  if (!actor) return;
  const prepared = Math.max(0, (item.system.prepared ?? 0) + delta);
  let slotSource = null;
  if (delta > 0) {
    slotSource = await claimTalismanSlot(actor, item.name);
    if (!slotSource) return;
  }
  if (prepared !== item.system.prepared) await item.update({ 'system.prepared': prepared });
  if (slotSource === 'kami') await inflictKamiWound(actor, 1, `Etching ${item.name}`);
}

/**
 * Add a week of training progress to an unlearned Talisman.
 * @param {Item} item
 */
export async function trainTalisman(item) {
  const actor = item.actor;
  if (!actor) return;
  const cost = CONFIG.CASUSBELLI.miko.talismanLearningCost;
  const gained = await promptTrainingWeek(actor, item.name);
  if (gained === null) return;
  const progress = (item.system.progress ?? 0) + gained;
  const learned = progress >= cost;
  await item.update({ 'system.progress': progress, 'system.learned': learned });
  ui.notifications.info(learned
    ? `${item.name} learned!`
    : `${item.name}: +${gained} progress (${progress} / ${cost}).`);
}

/* -------------------------------------------- */
/*  Rites                                       */
/* -------------------------------------------- */

/**
 * Whether a rite can be performed, and why not.
 * @param {Actor} actor
 * @param {Item} item
 * @returns {{usable: boolean, reasons: string[]}}
 */
export function riteStatus(actor, item) {
  const rite = item.system;
  const reasons = [];
  if ((actor.system.arcaneMight ?? 0) < (rite.minArcaneMight ?? 0)) {
    reasons.push(`Requires Arcane Might ${rite.minArcaneMight} to perform (it may still be maintained)`);
  }
  if (rite.kind === 'miasma' && !actor.system.wieldsMiasma) reasons.push('Does not wield Miasma');
  return { usable: reasons.length === 0, reasons };
}

/**
 * Perform a rite: confirm and spend Favor, mark it active, post it to chat, and roll if needed.
 * @param {Item} item
 */
export async function performRite(item) {
  const actor = item.actor;
  if (!actor) return;
  const rite = item.system;
  const status = riteStatus(actor, item);
  if (!status.usable) {
    ui.notifications.warn(`${item.name} cannot be performed: ${status.reasons.join('; ')}.`);
    return;
  }

  // A Miasma is prepared like a Talisman and holds a slot while active.
  let slotSource = null;
  if (rite.kind === 'miasma' && !rite.active) {
    slotSource = await claimTalismanSlot(actor, item.name);
    if (!slotSource) return;
  }

  const favor = actor.system.favor?.value ?? 0;
  const spent = await new Promise((resolve) => {
    new Dialog({
      title: `Perform ${item.name}`,
      content: `
        <form>
          <p>Favor available: <strong>${favor}</strong>.${rite.costNote ? ` Cost: ${escape(rite.costNote)}.` : ''}</p>
          <div class="form-group">
            <label>Favor to spend:</label>
            <input type="number" name="favor" value="${rite.cost ?? 0}" min="0"/>
          </div>
          <p class="hint">Favor paid from a shrine's pool should be entered as 0 here.</p>
        </form>`,
      classes: ['casus-belli', 'casus-belli-roll-dialog'],
      buttons: {
        perform: { label: 'Perform', callback: (html) => resolve(Math.max(0, parseInt(html.find('[name="favor"]').val()) || 0)) },
      },
      default: 'perform',
      close: () => resolve(null),
    }).render(true);
  });
  if (spent === null) return;
  if (spent > favor) {
    ui.notifications.warn(`${actor.name} has only ${favor} Favor.`);
    return;
  }

  if (spent > 0) await actor.update({ 'system.favor.value': favor - spent });
  if (!rite.active) await item.update({ 'system.active': true });
  if (slotSource === 'kami') await inflictKamiWound(actor, 1, `Preparing ${item.name}`);

  const capacity = maintenanceCapacity(actor);
  const lines = [`<strong>Favor spent:</strong> ${spent}`];
  if (rite.maintenance > 0 || rite.maintenanceNote) {
    lines.push(`<strong>Maintenance:</strong> ${escape(rite.maintenanceNote || rite.maintenance)}`);
  }
  if (capacity.used > capacity.max) {
    lines.push(`<em>Maintenance in use (${capacity.used}) exceeds ${escape(actor.name)}'s capacity (${capacity.max}): other Miko must help maintain it.</em>`);
  }
  const tags = [CONFIG.CASUSBELLI.riteKinds[rite.kind], rite.draining ? 'Draining' : '', rite.vicious ? 'Vicious' : ''];
  await postCard(actor, item, {
    title: item.name,
    meta: tags.filter(Boolean).join(' · '),
    html: rite.description,
    lines,
  });

  if (rite.roll) await castingRoll(actor, item.name);
}

/* -------------------------------------------- */
/*  Favor and rest                              */
/* -------------------------------------------- */

/**
 * Spend the once-per-rest ten Favor to restore all Unmei, or to etch a new set of Talismans.
 * @param {Actor} actor
 * @param {'unmei'|'reetch'} kind
 */
export async function spendRestFavor(actor, kind) {
  const system = actor.system;
  const cost = CONFIG.CASUSBELLI.miko.restFavorCost;
  const flag = kind === 'unmei' ? 'unmeiRestored' : 'reetched';
  if (kind === 'unmei' && system.belovedAboveAll) {
    ui.notifications.warn('Beloved Above All: nothing can grant you Unmei points.');
    return;
  }
  if (system.mikoRest?.[flag]) {
    ui.notifications.warn('That can only be done once per rest.');
    return;
  }
  const favor = system.favor?.value ?? 0;
  if (favor < cost) {
    ui.notifications.warn(`${actor.name} needs ${cost} Favor (has ${favor}).`);
    return;
  }

  const updates = { 'system.favor.value': favor - cost, [`system.mikoRest.${flag}`]: true };
  let text;
  if (kind === 'unmei') {
    updates['system.unmei.value'] = system.unmei?.max ?? 0;
    text = 'All Unmei restored.';
  } else {
    text = 'A new set of Talismans may be etched without waiting for a rest.';
  }
  await actor.update(updates);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="casus-belli-ninja-note"><h3>Favor Spent (${cost})</h3><p>${text}</p></div>`,
  });
}

/**
 * Complete a rest: restore Unmei and reset the once-per-rest Favor uses.
 * Etched Ofuda are kept; they only lose their power when their slot is re-etched.
 * @param {Actor} actor
 */
export async function mikoRest(actor) {
  const max = actor.system.unmei?.max ?? 0;
  await actor.update({
    'system.unmei.value': max,
    'system.mikoRest.unmeiRestored': false,
    'system.mikoRest.reetched': false,
  });
  ui.notifications.info(`${actor.name} rests: Unmei restored to ${max}. Talismans may be re-etched.`);
}
