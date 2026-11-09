import CasusBelliItemBase from "./base-item.mjs";

/**
 * A Miko Talisman. Each has a lesser variant (Omamori, used freely) and a greater variant
 * (Ofuda, which must be etched into one of the Miko's Talisman slots before use).
 */
export default class CasusBelliTalisman extends CasusBelliItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.omamori = new fields.StringField({ required: true, blank: true, initial: '' });
    schema.ofuda = new fields.StringField({ required: true, blank: true, initial: '' });

    /** Whether each variant calls for a casting roll (Spiritualism + Will). */
    schema.omamoriRoll = new fields.BooleanField({ required: true, initial: false });
    schema.ofudaRoll = new fields.BooleanField({ required: true, initial: false });

    /** Number of Ofuda of this Talisman currently etched. */
    schema.prepared = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    /** Training: unlearned Talismans accumulate progress until learned. */
    schema.learned = new fields.BooleanField({ required: true, initial: true });
    schema.progress = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    return schema;
  }
}
