import CasusBelliItemBase from "./base-item.mjs";

/**
 * A ninja's special bloodline (Byakugan, Sharingan, Eight Gates, Jinchuriki, ...).
 * A character may own at most one, and bloodline techniques must match it.
 */
export default class CasusBelliBloodline extends CasusBelliItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const config = CONFIG.CASUSBELLI;
    const schema = super.defineSchema();

    schema.bloodline = new fields.StringField({ required: true, initial: 'byakugan', choices: Object.keys(config.bloodlines) });
    schema.variant = new fields.StringField({ required: true, blank: true, initial: '' });

    /** Whether the bloodline is currently manifested (Byakugan / Sharingan). */
    schema.active = new fields.BooleanField({ required: true, initial: false });

    /** Progression track: tomoe, gates currently open, or seals opened. */
    schema.stage = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    /** Eight Gates: the gates have been opened and closed since the last rest. */
    schema.gatesSpent = new fields.BooleanField({ required: true, initial: false });

    /** Jinchuriki: chakra was drawn from the creature this scene. */
    schema.drewChakra = new fields.BooleanField({ required: true, initial: false });

    /** Jinchuriki: flaws (keys of CONFIG.CASUSBELLI.jinchurikiFlaws). */
    schema.flaws = new fields.ArrayField(
      new fields.StringField({ required: true, blank: false, choices: Object.keys(config.jinchurikiFlaws) }),
      { required: true, initial: [] }
    );

    return schema;
  }

  prepareDerivedData() {
    const def = CONFIG.CASUSBELLI.bloodlines[this.bloodline] ?? {};
    const min = def.minStage ?? 0;
    const max = def.maxStage ?? 0;
    this.stage = Math.max(min, Math.min(max, this.stage ?? 0));
  }

  /** Whether this bloodline has the given flaw. */
  hasFlaw(flaw) {
    return this.bloodline === 'jinchuriki' && (this.flaws ?? []).includes(flaw);
  }
}
