// Import document classes.
import { CasusBelliActor } from './documents/actor.mjs';
import { CasusBelliItem } from './documents/item.mjs';
// Import sheet classes.
import { CasusBelliActorSheet } from './sheets/actor-sheet.mjs';
import { CasusBelliItemSheet } from './sheets/item-sheet.mjs';
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { CASUSBELLI } from './helpers/config.mjs';
// Import DataModel classes
import * as models from './data/_module.mjs';

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', function () {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.casusBelli = {
    CasusBelliActor,
    CasusBelliItem,
    rollItemMacro,
  };
  game['casus-belli'] = game.casusBelli;

  // Add custom constants for configuration.
  CONFIG.CASUSBELLI = CASUSBELLI;
  CONFIG.CASUS_BELLI = CASUSBELLI;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: '1d10 + @agi.value',
    decimals: 2,
  };

  // Define custom Document and DataModel classes
  CONFIG.Actor.documentClass = CasusBelliActor;

  // Note that you don't need to declare a DataModel
  // for the base actor/item classes - they are included
  // with the Character/NPC as part of super.defineSchema()
  CONFIG.Actor.dataModels = {
    character: models.CasusBelliCharacter,
    npc: models.CasusBelliNPC
  }
  CONFIG.Item.documentClass = CasusBelliItem;
  CONFIG.Item.dataModels = {
    item: models.CasusBelliItem,
    feature: models.CasusBelliFeature,
    boon: models.CasusBelliBoon,
    maneuver: models.CasusBelliManeuver,
    wound: models.CasusBelliWound,
    armor: models.CasusBelliArmor,
    gadget: models.CasusBelliGadget,
    technique: models.CasusBelliTechnique,
    bloodline: models.CasusBelliBloodline
  };
  CONFIG.Item.typeLabels = {
    item: 'Item',
    feature: 'Feature',
    boon: 'TYPES.Item.boon',
    maneuver: 'Maneuver',
    wound: 'Wound',
    armor: 'Armor',
    gadget: 'Gadget',
    technique: 'Technique',
    bloodline: 'Bloodline'
  };

  // Set type-specific default icons so items don't use the bag icon.
  CONFIG.Item.typeIcons = foundry.utils.mergeObject(CONFIG.Item.typeIcons || {}, {
    wound: 'icons/svg/blood.svg',
    maneuver: 'icons/svg/sword.svg',
    armor: 'icons/svg/shield.svg',
    boon: 'icons/svg/regen.svg',
    gadget: 'icons/tools/smithing/crucible.webp',
    technique: 'icons/svg/lightning.svg',
    bloodline: 'icons/svg/eye.svg',
  });

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet('casus-belli', CasusBelliActorSheet, {
    makeDefault: true,
    label: 'CASUSBELLI.SheetLabels.Actor',
  });
  Items.unregisterSheet('core', ItemSheet);
  Items.registerSheet('casus-belli', CasusBelliItemSheet, {
    makeDefault: true,
    label: 'CASUSBELLI.SheetLabels.Item',
  });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Chat Message Context Menu                   */
/* -------------------------------------------- */

Hooks.on('getChatMessageContextOptions', (application, menuItems) => {
  menuItems.push({
    name: 'Re-roll With Luck',
    icon: '<i class="fas fa-clover"></i>',
    condition: html => {
      const el = html instanceof jQuery ? html[0] : html;
      const messageId = el.closest?.('.chat-message')?.dataset.messageId;
      const message = game.messages.get(messageId);
      const flags = message?.flags?.['casus-belli'];
      if (!flags?.actorId || flags.tn == null) return false;
      const actor = game.actors.get(flags.actorId);
      if (!actor?.isOwner) return false;
      return (actor.system.luck?.value ?? 0) > 0;
    },
    callback: async html => {
      const el = html instanceof jQuery ? html[0] : html;
      const messageId = el.closest?.('.chat-message')?.dataset.messageId;
      const message = game.messages.get(messageId);
      const flags = message?.flags?.['casus-belli'];
      const actor = game.actors.get(flags.actorId);
      const tn = flags.tn;

      if ((actor.system.luck?.value ?? 0) <= 0) {
        ui.notifications.warn(`${actor.name} has no luck points remaining.`);
        return;
      }

      const originalRoll = message.rolls[0];
      if (!originalRoll) {
        ui.notifications.warn('Could not find the original roll data.');
        return;
      }

      // Identify failures from the original roll
      const originalDice = originalRoll.dice.flatMap(die =>
        die.results.map(r => r.result)
      );
      const failures = originalDice.filter(r => r < tn);
      const rerollCount = Math.min(3, failures.length);

      if (rerollCount === 0) {
        ui.notifications.warn('No failures available to re-roll with luck.');
        return;
      }

      // Perform the luck re-roll
      const reroll = new Roll(`${rerollCount}d10cs>=${tn}`);
      await reroll.evaluate();

      // Calculate original total (including crit bonus)
      const originalTens = originalDice.filter(r => r === 10).length;
      const originalCritCount = Math.floor(originalTens / 2);
      const originalTotal = originalRoll.total + originalCritCount * 2;

      // Calculate new re-roll total (including crit bonus)
      const newDice = reroll.dice[0]?.results.map(r => r.result) ?? [];
      const newTens = newDice.filter(r => r === 10).length;
      const newCritCount = Math.floor(newTens / 2);
      const newTotal = reroll.total + newCritCount * 2;
      const combinedTotal = originalTotal + newTotal;

      // Deduct one luck point
      await actor.update({
        'system.luck.value': Math.max(0, actor.system.luck.value - 1),
      });

      // Build follow-up message content
      const diceHtml = newDice
        .map(result => {
          const classes = ['die-box', 'd10'];
          if (result >= tn) classes.push('success');
          if (result === 10) classes.push('max');
          return `<div class="${classes.join(' ')}">${result}</div>`;
        })
        .join('');

      const critHtml =
        newCritCount > 0
          ? ` <span class="crit-tag">+${newCritCount * 2} CRIT${
              newCritCount > 1 ? 'S' : ''
            }</span>`
          : '';

      const content = `
        <div class="casus-belli-roll-result">
          <div class="dice-pool">${diceHtml}</div>
          <div class="success-summary ${newCritCount > 0 ? 'crit' : ''}">
            <span class="success-count">${newTotal}</span> New Successes${critHtml}
          </div>
          <div class="success-summary">
            <span class="success-count">${combinedTotal}</span> Combined Total
          </div>
        </div>
      `;

      await ChatMessage.create({
        speaker: message.speaker,
        flavor: `${message.flavor} — Luck Re-roll`,
        content,
        rolls: [reroll],
        flags: {
          'casus-belli': {
            actorId: actor.id,
            tn: tn,
            luckReroll: true,
          },
        },
      });
    },
  });
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});
Handlebars.registerHelper('equals', function (a, b) {
  return a === b;
});
Handlebars.registerHelper('gte', function (a, b) {
  return a >= b;
});
Handlebars.registerHelper('capitalize', function (str) {
  if (typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once('ready', function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn(
      'You can only create macro buttons for owned Items'
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.casusBelli.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'casus-belli.itemMacro': true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: 'Item',
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}
