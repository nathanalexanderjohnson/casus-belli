import CasusBelliItemBase from "./base-item.mjs";

/**
 * A Samurai ability: a Martial Spirit, a Warrior's Presence order, a Dragon Blood power,
 * or a core rules card.
 */
export default class CasusBelliSamuraiAbility extends CasusBelliItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const config = CONFIG.CASUSBELLI;
    const schema = super.defineSchema();

    schema.category = new fields.StringField({ required: true, initial: 'martialSpirit', choices: Object.keys(config.samuraiAbilityCategories) });

    /** Stamina cost to use, if any. */
    schema.stamina = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    /** Whether using it calls for a samurai ability roll (Strength + Arcane Might). */
    schema.roll = new fields.BooleanField({ required: true, initial: false });

    /** How often it may be used, and whether that use has been spent. */
    schema.frequency = new fields.StringField({ required: true, initial: 'atWill', choices: Object.keys(config.techniqueFrequencies) });
    schema.used = new fields.BooleanField({ required: true, initial: false });

    /** Free-text requirement (e.g. the blessing of a Hinotori). */
    schema.requirement = new fields.StringField({ required: true, blank: true, initial: '' });

    return schema;
  }
}
