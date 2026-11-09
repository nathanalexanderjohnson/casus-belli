/**
 * Shared training-project helpers (ninja techniques, Miko talismans).
 * A week of training adds the student's Arcane Might, plus a teacher's Arcane Might if any.
 */

/**
 * Ask for a week of training on an item.
 * @param {Actor} actor
 * @param {string} name  The name of what is being trained
 * @returns {Promise<number|null>} Progress gained this week, or null when cancelled
 */
export async function promptTrainingWeek(actor, name) {
  const arcaneMight = actor.system.arcaneMight ?? 0;
  const teacher = await new Promise((resolve) => {
    new Dialog({
      title: `Train ${name}`,
      content: `
        <form>
          <p>One week of training adds ${arcaneMight} progress (Arcane Might).</p>
          <div class="form-group">
            <label>Teacher's Arcane Might (0 for none):</label>
            <input type="number" name="teacher" value="0" min="0"/>
          </div>
        </form>`,
      classes: ['casus-belli', 'casus-belli-roll-dialog'],
      buttons: {
        train: { label: 'Train One Week', callback: (html) => resolve(Math.max(0, parseInt(html.find('[name="teacher"]').val()) || 0)) },
      },
      default: 'train',
      close: () => resolve(null),
    }).render(true);
  });
  return teacher === null ? null : arcaneMight + teacher;
}
