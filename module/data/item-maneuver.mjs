import CasusBelliItemBase from "./base-item.mjs";

export default class CasusBelliManeuver extends CasusBelliItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.cost = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 });
    schema.requiresTempo = new fields.BooleanField({ required: true, initial: false });
    schema.tags = new fields.ArrayField(new fields.StringField({ max: 50 }), { initial: [] });

    return schema;
  }
}