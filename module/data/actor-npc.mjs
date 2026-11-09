import CasusBelliActorBase from "./base-actor.mjs";

export default class CasusBelliNPC extends CasusBelliActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.cr = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });
    schema.xp = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    
    return schema
  }

  prepareDerivedData() {
    // Loop through attributes, and add their modifiers to our sheet output.
    for (const key in this.attributes) {
      // Calculate the modifier using d20 rules.
      this.attributes[key].mod = Math.floor((this.attributes[key].value - 10) / 2);
      // Handle attribute label localization.
      this.attributes[key].label = game.i18n.localize(CONFIG.CASUSBELLI.attributes[key]) ?? key;
    }

    // Loop through skills
    for (const key in this.skills) {
      this.skills[key].label = game.i18n.localize(CONFIG.CASUSBELLI.skills[key]) ?? key;
    }

    this.xp = this.cr * this.cr * 100;
  }
}