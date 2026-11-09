export const CASUSBELLI = {};

/**
 * Body locations shared by wounds (single-value dropdown) and armor (per-location checkboxes).
 * Each entry exposes:
 *   label – the human-readable name used as the wound bodyLocation value and display text.
 *   field – the corresponding boolean field name on the armor data model.
 * @type {Array<{label: string, field: string}>}
 */
CASUSBELLI.bodyLocations = [
  { label: 'Head',  field: 'locationHead'  },
  { label: 'Arms',  field: 'locationArms'  },
  { label: 'Chest', field: 'locationChest' },
  { label: 'Legs',  field: 'locationLegs'  },
];

/**
 * The set of Attributes used within the system.
 * @type {Object}
 */
CASUSBELLI.attributes = {
  str: 'CASUSBELLI.Attribute.Str.long',
  agi: 'CASUSBELLI.Attribute.Agi.long',
  end: 'CASUSBELLI.Attribute.End.long',
  wil: 'CASUSBELLI.Attribute.Wil.long',
  wit: 'CASUSBELLI.Attribute.Wit.long',
  ins: 'CASUSBELLI.Attribute.Ins.long',
};

CASUSBELLI.attributeAbbreviations = {
  str: 'CASUSBELLI.Attribute.Str.abbr',
  agi: 'CASUSBELLI.Attribute.Agi.abbr',
  end: 'CASUSBELLI.Attribute.End.abbr',
  wil: 'CASUSBELLI.Attribute.Wil.abbr',
  wit: 'CASUSBELLI.Attribute.Wit.abbr',
  ins: 'CASUSBELLI.Attribute.Ins.abbr',
};

/**
 * The set of Skills used within the system.
 * @type {Object}
 */
CASUSBELLI.skills = {
  athletics: 'CASUSBELLI.Skill.Athletics',
  unarmed: 'CASUSBELLI.Skill.Unarmed',
  melee: 'CASUSBELLI.Skill.Melee',
  ranged: 'CASUSBELLI.Skill.Ranged',
  stealth: 'CASUSBELLI.Skill.Stealth',
  survival: 'CASUSBELLI.Skill.Survival',
  riding: 'CASUSBELLI.Skill.Riding',
  persuasion: 'CASUSBELLI.Skill.Persuasion',
  intimidation: 'CASUSBELLI.Skill.Intimidation',
  subterfuge: 'CASUSBELLI.Skill.Subterfuge',
  performance: 'CASUSBELLI.Skill.Performance',
  etiquette: 'CASUSBELLI.Skill.Etiquette',
  awareness: 'CASUSBELLI.Skill.Awareness',
  empathy: 'CASUSBELLI.Skill.Empathy',
  leadership: 'CASUSBELLI.Skill.Leadership',
  tactics: 'CASUSBELLI.Skill.Tactics',
  scholarship: 'CASUSBELLI.Skill.Scholarship',
  stewardship: 'CASUSBELLI.Skill.Stewardship',
  crafting: 'CASUSBELLI.Skill.Crafting',
  medicine: 'CASUSBELLI.Skill.Medicine',
};

/**
 * Canonical list of maneuver tags available system-wide.
 * These are merged with any tags found on existing world maneuver items
 * when building the tag picker in the maneuver sheet.
 * @type {string[]}
 */
CASUSBELLI.maneuverTags = [
  'Attack',
  'Area',
  'Defensive',
  'Disarm',
  'Grapple',
  'Melee',
  'Movement',
  'Offensive',
  'Ranged',
  'Reaction',
  'Social',
  'Support',
  'Utility',
];

/**
 * Skills grouped by category for display on the character sheet.
 * @type {Object}
 */
CASUSBELLI.skillGroups = {
  physical: {
    label: 'Physical',
    skills: ['athletics', 'unarmed', 'melee', 'ranged', 'stealth', 'survival', 'riding'],
  },
  social: {
    label: 'Social',
    skills: ['persuasion', 'intimidation', 'subterfuge', 'performance', 'etiquette', 'awareness', 'empathy'],
  },
  professional: {
    label: 'Professional',
    skills: ['leadership', 'tactics', 'scholarship', 'stewardship', 'crafting', 'medicine'],
  },
};

/* -------------------------------------------- */
/*  Ninja                                       */
/* -------------------------------------------- */

/**
 * Ninja skills. These live in system.ninjaSkills (not CASUSBELLI.skills) so only ninja get them.
 * Locked skills are shown but cannot be used yet (no rules available).
 * @type {Object<string, {label: string, locked?: boolean}>}
 */
CASUSBELLI.ninjaSkills = {
  ninjutsu: { label: 'Ninjutsu' },
  taijutsu: { label: 'Taijutsu' },
  genjutsu: { label: 'Genjutsu' },
  senjutsu: { label: 'Senjutsu', locked: true },
};

/** Elemental affinities a ninja may possess. */
CASUSBELLI.elements = {
  fire: 'Fire',
  wind: 'Wind',
  lightning: 'Lightning',
  earth: 'Earth',
  water: 'Water',
};

/** Element choices for a technique (includes "none" for N/A). */
CASUSBELLI.techniqueElements = {
  none: 'N/A',
  ...CASUSBELLI.elements,
};

/** Technique categories. Bloodline techniques are tied to a specific bloodline. */
CASUSBELLI.techniqueCategories = {
  ninjutsu: 'Ninjutsu',
  taijutsu: 'Taijutsu',
  genjutsu: 'Genjutsu',
  senjutsu: 'Senjutsu',
  bloodline: 'Bloodline',
};

/**
 * Technique ranks: base learning cost (progress) and minimum Arcane Might to learn normally.
 * S rank techniques can only be gained through roleplay.
 */
CASUSBELLI.techniqueRanks = {
  D: { label: 'D', cost: 10, minArcaneMight: 0 },
  C: { label: 'C', cost: 20, minArcaneMight: 2 },
  B: { label: 'B', cost: 50, minArcaneMight: 3 },
  A: { label: 'A', cost: 100, minArcaneMight: 4 },
  S: { label: 'S', cost: null, minArcaneMight: null },
};

/** How often a technique may be used. */
CASUSBELLI.techniqueFrequencies = {
  atWill: 'At Will',
  scene: 'Once per Scene',
  rest: 'Once per Rest',
};

/** Which roll (if any) a technique calls for. Ninja skills roll skill + Agility. */
CASUSBELLI.techniqueRolls = {
  none: 'No Roll',
  ninjutsu: 'Ninjutsu',
  taijutsu: 'Taijutsu',
  genjutsu: 'Genjutsu',
  arcaneMight: 'Ninja Ability (Arcane Might)',
};

/** Starting technique progress by Arcane Might (cumulative). */
CASUSBELLI.startingTechniqueProgress = [
  { arcaneMight: 1, points: 30, ranks: 'D' },
  { arcaneMight: 2, points: 60, ranks: 'D or C' },
  { arcaneMight: 3, points: 150, ranks: 'D, C or B' },
];

/** Bloodline potency: bonus chakra and learning cost modifier (progress). */
CASUSBELLI.bloodlinePotencies = {
  meager: { label: 'Meager', chakra: 2, learningModifier: -20, note: '' },
  modest: { label: 'Modest', chakra: 4, learningModifier: -10, note: '' },
  standard: { label: 'Standard', chakra: 6, learningModifier: 0, note: '' },
  vast: { label: 'Vast', chakra: 9, learningModifier: 10, note: '' },
  immense: { label: 'Immense', chakra: 14, learningModifier: 20, note: 'Costs one boon point.' },
  monstrous: { label: 'Monstrous', chakra: 20, learningModifier: 30, note: 'Costs two boon points and requires GM approval.' },
};

/**
 * Special bloodlines.
 *  stageLabel/minStage/maxStage – an optional progression track (tomoe, gates open, seals opened).
 *  canManifest                  – the bloodline can be toggled active (manifested).
 *  variants                     – sub-types (e.g. which creature is sealed in a Jinchuriki).
 */
CASUSBELLI.bloodlines = {
  byakugan: { label: 'Byakugan', canManifest: true },
  sharingan: { label: 'Sharingan', canManifest: true, stageLabel: 'Tomoe', minStage: 1, maxStage: 3 },
  divineLineage: { label: 'Divine Lineage' },
  mixedAffinity: { label: 'Mixed Affinity' },
  eightGates: { label: 'Eight Gates', stageLabel: 'Gates Open', minStage: 0, maxStage: 5 },
  jinchuriki: {
    label: 'Jinchuriki',
    stageLabel: 'Seals Opened',
    minStage: 0,
    maxStage: 8,
    variants: {
      devouringFlame: { label: 'The Devouring Flame', element: 'fire' },
    },
  },
};

/** The Eight Gates that currently have rules, in opening order. */
CASUSBELLI.eightGates = [
  'Gate of Opening',
  'Gate of Healing',
  'Gate of Life',
  'Gate of Pain',
  'Gate of Limit',
];

/** Jinchuriki flaws (at least one must be chosen; more may be gained through roleplay). */
CASUSBELLI.jinchurikiFlaws = {
  sealedPower: {
    label: 'Sealed Power',
    description: 'The creature within disdains you and prevents you from using its powers. Your Arcane Might falls by one.',
  },
  brokenMind: {
    label: 'Broken Mind',
    description: 'Automatically fail rolls with zero successes to resist a mental effect such as Genjutsu, so long as they do not deal damage to you.',
  },
  wrackedByPain: {
    label: 'Wracked by Pain',
    description: 'Suffer four Pain which may not be reduced in any way save by a power of equal or greater Arcane Might than the creature within you.',
  },
  weakenedBody: {
    label: 'Weakened Body',
    description: 'Halve your Stamina and count all your physical stats as one lower, potentially disabling you if this reduces a stat to zero.',
  },
  chakraSeal: {
    label: 'Chakra Seal',
    description: 'Reduce your natural Chakra by ten more. If this reduces your maximum Chakra to zero, you are in a constant state of Chakra exhaustion unless you draw on the power of the creature within you.',
  },
  leakyVessel: {
    label: 'Leaky Vessel',
    description: 'Double the Chakra cost of all your techniques. This does not affect Chakra Surge.',
  },
  allConsuming: {
    label: 'All Consuming',
    description: 'You cannot use any techniques that are of a different element than the creature sealed within you.',
  },
};

/** Physical attributes (halved by Chakra exhaustion, lowered by Weakened Body). */
CASUSBELLI.physicalAttributes = ['str', 'agi', 'end'];

/** Chakra rules constants. */
CASUSBELLI.chakra = {
  surgeCost: 2,
  /** Successes needed on the roll made when spending Chakra you don't have. */
  exhaustionDifficulty: 3,
  /** Default target number for system-made rolls. */
  defaultTn: 6,
  /** Maximum chakra reductions for being a Jinchuriki and for the Chakra Seal flaw. */
  jinchurikiPenalty: 10,
  chakraSealPenalty: 10,
};

/* -------------------------------------------- */
/*  Miko                                        */
/* -------------------------------------------- */

/** Miko traditions. A Miko follows exactly one. */
CASUSBELLI.mikoTraditions = {
  dosojin: 'Dosojin',
  harai: 'Harai',
};

/** Tradition choices for a Miko ability ("" = available to every Miko). */
CASUSBELLI.mikoAbilityTraditions = {
  '': 'Any Miko',
  ...CASUSBELLI.mikoTraditions,
};

/** Rite kinds: blessings on the land, and curses. */
CASUSBELLI.riteKinds = {
  kannagara: 'Kannagara',
  miasma: 'Miasma',
};

/** Miko rules constants. */
CASUSBELLI.miko = {
  /** Maximum Unmei that may be spent on one roll. */
  maxUnmeiPerRoll: 2,
  /** Maximum Favor per level of Arcane Might. */
  favorPerArcaneMight: 30,
  /** Favor cost of the once-per-rest Unmei restore and Talisman re-etch. */
  restFavorCost: 10,
  /** Progress needed to learn an additional Talisman. */
  talismanLearningCost: 100,
  /** Spirit Ward hit points, and the Arcane Might at which it gains them. */
  wardHp: 20,
  wardHpArcaneMight: 5,
  /** Kannagara maintenance capacity by minimum Arcane Might (highest match wins). */
  kannagaraCapacity: [
    { arcaneMight: 7, capacity: 1000 },
    { arcaneMight: 5, capacity: 100 },
    { arcaneMight: 3, capacity: 10 },
    { arcaneMight: 1, capacity: 1 },
  ],
};
