import {
  getTechniqueLearningWarning,
  validateNinjaItemCreate,
  validateNinjaItemUpdate,
} from '../helpers/ninja.mjs';

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class CasusBelliItem extends Item {
  /**
   * @inheritDoc
   */
  static getDefaultArtwork(itemData = {}) {
    const { type, system } = itemData;
    const { img } = super.getDefaultArtwork(itemData);
    let defaultIcon = CONFIG.Item.typeIcons?.[type] ?? img;
    if (type === 'boon' && system?.type === 'bane') {
      defaultIcon = 'icons/svg/daze.svg';
    }
    return { img: defaultIcon };
  }

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();

    if (this.type === 'wound') {
      const severity = this.system.severity || 'minor';
      const location = (this.system.bodyLocation || '').trim();
      // Bleeding is suppressed once a wound is treated.
      const bleeding = this.system.bleeding && !this.system.treated;

      const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);
      const locationPart  = location ? ` ${location}` : '';
      const statusPart    = this.system.treated ? ' (Treated)' : bleeding ? ' (Bleeding)' : '';

      this.name = `${severityLabel}${locationPart} Wound${statusPart}`;
    }
  }

  /**
   * @inheritDoc
   */
  async _preCreate(data, options, user) {
    if ((await super._preCreate(data, options, user)) === false) return false;

    // Ninja items: enforce one bloodline per character and matching bloodline techniques.
    if (this.parent && ['technique', 'bloodline'].includes(this.type)) {
      const error = validateNinjaItemCreate(this.parent, this);
      if (error) {
        ui.notifications.warn(error);
        return false;
      }
      const warning = getTechniqueLearningWarning(this.parent, this);
      if (warning) ui.notifications.info(warning);
    }

    let defaultIcon = CONFIG.Item.typeIcons?.[this.type];
    if (this.type === 'boon' && this.system.type === 'bane') {
      defaultIcon = 'icons/svg/daze.svg';
    }
    if (defaultIcon && (!this.img || this.img === Item.DEFAULT_ICON)) {
      this.updateSource({ img: defaultIcon });
    }
  }

  /** @inheritDoc */
  async _preUpdate(changed, options, user) {
    if ((await super._preUpdate(changed, options, user)) === false) return false;
    if (this.parent && ['technique', 'bloodline'].includes(this.type)) {
      const error = validateNinjaItemUpdate(this.parent, this, changed);
      if (error) {
        ui.notifications.warn(error);
        return false;
      }
    }
  }

  /** @inheritDoc */
  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    this._syncParentNinjaEffects(userId);
  }

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    this._syncParentNinjaEffects(userId);
  }

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    this._syncParentNinjaEffects(userId);
  }

  /**
   * Bloodline state (open gates, flaws) drives Active Effects on the owning character.
   * @param {string} userId  The user who made the change; only they perform the sync.
   * @private
   */
  _syncParentNinjaEffects(userId) {
    if (this.type !== 'bloodline' || userId !== game.user.id) return;
    this.parent?.syncNinjaEffects?.();
  }

  /**
   * Prepare a data object which defines the data schema used by dice roll commands against this Item
   * @override
   */
  getRollData() {
    // Starts off by populating the roll data with a shallow copy of `this.system`
    const rollData = { ...this.system };

    // Quit early if there's no parent actor
    if (!this.actor) return rollData;

    // If present, add the actor's roll data
    rollData.actor = this.actor.getRollData();

    return rollData;
  }

  /**
   * Convert the actor document to a plain object.
   *
   * The built in `toObject()` method will ignore derived data when using Data Models.
   * This additional method will instead use the spread operator to return a simplified
   * version of the data.
   *
   * @returns {object} Plain object either via deepClone or the spread operator.
   */
  toPlainObject() {
    const result = { ...this };

    // Simplify system data.
    result.system = this.system.toPlainObject();

    // Add effects.
    result.effects = this.effects?.size > 0 ? this.effects.contents : [];

    return result;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll() {
    const item = this;

    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `[${item.type}] ${item.name}`;

    // If there's no roll data, send a chat message.
    if (!this.system.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.system.description ?? '',
      });
    }
    // Otherwise, create a roll and send a chat message from it.
    else {
      // Retrieve roll data.
      const rollData = this.getRollData();

      // Invoke the roll and submit it to chat.
      const roll = new Roll(rollData.formula, rollData.actor);
      // If you need to store the value first, uncomment the next line.
      // const result = await roll.evaluate();
      roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
      });
      return roll;
    }
  }
}
