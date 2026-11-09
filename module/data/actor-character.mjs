import CasusBelliActorBase from "./base-actor.mjs";

/**
 * Whether an item is the Beloved Above All Inori: a boon flagged by the compendium,
 * or any boon with that exact name (so a hand-made copy works too).
 * @param {Item} item
 */
export function isBelovedAboveAll(item) {
  if (item?.type !== 'boon') return false;
  return item.getFlag?.('casus-belli', 'inori') === 'belovedAboveAll'
    || item.name?.trim().toLowerCase() === 'beloved above all';
}

export default class CasusBelliCharacter extends CasusBelliActorBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.level = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 1 })
    });

    schema.combatantRank = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 1, min: 0 })
    });

    schema.reputation = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    schema.pain = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    schema.stress = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    schema.stamina = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    schema.carryingCapacity = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    schema.speed = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 5, min: 0 })
    });

    schema.luck = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 3, min: 0 })
    });

    schema.xp = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    schema.magicType = new fields.StringField({
      required: true,
      initial: 'none',
      choices: ['none', 'samurai', 'ninja', 'miko']
    });

    schema.arcaneMight = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
      max: 10
    });

    schema.ephiphanies = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    schema.martialSpirit = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ required: false, blank: true, initial: '' }),
        description: new fields.StringField({ required: false, blank: true, initial: '' }),
        editing: new fields.BooleanField({ required: false, initial: false })
      }),
      { required: false, initial: [] }
    );

    schema.warriorsPresence = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ required: false, blank: true, initial: '' }),
        description: new fields.StringField({ required: false, blank: true, initial: '' }),
        editing: new fields.BooleanField({ required: false, initial: false })
      }),
      { required: false, initial: [] }
    );

    schema.kenjutsu = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ required: false, blank: true, initial: '' }),
        stamina: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
        description: new fields.StringField({ required: false, blank: true, initial: '' }),
        arcaneMightIII: new fields.StringField({ required: false, blank: true, initial: '' }),
        arcaneMightV: new fields.StringField({ required: false, blank: true, initial: '' }),
        editing: new fields.BooleanField({ required: false, initial: true })
      }),
      { required: false, initial: [] }
    );

    // ── Ninja ───────────────────────────────────────────────────────────────
    const config = CONFIG.CASUSBELLI;

    schema.chakra = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    /** Weeks of Chakra exhaustion remaining (0 = not exhausted). */
    schema.chakraExhaustion = new fields.SchemaField({
      weeks: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    schema.bloodlinePotency = new fields.StringField({
      required: true,
      initial: 'standard',
      choices: Object.keys(config.bloodlinePotencies)
    });

    schema.ninjaSkills = new fields.SchemaField(Object.keys(config.ninjaSkills).reduce((obj, key) => {
      obj[key] = new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 14 })
      });
      return obj;
    }, {}));

    schema.affinities = new fields.SchemaField(Object.keys(config.elements).reduce((obj, key) => {
      obj[key] = new fields.BooleanField({ required: true, initial: false });
      return obj;
    }, {}));

    /** Flat pain added by effects (e.g. the Wracked by Pain flaw). Applied on top of wound pain. */
    schema.painModifier = new fields.NumberField({ ...requiredInteger, initial: 0 });

    // ── Miko ────────────────────────────────────────────────────────────────
    schema.tradition = new fields.StringField({
      required: true,
      initial: 'dosojin',
      choices: Object.keys(config.mikoTraditions)
    });

    schema.spiritualism = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0, max: 14 })
    });

    schema.unmei = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    /** Favor may go negative (Destined For Greatness). */
    schema.favor = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    /** Extra Talisman slots from Inori such as Talisman Master. */
    schema.talismanSlotBonus = new fields.NumberField({ ...requiredInteger, initial: 0 });

    schema.wieldsMiasma = new fields.BooleanField({ required: true, initial: false });

    /** Spirit Ward hit points (gained at Arcane Might V). */
    schema.spiritWard = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    /** Once-per-rest Favor uses. */
    schema.mikoRest = new fields.SchemaField({
      unmeiRestored: new fields.BooleanField({ required: true, initial: false }),
      reetched: new fields.BooleanField({ required: true, initial: false })
    });

    schema.thesis = new fields.StringField({
      required: true,
      blank: true
    });

    schema.arithmeticSpark = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
      max: 10
    });

    schema.flux = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 })
    });

    return schema;
  }

  prepareDerivedData() {
    // Active Effects (e.g. halving from Chakra exhaustion) may leave fractional values; round down.
    for (const key in this.attributes) {
      this.attributes[key].value = Math.floor(this.attributes[key].value ?? 0);
    }
    this.arcaneMight = Math.floor(this.arcaneMight ?? 0);

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

    if (this.magicType === 'none') {
      this.arcaneMight = 0;
      if (this.ephiphanies) {
        this.ephiphanies.value = 0;
        this.ephiphanies.max = 0;
      }
    } else {
      this.arcaneMight = Math.max(0, Math.min(10, this.arcaneMight ?? 0));
      if (this.ephiphanies) {
        this.ephiphanies.max = this.magicType === 'samurai' ? this.arcaneMight : 0;
        this.ephiphanies.value = Math.max(0, Math.min(this.ephiphanies.value ?? 0, this.ephiphanies.max));
      }
    }

    const rank = this.combatantRank?.value ?? 0;
    const strength = this.attributes?.str?.value ?? 0;
    const endurance = this.attributes?.end?.value ?? 0;
    const will = this.attributes?.wil?.value ?? 0;
    const insight = this.attributes?.ins?.value ?? 0;

    if (this.pain) {
      this.pain.value = 0;
      this.pain.max = rank + endurance + will;
    }

    if (this.stress) {
      const stressMax = 4 + insight + will;
      this.stress.max = Math.max(0, stressMax);
    }

    if (this.stamina) {
      this.stamina.max = strength + endurance + (2 * rank);
    }

    if (this.carryingCapacity) {
      this.carryingCapacity.value = 0;
      this.carryingCapacity.max = 4 + strength + endurance;
    }

    this._prepareNinjaData();
    this._prepareMikoData();
  }

  /** True when the character is a Miko. */
  get isMiko() {
    return this.magicType === 'miko';
  }

  /**
   * Derived Miko values: Unmei, Favor, Talisman slots, Kannagara capacity, Spirit Ward.
   * @private
   */
  _prepareMikoData() {
    const miko = CONFIG.CASUSBELLI.miko;
    const isMiko = this.isMiko;
    const arcaneMight = this.arcaneMight ?? 0;

    // Beloved Above All: no Unmei and a single Talisman; nothing can raise either.
    // Extra Unmei and Talismans are paid for with the Kami's wound instead (see helpers/miko.mjs).
    this.belovedAboveAll = isMiko && Boolean(this.parent?.items?.some((i) => isBelovedAboveAll(i)));

    if (this.unmei) {
      this.unmei.max = isMiko && !this.belovedAboveAll ? 1 + arcaneMight : 0;
      this.unmei.value = Math.max(0, Math.min(this.unmei.value ?? 0, this.unmei.max));
    }

    if (this.favor) {
      this.favor.max = isMiko ? miko.favorPerArcaneMight * arcaneMight : 0;
      this.favor.value = Math.min(this.favor.value ?? 0, this.favor.max);
    }

    if (this.spiritWard) {
      this.spiritWard.max = isMiko && arcaneMight >= miko.wardHpArcaneMight ? miko.wardHp : 0;
      this.spiritWard.value = Math.min(this.spiritWard.value ?? 0, this.spiritWard.max);
    }

    // Ofuda that may be etched at once: 1 + Arcane Might, plus Inori bonuses.
    if (!isMiko) this.talismanSlots = 0;
    else if (this.belovedAboveAll) this.talismanSlots = 1;
    else this.talismanSlots = Math.max(0, 1 + arcaneMight + (this.talismanSlotBonus ?? 0));

    // Kannagara maintenance capacity.
    this.kannagaraCapacity = isMiko
      ? (miko.kannagaraCapacity.find((tier) => arcaneMight >= tier.arcaneMight)?.capacity ?? 0)
      : 0;
  }

  /** True when the character is a ninja. */
  get isNinja() {
    return this.magicType === 'ninja';
  }

  /** The character's bloodline item, if any. */
  get bloodlineItem() {
    return this.parent?.items?.find((i) => i.type === 'bloodline') ?? null;
  }

  /** True when Chakra exhaustion is in effect. */
  get isExhausted() {
    return this.isNinja && ((this.chakraExhaustion?.weeks ?? 0) > 0 || this.chakra?.sealedExhaustion === true);
  }

  /**
   * Derived ninja values: chakra maximum, effective ninja skill totals, technique learning cost.
   * @private
   */
  _prepareNinjaData() {
    const config = CONFIG.CASUSBELLI;
    const bloodline = this.isNinja ? this.bloodlineItem?.system : null;
    const arcaneMight = this.arcaneMight ?? 0;

    // Effective ninja skills. Divine Lineage raises every skill to the highest one.
    const highest = Math.max(0, ...Object.values(this.ninjaSkills ?? {}).map((s) => s.value ?? 0));
    for (const [key, skill] of Object.entries(this.ninjaSkills ?? {})) {
      skill.label = config.ninjaSkills[key]?.label ?? key;
      skill.locked = Boolean(config.ninjaSkills[key]?.locked);
      skill.total = bloodline?.bloodline === 'divineLineage' ? highest : (skill.value ?? 0);
    }

    // Effective affinities. Divine Lineage grants all five.
    this.effectiveAffinities = {};
    for (const key of Object.keys(config.elements)) {
      this.effectiveAffinities[key] = bloodline?.bloodline === 'divineLineage' || Boolean(this.affinities?.[key]);
    }

    // Weakened Body halves stamina.
    if (bloodline?.hasFlaw('weakenedBody') && this.stamina) {
      this.stamina.max = Math.floor(this.stamina.max / 2);
    }

    // Chakra maximum.
    const potency = config.bloodlinePotencies[this.bloodlinePotency] ?? config.bloodlinePotencies.standard;
    if (this.chakra) {
      if (!this.isNinja) {
        this.chakra.max = 0;
        this.chakra.sealedExhaustion = false;
      } else {
        let max = potency.chakra + (3 * arcaneMight);
        if (bloodline?.bloodline === 'jinchuriki') max -= config.chakra.jinchurikiPenalty;
        if (bloodline?.hasFlaw('chakraSeal')) max -= config.chakra.chakraSealPenalty;
        this.chakra.max = Math.max(0, max);
        // Chakra Seal reducing max chakra to zero is a constant state of exhaustion.
        this.chakra.sealedExhaustion = Boolean(bloodline?.hasFlaw('chakraSeal')) && this.chakra.max === 0;
      }
      const cap = this.isExhausted ? 0 : this.chakra.max;
      this.chakra.value = Math.max(0, Math.min(this.chakra.value ?? 0, cap));
    }

    // Technique learning: progress per week, cost per rank after the potency modifier.
    this.techniqueLearning = {
      progressPerWeek: arcaneMight,
      modifier: potency.learningModifier,
      costs: Object.fromEntries(Object.entries(config.techniqueRanks).map(([rank, def]) => {
        if (def.cost === null) return [rank, null];
        return [rank, def.cost + potency.learningModifier];
      })),
    };
  }

  getRollData() {
    const data = super.getRollData();

    data.lvl = this.level.value;
    data.arcaneMight = { value: this.arcaneMight ?? 0 };

    // Ninja skills are only available to ninja.
    if (this.isNinja) {
      for (const [key, skill] of Object.entries(this.ninjaSkills ?? {})) {
        data[key] = { value: skill.total ?? skill.value ?? 0 };
      }
      data.chakra = { value: this.chakra?.value ?? 0, max: this.chakra?.max ?? 0 };
    }

    // Spiritualism is only available to Miko.
    if (this.isMiko) {
      data.spiritualism = { value: this.spiritualism?.value ?? 0 };
    }

    return data
  }
}