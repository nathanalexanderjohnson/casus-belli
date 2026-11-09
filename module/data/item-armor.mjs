import CasusBelliItemBase from "./base-item.mjs";

export default class CasusBelliArmor extends CasusBelliItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    const requiredInteger = { required: true, nullable: false, integer: true };

    // Weight and equipped state
    schema.weight   = new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 });
    schema.equipped = new fields.BooleanField({ required: true, initial: false });

    // Armor Values
    schema.avb = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, label: "CASUSBELLI.Armor.AVB" });
    schema.avp = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, label: "CASUSBELLI.Armor.AVP" });
    schema.avs = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, label: "CASUSBELLI.Armor.AVS" });

    // Locations worn — one boolean per location for reliable form handling
    schema.locationHead  = new fields.BooleanField({ required: true, initial: false });
    schema.locationArms  = new fields.BooleanField({ required: true, initial: false });
    schema.locationChest = new fields.BooleanField({ required: true, initial: false });
    schema.locationLegs  = new fields.BooleanField({ required: true, initial: false });

    return schema;
  }

  /**
   * Returns a human-readable string of worn locations.
   * @returns {string}
   */
  get locationSummary() {
    const worn = CONFIG.CASUSBELLI.bodyLocations
      .filter(loc => this[loc.field])
      .map(loc => loc.label);
    return worn.length ? worn.join(', ') : '—';
  }
}
