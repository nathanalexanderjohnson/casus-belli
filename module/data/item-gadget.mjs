import CasusBelliItemBase from "./base-item.mjs";

export default class CasusBelliGadget extends CasusBelliItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.baseBlueprint = new fields.StringField({ initial: '' });
    schema.baseComplexity = new fields.NumberField({ initial: 0, integer: true });
    schema.wireType = new fields.StringField({ initial: 'copper', choices: ['copper', 'silver', 'gold'] });
    schema.weight = new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 });
    schema.equipped = new fields.BooleanField({ required: true, initial: false });
    schema.augments = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ initial: '' }),
        complexity: new fields.NumberField({ initial: 0, integer: true }),
        enabled: new fields.BooleanField({ initial: true })
      })
    );

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    const wireModifiers = { copper: 0, silver: -1, gold: -2 };
    const augmentSum = (this.augments || []).reduce((sum, a) => sum + (a.enabled ? (a.complexity ?? 0) : 0), 0);
    const wireMod = wireModifiers[this.wireType] ?? 0;
    this.totalComplexity = (this.baseComplexity ?? 0) + augmentSum + wireMod;
  }
}
