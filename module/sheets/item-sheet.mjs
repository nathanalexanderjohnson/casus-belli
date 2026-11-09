import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class CasusBelliItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['casus-belli', 'sheet', 'item'],
      width: 520,
      height: 480,
      tabs: [
        {
          navSelector: '.sheet-tabs',
          contentSelector: '.sheet-body',
          initial: 'description',
        },
      ],
    });
  }

  /** @override */
  get template() {
    const path = 'systems/casus-belli/templates/item';
    // Return a single sheet for all item types.
    // return `${path}/item-sheet.hbs`;

    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.hbs`.
    return `${path}/item-${this.item.type}-sheet.hbs`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve base data structure.
    const context = super.getData();

    // Use a safe clone of the item data for further operations.
    const itemData = this.document.toPlainObject();

    // Enrich description info for display
    // Enrichment turns text like `[[/r 1d20]]` into buttons
    context.enrichedDescription = await TextEditor.enrichHTML(
      this.item.system.description,
      {
        // Whether to show secret blocks in the finished html
        secrets: this.document.isOwner,
        // Necessary in v11, can be removed in v12
        async: true,
        // Data to fill in for inline rolls
        rollData: this.item.getRollData(),
        // Relative UUID resolution
        relativeTo: this.item,
      }
    );

    // Add the item's data to context.data for easier access, as well as flags.
    context.system = itemData.system;
    context.flags = itemData.flags;

    // Adding a pointer to CONFIG.CASUSBELLI
    context.config = CONFIG.CASUSBELLI;

    // Prepare active effects for easier access
    context.effects = prepareActiveEffectCategories(this.item.effects);

    // For maneuver items, build the available-tags list from config + world items
    if (this.item.type === 'maneuver') {
      const configTags = CONFIG.CASUSBELLI.maneuverTags ?? [];
      const worldTags = (game.items ?? [])
        .filter(i => i.type === 'maneuver')
        .flatMap(i => i.system?.tags ?? []);
      const currentTags = context.system.tags ?? [];
      const allTags = [...new Set([...configTags, ...worldTags, ...currentTags])].sort();
      context.availableTags = allTags.map(tag => ({
        value: tag,
        selected: currentTags.includes(tag),
      }));
      context.hasTags = currentTags.length > 0;
    }

    // Technique and bloodline select options
    if (this.item.type === 'technique' || this.item.type === 'bloodline') {
      const config = CONFIG.CASUSBELLI;
      const bloodlineKey = context.system.bloodline;
      const bloodlineDef = config.bloodlines[bloodlineKey];
      const variants = bloodlineDef?.variants
        ? { '': '—', ...Object.fromEntries(Object.entries(bloodlineDef.variants).map(([k, v]) => [k, v.label])) }
        : null;
      const bloodlines = Object.fromEntries(Object.entries(config.bloodlines).map(([k, v]) => [k, v.label]));

      if (this.item.type === 'technique') {
        context.techniqueOptions = {
          categories: config.techniqueCategories,
          ranks: Object.fromEntries(Object.keys(config.techniqueRanks).map((k) => [k, k])),
          elements: config.techniqueElements,
          rolls: config.techniqueRolls,
          frequencies: config.techniqueFrequencies,
          bloodlines: { '': '—', ...bloodlines },
          variants,
        };
      } else {
        context.bloodlineOptions = {
          bloodlines,
          variants,
          canManifest: Boolean(bloodlineDef?.canManifest),
          stageLabel: bloodlineDef?.stageLabel ?? '',
          minStage: bloodlineDef?.minStage ?? 0,
          maxStage: bloodlineDef?.maxStage ?? 0,
          flaws: bloodlineKey === 'jinchuriki'
            ? Object.entries(config.jinchurikiFlaws).map(([key, flaw]) => ({
              key,
              label: flaw.label,
              description: flaw.description,
              checked: (context.system.flaws ?? []).includes(key),
            }))
            : null,
        };
      }
    }

    // Inject derived total complexity for gadget items
    if (this.item.type === 'gadget') {
      context.system.totalComplexity = this.item.system.totalComplexity;
    }

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // ── Maneuver tag bubble dropdown ─────────────────────────────────────────
    if (this.item.type === 'maneuver') {
      const $dropdown = html.find('.tag-dropdown');

      // Restore open state after a re-render triggered by a tag toggle
      if (this._tagDropdownOpen) {
        $dropdown.addClass('open');
        this._attachTagDropdownOutsideHandler($dropdown[0]);
      }

      // Click the toggle row → open/close the panel
      html.on('click', '.tag-dropdown-toggle', (ev) => {
        ev.stopPropagation();
        this._tagDropdownOpen = $dropdown.toggleClass('open').hasClass('open');
        if (this._tagDropdownOpen) {
          this._attachTagDropdownOutsideHandler($dropdown[0]);
        } else {
          this._removeTagDropdownOutsideHandler();
        }
      });

      // Click a bubble in the panel → toggle it and save immediately
      html.on('click', '.tag-dropdown-panel .tag-bubble', (ev) => {
        ev.stopPropagation(); // prevent outside-click handler from firing
        $(ev.currentTarget).toggleClass('selected');
        const tags = html.find('.tag-dropdown-panel .tag-bubble.selected')
          .map((_, el) => el.dataset.tag).get();
        this._tagDropdownOpen = true; // keep panel open across the re-render
        this.item.update({ 'system.tags': tags });
      });
    }

    // Gadget augment management
    if (this.item.type === 'gadget') {
      html.on('click', '.gadget-augment-create', (ev) => {
        const augments = [...(this.item.system.augments || [])];
        augments.push({ name: '', complexity: 0, enabled: true });
        this.item.update({ 'system.augments': augments });
      });

      html.on('click', '.gadget-augment-delete', (ev) => {
        const li = $(ev.currentTarget).parents('.item');
        const index = li.data('index');
        const augments = [...(this.item.system.augments || [])];
        augments.splice(index, 1);
        this.item.update({ 'system.augments': augments });
      });
    }

    // Jinchuriki flaws (array field toggled by checkbox)
    if (this.item.type === 'bloodline') {
      html.on('change', '.bloodline-flaw-toggle', (ev) => {
        ev.stopPropagation();
        const flaw = ev.currentTarget.dataset.flaw;
        const flaws = new Set(this.item.system.flaws ?? []);
        if (ev.currentTarget.checked) flaws.add(flaw);
        else flaws.delete(flaw);
        this.item.update({ 'system.flaws': [...flaws] });
      });
    }

    // Active Effect management
    html.on('click', '.effect-control', (ev) =>
      onManageActiveEffect(ev, this.item)
    );
  }

  /** @override — clean up the document listener when the sheet closes */
  async close(options = {}) {
    this._removeTagDropdownOutsideHandler();
    return super.close(options);
  }

  /**
   * Attach a one-shot document click handler that closes the tag dropdown
   * when the user clicks anywhere outside it.
   * @param {HTMLElement} dropdownEl
   */
  _attachTagDropdownOutsideHandler(dropdownEl) {
    this._removeTagDropdownOutsideHandler(); // clear any stale handler first
    this._tagDropdownOutsideHandler = (ev) => {
      if (!dropdownEl.contains(ev.target)) {
        this._tagDropdownOpen = false;
        dropdownEl.classList.remove('open');
        this._removeTagDropdownOutsideHandler();
      }
    };
    // Defer by one tick so the current click doesn't immediately close the panel
    setTimeout(() => document.addEventListener('click', this._tagDropdownOutsideHandler), 0);
  }

  /** Remove the document-level outside-click handler if one is attached. */
  _removeTagDropdownOutsideHandler() {
    if (this._tagDropdownOutsideHandler) {
      document.removeEventListener('click', this._tagDropdownOutsideHandler);
      this._tagDropdownOutsideHandler = null;
    }
  }
}
