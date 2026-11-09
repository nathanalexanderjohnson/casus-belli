import CasusBelliItemBase from "./base-item.mjs";

/**
 * A ninja technique (Ninjutsu, Taijutsu, Genjutsu, Senjutsu, or a Bloodline technique).
 */
export default class CasusBelliTechnique extends CasusBelliItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const config = CONFIG.CASUSBELLI;
    const schema = super.defineSchema();

    schema.category = new fields.StringField({ required: true, initial: 'ninjutsu', choices: Object.keys(config.techniqueCategories) });
    schema.rank = new fields.StringField({ required: true, initial: 'D', choices: Object.keys(config.techniqueRanks) });
    schema.element = new fields.StringField({ required: true, initial: 'none', choices: Object.keys(config.techniqueElements) });

    /** Chakra cost to use the technique. */
    schema.cost = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    /** Which roll the technique calls for, if any. */
    schema.roll = new fields.StringField({ required: true, initial: 'none', choices: Object.keys(config.techniqueRolls) });

    /** How often the technique may be used, and whether that use has been spent. */
    schema.frequency = new fields.StringField({ required: true, initial: 'atWill', choices: Object.keys(config.techniqueFrequencies) });
    schema.used = new fields.BooleanField({ required: true, initial: false });

    /** Bloodline techniques: the bloodline (and optional variant) they belong to. */
    schema.bloodline = new fields.StringField({ required: true, blank: true, initial: '' });
    schema.variant = new fields.StringField({ required: true, blank: true, initial: '' });

    /** Bloodline techniques: the stage (tomoe / gates open / seals opened) required to use it. */
    schema.requiredStage = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    /** Additional Arcane Might requirement beyond the rank's normal requirement. */
    schema.minArcaneMight = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    /** Free-text prerequisite (e.g. another technique). */
    schema.prerequisite = new fields.StringField({ required: true, blank: true, initial: '' });

    /** Training: unlearned techniques accumulate progress until learned. */
    schema.learned = new fields.BooleanField({ required: true, initial: true });
    schema.progress = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    return schema;
  }

  /** True when the technique belongs to a bloodline. */
  get isBloodlineTechnique() {
    return this.category === 'bloodline';
  }
}
