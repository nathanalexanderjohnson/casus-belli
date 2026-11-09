import CasusBelliItemBase from "./base-item.mjs";

/**
 * A Miko ability: either a tradition ability (Dosojin or Harai, unlocked by Arcane Might)
 * or a core ability shared by every Miko (tradition "").
 */
export default class CasusBelliMikoAbility extends CasusBelliItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.tradition = new fields.StringField({ required: true, blank: true, initial: '', choices: Object.keys(CONFIG.CASUSBELLI.mikoAbilityTraditions) });
    schema.minArcaneMight = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 0 });

    return schema;
  }
}
