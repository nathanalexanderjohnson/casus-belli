/**
 * Samurai rules: item validation, Kenjutsu and abilities, Bushido, Epiphanies, scene/rest
 * resets, the Oni's Might Active Effect, and migration from the old Samurai lists.
 */
import { openRollDialog } from './rolls.mjs';

const escape = (value) => Handlebars.escapeExpression(String(value ?? ''));

/** Item types that only a Samurai may own. */
export const SAMURAI_ITEM_TYPES = ['kenjutsu', 'samuraiAbility'];

/** Pass as an operation option to create Samurai items without class checks (migration). */
export const MIGRATION_OPTION = 'casusBelliMigration';

/* -------------------------------------------- */
/*  Validation                                  */
/* -------------------------------------------- */

/**
 * Validate adding a Samurai item to an actor.
 * @param {Actor} actor
 * @param {Item} item  The item being created
 * @returns {string|null} An error message, or null when allowed
 */
export function validateSamuraiItemCreate(actor, item) {
  if (actor.type !== 'character' || !actor.system.isSamurai) {
    return `${actor.name} must have the Samurai class to have ${item.name}.`;
  }
  return null;
}

/**
 * A non-blocking note when a Kenjutsu's prerequisite or an ability's requirement isn't met.
 * @returns {string|null}
 */
export function getSamuraiItemWarning(actor, item) {
  if (item.type === 'kenjutsu' && item.system.prerequisite) {
    const needed = item.system.prerequisite.trim().toLowerCase();
    const owned = actor.items.some((i) => i.name?.trim().toLowerCase() === needed);
    if (!owned) return `${item.name} requires ${item.system.prerequisite}, which ${actor.name} does not have.`;
  }
  if (item.type === 'samuraiAbility' && item.system.requirement) {
    return `${item.name}: ${item.system.requirement}. Check with your GM.`;
  }
  return null;
}

/* -------------------------------------------- */
/*  Levels and availability                     */
/* -------------------------------------------- */

/**
 * The level a Kenjutsu is performed at: the Samurai's Arcane Might, capped by the teacher's
 * Arcane Might for a Kenjutsu learned from someone else.
 * @param {Actor} actor
 * @param {Item} item
 */
export function kenjutsuLevel(actor, item) {
  const arcaneMight = actor.system.arcaneMight ?? 0;
  const teacher = item.system.teacherArcaneMight ?? 0;
  return teacher > 0 ? Math.min(arcaneMight, teacher) : arcaneMight;
}

/**
 * Why a Samurai item can't be used right now.
 * @returns {{usable: boolean, reasons: string[], stamina: number}}
 */
export function samuraiItemStatus(actor, item) {
  const reasons = [];
  const stamina = item.system.stamina ?? 0;
  if (!actor.system.isSamurai) reasons.push('Not a Samurai');
  if (item.type === 'samuraiAbility' && item.system.frequency !== 'atWill' && item.system.used) {
    reasons.push(item.system.frequency === 'scene' ? 'Already used this scene' : 'Already used since your last rest');
  }
  if (stamina > (actor.system.stamina?.value ?? 0)) reasons.push(`Needs ${stamina} Stamina`);
  return { usable: reasons.length === 0, reasons, stamina };
}

/* -------------------------------------------- */
/*  Use                                         */
/* -------------------------------------------- */

const enrich = (actor, item, html) => TextEditor.enrichHTML(html ?? '', {
  secrets: actor.isOwner,
  async: true,
  rollData: actor.getRollData(),
  relativeTo: item,
});

/**
 * Open a samurai ability roll: Strength + Arcane Might.
 * @param {Actor} actor
 * @param {string} label
 */
export function samuraiAbilityRoll(actor, label) {
  return openRollDialog(actor, {
    key: 'arcaneMight',
    value: Number(actor.system.arcaneMight ?? 0),
    label,
    defaultSecond: 'str',
  });
}

/**
 * Use a Kenjutsu or Samurai ability: pay its Stamina, mark limited uses, post it to chat
 * (with the Kenjutsu tiers it has reached), and open its roll.
 * @param {Item} item
 */
export async function useSamuraiItem(item) {
  const actor = item.actor;
  if (!actor) return;
  const sys = item.system;
  const status = samuraiItemStatus(actor, item);
  if (!status.usable) {
    ui.notifications.warn(`${item.name} cannot be used: ${status.reasons.join('; ')}.`);
    return;
  }

  if (status.stamina > 0) {
    await actor.update({ 'system.stamina.value': (actor.system.stamina?.value ?? 0) - status.stamina });
  }
  if (item.type === 'samuraiAbility' && sys.frequency !== 'atWill') {
    await item.update({ 'system.used': true });
  }

  const blocks = [await enrich(actor, item, sys.description)];
  let meta = CONFIG.CASUSBELLI.samuraiAbilityCategories[sys.category] ?? '';
  if (item.type === 'kenjutsu') {
    const level = kenjutsuLevel(actor, item);
    meta = `Kenjutsu · Level ${level}${sys.teacherArcaneMight ? ` (taught at Arcane Might ${sys.teacherArcaneMight})` : ''}`;
    if (level >= 3 && sys.arcaneMightIII) blocks.push(`<p><strong>Arcane Might III</strong></p>${await enrich(actor, item, sys.arcaneMightIII)}`);
    if (level >= 5 && sys.arcaneMightV) blocks.push(`<p><strong>Arcane Might V</strong></p>${await enrich(actor, item, sys.arcaneMightV)}`);
  }

  const costs = [status.stamina ? `${status.stamina} Stamina` : '', sys.costNote ?? ''].filter(Boolean).join(', ');
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="casus-belli-ninja-note technique-card">
        <h3>${escape(item.name)}</h3>
        ${meta ? `<p class="technique-meta">${escape(meta)}</p>` : ''}
        ${costs ? `<p><strong>Cost:</strong> ${escape(costs)}</p>` : ''}
        ${blocks.join('')}
      </div>`,
  });

  if (item.type === 'samuraiAbility' && sys.roll) await samuraiAbilityRoll(actor, item.name);
}

/* -------------------------------------------- */
/*  Bushido and Epiphanies                      */
/* -------------------------------------------- */

/**
 * Inflict the Stress of a Bushido infraction (1d4 minor, 2d4 moderate, 4d4 major).
 * @param {Actor} actor
 * @param {string} severity  A key of CONFIG.CASUSBELLI.bushidoInfractions
 */
export async function bushidoInfraction(actor, severity) {
  const infraction = CONFIG.CASUSBELLI.bushidoInfractions[severity];
  if (!infraction) return;
  const roll = new Roll(infraction.formula);
  await roll.evaluate();
  await actor.update({ 'system.stress.value': (actor.system.stress?.value ?? 0) + roll.total });
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${infraction.label} Bushido Infraction: +${roll.total} Stress`,
    rollMode: game.settings.get('core', 'rollMode'),
  });
}

/**
 * Spend Epiphanies equal to the current level to raise Arcane Might by one.
 * @param {Actor} actor
 */
export async function advanceArcaneMight(actor) {
  const system = actor.system;
  const required = system.ephiphanies?.max ?? 0;
  const have = system.ephiphanies?.value ?? 0;
  const arcaneMight = system.arcaneMight ?? 0;
  if (arcaneMight >= 10) {
    ui.notifications.warn('Arcane Might is already at its maximum.');
    return;
  }
  if (have < required) {
    ui.notifications.warn(`${actor.name} needs ${required} Epiphanies to advance (has ${have}).`);
    return;
  }
  await actor.update({
    'system.arcaneMight': arcaneMight + 1,
    'system.ephiphanies.value': have - required,
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="casus-belli-ninja-note"><h3>Arcane Might ${arcaneMight + 1}</h3><p>${escape(actor.name)} spends ${required} Epiphan${required === 1 ? 'y' : 'ies'} and grows in strength. A new Martial Spirit is gained.</p></div>`,
  });
}

/* -------------------------------------------- */
/*  Scenes and rest                             */
/* -------------------------------------------- */

/**
 * Clear the "used" marker on Samurai abilities with the given frequencies.
 * @param {Actor} actor
 * @param {string[]} frequencies
 */
export async function resetSamuraiUses(actor, frequencies) {
  const updates = actor.items
    .filter((i) => i.type === 'samuraiAbility' && i.system.used && frequencies.includes(i.system.frequency))
    .map((i) => ({ _id: i.id, 'system.used': false }));
  if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);
  ui.notifications.info(frequencies.includes('rest')
    ? `${actor.name} rests: once-per-scene and once-per-rest abilities are ready.`
    : `Scene ended: ${actor.name}'s once-per-scene abilities are ready.`);
}

/* -------------------------------------------- */
/*  Active Effects                              */
/* -------------------------------------------- */

/**
 * The Samurai's managed effects. Read by syncClassEffects (class-effects.mjs).
 *
 * Deliberately empty: Oni's Might (+half Arcane Might to Strength and Endurance) is entered by
 * the player, since those scores change through roleplay. Returning nothing also removes any
 * "Oni's Might" effect an earlier build created.
 * @param {Actor} actor
 * @returns {object[]}
 */
export function desiredSamuraiEffects(actor) {
  return [];
}

/* -------------------------------------------- */
/*  Migration                                   */
/* -------------------------------------------- */

/** Plain text from the old Samurai lists → HTML paragraphs. */
function textToHtml(text) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\n\s*\n/)
    .map((para) => `<p>${escape(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Convert a character's old Samurai lists (Kenjutsu, Martial Spirit, Warrior's Presence) into
 * items, then empty the lists. Safe to run repeatedly: emptied lists are skipped.
 * @param {Actor} actor
 * @returns {Promise<number>} The number of items created
 */
export async function migrateSamuraiLists(actor) {
  const system = actor.system;
  const kenjutsu = system.kenjutsu ?? [];
  const martialSpirit = system.martialSpirit ?? [];
  const warriorsPresence = system.warriorsPresence ?? [];
  if (!kenjutsu.length && !martialSpirit.length && !warriorsPresence.length) return 0;

  const items = [
    ...kenjutsu.map((e) => ({
      name: e.name?.trim() || 'Kenjutsu',
      type: 'kenjutsu',
      system: {
        stamina: e.stamina ?? 0,
        description: textToHtml(e.description),
        arcaneMightIII: textToHtml(e.arcaneMightIII),
        arcaneMightV: textToHtml(e.arcaneMightV),
      },
    })),
    ...martialSpirit.map((e) => ({
      name: e.name?.trim() || 'Martial Spirit',
      type: 'samuraiAbility',
      system: { category: 'martialSpirit', description: textToHtml(e.description) },
    })),
    ...warriorsPresence.map((e) => ({
      name: e.name?.trim() || "Warrior's Presence",
      type: 'samuraiAbility',
      system: { category: 'warriorsPresence', description: textToHtml(e.description) },
    })),
  ];

  await actor.createEmbeddedDocuments('Item', items, { [MIGRATION_OPTION]: true });
  await actor.update({ 'system.kenjutsu': [], 'system.martialSpirit': [], 'system.warriorsPresence': [] });
  return items.length;
}

/**
 * Migrate every world character that still has old Samurai lists. Run by the active GM on ready.
 */
export async function migrateWorldSamuraiLists() {
  let actors = 0;
  let items = 0;
  for (const actor of game.actors.filter((a) => a.type === 'character')) {
    try {
      const created = await migrateSamuraiLists(actor);
      if (created) {
        actors += 1;
        items += created;
      }
    } catch (err) {
      console.error(`casus-belli | Failed to migrate Samurai lists for ${actor.name}`, err);
    }
  }
  if (actors) {
    ui.notifications.info(`Casus Belli: moved ${items} Samurai entries on ${actors} character(s) into Kenjutsu and Samurai Ability items.`);
  }
}
