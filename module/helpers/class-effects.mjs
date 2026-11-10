/**
 * System-managed Active Effects for class features (ninja conditions, Samurai Oni's Might).
 *
 * Each class module describes the effects an actor should have right now; this module creates,
 * updates, and deletes effects so the actor matches. Managed effects are tagged with a flag;
 * effects a user has disabled stay disabled (only presence and changes are synced).
 */
import { desiredNinjaEffects } from './ninja.mjs';
import { desiredSamuraiEffects } from './samurai.mjs';

const FLAG_SCOPE = 'casus-belli';
const FLAG_KEY = 'classEffect';
/** Tag used before the sync was shared between classes; still recognised. */
const LEGACY_FLAG_KEY = 'ninjaEffect';

/**
 * The managed-effect id of an ActiveEffect, or undefined for effects users created.
 * @param {ActiveEffect} effect
 */
function managedId(effect) {
  return effect.getFlag(FLAG_SCOPE, FLAG_KEY) ?? effect.getFlag(FLAG_SCOPE, LEGACY_FLAG_KEY);
}

/** Comparable form of a list of changes. */
function changeSignature(changes) {
  return JSON.stringify((changes ?? []).map((c) => [c.key, c.type, Number(c.value), c.phase ?? 'initial']));
}

/**
 * Make the actor's managed effects match its current class state.
 * @param {Actor} actor
 */
export async function syncClassEffects(actor) {
  if (!actor?.isOwner || actor.type !== 'character') return;
  const desired = [...desiredNinjaEffects(actor), ...desiredSamuraiEffects(actor)];
  const desiredById = new Map(desired.map((e) => [e.id, e]));
  const existing = actor.effects.filter((e) => managedId(e));

  const toDelete = [];
  const toUpdate = [];
  const present = new Set();
  for (const effect of existing) {
    const id = managedId(effect);
    const want = desiredById.get(id);
    if (!want || present.has(id)) {
      toDelete.push(effect.id); // no longer wanted, or a duplicate
      continue;
    }
    present.add(id);
    if (changeSignature(effect.system?.changes) !== changeSignature(want.changes) || effect.name !== want.name) {
      toUpdate.push({ _id: effect.id, name: want.name, description: want.description, 'system.changes': want.changes });
    }
  }

  const toCreate = desired.filter((e) => !present.has(e.id)).map((e) => ({
    name: e.name,
    img: e.img,
    description: e.description,
    transfer: false,
    system: { changes: e.changes },
    flags: { [FLAG_SCOPE]: { [FLAG_KEY]: e.id } },
  }));

  if (toDelete.length) await actor.deleteEmbeddedDocuments('ActiveEffect', toDelete);
  if (toUpdate.length) await actor.updateEmbeddedDocuments('ActiveEffect', toUpdate);
  if (toCreate.length) await actor.createEmbeddedDocuments('ActiveEffect', toCreate);
}
