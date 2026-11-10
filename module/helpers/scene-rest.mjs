/**
 * End Scene and Rest, shared by every class. The buttons live in the character sheet header;
 * these route to the character's class so each applies its own rules.
 */
import { endScene as ninjaEndScene, fullRest as ninjaRest } from './ninja.mjs';
import { mikoRest } from './miko.mjs';
import { resetSamuraiUses } from './samurai.mjs';

/**
 * End the current scene for a character.
 * Ninja: closes the Gates, applies the Endless Chakra injury, resets once-per-scene techniques.
 * Samurai: resets once-per-scene abilities.
 * @param {Actor} actor
 */
export async function endScene(actor) {
  switch (actor.system.magicType) {
    case 'ninja':
      await ninjaEndScene(actor);
      ui.notifications.info(`Scene ended for ${actor.name}.`);
      break;
    case 'samurai':
      await resetSamuraiUses(actor, ['scene']);
      break;
    default:
      ui.notifications.info(`Scene ended for ${actor.name}.`);
  }
}

/**
 * Take a rest.
 * Ninja: asks how much Chakra to restore, ends the scene, resets once-per-rest techniques.
 * Miko: restores Unmei and the once-per-rest Favor uses.
 * Samurai: resets once-per-scene and once-per-rest abilities.
 * @param {Actor} actor
 */
export async function rest(actor) {
  switch (actor.system.magicType) {
    case 'ninja':
      await ninjaRest(actor);
      break;
    case 'miko':
      await mikoRest(actor);
      break;
    case 'samurai':
      await resetSamuraiUses(actor, ['scene', 'rest']);
      break;
    default:
      ui.notifications.info(`${actor.name} rests.`);
  }
}
