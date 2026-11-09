export class SpellcastDialog extends Application {
  constructor(actor, coreData, options = {}) {
    super(options);
    this.actor = actor;
    this.coreData = coreData;
    this._page = 'potency';
    this._data = {
      potency: '1',
      connections: [],
      range: '30',
      scourgeOptions: []
    };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'spellcast-dialog',
      classes: ['casus-belli', 'spellcast-dialog'],
      template: 'systems/casus-belli/templates/dialogs/spellcast-dialog.hbs',
      title: 'Cast Spell',
      width: 420,
      height: 'auto'
    });
  }

  getData() {
    const potencyOptions = [
      { value: '1', label: '1st Circle', complexity: 2 },
      { value: '2', label: '2nd Circle', complexity: 3 },
      { value: '3', label: '3rd Circle', complexity: 4 },
      { value: '4', label: '4th Circle', complexity: 5 },
      { value: '5', label: '5th Circle', complexity: 6 },
      { value: '6', label: '6th Circle', complexity: 8 },
      { value: '7', label: '7th Circle', complexity: 10 },
      { value: '8', label: '8th Circle', complexity: 12 },
      { value: '9', label: '9th Circle', complexity: 14 }
    ].map(o => ({ ...o, checked: this._data.potency === o.value }));

    const connectionOptions = [
      { value: 'blood', label: 'Blood', complexity: -1 },
      { value: 'object', label: 'Object of Value', complexity: -1 },
      { value: 'truename', label: 'True Name', complexity: -1 },
      { value: 'portion', label: 'Portion of the Whole', complexity: -1 },
      { value: 'los', label: 'Line of Sight', complexity: 0 },
      { value: 'none', label: 'None', complexity: 2 }
    ].map(o => ({ ...o, checked: this._data.connections.includes(o.value) }));

    const rangeOptions = [
      { value: '30', label: '30 Yards', complexity: 0 },
      { value: '120', label: '120 Yards', complexity: 1 },
      { value: '600', label: '600 Yards', complexity: 2 },
      { value: '1mile', label: 'One Mile', complexity: 4 },
      { value: '10mile', label: 'Ten Miles', complexity: 6 },
      { value: '100mile', label: 'A Hundred Miles', complexity: 8 },
      { value: 'unlimited', label: 'Unlimited', complexity: 12 }
    ].map(o => ({ ...o, checked: this._data.range === o.value }));

    const scourgeCurrent = this.actor.system.scourge.value;
    const scourgeMax = this.actor.system.scourge.max;
    const hasScourge = scourgeCurrent < scourgeMax;

    const scourgeOptions = [
      { value: 'empower', label: 'Empower', description: '+1 + Arcane Might / 2 dice' },
      { value: 'bind', label: 'Bind', description: '-Arcane Might Complexity' },
      { value: 'translocate', label: 'Translocate', description: 'Cast from another tile' }
    ].map(o => ({ ...o, checked: hasScourge && this._data.scourgeOptions.includes(o.value), disabled: !hasScourge }));

    const potency = potencyOptions.find(p => p.checked) || potencyOptions[0];
    const connections = connectionOptions.filter(c => c.checked);
    const range = rangeOptions.find(r => r.checked) || rangeOptions[0];

    const connectionComplexity = connections.reduce((sum, c) => sum + c.complexity, 0);
    const connectionLabel = connections.length ? connections.map(c => c.label).join(', ') : 'None';
    const totalComplexity = potency.complexity + connectionComplexity + range.complexity;

    const will = this.actor.system.attributes.wil.value;
    const arcaneMight = this.actor.system.arcaneMight;
    const dicePool = will + arcaneMight;

    return {
      page: this._page,
      coreName: this.coreData.name,
      potencyOptions,
      connectionOptions,
      rangeOptions,
      scourgeOptions,
      potency,
      connectionComplexity,
      connectionLabel,
      range,
      totalComplexity,
      will,
      arcaneMight,
      dicePool
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('.next-page').click(this._onNextPage.bind(this));
    html.find('.prev-page').click(this._onPrevPage.bind(this));
    html.find('.cast-button').click(this._onCast.bind(this));
    html.find('.cancel-button').click(() => this.close());
  }

  _readPageData(html, page) {
    if (page === 'potency') {
      this._data.potency = html.find('[name="potency"]').val() || '1';
    } else if (page === 'connection') {
      const vals = [];
      html.find('input[name="connection"]:checked').each((i, el) => vals.push(el.value));
      this._data.connections = vals;
    } else if (page === 'range') {
      this._data.range = html.find('[name="range"]').val() || '30';
    } else if (page === 'summary') {
      const vals = [];
      html.find('input[name="scourgeOption"]:checked').each((i, el) => vals.push(el.value));
      this._data.scourgeOptions = vals;
    }
  }

  _onNextPage(event) {
    event.preventDefault();
    const nextPage = event.currentTarget.dataset.page;
    this._readPageData(this.element, this._page);
    this._page = nextPage;
    this.render(true);
  }

  _onPrevPage(event) {
    event.preventDefault();
    const prevPage = event.currentTarget.dataset.page;
    this._readPageData(this.element, this._page);
    this._page = prevPage;
    this.render(true);
  }

  _gatherRollData() {
    const potencyMap = { '1': 2, '2': 3, '3': 4, '4': 5, '5': 6, '6': 8, '7': 10, '8': 12, '9': 14 };
    const connectionMap = { blood: -1, object: -1, truename: -1, portion: -1, los: 0, none: 2 };
    const rangeMap = { '30': 0, '120': 1, '600': 2, '1mile': 4, '10mile': 6, '100mile': 8, unlimited: 12 };

    const potencyComplexity = potencyMap[this._data.potency] || 2;
    const connectionComplexity = this._data.connections.reduce((sum, v) => sum + (connectionMap[v] || 0), 0);
    const rangeComplexity = rangeMap[this._data.range] || 0;

    let complexity = potencyComplexity + connectionComplexity + rangeComplexity;

    const will = this.actor.system.attributes.wil.value;
    const arcaneMight = this.actor.system.arcaneMight;
    let dice = will + arcaneMight;

    let bonusDice = 0;
    let complexityMod = 0;
    let translocate = false;

    if (this._data.scourgeOptions.includes('empower')) {
      bonusDice = 1 + Math.ceil(arcaneMight / 2);
    }
    if (this._data.scourgeOptions.includes('bind')) {
      complexityMod = -arcaneMight;
    }
    if (this._data.scourgeOptions.includes('translocate')) {
      translocate = true;
    }

    const finalComplexity = Math.max(0, complexity + complexityMod);
    const totalDice = Math.max(1, dice + bonusDice);

    return {
      complexity,
      finalComplexity,
      totalDice,
      translocate,
      scourgeCount: this._data.scourgeOptions.length,
      potencyLabel: potencyComplexity,
      connectionLabel: this._data.connections.join(', ') || 'None',
      rangeLabel: this._data.range,
      scourgeLabels: this._data.scourgeOptions.join(', ') || 'None'
    };
  }

  async _onCast(event) {
    event.preventDefault();
    this._readPageData(this.element, this._page);
    const data = this._gatherRollData();

    if (data.scourgeCount > 0) {
      const currentScourge = this.actor.system.scourge.value;
      await this.actor.update({ 'system.scourge.value': currentScourge + data.scourgeCount });
    }

    await this._performRoll(data, data.scourgeCount > 0);
    this.close();
  }

  async _performRoll(data, withScourge) {
    const formula = `${data.totalDice}d10cs>=6`;
    const roll = new Roll(formula, this.actor.getRollData());
    await roll.evaluate();

    const allDice = roll.dice.flatMap(die => die.results.map(r => r.result));
    const tens = allDice.filter(r => r === 10).length;
    const critCount = Math.floor(tens / 2);
    const totalSuccesses = roll.total + (critCount * 2);
    const success = totalSuccesses >= data.finalComplexity;

    const diceHtml = allDice.map(result => {
      const classes = ['die-box', 'd10'];
      if (result >= 6) classes.push('success');
      if (result === 10) classes.push('max');
      return `<div class="${classes.join(' ')}">${result}</div>`;
    }).join('');

    const critHtml = critCount > 0
      ? ` <span class="crit-tag">+${critCount * 2} CRIT${critCount > 1 ? 'S' : ''}</span>`
      : '';

    let flavor = `Casting ${this.coreData.name} (TN 6)`;
    if (withScourge) flavor += ' [Scourge]';

    const resultText = success ? 'Spell Succeeds!' : 'Spell Fails!';
    const failureMargin = data.finalComplexity - totalSuccesses;

    let failureConsequences = '';
    if (!success) {
      const level = Math.min(failureMargin, 8);
      const effects = {
        1: 'Suffer: Gain one Pain that lasts until the next time you rest. This Pain cannot be reduced in any way by Sorcery.',
        2: 'Torn: Roll four dice in a basic test and gain two Stress for each failure.',
        3: 'Rend: Gain two Mental Strain.',
        4: 'Curse: Your Curse progresses by one level.',
        5: 'Shock: You suffer a critical electric wound to your chest as your power surges uncontrollably. If you are wearing metal armor on your chest, increase this to a lethal wound. This wound cannot be treated in any way by Sorcery. Increase the required successes to avoid infection from this wound by one.',
        6: 'Rupture: Suffer a wound as with Shock. Your Scourge is increased to its maximum value and you cannot reduce it, cast spells, or use your Witch\'s Mark till your wound incurred from this effect is healed. Additionally roll five dice in a basic test and add 2 Stress for each failure.',
        7: 'Stilled: You forever burn away your ability to use magic. Immediately suffer a mental break and increase your Stress to the highest it can be without driving you catatonic.',
        8: 'Obliteration: Your magic implodes your body, instantly killing you and dealing 3 + 2 * Arcane Might electric damage to anyone touching you. Any character damaged by this effect not Touched by Fate must roll one dice in a basic test and immediately die on a failure. Sorcerers of Arcane Might III or greater may increase the radius beyond only those touching them by a number of yards equal to their Arcane Might.'
      };
      const effect = effects[level] || effects[8];
      const extraNote = failureMargin >= 8
        ? '<p class="obliteration-note">If you suffer from this level of failure your spell fails to take form or be cast and is instead released as raw Scourge into the lands around your area of death. Increase ambient Scourge by ten times your Arcane Might.</p>'
        : '';
      failureConsequences = `
        <div class="failure-consequences">
          <h4>Consequence of Failure</h4>
          <p class="failure-margin">You fell short by <strong>${failureMargin}</strong> success${failureMargin > 1 ? 'es' : ''}. You may always choose to suffer a higher level failure effect.</p>
          <p class="failure-effect"><strong>Level ${failureMargin >= 8 ? '8+' : failureMargin} &mdash; ${effect}</strong></p>
          ${extraNote}
        </div>
      `;
    }

    const content = `
      <div class="casus-belli-roll-result">
        <div class="spell-summary">
          <p><strong>Complexity:</strong> ${data.finalComplexity}</p>
          <p><strong>${resultText}</strong> (${totalSuccesses} Successes)</p>
        </div>
        <div class="dice-pool">${diceHtml}</div>
        <div class="success-summary ${critCount > 0 ? 'crit' : ''}">
          <span class="success-count">${totalSuccesses}</span> Successes${critHtml}
        </div>
        ${failureConsequences}
      </div>
    `;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: flavor,
      content: content,
      rollMode: game.settings.get('core', 'rollMode'),
      flags: {
        'casus-belli': {
          actorId: this.actor.id,
          tn: 6,
        },
      },
    });
  }
}
