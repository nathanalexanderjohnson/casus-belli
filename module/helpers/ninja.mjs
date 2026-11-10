/**
 * Ninja rules: chakra spending, technique availability and use, bloodline state, training,
 * and the system-managed Active Effects for ninja conditions.
 */
import { promptTrainingWeek } from './training.mjs';
import { countSuccesses, formatRollContent, labelForKey, openRollDialog } from './rolls.mjs';

const escape = (value) => Handlebars.escapeExpression(String(value ?? ''));

/* -------------------------------------------- */
/*  Lookups                                     */
/* -------------------------------------------- */

/**
 * The actor's bloodline item, if any.
 * @param {Actor} actor
 * @returns {Item|null}
 */
export function getBloodline(actor) {
  return actor?.items?.find((i) => i.type === 'bloodline') ?? null;
}

/**
 * Display name for a bloodline (and variant) key.
 * @param {string} key
 * @param {string} [variant]
 */
export function bloodlineLabel(key, variant = '') {
  const def = CONFIG.CASUSBELLI.bloodlines[key];
  if (!def) return key || 'None';
  const variantLabel = def.variants?.[variant]?.label;
  return variantLabel ? `${def.label} (${variantLabel})` : def.label;
}

/**
 * Whether the actor can draw Chakra from a sealed creature (Jinchuriki without Sealed Power).
 * @param {Actor} actor
 */
export function canDrawFromBeast(actor) {
  const bloodline = getBloodline(actor)?.system;
  return actor?.system?.isNinja === true
    && bloodline?.bloodline === 'jinchuriki'
    && !bloodline.hasFlaw('sealedPower');
}

/**
 * Learning cost (progress) for a technique rank, after the bloodline potency modifier.
 * Returns null for ranks that cannot be trained (S rank).
 * @param {Actor} actor
 * @param {string} rank
 */
export function learningCost(actor, rank) {
  const costs = actor.system.techniqueLearning?.costs ?? {};
  return costs[rank] ?? null;
}

/* -------------------------------------------- */
/*  Validation                                  */
/* -------------------------------------------- */

/**
 * Validate adding a technique or bloodline to an actor.
 * @param {Actor} actor
 * @param {Item} item   The item being created (not yet in the actor's collection)
 * @returns {string|null} An error message, or null when allowed
 */
export function validateNinjaItemCreate(actor, item) {
  const typeLabel = item.type === 'bloodline' ? 'a bloodline' : 'techniques';
  if (actor.type !== 'character' || !actor.system.isNinja) {
    return `${actor.name} must have the Ninja class to have ${typeLabel}.`;
  }

  const existing = getBloodline(actor);

  if (item.type === 'bloodline') {
    if (existing) {
      return `${actor.name} already has the ${existing.name} bloodline. Remove it before adding another.`;
    }
    return null;
  }

  return validateTechniqueBloodline(actor, item.system, item.name, existing);
}

/**
 * A bloodline technique may only be owned by a character with the matching bloodline (and variant).
 * @returns {string|null}
 */
function validateTechniqueBloodline(actor, system, name, bloodlineItem) {
  if (system.category !== 'bloodline') return null;
  const required = bloodlineLabel(system.bloodline, system.variant);
  if (!system.bloodline) {
    return `${name} is a bloodline technique but does not say which bloodline it belongs to.`;
  }
  if (!bloodlineItem) {
    return `${name} belongs to the ${required} bloodline, and ${actor.name} has no bloodline.`;
  }
  const owned = bloodlineItem.system;
  if (owned.bloodline !== system.bloodline || (system.variant && owned.variant !== system.variant)) {
    return `${name} belongs to the ${required} bloodline, but ${actor.name} has ${bloodlineLabel(owned.bloodline, owned.variant)}.`;
  }
  return null;
}

/**
 * Validate an update to an owned technique or bloodline.
 * @param {Actor} actor
 * @param {Item} item
 * @param {object} changed  The update delta
 * @returns {string|null}
 */
export function validateNinjaItemUpdate(actor, item, changed) {
  const sys = changed.system ?? {};

  if (item.type === 'bloodline') {
    const changesType = ('bloodline' in sys && sys.bloodline !== item.system.bloodline)
      || ('variant' in sys && sys.variant !== item.system.variant);
    const hasTechniques = actor.items.some((i) => i.type === 'technique' && i.system.category === 'bloodline');
    if (changesType && hasTechniques) {
      return `Remove ${actor.name}'s bloodline techniques before changing their bloodline.`;
    }
    return null;
  }

  // Technique: check the merged result still matches the owner's bloodline.
  if (!['category', 'bloodline', 'variant'].some((k) => k in sys)) return null;
  const merged = { ...item.system, ...foundry.utils.expandObject(sys) };
  return validateTechniqueBloodline(actor, merged, item.name, getBloodline(actor));
}

/**
 * A non-blocking warning when a technique is above the rank the actor can normally learn.
 * @returns {string|null}
 */
export function getTechniqueLearningWarning(actor, item) {
  if (item.type !== 'technique' || !actor.system?.isNinja) return null;
  const rankDef = CONFIG.CASUSBELLI.techniqueRanks[item.system.rank];
  const arcaneMight = actor.system.arcaneMight ?? 0;
  const required = Math.max(rankDef?.minArcaneMight ?? 0, item.system.minArcaneMight ?? 0);
  if (item.system.rank === 'S') {
    return `${item.name} is an S rank technique, which can only be gained through roleplay.`;
  }
  if (arcaneMight < required) {
    return `${item.name} normally requires Arcane Might ${required} (${actor.name} has ${arcaneMight}). Check with your GM.`;
  }
  return null;
}

/* -------------------------------------------- */
/*  Technique availability                      */
/* -------------------------------------------- */

/**
 * Whether a technique can be used right now, why not, and its effective Chakra cost.
 * @param {Actor} actor
 * @param {Item} item
 * @returns {{usable: boolean, reasons: string[], cost: number, beastOnly: boolean}}
 */
export function techniqueStatus(actor, item) {
  const config = CONFIG.CASUSBELLI;
  const system = actor.system;
  const tech = item.system;
  const bloodlineItem = getBloodline(actor);
  const bloodline = bloodlineItem?.system;
  const reasons = [];

  if (!system.isNinja) reasons.push('Not a ninja');

  if (!tech.learned) {
    const cost = learningCost(actor, tech.rank);
    reasons.push(`In training (${tech.progress}/${cost === null ? '—' : Math.max(cost, 0)})`);
  }

  if (tech.category === 'senjutsu') reasons.push('Senjutsu is not yet understood');

  // Chakra exhaustion. A Chakra Seal can be bypassed by drawing on the creature within.
  const beastOnly = system.isExhausted && system.chakra?.sealedExhaustion && canDrawFromBeast(actor);
  if (system.isExhausted && !beastOnly) reasons.push('Chakra exhausted');

  if (tech.category === 'bloodline') {
    const error = validateTechniqueBloodline(actor, tech, item.name, bloodlineItem);
    if (error) {
      reasons.push(`Requires the ${bloodlineLabel(tech.bloodline, tech.variant)} bloodline`);
    } else if ((tech.requiredStage ?? 0) > (bloodline.stage ?? 0)) {
      reasons.push(stageRequirementLabel(bloodline.bloodline, tech.requiredStage));
    }
  }

  if (tech.element && tech.element !== 'none') {
    const elementLabel = config.elements[tech.element] ?? tech.element;
    if (!system.effectiveAffinities?.[tech.element]) reasons.push(`No ${elementLabel} affinity`);
    if (bloodline?.hasFlaw('allConsuming')) {
      const beastElement = config.bloodlines.jinchuriki.variants?.[bloodline.variant]?.element;
      if (beastElement && beastElement !== tech.element) reasons.push(`All Consuming: only ${config.elements[beastElement]} techniques`);
    }
  }

  if (tech.frequency !== 'atWill' && tech.used) {
    reasons.push(tech.frequency === 'scene' ? 'Already used this scene' : 'Already used since your last rest');
  }

  const cost = (tech.cost ?? 0) * (bloodline?.hasFlaw('leakyVessel') ? 2 : 1);
  return { usable: reasons.length === 0, reasons, cost, beastOnly: Boolean(beastOnly) };
}

/**
 * Human-readable stage requirement for a bloodline technique.
 */
export function stageRequirementLabel(bloodlineKey, stage) {
  if (bloodlineKey === 'eightGates') {
    return `Requires the ${CONFIG.CASUSBELLI.eightGates[stage - 1] ?? `Gate ${stage}`} to be open`;
  }
  if (bloodlineKey === 'sharingan') return `Requires ${stage} Tomoe`;
  if (bloodlineKey === 'jinchuriki') return `Requires Seal ${stage} to be opened`;
  const def = CONFIG.CASUSBELLI.bloodlines[bloodlineKey];
  return `Requires ${def?.stageLabel ?? 'stage'} ${stage}`;
}

/* -------------------------------------------- */
/*  Chakra                                      */
/* -------------------------------------------- */

/**
 * Spend Chakra. When the actor lacks enough, the remainder is paid with an exhaustion roll:
 * roll one die per missing point needing 3 successes; each success short is a week of exhaustion.
 * Drawing from the creature within (Jinchuriki) costs Stress instead.
 *
 * @param {Actor} actor
 * @param {number} amount
 * @param {object} [options]
 * @param {string} [options.label]      What the Chakra is being spent on
 * @param {boolean} [options.fromBeast] Draw from the sealed creature instead of the actor's own Chakra
 * @returns {Promise<boolean>} False when the spend was refused or cancelled
 */
export async function spendChakra(actor, amount, { label = 'Chakra', fromBeast = false } = {}) {
  if (amount <= 0) return true;
  const config = CONFIG.CASUSBELLI;
  const system = actor.system;
  const speaker = ChatMessage.getSpeaker({ actor });

  if (fromBeast) {
    if (!canDrawFromBeast(actor)) {
      ui.notifications.warn(`${actor.name} cannot draw on the creature within.`);
      return false;
    }
    const stress = Math.ceil(amount / 2);
    await actor.update({ 'system.stress.value': (system.stress?.value ?? 0) + stress });
    await getBloodline(actor).update({ 'system.drewChakra': true });
    await ChatMessage.create({
      speaker,
      content: `
        <div class="casus-belli-ninja-note">
          <h3>${escape(label)}: Endless Chakra</h3>
          <p>Drew <strong>${amount}</strong> Chakra from the creature within and gained <strong>${stress}</strong> Stress.</p>
          <p>At the end of this scene, suffer a Critical internal injury.</p>
        </div>`,
    });
    return true;
  }

  if (system.isExhausted) {
    ui.notifications.warn(`${actor.name} is suffering from Chakra exhaustion and cannot use Chakra.`);
    return false;
  }

  const current = system.chakra?.value ?? 0;
  if (current >= amount) {
    await actor.update({ 'system.chakra.value': current - amount });
    return true;
  }

  // Not enough Chakra: pay the shortfall with an exhaustion roll.
  const shortfall = amount - current;
  const difficulty = config.chakra.exhaustionDifficulty;
  const tn = config.chakra.defaultTn;
  const confirmed = await Dialog.confirm({
    title: 'Not Enough Chakra',
    content: `
      <p>${escape(actor.name)} has <strong>${current}</strong> Chakra, but ${escape(label)} costs <strong>${amount}</strong>.</p>
      <p>Spending the remaining ${shortfall} means rolling ${shortfall} ${shortfall === 1 ? 'die' : 'dice'} needing ${difficulty} successes.
      Each success short is a week of Chakra exhaustion.</p>
      <p>Continue?</p>`,
    options: { classes: ['casus-belli', 'casus-belli-roll-dialog'] },
  });
  if (!confirmed) return false;

  await actor.update({ 'system.chakra.value': 0 });
  const roll = new Roll(`${shortfall}d10cs>=${tn}`);
  await roll.evaluate();
  const { successes } = countSuccesses(roll);
  const failures = Math.max(0, difficulty - successes);

  let outcome = `<p><strong>No exhaustion.</strong> ${successes} of ${difficulty} successes.</p>`;
  if (failures > 0) {
    const weeks = Math.max(system.chakraExhaustion?.weeks ?? 0, failures);
    await actor.update({ 'system.chakraExhaustion.weeks': weeks });
    outcome = `
      <p><strong>Chakra exhaustion for ${failures} week${failures > 1 ? 's' : ''}.</strong>
      ${successes} of ${difficulty} successes.</p>
      <p>Chakra cannot rise above zero, rolls involving ninja skills automatically fail, and physical attributes are halved.</p>`;
  }

  await roll.toMessage({
    speaker,
    flavor: `${label}: Chakra Exhaustion Roll (${shortfall} ${shortfall === 1 ? 'die' : 'dice'}, need ${difficulty})`,
    content: formatRollContent(roll, tn) + `<div class="casus-belli-ninja-note">${outcome}</div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });
  return true;
}

/**
 * Use a Chakra Surge outside a roll: movement, jumping, or armor as a reaction.
 * @param {Actor} actor
 * @param {'speed'|'jump'|'armor'} mode
 */
export async function chakraSurge(actor, mode) {
  const arcaneMight = actor.system.arcaneMight ?? 0;
  const effects = {
    speed: { title: 'Chakra Surge: Speed', text: `Movement speed increased by ${arcaneMight} until the end of the turn.` },
    jump: { title: 'Chakra Surge: Jump', text: `Jump distance or height increased by ${arcaneMight} yards.` },
    armor: { title: 'Chakra Surge: Armor', text: `Natural armor ${1 + arcaneMight} against all damage types until the attack is resolved.` },
  };
  const effect = effects[mode];
  if (!effect) return;

  const fromBeast = await chooseChakraSource(actor, CONFIG.CASUSBELLI.chakra.surgeCost, effect.title);
  if (fromBeast === null) return;
  const ok = await spendChakra(actor, CONFIG.CASUSBELLI.chakra.surgeCost, { label: effect.title, fromBeast });
  if (!ok) return;

  // The Cloak of Flames makes surge armor last until the start of your next turn.
  let extra = '';
  const bloodline = getBloodline(actor)?.system;
  if (mode === 'armor' && bloodline?.bloodline === 'jinchuriki' && bloodline.stage >= 2) {
    extra = `<p>Cloak of Flames: stacks with its natural armor (${1 + arcaneMight}), and lasts until the start of your next turn.</p>`;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="casus-belli-ninja-note"><h3>${effect.title}</h3><p>${effect.text}</p>${extra}</div>`,
  });
}

/**
 * Ask a Jinchuriki where Chakra comes from.
 * @returns {Promise<boolean|null>} true = creature, false = own Chakra, null = cancelled
 */
async function chooseChakraSource(actor, cost, label, { beastOnly = false } = {}) {
  if (cost <= 0 || !canDrawFromBeast(actor)) return false;
  if (beastOnly) return true;
  const chakra = actor.system.chakra ?? { value: 0, max: 0 };
  return new Promise((resolve) => {
    new Dialog({
      title: `${label}: Chakra Source`,
      content: `<p>${escape(label)} costs <strong>${cost}</strong> Chakra.</p>
        <p>Draw it from your own reserves (${chakra.value}/${chakra.max}) or from the creature within
        (${Math.ceil(cost / 2)} Stress and a Critical internal injury at the end of the scene)?</p>`,
      classes: ['casus-belli', 'casus-belli-roll-dialog'],
      buttons: {
        own: { label: 'Own Chakra', callback: () => resolve(false) },
        beast: { label: 'The Creature', callback: () => resolve(true) },
      },
      default: 'own',
      close: () => resolve(null),
    }).render(true);
  });
}

/* -------------------------------------------- */
/*  Techniques                                  */
/* -------------------------------------------- */

/**
 * Use a technique: check availability, spend Chakra, post it to chat, and open its roll.
 * @param {Item} item
 */
export async function useTechnique(item) {
  const actor = item.actor;
  if (!actor) return;
  const config = CONFIG.CASUSBELLI;
  const tech = item.system;
  const status = techniqueStatus(actor, item);

  if (!status.usable) {
    ui.notifications.warn(`${item.name} cannot be used: ${status.reasons.join('; ')}.`);
    return;
  }

  let fromBeast = false;
  if (status.cost > 0) {
    fromBeast = await chooseChakraSource(actor, status.cost, item.name, { beastOnly: status.beastOnly });
    if (fromBeast === null) return;
    const ok = await spendChakra(actor, status.cost, { label: item.name, fromBeast });
    if (!ok) return;
  }

  if (tech.frequency !== 'atWill') await item.update({ 'system.used': true });

  const description = await TextEditor.enrichHTML(tech.description ?? '', {
    secrets: actor.isOwner,
    async: true,
    rollData: actor.getRollData(),
    relativeTo: item,
  });

  const meta = [
    tech.category === 'bloodline' ? bloodlineLabel(tech.bloodline, tech.variant) : config.techniqueCategories[tech.category],
    tech.rank ? `${tech.rank} Rank` : '',
    tech.element !== 'none' ? config.elements[tech.element] : '',
  ].filter(Boolean).join(' · ');
  const costText = status.cost > 0
    ? `<p><strong>Cost:</strong> ${status.cost} Chakra${fromBeast ? ' (drawn from the creature within)' : ''}</p>`
    : '';

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="casus-belli-ninja-note technique-card">
        <h3>${escape(item.name)}</h3>
        <p class="technique-meta">${escape(meta)}</p>
        ${costText}
        ${description}
      </div>`,
  });

  if (tech.roll && tech.roll !== 'none') {
    const key = tech.roll;
    const value = key === 'arcaneMight'
      ? (actor.system.arcaneMight ?? 0)
      : (actor.system.ninjaSkills?.[key]?.total ?? 0);
    await openRollDialog(actor, { key, value, label: `${item.name} (${labelForKey(key)})`, defaultSecond: 'agi' });
  }
}

/**
 * Add a week of training progress to an unlearned technique.
 * Progress per week is the actor's Arcane Might, plus a teacher's Arcane Might if any.
 * A technique whose cost is zero or less takes one week.
 * @param {Item} item
 */
export async function trainTechnique(item) {
  const actor = item.actor;
  if (!actor) return;
  const cost = learningCost(actor, item.system.rank);
  if (cost === null) {
    ui.notifications.warn(`${item.name} is ${item.system.rank} rank and can only be gained through roleplay.`);
    return;
  }

  const gained = await promptTrainingWeek(actor, item.name);
  if (gained === null) return;
  const progress = (item.system.progress ?? 0) + gained;
  const learned = cost <= 0 || progress >= cost;
  await item.update({ 'system.progress': progress, 'system.learned': learned });

  ui.notifications.info(learned
    ? `${item.name} learned!`
    : `${item.name}: +${gained} progress (${progress} / ${cost}).`);
}

/* -------------------------------------------- */
/*  Eight Gates                                 */
/* -------------------------------------------- */

/**
 * Open the next of the Eight Gates.
 * @param {Actor} actor
 */
export async function openNextGate(actor) {
  const bloodline = getBloodline(actor);
  if (bloodline?.system.bloodline !== 'eightGates') return;
  const gates = CONFIG.CASUSBELLI.eightGates;
  const stage = bloodline.system.stage ?? 0;

  if (bloodline.system.gatesSpent) {
    ui.notifications.warn('Each Gate may only be opened once per rest.');
    return;
  }
  if (stage >= gates.length) {
    ui.notifications.warn('No further Gates are known.');
    return;
  }

  const next = stage + 1;
  await bloodline.update({ 'system.stage': next });

  const notes = [];
  // Gate of Healing restores Stamina to maximum.
  if (next === 2) {
    await actor.update({ 'system.stamina.value': actor.system.stamina?.max ?? 0 });
    notes.push('Stamina restored to maximum. Strength and Agility +1.');
  }
  if (next === 4) notes.push('Ignore all Pain while this Gate is open.');
  if (next === 5) notes.push('Strength and Agility +1 more. Every movement is as the Front Lotus.');

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="casus-belli-ninja-note"><h3>${gates[next - 1]} Opened</h3>${notes.map((n) => `<p>${n}</p>`).join('')}</div>`,
  });
}

/**
 * Close all open Gates and apply their aftermath.
 * @param {Actor} actor
 */
export async function closeGates(actor) {
  const bloodline = getBloodline(actor);
  if (bloodline?.system.bloodline !== 'eightGates') return;
  const stage = bloodline.system.stage ?? 0;
  if (stage <= 0) return;

  await bloodline.update({ 'system.stage': 0, 'system.gatesSpent': true });

  const notes = [];
  if (stage >= 2) {
    await actor.update({ 'system.stamina.value': 0 });
    notes.push('Gate of Healing: Stamina drops to zero and cannot recover naturally above zero. -2 dice to all physical rolls for a week.');
  }
  if (stage >= 3) {
    // Gate of Life: a minor internal injury on each arm and leg; Gate of Limit makes them major.
    const severity = stage >= 5 ? 'major' : 'minor';
    const source = stage >= 5 ? 'Gate of Limit' : 'Gate of Life';
    const limbs = ['Arms', 'Arms', 'Legs', 'Legs'];
    await actor.createEmbeddedDocuments('Item', limbs.map((location) => ({
      name: `${severity} ${location} Wound`,
      type: 'wound',
      system: {
        severity,
        bodyLocation: location,
        description: `<p>Internal injury from closing the ${source}.</p>`,
      },
    })));
    notes.push(`${source}: a ${severity} internal injury on each arm and leg.`);
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="casus-belli-ninja-note"><h3>The Gates Close</h3>${notes.map((n) => `<p>${n}</p>`).join('') || '<p>No lasting effects.</p>'}</div>`,
  });
}

/* -------------------------------------------- */
/*  Scenes and rest                             */
/* -------------------------------------------- */

/**
 * End the current scene: close the Gates, apply the Endless Chakra injury, reset once-per-scene uses.
 * @param {Actor} actor
 */
export async function endScene(actor) {
  const bloodline = getBloodline(actor);

  if (bloodline?.system.bloodline === 'eightGates' && (bloodline.system.stage ?? 0) > 0) {
    await closeGates(actor);
  }

  if (bloodline?.system.drewChakra) {
    await bloodline.update({ 'system.drewChakra': false });
    await actor.createEmbeddedDocuments('Item', [{
      name: 'Critical Chest Wound',
      type: 'wound',
      system: {
        severity: 'critical',
        bodyLocation: 'Chest',
        description: '<p>Internal injury from drawing Endless Chakra from the creature within.</p>',
      },
    }]);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: '<div class="casus-belli-ninja-note"><h3>Endless Chakra</h3><p>Drawing on the creature this scene inflicts a Critical internal injury.</p></div>',
    });
  }

  await resetTechniqueUses(actor, ['scene']);
}

/**
 * Take a full rest: ends the scene, restores Chakra (by sleep quality), and resets once-per-rest uses.
 * @param {Actor} actor
 */
export async function fullRest(actor) {
  const percent = await new Promise((resolve) => {
    new Dialog({
      title: `Full Rest: ${actor.name}`,
      content: `
        <form>
          <p>A full night's rest restores all Chakra. If sleep was interrupted, restore a percentage based on its quality.</p>
          <div class="form-group">
            <label>Chakra restored (%):</label>
            <input type="number" name="percent" value="100" min="0" max="100"/>
          </div>
        </form>`,
      classes: ['casus-belli', 'casus-belli-roll-dialog'],
      buttons: {
        rest: { label: 'Rest', callback: (html) => resolve(Math.max(0, Math.min(100, parseInt(html.find('[name="percent"]').val()) || 0))) },
      },
      default: 'rest',
      close: () => resolve(null),
    }).render(true);
  });
  if (percent === null) return;

  await endScene(actor);

  const system = actor.system;
  const chakra = system.chakra ?? { value: 0, max: 0 };
  const restored = Math.floor(chakra.max * percent / 100);
  const value = system.isExhausted ? 0 : Math.min(chakra.max, chakra.value + restored);
  await actor.update({ 'system.chakra.value': value });

  const bloodline = getBloodline(actor);
  if (bloodline?.system.gatesSpent) await bloodline.update({ 'system.gatesSpent': false });

  await resetTechniqueUses(actor, ['scene', 'rest']);

  const exhaustedNote = system.isExhausted
    ? `<p>Still suffering Chakra exhaustion (${system.chakraExhaustion?.weeks ?? 0} week(s) remaining): Chakra stays at zero.</p>`
    : '';
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="casus-belli-ninja-note"><h3>Full Rest</h3><p>Chakra: ${value} / ${chakra.max}.</p>${exhaustedNote}</div>`,
  });
}

/**
 * Clear the "used" marker on techniques with the given frequencies.
 */
async function resetTechniqueUses(actor, frequencies) {
  const updates = actor.items
    .filter((i) => i.type === 'technique' && i.system.used && frequencies.includes(i.system.frequency))
    .map((i) => ({ _id: i.id, 'system.used': false }));
  if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);
}

/* -------------------------------------------- */
/*  Active Effects                              */
/* -------------------------------------------- */

/**
 * The system-managed effects an actor should currently have.
 * @param {Actor} actor
 * @returns {object[]} Effect definitions keyed by `id`
 */
export function desiredNinjaEffects(actor) {
  const config = CONFIG.CASUSBELLI;
  const system = actor.system;
  if (!system.isNinja) return [];

  const bloodline = getBloodline(actor)?.system;
  const attr = (key, type, value) => ({ key: `system.attributes.${key}.value`, type, value, phase: 'initial' });
  const effects = [];

  if (system.isExhausted) {
    effects.push({
      id: 'chakraExhaustion',
      name: 'Chakra Exhaustion',
      img: 'icons/svg/unconscious.svg',
      description: 'Physical attributes are halved. Chakra cannot rise above zero, and rolls involving ninja skills automatically fail.',
      changes: config.physicalAttributes.map((k) => attr(k, 'multiply', 0.5)),
    });
  }

  if (bloodline?.bloodline === 'eightGates') {
    if ((bloodline.stage ?? 0) >= 2) {
      effects.push({
        id: 'gateOfHealing',
        name: 'Gate of Healing',
        img: 'icons/svg/regen.svg',
        description: 'Strength and Agility +1 while the Gates are open.',
        changes: ['str', 'agi'].map((k) => attr(k, 'add', 1)),
      });
    }
    if ((bloodline.stage ?? 0) >= 5) {
      effects.push({
        id: 'gateOfLimit',
        name: 'Gate of Limit',
        img: 'icons/svg/lightning.svg',
        description: 'Strength and Agility +1 more while the Gate of Limit is open.',
        changes: ['str', 'agi'].map((k) => attr(k, 'add', 1)),
      });
    }
  }

  if (bloodline?.bloodline === 'jinchuriki') {
    if (bloodline.hasFlaw('weakenedBody')) {
      effects.push({
        id: 'weakenedBody',
        name: 'Weakened Body',
        img: 'icons/svg/downgrade.svg',
        description: config.jinchurikiFlaws.weakenedBody.description,
        changes: config.physicalAttributes.map((k) => attr(k, 'add', -1)),
      });
    }
    if (bloodline.hasFlaw('sealedPower')) {
      effects.push({
        id: 'sealedPower',
        name: 'Sealed Power',
        img: 'icons/svg/padlock.svg',
        description: config.jinchurikiFlaws.sealedPower.description,
        changes: [{ key: 'system.arcaneMight', type: 'add', value: -1, phase: 'initial' }],
      });
    }
    if (bloodline.hasFlaw('wrackedByPain')) {
      effects.push({
        id: 'wrackedByPain',
        name: 'Wracked by Pain',
        img: 'icons/svg/blood.svg',
        description: config.jinchurikiFlaws.wrackedByPain.description,
        changes: [{ key: 'system.painModifier', type: 'add', value: 4, phase: 'initial' }],
      });
    }
  }

  return effects;
}
// The effects are applied by syncClassEffects in class-effects.mjs.
