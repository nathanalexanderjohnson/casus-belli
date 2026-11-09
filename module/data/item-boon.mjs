import CasusBelliItemBase from "./base-item.mjs";

export default class CasusBelliBoon extends CasusBelliItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.type = new fields.StringField({ required: true, initial: "boon", choices: { boon: "CASUSBELLI.Item.Boon.Boon", bane: "CASUSBELLI.Item.Boon.Bane" } });
    schema.cost = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 });

    return schema;
  }
}