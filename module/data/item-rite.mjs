import CasusBelliItemBase from "./base-item.mjs";

/**
 * A Miko rite: a Kannagara (blessing on the land) or a Miasma (curse).
 */
export default class CasusBelliRite extends CasusBelliItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.kind = new fields.StringField({ required: true, initial: 'kannagara', choices: Object.keys(CONFIG.CASUSBELLI.riteKinds) });
    schema.minArcaneMight = new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 });

    /** Favor cost. Variable costs use 0 plus a note; the amount is confirmed when performed. */
    schema.cost = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.costNote = new fields.StringField({ required: true, blank: true, initial: '' });

    /** Maintenance capacity used while the rite is active. */
    schema.maintenance = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.maintenanceNote = new fields.StringField({ required: true, blank: true, initial: '' });

    /** Draining: keeps using capacity until the end of the Passage of Time. */
    schema.draining = new fields.BooleanField({ required: true, initial: false });
    /** Vicious (Miasma): does not need a connection to the target. */
    schema.vicious = new fields.BooleanField({ required: true, initial: false });

    /** Whether performing the rite calls for a casting roll (Spiritualism + Will). */
    schema.roll = new fields.BooleanField({ required: true, initial: false });

    /** The rite is in effect (using maintenance capacity; a Miasma also holds a Talisman slot). */
    schema.active = new fields.BooleanField({ required: true, initial: false });

    return schema;
  }
}
