/**
 * Shared dice-pool roll helpers.
 *
 * Rolls are pools of d10s; each die at or above the target number (TN, normally 6) is a success,
 * and every pair of 10s adds two bonus successes (a crit).
 */

const escape = (value) => Handlebars.escapeExpression(String(value ?? ''));

/**
 * Count the successes in an evaluated roll, including crit bonuses.
 * @param {Roll} roll
 * @returns {{successes: number, critCount: number, dice: number[]}}
 */
export function countSuccesses(roll) {
  const dice = roll.dice.flatMap((die) => die.results.map((r) => r.result));
  const critCount = Math.floor(dice.filter((r) => r === 10).length / 2);
  return { successes: roll.total + (critCount * 2), critCount, dice };
}

/**
 * Build the chat HTML for an evaluated dice pool.
 * @param {Roll} roll
 * @param {number|null} [tn]            Target number (parsed from the formula when omitted)
 * @param {object} [options]
 * @param {number} [options.minSuccesses]  A floor on the success count (Sharingan foresight)
 * @returns {string}
 */
export function formatRollContent(roll, tn = null, { minSuccesses = 0 } = {}) {
  const { successes, critCount, dice } = countSuccesses(roll);
  const hasCrit = critCount > 0;

  let effectiveTn = tn;
  if (effectiveTn === null && roll.formula) {
    const match = roll.formula.match(/cs>=?(\d+)/);
    if (match) effectiveTn = parseInt(match[1]);
  }

  const diceHtml = dice.map((result) => {
    const classes = ['die-box', 'd10'];
    if (effectiveTn !== null && result >= effectiveTn) classes.push('success');
    if (result === 10) classes.push('max');
    return `<div class="${classes.join(' ')}">${result}</div>`;
  }).join('');

  const critHtml = hasCrit
    ? ` <span class="crit-tag">+${critCount * 2} CRIT${critCount > 1 ? 'S' : ''}</span>`
    : '';

  const total = Math.max(successes, minSuccesses);
  const foresightHtml = minSuccesses > successes
    ? `<div class="foresight-note">Foresight: raised from ${successes} to ${minSuccesses} (half the pool)</div>`
    : '';

  return `
    <div class="casus-belli-roll-result">
      <div class="dice-pool">${diceHtml}</div>
      <div class="success-summary ${hasCrit ? 'crit' : ''}">
        <span class="success-count">${total}</span> Successes${critHtml}
      </div>
      ${foresightHtml}
    </div>
  `;
}

/**
 * Roll a dice pool and post it to chat.
 * @param {Actor} actor
 * @param {object} options
 * @param {number} options.dice
 * @param {number} options.tn
 * @param {string} options.flavor
 * @param {number} [options.minSuccesses]
 * @param {string} [options.extraContent]  Extra HTML appended under the result
 * @returns {Promise<Roll>}
 */
export async function rollPool(actor, { dice, tn, flavor, minSuccesses = 0, extraContent = '' }) {
  const formula = `${Math.max(1, dice)}d10cs>=${tn}`;
  const roll = new Roll(formula, actor.getRollData());
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    content: formatRollContent(roll, tn, { minSuccesses }) + extraContent,
    rollMode: game.settings.get('core', 'rollMode'),
    flags: {
      'casus-belli': {
        actorId: actor.id,
        tn,
      },
    },
  });
  return roll;
}

/**
 * Resolve the display label for an attribute, skill, or ninja skill key.
 * @param {string} key
 * @returns {string}
 */
export function labelForKey(key) {
  const config = CONFIG.CASUSBELLI;
  if (config.attributes[key]) return game.i18n.localize(config.attributes[key]);
  if (config.skills[key]) return game.i18n.localize(config.skills[key]);
  if (config.ninjaSkills[key]) return config.ninjaSkills[key].label;
  if (key === 'arcaneMight') return 'Arcane Might';
  return key;
}

/**
 * Open the standard roll dialog (TN, dice modifier, optional second attribute/skill), with ninja
 * options (Chakra Surge, Sharingan, reckless surge, foresight, Taijutsu substitution) for ninja.
 *
 * @param {Actor} actor
 * @param {object} options
 * @param {string} options.key            The primary attribute/skill/ninja skill key
 * @param {number} options.value          The primary dice value
 * @param {string} options.label          Display label
 * @param {string} [options.defaultSecond] Key pre-selected as the second attribute/skill
 */
export async function openRollDialog(actor, { key, value, label, defaultSecond = '' }) {
  // Imported lazily to avoid a circular import (ninja.mjs imports this module).
  const ninja = await import('./ninja.mjs');
  const config = CONFIG.CASUSBELLI;
  const system = actor.system;
  const isNinja = actor.type === 'character' && system.isNinja;
  const rollData = actor.getRollData();
  const arcaneMight = Number(system.arcaneMight ?? 0);

  // ── Second attribute/skill options ────────────────────────────────────────
  let options = '<option value="">None (Single Roll)</option>';
  for (const [attrKey, attrLabel] of Object.entries(config.attributes)) {
    const abbr = game.i18n.localize(config.attributeAbbreviations[attrKey]);
    const selected = attrKey === defaultSecond ? ' selected' : '';
    options += `<option value="${attrKey}"${selected}>${game.i18n.localize(attrLabel)} (${abbr})</option>`;
  }
  for (const [skillKey, skillLabel] of Object.entries(config.skills)) {
    const selected = skillKey === defaultSecond ? ' selected' : '';
    options += `<option value="${skillKey}"${selected}>${game.i18n.localize(skillLabel)}</option>`;
  }
  if (isNinja) {
    for (const [skillKey, def] of Object.entries(config.ninjaSkills)) {
      if (def.locked) continue;
      const selected = skillKey === defaultSecond ? ' selected' : '';
      options += `<option value="${skillKey}"${selected}>${def.label}</option>`;
    }
  }

  // ── Ninja options ─────────────────────────────────────────────────────────
  let ninjaHtml = '';
  const bloodline = isNinja ? system.bloodlineItem?.system : null;
  const sharinganActive = bloodline?.bloodline === 'sharingan' && bloodline.active;
  const foresight = sharinganActive && bloodline.stage >= 3;
  const canBeast = isNinja && ninja.canDrawFromBeast(actor);
  const taijutsu = isNinja ? (system.ninjaSkills?.taijutsu?.total ?? 0) : 0;

  if (isNinja) {
    const surgeCost = config.chakra.surgeCost;
    ninjaHtml += `
      <fieldset class="ninja-roll-options">
        <legend>Ninja</legend>
        <div class="form-group">
          <label><input type="checkbox" name="surge"/> Chakra Surge (+${arcaneMight} dice, ${surgeCost} Chakra)</label>
        </div>
        <p class="hint">Chakra: ${system.chakra?.value ?? 0} / ${system.chakra?.max ?? 0}. Surge applies to physical attributes, Awareness, and ninja skills.</p>`;
    if (sharinganActive) {
      ninjaHtml += `
        <div class="form-group">
          <label><input type="checkbox" name="sharinganDie"/> Sharingan: +1 surge die (+1 Chakra)</label>
        </div>
        <p class="hint">Sharingan: surging on sight-based Awareness rolls costs no Chakra.</p>`;
    }
    if (canBeast) {
      ninjaHtml += `
        <div class="form-group">
          <label>Reckless surge dice (2 Chakra each, max ${arcaneMight})</label>
          <input type="number" name="recklessDice" value="0" min="0" max="${arcaneMight}"/>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="fromBeast"/> Draw this Chakra from the creature within</label>
        </div>`;
    }
    if (foresight) {
      ninjaHtml += `
        <div class="form-group">
          <label><input type="checkbox" name="foresight" checked/> Third Tomoe foresight (at least half the pool in successes)</label>
        </div>`;
    }
    if (['athletics', 'unarmed'].includes(key) && taijutsu > 0) {
      ninjaHtml += `
        <div class="form-group">
          <label><input type="checkbox" name="useTaijutsu" ${taijutsu > value ? 'checked' : ''}/> Use Taijutsu (${taijutsu}) instead of ${escape(label)} (${value})</label>
        </div>`;
    }
    ninjaHtml += '</fieldset>';
  }

  const content = `
    <form>
      <div class="form-group">
        <label>Target Number:</label>
        <input type="number" name="tn" value="${config.chakra.defaultTn}" min="1" max="10"/>
      </div>
      <div class="form-group">
        <label>Dice Modifier:</label>
        <input type="number" name="diceMod" value="0"/>
      </div>
      <div class="form-group">
        <label>Combine with (optional):</label>
        <select name="secondKey">${options}</select>
      </div>
      ${ninjaHtml}
    </form>
  `;

  const onRoll = async (html) => {
    const field = (name) => html.find(`[name="${name}"]`);
    const checked = (name) => Boolean(field(name).prop('checked'));
    const tn = parseInt(field('tn').val()) || config.chakra.defaultTn;
    const diceMod = parseInt(field('diceMod').val()) || 0;
    const secondKey = field('secondKey').val();

    let primaryKey = key;
    let primaryLabel = label;
    let totalDice = Number(value) || 0;
    if (checked('useTaijutsu')) {
      primaryKey = 'taijutsu';
      primaryLabel = `Taijutsu (as ${label})`;
      totalDice = taijutsu;
    }

    let flavor = `${primaryLabel} (TN ${tn})`;
    if (secondKey) {
      const secondValue = Number(rollData[secondKey]?.value ?? system[secondKey] ?? 0);
      totalDice += secondValue;
      flavor = `${primaryLabel} + ${labelForKey(secondKey)} (TN ${tn})`;
    }

    const keys = [primaryKey, secondKey].filter(Boolean);
    const notes = [];

    if (isNinja) {
      const involvesNinjaSkill = keys.some((k) => k in config.ninjaSkills || k === 'arcaneMight');

      // Chakra exhaustion: rolls involving a ninja skill automatically fail.
      if (involvesNinjaSkill && system.isExhausted) {
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor,
          content: `<div class="casus-belli-ninja-note"><p><strong>Automatic failure.</strong> ${escape(actor.name)} is suffering from Chakra exhaustion and cannot use ninja skills.</p></div>`,
        });
        return;
      }

      if (checked('surge')) {
        const eligible = keys.some((k) => config.physicalAttributes.includes(k) || k === 'awareness' || k in config.ninjaSkills || k === 'arcaneMight');
        if (!eligible) {
          ui.notifications.warn('Chakra Surge only applies to physical attributes, Awareness, and ninja skills. Rolling without it.');
        } else {
          const freeSight = sharinganActive && keys.includes('awareness');
          const sharinganDie = sharinganActive && checked('sharinganDie');
          const reckless = canBeast ? Math.max(0, Math.min(arcaneMight, parseInt(field('recklessDice').val()) || 0)) : 0;
          const cost = (freeSight ? 0 : config.chakra.surgeCost) + (sharinganDie ? 1 : 0) + (reckless * 2);
          const ok = await ninja.spendChakra(actor, cost, { label: 'Chakra Surge', fromBeast: canBeast && checked('fromBeast') });
          if (!ok) return;
          const bonus = arcaneMight + (sharinganDie ? 1 : 0) + reckless;
          totalDice += bonus;
          flavor += ` [Chakra Surge +${bonus}]`;
          notes.push(`Chakra Surge: +${bonus} dice for ${cost} Chakra${freeSight ? ' (Sharingan sight)' : ''}.`);
        }
      }
    }

    if (diceMod !== 0) {
      totalDice += diceMod;
      flavor += ` [${diceMod > 0 ? `+${diceMod}` : diceMod} dice]`;
    }
    totalDice = Math.max(1, totalDice);

    const minSuccesses = foresight && checked('foresight') ? Math.floor(totalDice / 2) : 0;
    const extraContent = notes.length
      ? `<div class="casus-belli-ninja-note">${notes.map((n) => `<p>${n}</p>`).join('')}</div>`
      : '';
    await rollPool(actor, { dice: totalDice, tn, flavor, minSuccesses, extraContent });
  };

  new Dialog({
    title: `Roll ${label}`,
    content,
    classes: ['casus-belli', 'casus-belli-roll-dialog'],
    buttons: {
      roll: { label: 'Roll', callback: onRoll },
    },
    default: 'roll',
  }).render(true);
}
