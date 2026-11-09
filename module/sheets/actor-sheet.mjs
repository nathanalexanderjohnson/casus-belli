import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';
import { formatRollContent, openRollDialog } from '../helpers/rolls.mjs';
import {
  bloodlineLabel,
  canDrawFromBeast,
  chakraSurge,
  closeGates,
  endScene,
  fullRest,
  getBloodline,
  learningCost,
  openNextGate,
  stageRequirementLabel,
  techniqueStatus,
  trainTechnique,
  useTechnique,
} from '../helpers/ninja.mjs';
import {
  castingRoll,
  etchTalisman,
  getKamiWound,
  reduceKamiWound,
  maintenanceCapacity,
  mikoRest,
  performRite,
  riteStatus,
  spendRestFavor,
  talismanSlots,
  trainTalisman,
  useTalisman,
} from '../helpers/miko.mjs';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class CasusBelliActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);
    this._expandedGadgetIds = new Set();
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['casus-belli', 'sheet', 'actor'],
      width: 1000,
      height: 1000,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'features',
        },
      ],
    });
  }

  /** @override */
  get defaultOptions() {
    const options = super.defaultOptions;
    options.tabs[0].initial = this.actor.type === 'character' ? 'features' : 'stats';
    return options;
  }

  /** @override */
  get template() {
    return `systems/casus-belli/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async render(force = false, options = {}) {
    const focus = this.element?.find ? this.element.find(':focus') : null;
    const focusName = focus?.attr?.('name') ?? null;
    const selection = focus?.length && focus[0].setSelectionRange
      ? [focus[0].selectionStart, focus[0].selectionEnd]
      : null;

    const result = await super.render(force, options);

    if (focusName) {
      requestAnimationFrame(() => {
        const newFocus = this.element?.find ? this.element.find(`[name="${focusName}"]`) : null;
        if (newFocus?.length) {
          newFocus.focus();
          if (selection && newFocus[0].setSelectionRange) {
            newFocus[0].setSelectionRange(selection[0], selection[1]);
          }
        }
      });
    }

    return result;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = this.document.toPlainObject();

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;
    if (!context.system.ephiphanies) {
      context.system.ephiphanies = { value: 0, max: 0 };
    }
    if (!context.system.martialSpirit) {
      context.system.martialSpirit = [];
    }
    if (!context.system.warriorsPresence) {
      context.system.warriorsPresence = [];
    }
    if (!context.system.kenjutsu) {
      context.system.kenjutsu = [];
    }
    if (context.system.magicType === 'none') {
      context.system.arcaneMight = 0;
      context.system.ephiphanies.value = 0;
      context.system.ephiphanies.max = 0;
    } else if (context.system.magicType === 'samurai') {
      context.system.ephiphanies.max = context.system.arcaneMight ?? 0;
      context.system.ephiphanies.value = Math.max(0, Math.min(context.system.ephiphanies.value ?? 0, context.system.ephiphanies.max));
    }

    // Adding a pointer to CONFIG.CASUSBELLI
    context.config = CONFIG.CASUSBELLI;

    // Prepare character data and items.
    if (actorData.type == 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type == 'npc') {
      this._prepareItems(context);
    }

    // Enrich biography info for display
    // Enrichment turns text like `[[/r 1d20]]` into buttons
    context.enrichedBiography = await TextEditor.enrichHTML(
      this.actor.system.biography,
      {
        // Whether to show secret blocks in the finished html
        secrets: this.document.isOwner,
        // Necessary in v11, can be removed in v12
        async: true,
        // Data to fill in for inline rolls
        rollData: this.actor.getRollData(),
        // Relative UUID resolution
        relativeTo: this.actor,
      }
    );

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );

    // Prepare skills grouped by category for the features tab sidebar
    context.skillGroups = Object.entries(CONFIG.CASUSBELLI.skillGroups).map(
      ([groupKey, group]) => ({
        key: groupKey,
        label: group.label,
        skills: group.skills.map(skillKey => ({
          key: skillKey,
          value: context.system.skills[skillKey]?.value ?? 0,
          label: context.system.skills[skillKey]?.label ?? skillKey,
        })),
      })
    );

    return context;
  }

  /**
   * Character-specific context modifications
   *
   * @param {object} context The context object to mutate
   */
  _prepareCharacterData(context) {
    if (this.actor.system.isNinja) context.ninja = this._prepareNinjaContext();
    if (this.actor.system.isMiko) context.miko = this._prepareMikoContext();
    return context;
  }

  /**
   * Build the data for the Miko tab.
   * @returns {object}
   * @private
   */
  _prepareMikoContext() {
    const config = CONFIG.CASUSBELLI;
    const actor = this.actor;
    const system = actor.system;
    const arcaneMight = system.arcaneMight ?? 0;
    const byName = (a, b) => a.name.localeCompare(b.name);

    // Abilities: the Miko's tradition, then those shared by every Miko.
    const abilities = actor.items.filter((i) => i.type === 'mikoAbility')
      .sort((a, b) => (a.system.minArcaneMight - b.system.minArcaneMight) || byName(a, b))
      .map((item) => ({
        id: item.id,
        name: item.name,
        img: item.img,
        tradition: item.system.tradition ? config.mikoTraditions[item.system.tradition] : 'Miko',
        minArcaneMight: item.system.minArcaneMight,
        usable: arcaneMight >= item.system.minArcaneMight,
        reasons: `Requires Arcane Might ${item.system.minArcaneMight}`,
      }));

    // Talismans: learned ones, and those still in training.
    const learningCost = config.miko.talismanLearningCost;
    const talismans = [];
    const training = [];
    for (const item of actor.items.filter((i) => i.type === 'talisman').sort(byName)) {
      const tal = item.system;
      const entry = {
        id: item.id,
        name: item.name,
        img: item.img,
        prepared: tal.prepared ?? 0,
        hasOmamori: Boolean(tal.omamori),
        hasOfuda: Boolean(tal.ofuda),
        progress: tal.progress ?? 0,
        learningCost,
        progressPercent: Math.min(100, Math.round(((tal.progress ?? 0) / learningCost) * 100)),
      };
      (tal.learned ? talismans : training).push(entry);
    }

    // Rites
    const rites = { kannagara: [], miasma: [] };
    for (const item of actor.items.filter((i) => i.type === 'rite')
      .sort((a, b) => (a.system.minArcaneMight - b.system.minArcaneMight) || byName(a, b))) {
      const rite = item.system;
      const status = riteStatus(actor, item);
      rites[rite.kind]?.push({
        id: item.id,
        name: item.name,
        img: item.img,
        minArcaneMight: rite.minArcaneMight,
        cost: rite.costNote ? 'Varies' : rite.cost,
        costTitle: rite.costNote,
        maintenance: rite.maintenanceNote ? `${rite.maintenance}+` : (rite.maintenance || '—'),
        maintenanceTitle: rite.maintenanceNote,
        tags: [rite.draining ? 'Draining' : '', rite.vicious ? 'Vicious' : ''].filter(Boolean).join(', '),
        active: rite.active,
        usable: status.usable,
        reasons: status.reasons.join('; '),
      });
    }

    const slots = talismanSlots(actor);
    const capacity = maintenanceCapacity(actor);
    const beloved = Boolean(system.belovedAboveAll);
    const kamiWound = beloved ? getKamiWound(actor) : null;
    // Two Talismans to begin with, plus one for each increase in Arcane Might.
    const expectedTalismans = arcaneMight > 0 ? arcaneMight + 1 : 0;

    return {
      traditions: config.mikoTraditions,
      tradition: system.tradition,
      traditionLabel: config.mikoTraditions[system.tradition],
      isHarai: system.tradition === 'harai',
      naturalArmor: 1 + arcaneMight,
      wearingArmor: actor.items.some((i) => i.type === 'armor' && i.system.equipped),
      abilities,
      talismans,
      training,
      knownTalismans: talismans.length,
      expectedTalismans,
      slots,
      // Beloved Above All may exceed its single slot by drawing on the Kami.
      slotsOver: !beloved && slots.used > slots.max,
      beloved,
      kamiWound: kamiWound
        ? { pain: kamiWound.system.fixedPain ?? 0, severity: kamiWound.system.severity }
        : null,
      capacity,
      capacityOver: capacity.used > capacity.max,
      kannagara: rites.kannagara,
      miasma: rites.miasma,
      wieldsMiasma: system.wieldsMiasma,
      wardHasHp: (system.spiritWard?.max ?? 0) > 0,
      wardPhysical: arcaneMight >= 3,
      restFavorCost: config.miko.restFavorCost,
      mikoRest: system.mikoRest,
    };
  }

  /**
   * Build the data for the Ninja tab.
   * @returns {object}
   * @private
   */
  _prepareNinjaContext() {
    const config = CONFIG.CASUSBELLI;
    const actor = this.actor;
    const system = actor.system;
    const bloodlineItem = getBloodline(actor);
    const bloodline = bloodlineItem?.system;
    const rankOrder = Object.keys(config.techniqueRanks);

    // Ninja skills
    const skills = Object.entries(system.ninjaSkills ?? {}).map(([key, skill]) => ({
      key,
      label: config.ninjaSkills[key]?.label ?? key,
      value: skill.value ?? 0,
      total: skill.total ?? skill.value ?? 0,
      boosted: (skill.total ?? 0) > (skill.value ?? 0),
      locked: Boolean(config.ninjaSkills[key]?.locked),
    }));

    // Elemental affinities
    const affinities = Object.entries(config.elements).map(([key, label]) => ({
      key,
      label,
      checked: Boolean(system.affinities?.[key]),
      granted: !system.affinities?.[key] && Boolean(system.effectiveAffinities?.[key]),
    }));

    // Techniques, grouped by category; unlearned techniques go to training.
    const groups = Object.fromEntries(Object.entries(config.techniqueCategories).map(([key, label]) => [key, {
      key,
      label,
      techniques: [],
      locked: Boolean(config.ninjaSkills[key]?.locked),
    }]));
    const training = [];
    const techniques = actor.items.filter((i) => i.type === 'technique')
      .sort((a, b) => (rankOrder.indexOf(a.system.rank) - rankOrder.indexOf(b.system.rank)) || a.name.localeCompare(b.name));

    for (const item of techniques) {
      const status = techniqueStatus(actor, item);
      const tech = item.system;
      const cost = learningCost(actor, tech.rank);
      const entry = {
        id: item.id,
        name: item.name,
        img: item.img,
        rank: tech.rank,
        element: tech.element !== 'none' ? config.elements[tech.element] : '',
        cost: status.cost,
        roll: tech.roll !== 'none' ? config.techniqueRolls[tech.roll] : '',
        frequency: tech.frequency !== 'atWill' ? config.techniqueFrequencies[tech.frequency] : '',
        limited: tech.frequency !== 'atWill',
        used: tech.used,
        usable: status.usable,
        reasons: status.reasons.join('; '),
        requirement: tech.category === 'bloodline' && tech.requiredStage
          ? stageRequirementLabel(tech.bloodline, tech.requiredStage)
          : '',
        progress: tech.progress ?? 0,
        learningCost: cost === null ? null : Math.max(cost, 0),
        progressPercent: cost === null ? 0 : (cost <= 0 ? 0 : Math.min(100, Math.round(((tech.progress ?? 0) / cost) * 100))),
      };
      if (!tech.learned) training.push(entry);
      else (groups[tech.category] ?? groups.ninjutsu).techniques.push(entry);
    }

    // Only show the bloodline group when the character has a bloodline.
    const techniqueGroups = Object.values(groups).filter((g) => g.key !== 'bloodline' || bloodlineItem);

    // Bloodline panel
    let bloodlineContext = null;
    if (bloodlineItem) {
      const def = config.bloodlines[bloodline.bloodline] ?? {};
      const stages = [];
      if (def.stageLabel) {
        for (let s = (def.minStage ?? 0) + 1; s <= def.maxStage; s++) {
          const name = bloodline.bloodline === 'eightGates'
            ? config.eightGates[s - 1]
            : bloodline.bloodline === 'sharingan' ? `Tomoe ${s}` : `Seal ${s}`;
          stages.push({ stage: s, name, reached: bloodline.stage >= s });
        }
      }
      bloodlineContext = {
        id: bloodlineItem.id,
        name: bloodlineItem.name,
        img: bloodlineItem.img,
        key: bloodline.bloodline,
        label: bloodlineLabel(bloodline.bloodline, bloodline.variant),
        canManifest: Boolean(def.canManifest),
        active: bloodline.active,
        stageLabel: def.stageLabel ?? '',
        stage: bloodline.stage,
        stages,
        isEightGates: bloodline.bloodline === 'eightGates',
        isJinchuriki: bloodline.bloodline === 'jinchuriki',
        canAdjustStage: Boolean(def.stageLabel) && bloodline.bloodline !== 'eightGates',
        gatesSpent: bloodline.gatesSpent,
        drewChakra: bloodline.drewChakra,
        canDrawFromBeast: canDrawFromBeast(actor),
        flaws: Object.entries(config.jinchurikiFlaws).map(([key, flaw]) => ({
          key,
          label: flaw.label,
          description: flaw.description,
          checked: (bloodline.flaws ?? []).includes(key),
        })),
        needsFlaw: bloodline.bloodline === 'jinchuriki' && !(bloodline.flaws ?? []).length,
      };
    }

    const potency = config.bloodlinePotencies[system.bloodlinePotency] ?? config.bloodlinePotencies.standard;
    const learning = system.techniqueLearning ?? { costs: {}, progressPerWeek: 0 };

    return {
      potencies: Object.fromEntries(Object.entries(config.bloodlinePotencies).map(([k, p]) => [k, `${p.label} (+${p.chakra})`])),
      potencyNote: potency.note,
      chakra: system.chakra,
      exhausted: system.isExhausted,
      sealedExhaustion: Boolean(system.chakra?.sealedExhaustion),
      exhaustionWeeks: system.chakraExhaustion?.weeks ?? 0,
      surgeCost: config.chakra.surgeCost,
      skills,
      affinities,
      divineLineage: bloodline?.bloodline === 'divineLineage',
      techniqueGroups,
      training,
      bloodline: bloodlineContext,
      learning: {
        progressPerWeek: learning.progressPerWeek,
        modifier: learning.modifier,
        ranks: Object.entries(config.techniqueRanks).map(([rank, def]) => ({
          rank,
          cost: learning.costs[rank] === null || learning.costs[rank] === undefined
            ? 'Roleplay only'
            : (learning.costs[rank] <= 0 ? '1 week' : learning.costs[rank]),
          minArcaneMight: def.minArcaneMight ?? '—',
        })),
        starting: config.startingTechniqueProgress,
      },
    };
  }

  /**
   * Organize and classify Items for Actor sheets.
   *
   * @param {object} context The context object to mutate
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const features = [];
    const maneuvers = [];
    const boons = [];
    const banes = [];
    const wounds = [];
    const armors = [];
    const gadgets = [];
    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      // Append to gear.
      if (i.type === 'item') {
        gear.push(i);
      }
      // Append to features.
      else if (i.type === 'feature') {
        features.push(i);
      }
      // Append to maneuvers.
      else if (i.type === 'maneuver') {
        maneuvers.push(i);
      }
      // Append to wounds.
      else if (i.type === 'wound') {
        wounds.push(i);
      }
      // Append to armors.
      else if (i.type === 'armor') {
        armors.push(i);
      }
      // Append to boons or banes.
      else if (i.type === 'boon') {
        if (i.system.type === 'boon') {
          boons.push(i);
        } else if (i.system.type === 'bane') {
          banes.push(i);
        }
      }
      // Append to gadgets.
      else if (i.type === 'gadget') {
        i.system.totalComplexity = this.actor.items.get(i._id)?.system?.totalComplexity ?? 0;
        i.expanded = this._expandedGadgetIds.has(i._id);
        gadgets.push(i);
      }
    }

    // Compute total complexity of all equipped gadgets
    const totalEquippedGadgetComplexity = gadgets.reduce((sum, g) => {
      return g.system.equipped ? sum + (g.system.totalComplexity ?? 0) : sum;
    }, 0);

    // Compute armor tracker — highest AV per location from all equipped armor pieces.
    const makeZone = () => ({ avb: 0, avp: 0, avs: 0 });
    const armorTracker = {
      head:  makeZone(),
      arms:  makeZone(),
      chest: makeZone(),
      legs:  makeZone(),
    };
    const hasAnyEquippedArmor = armors.some((armor) => armor.system.equipped);
    const fullSamuraiBonus = 1 + (this.actor.system.arcaneMight ?? 0);
    const partialSamuraiBonus = Math.floor(fullSamuraiBonus / 2);

    for (const armor of armors) {
      if (!armor.system.equipped) continue;
      const { avb, avp, avs } = armor.system;
      const zones = [
        [armor.system.locationHead,  armorTracker.head],
        [armor.system.locationArms,  armorTracker.arms],
        [armor.system.locationChest, armorTracker.chest],
        [armor.system.locationLegs,  armorTracker.legs],
      ];
      for (const [active, zone] of zones) {
        if (!active) continue;
        zone.avb = Math.max(zone.avb, avb);
        zone.avp = Math.max(zone.avp, avp);
        zone.avs = Math.max(zone.avs, avs);
      }
    }

    if (this.actor.system.magicType === 'samurai') {
      const locationMap = {
        head: 'Head',
        arms: 'Arms',
        chest: 'Chest',
        legs: 'Legs',
      };

      for (const [locationKey, locationLabel] of Object.entries(locationMap)) {
        const zone = armorTracker[locationKey];
        const covered = armors.some((armor) => {
          if (!armor.system.equipped) return false;
          const locationKeyName = `location${locationLabel}`;
          return Boolean(armor.system[locationKeyName]);
        });

        const bonus = covered
          ? partialSamuraiBonus
          : fullSamuraiBonus;

        zone.avb += bonus;
        zone.avp += bonus;
        zone.avs += bonus;
      }
    }

    // Harai Spellblade: natural armor of 1 + Arcane Might on every location, but only while the
    // Miko wears no armor at all (they fight in priestess robes). Unlike the Samurai's bonus,
    // it does not stack with worn armor.
    if (this.actor.system.isMiko && this.actor.system.tradition === 'harai' && !hasAnyEquippedArmor) {
      const bonus = 1 + (this.actor.system.arcaneMight ?? 0);
      for (const zone of Object.values(armorTracker)) {
        zone.avb += bonus;
        zone.avp += bonus;
        zone.avs += bonus;
      }
    }

    // Assign and return
    context.gear = gear;
    context.features = features;
    context.maneuvers = maneuvers;
    context.wounds = wounds;
    context.boons = boons;
    context.banes = banes;
    context.armors = armors;
    context.armorTracker = armorTracker;
    context.gadgets = gadgets;
    context.totalEquippedGadgetComplexity = totalEquippedGadgetComplexity;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on('click', '.item-edit', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.sheet.render(true);
    });

    // Post item to chat
    html.on('click', '.item-use', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      this._postItemToChat(item);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.on('click', '.item-create', this._onItemCreate.bind(this));

    // Toggle wound bleeding (only meaningful when not treated)
    html.on('click', '.wound-toggle-bleeding', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      if (item.system.treated) return; // treated wounds cannot bleed
      item.update({ 'system.bleeding': !item.system.bleeding });
    });

    // Toggle wound treated; clearing bleeding at the same time
    html.on('click', '.wound-toggle-treated', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      const newTreated = !item.system.treated;
      const updates = { 'system.treated': newTreated };
      if (newTreated) updates['system.bleeding'] = false;
      item.update(updates);
    });

    // Toggle armor equipped state
    html.on('click', '.armor-toggle-equipped', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.update({ 'system.equipped': !item.system.equipped });
    });

    // Toggle general item equipped state
    html.on('click', '.item-toggle-equipped', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.update({ 'system.equipped': !item.system.equipped });
    });

    // Toggle individual armor location
    html.on('click', '.armor-toggle-location', (ev) => {
      const a = ev.currentTarget;
      const location = a.dataset.location;
      const li = $(a).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.update({ [`system.${location}`]: !item.system[location] });
    });

    html.on('click', '.samurai-add-entry', (ev) => {
      const listKey = ev.currentTarget.dataset.list;
      this._addSamuraiTableEntry(listKey);
    });

    html.on('click', '.samurai-ping', (ev) => {
      const listKey = ev.currentTarget.dataset.list;
      const index = Number(ev.currentTarget.dataset.index);
      this._pingSamuraiTableEntry(listKey, index);
    });

    html.on('click', '.samurai-toggle-edit', (ev) => {
      const listKey = ev.currentTarget.dataset.list;
      const index = Number(ev.currentTarget.dataset.index);
      this._toggleSamuraiTableEntryEdit(listKey, index);
    });

    html.on('click', '.samurai-delete', (ev) => {
      const listKey = ev.currentTarget.dataset.list;
      const index = Number(ev.currentTarget.dataset.index);
      this._deleteSamuraiTableEntry(listKey, index);
    });

    this._activateNinjaListeners(html);
    this._activateMikoListeners(html);

    // Gadget toggles remain available for the generic item system; class-specific magic controls are intentionally removed.
    html.on('click', '.gadget-toggle', (ev) => {
      const li = $(ev.currentTarget).closest('.gadget-item');
      const itemId = li.data('itemId');
      li.toggleClass('expanded');
      if (li.hasClass('expanded')) {
        this._expandedGadgetIds.add(itemId);
      } else {
        this._expandedGadgetIds.delete(itemId);
      }
    });

    // Toggle gadget augment enabled state
    html.on('click', '.augment-toggle', (ev) => {
      ev.stopPropagation();
      const li = $(ev.currentTarget).closest('.gadget-item');
      const item = this.actor.items.get(li.data('itemId'));
      const index = $(ev.currentTarget).data('augment-index');
      const augments = item.system.augments || [];
      if (augments[index]) {
        const newAugments = foundry.utils.duplicate(augments);
        newAugments[index].enabled = !newAugments[index].enabled;
        item.update({ 'system.augments': newAugments });
      }
    });

    // Toggle gadget equipped state
    html.on('click', '.gadget-toggle-equipped', (ev) => {
      ev.stopPropagation();
      const li = $(ev.currentTarget).closest('.gadget-item');
      const item = this.actor.items.get(li.data('itemId'));
      item.update({ 'system.equipped': !item.system.equipped });
    });

    // Delete Inventory Item
    html.on('click', '.item-delete', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.on('click', '.effect-control', (ev) => {
      const row = ev.currentTarget.closest('li');
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // Rollable attributes and skills.
    html.on('click', '.rollable', this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });
    }
  }

  /**
   * Ninja tab controls (editable sheets only).
   * @param {jQuery} html
   * @private
   */
  _activateNinjaListeners(html) {
    const itemFrom = (ev) => this.actor.items.get(ev.currentTarget.closest('[data-item-id]')?.dataset.itemId);
    const bloodline = () => getBloodline(this.actor);

    html.on('click', '.ninja-use-technique', (ev) => {
      ev.preventDefault();
      const item = itemFrom(ev);
      if (item) useTechnique(item);
    });

    html.on('click', '.ninja-toggle-used', (ev) => {
      ev.preventDefault();
      const item = itemFrom(ev);
      if (item) item.update({ 'system.used': !item.system.used });
    });

    html.on('click', '.ninja-toggle-training', (ev) => {
      ev.preventDefault();
      const item = itemFrom(ev);
      if (item) item.update({ 'system.learned': !item.system.learned });
    });

    html.on('click', '.ninja-train', (ev) => {
      ev.preventDefault();
      const item = itemFrom(ev);
      if (item) trainTechnique(item);
    });

    html.on('click', '.ninja-surge', (ev) => {
      ev.preventDefault();
      chakraSurge(this.actor, ev.currentTarget.dataset.mode);
    });

    html.on('click', '.ninja-end-scene', (ev) => {
      ev.preventDefault();
      endScene(this.actor);
    });

    html.on('click', '.ninja-full-rest', (ev) => {
      ev.preventDefault();
      fullRest(this.actor);
    });

    html.on('click', '.ninja-manifest', (ev) => {
      ev.preventDefault();
      const item = bloodline();
      if (item) item.update({ 'system.active': !item.system.active });
    });

    html.on('click', '.ninja-stage', (ev) => {
      ev.preventDefault();
      const item = bloodline();
      if (!item) return;
      const delta = Number(ev.currentTarget.dataset.delta) || 0;
      const def = CONFIG.CASUSBELLI.bloodlines[item.system.bloodline] ?? {};
      const stage = Math.max(def.minStage ?? 0, Math.min(def.maxStage ?? 0, (item.system.stage ?? 0) + delta));
      if (stage !== item.system.stage) item.update({ 'system.stage': stage });
    });

    html.on('click', '.ninja-open-gate', (ev) => {
      ev.preventDefault();
      openNextGate(this.actor);
    });

    html.on('click', '.ninja-close-gates', (ev) => {
      ev.preventDefault();
      closeGates(this.actor);
    });

    html.on('click', '.ninja-flaw-toggle', (ev) => {
      const item = bloodline();
      if (!item) return;
      const flaw = ev.currentTarget.dataset.flaw;
      const flaws = new Set(item.system.flaws ?? []);
      if (ev.currentTarget.checked) flaws.add(flaw);
      else flaws.delete(flaw);
      if (!flaws.size) {
        ui.notifications.warn('A Jinchuriki must have at least one flaw.');
        ev.currentTarget.checked = true;
        return;
      }
      item.update({ 'system.flaws': [...flaws] });
    });
  }

  /**
   * Miko tab controls (editable sheets only).
   * @param {jQuery} html
   * @private
   */
  _activateMikoListeners(html) {
    const itemFrom = (ev) => this.actor.items.get(ev.currentTarget.closest('[data-item-id]')?.dataset.itemId);
    const onItem = (selector, handler) => html.on('click', selector, (ev) => {
      ev.preventDefault();
      const item = itemFrom(ev);
      if (item) handler(item, ev);
    });
    const onActor = (selector, handler) => html.on('click', selector, (ev) => {
      ev.preventDefault();
      handler(ev);
    });

    onItem('.miko-use-talisman', (item, ev) => useTalisman(item, ev.currentTarget.dataset.variant));
    onItem('.miko-etch', (item, ev) => etchTalisman(item, Number(ev.currentTarget.dataset.delta) || 0));
    onItem('.miko-train', (item) => trainTalisman(item));
    onItem('.miko-toggle-training', (item) => item.update({ 'system.learned': !item.system.learned }));
    onItem('.miko-perform-rite', (item) => performRite(item));
    onItem('.miko-toggle-active', (item) => item.update({ 'system.active': !item.system.active }));

    onActor('.miko-casting-roll', (ev) => castingRoll(this.actor, ev.currentTarget.dataset.label || 'Spiritualism'));
    onActor('.miko-rest', () => mikoRest(this.actor));
    onActor('.miko-rest-favor', (ev) => spendRestFavor(this.actor, ev.currentTarget.dataset.kind));
    onActor('.miko-reduce-kami-wound', () => reduceKamiWound(this.actor));
  }

  async _addSamuraiTableEntry(listKey) {
    if (!['martialSpirit', 'warriorsPresence', 'kenjutsu'].includes(listKey)) return;
    const entries = foundry.utils.duplicate(this.actor.system[listKey] ?? []);
    const baseEntry = listKey === 'kenjutsu'
      ? { name: '', stamina: 0, description: '', arcaneMightIII: '', arcaneMightV: '', editing: true }
      : { name: '', description: '', editing: true };
    entries.push(baseEntry);
    await this.actor.update({ [`system.${listKey}`]: entries });
  }

  async _toggleSamuraiTableEntryEdit(listKey, index) {
    if (!['martialSpirit', 'warriorsPresence', 'kenjutsu'].includes(listKey)) return;
    const entries = foundry.utils.duplicate(this.actor.system[listKey] ?? []);
    if (!entries[index]) return;
    entries[index].editing = !entries[index].editing;
    await this.actor.update({ [`system.${listKey}`]: entries });
  }

  async _deleteSamuraiTableEntry(listKey, index) {
    if (!['martialSpirit', 'warriorsPresence', 'kenjutsu'].includes(listKey)) return;
    const entries = foundry.utils.duplicate(this.actor.system[listKey] ?? []);
    entries.splice(index, 1);
    await this.actor.update({ [`system.${listKey}`]: entries });
  }

  async _pingSamuraiTableEntry(listKey, index) {
    if (!['martialSpirit', 'warriorsPresence', 'kenjutsu'].includes(listKey)) return;
    const entries = this.actor.system[listKey] ?? [];
    const entry = entries[index];
    if (!entry) return;

    if (listKey === 'kenjutsu') {
      const currentStamina = Number(this.actor.system.stamina?.value ?? 0);
      const arcaneMight = Number(this.actor.system.arcaneMight ?? 0);
      const staminaCost = Number(entry.stamina ?? 0);
      const description = (entry.description ?? '').trim();
      const arcaneThree = (entry.arcaneMightIII ?? '').trim();
      const arcaneFive = (entry.arcaneMightV ?? '').trim();
      const blocks = [];

      if (description) blocks.push(`<p>${description}</p>`);
      if (arcaneMight >= 3 && arcaneThree) blocks.push(`<p><strong>Arcane Might III</strong><br>${arcaneThree}</p>`);
      if (arcaneMight >= 5 && arcaneFive) blocks.push(`<p><strong>Arcane Might V</strong><br>${arcaneFive}</p>`);

      if (!blocks.length) return;

      await this.actor.update({ 'system.stamina.value': Math.max(0, currentStamina - staminaCost) });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `
          <div class="casus-belli-samurai-note">
            <h3>${entry.name?.trim() || 'Kenjutsu'}</h3>
            <p><strong>Cost: ${staminaCost} Stamina</strong></p>
            ${blocks.join('')}
          </div>
        `,
      });
      return;
    }

    const title = listKey === 'martialSpirit' ? 'Martial Spirit' : "Warrior's Presence";
    const name = entry.name?.trim() || 'Untitled';
    const description = entry.description?.trim() || 'No description provided.';

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="casus-belli-samurai-note">
          <h3>${title}</h3>
          <p><strong>${name}</strong></p>
          <p>${description}</p>
        </div>
      `,
      whisper: this.actor.isOwner ? [] : null,
    });
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = foundry.utils.duplicate(header.dataset);
    // Initialize a default name.
    const typeLabel = CONFIG.Item.typeLabels?.[type];
    const name = `New ${typeLabel ? game.i18n.localize(typeLabel) : type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system['type'];
    
    // Handle boon-type data (rename to 'type' for the system)
    if (itemData.system['boonType']) {
      itemData.system['type'] = itemData.system['boonType'];
      delete itemData.system['boonType'];
    }

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType == 'item') {
        const itemId = element.closest('.item').dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.roll) {
      const label = dataset.label ? `[check] ${dataset.label}` : '';
      const roll = new Roll(dataset.roll, this.actor.getRollData());
      await roll.evaluate();
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        content: formatRollContent(roll),
        rollMode: game.settings.get('core', 'rollMode'),
        flags: {
          'casus-belli': {
            actorId: this.actor.id,
            tn: (() => {
              const match = roll.formula.match(/cs>=?(\d+)/);
              return match ? parseInt(match[1]) : null;
            })(),
          },
        },
      });
      return roll;
    }

    // Handle system-value rolls (Arcane Might, Sense the Unseen, Arcane Lore)
    if (dataset.rollType === 'system-value') {
      const valuePath = dataset.valuePath;
      const value = foundry.utils.getProperty(this.actor.system, valuePath);
      if (!value) return;

      const rollData = this.actor.getRollData();

      const buildOptions = () => {
        let options = '<option value="">None (Single Roll)</option>';
        const defaultSecond = dataset.defaultSecond;

        for (const [attrKey, attrLabel] of Object.entries(CONFIG.CASUSBELLI.attributes)) {
          const displayName = game.i18n.localize(attrLabel);
          const abbr = game.i18n.localize(CONFIG.CASUSBELLI.attributeAbbreviations[attrKey]);
          const selected = attrKey === defaultSecond ? ' selected' : '';
          options += `<option value="${attrKey}"${selected}>${displayName} (${abbr})</option>`;
        }

        for (const [skillKey, skillLabel] of Object.entries(CONFIG.CASUSBELLI.skills)) {
          const displayName = game.i18n.localize(skillLabel);
          options += `<option value="${skillKey}">${displayName}</option>`;
        }

        return options;
      };

      const dialogContent = `
        <form>
          <div class="form-group">
            <label>Target Number:</label>
            <input type="number" name="tn" value="6" min="1" max="10"/>
          </div>
          <div class="form-group">
            <label>Dice Modifier:</label>
            <input type="number" name="diceMod" value="0"/>
          </div>
          <div class="form-group">
            <label>Combine with (optional):</label>
            <select name="secondKey">${buildOptions()}</select>
          </div>
        </form>
      `;

      new Dialog({
        title: `Roll ${dataset.label}`,
        content: dialogContent,
        classes: ['casus-belli', 'casus-belli-roll-dialog'],
        buttons: {
          roll: {
            label: "Roll",
            callback: async (html) => {
              const tn = parseInt(html.find('[name="tn"]').val()) || 6;
              const diceMod = parseInt(html.find('[name="diceMod"]').val()) || 0;
              const secondKey = html.find('[name="secondKey"]').val();

              let totalDice = value;
              let flavor = `${dataset.label} (TN ${tn})`;

              if (secondKey) {
                const secondValue = rollData[secondKey]?.value;
                if (secondValue) {
                  totalDice += secondValue;

                  let secondLabel = '';
                  if (CONFIG.CASUSBELLI.attributes[secondKey]) {
                    secondLabel = game.i18n.localize(CONFIG.CASUSBELLI.attributes[secondKey]);
                  } else if (CONFIG.CASUSBELLI.skills[secondKey]) {
                    secondLabel = game.i18n.localize(CONFIG.CASUSBELLI.skills[secondKey]);
                  }

                  flavor = `${dataset.label} + ${secondLabel} (TN ${tn})`;
                }
              }

              if (diceMod !== 0) {
                totalDice += diceMod;
                const modSign = diceMod > 0 ? `+${diceMod}` : `${diceMod}`;
                flavor += ` [${modSign} dice]`;
              }

              totalDice = Math.max(1, totalDice);

              const formula = `${totalDice}d10cs>=${tn}`;
              const roll = new Roll(formula, rollData);
              await roll.evaluate();
              roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flavor: flavor,
                content: formatRollContent(roll, tn),
                rollMode: game.settings.get('core', 'rollMode'),
                flags: {
                  'casus-belli': {
                    actorId: this.actor.id,
                    tn: tn,
                  },
                },
              });
            }
          }
        },
        default: "roll"
      }).render(true);
      return;
    }

    // Handle attribute and skill rolls (and the ninja ability roll: Arcane Might + Agility)
    if (dataset.rollType === 'attribute' || dataset.rollType === 'skill') {
      const key = dataset.key;
      const rollData = this.actor.getRollData();
      const value = rollData[key]?.value ?? this.actor.system[key] ?? 0;
      if (value === null || value === undefined || Number(value) <= 0) return;
      return openRollDialog(this.actor, {
        key,
        value: Number(value),
        label: dataset.label,
        defaultSecond: dataset.defaultSecond ?? '',
      });
    }

    // Ninja skill rolls: skill + Agility by default.
    if (dataset.rollType === 'ninja-skill') {
      const key = dataset.key;
      const skill = this.actor.system.ninjaSkills?.[key];
      if (!skill || CONFIG.CASUSBELLI.ninjaSkills[key]?.locked) return;
      return openRollDialog(this.actor, {
        key,
        value: Number(skill.total ?? skill.value ?? 0),
        label: CONFIG.CASUSBELLI.ninjaSkills[key].label,
        defaultSecond: 'agi',
      });
    }
  }

  /**
   * Post an item to chat
   * @param {Item} item The item to post
   * @private
   */
  async _postItemToChat(item) {
    const enrichedDescription = await TextEditor.enrichHTML(
      item.system.description,
      {
        secrets: this.document.isOwner,
        async: true,
        rollData: this.actor.getRollData(),
        relativeTo: item,
      }
    );

    let content = '';
    
    // Add tags if present
    if (item.system.tags && item.system.tags.length > 0) {
      content += `<div class="tags-section"><strong>Tags:</strong> ${item.system.tags.join(', ')}</div>`;
    }
    
    // Add description
    content += enrichedDescription;

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: item.name,
      content: content,
      rollMode: game.settings.get('core', 'rollMode'),
    };

    ChatMessage.create(chatData);
  }
}
