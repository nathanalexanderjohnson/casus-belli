import CasusBelliItemBase from "./base-item.mjs";

/**
 * A Samurai Kenjutsu: a Signature Maneuver that grows stronger at Arcane Might III and V.
 */
export default class CasusBelliKenjutsu extends CasusBelliItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    /** Stamina cost. Non-Stamina costs (e.g. Tempo) go in costNote. */
    schema.stamina = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.costNote = new fields.StringField({ required: true, blank: true, initial: '' });

    /** Additional effects unlocked at Arcane Might III and V. */
    schema.arcaneMightIII = new fields.StringField({ required: true, blank: true, initial: '' });
    schema.arcaneMightV = new fields.StringField({ required: true, blank: true, initial: '' });

    /** Free-text prerequisite (e.g. a Martial Spirit). */
    schema.prerequisite = new fields.StringField({ required: true, blank: true, initial: '' });

    /**
     * Arcane Might of the teacher, for a Kenjutsu learned from someone else: it cannot progress
     * beyond this. 0 means the Samurai's own style (no limit).
     */
    schema.teacherArcaneMight = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    return schema;
  }
}
