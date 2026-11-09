import CasusBelliItemBase from "./base-item.mjs";

export default class CasusBelliWound extends CasusBelliItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.bodyLocation = new fields.StringField({ required: true, blank: false, initial: 'Chest' });
    schema.severity = new fields.StringField({ required: true, blank: false, initial: 'minor' });
    schema.bleeding = new fields.BooleanField({ required: true, initial: false });
    schema.treated = new fields.BooleanField({ required: true, initial: false });
    schema.pain = new fields.NumberField({ required: true, nullable: false, initial: 1, integer: true });
    schema.title = new fields.StringField({ required: false, blank: true, initial: '' });
    /** Pain that does not follow severity and cannot be reduced by treatment (e.g. the Kami's wound). */
    schema.fixedPain = new fields.NumberField({ required: false, nullable: true, integer: true, initial: null, min: 0 });

    return schema;
  }

  prepareDerivedData() {
    const severity = this.severity || 'minor';
    const location = (this.bodyLocation || '').trim();

    const basePain = {
      minor: 1,
      major: 2,
      critical: 4,
      lethal: 8,
    }[severity] ?? 0;

    if (Number.isInteger(this.fixedPain)) this.pain = this.fixedPain;
    else this.pain = this.treated ? Math.max(1, Math.floor(basePain / 2)) : basePain;

    // Bleeding is suppressed once a wound is treated.
    const bleeding = this.bleeding && !this.treated;

    const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);
    const locationPart  = location ? ` ${location}` : '';
    const statusPart    = this.treated ? ' (Treated)' : bleeding ? ' (Bleeding)' : '';

    this.title = `${severityLabel}${locationPart} Wound${statusPart}`;
  }
}
