/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    // Actor partials.
    'systems/casus-belli/templates/actor/parts/actor-features.hbs',
    'systems/casus-belli/templates/actor/parts/actor-items.hbs',
    'systems/casus-belli/templates/actor/parts/actor-boons.hbs',
    'systems/casus-belli/templates/actor/parts/actor-maneuvers.hbs',
    'systems/casus-belli/templates/actor/parts/actor-effects.hbs',
    'systems/casus-belli/templates/actor/parts/actor-armor.hbs',
    'systems/casus-belli/templates/actor/parts/actor-armor-tracker.hbs',
    'systems/casus-belli/templates/actor/parts/actor-casus-belli-tab.hbs',
    'systems/casus-belli/templates/actor/parts/actor-sorcerer-tab.hbs',
    'systems/casus-belli/templates/actor/parts/actor-ninja-tab.hbs',
    'systems/casus-belli/templates/actor/parts/actor-miko-tab.hbs',
    'systems/casus-belli/templates/actor/parts/actor-samurai-tab.hbs',
    // Dialogs
    'systems/casus-belli/templates/dialogs/spellcast-dialog.hbs',
    // Item partials
    'systems/casus-belli/templates/item/parts/item-effects.hbs',
  ]);
};
