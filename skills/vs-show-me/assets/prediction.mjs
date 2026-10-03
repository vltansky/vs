// The factory is copied into portable shells verbatim; keep it free of imports
// so CLI registration and the sandboxed MCP App use the same component.
export const predictionComponentFactory = (React) => {
  const css = `
    .vs-prediction { border: 1px solid var(--md-sys-color-outline-variant); border-radius: 8px; padding: 16px; }
    .vs-prediction label { display: grid; gap: 6px; font-size: 13px; }
    .vs-prediction select, .vs-prediction button { font: inherit; color: inherit; background: var(--md-sys-color-surface-container); border: 1px solid var(--md-sys-color-outline-variant); border-radius: 6px; padding: 8px 12px; }
    .vs-prediction select { width: 100%; }
    .vs-prediction fieldset { padding: 0; border: 0; margin: 16px 0; }
    .vs-prediction legend { font-weight: 600; margin-bottom: 10px; }
    .vs-prediction-choices { display: flex; flex-wrap: wrap; gap: 8px; }
    .vs-prediction button[aria-pressed='true'] { border-color: var(--md-sys-color-primary); color: var(--md-sys-color-primary); }
    .vs-prediction button:disabled { opacity: .5; }
    .vs-prediction :focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 3px; }
    .vs-prediction-feedback { margin-top: 12px; border-left: 3px solid var(--md-sys-color-primary); padding-left: 12px; }
    .vs-prediction-feedback p { margin: 4px 0; }
    .vs-prediction details { margin-top: 14px; font-size: 13px; }
    .vs-prediction summary { cursor: pointer; }
  `;
  const parse = (body, choices) => {
    const options = choices.split(',').map((value) => value.trim());
    if (options.length < 2 || options.some((value) => !value) || new Set(options).size !== options.length) {
      throw new Error('Prediction needs at least two distinct comma-separated choices.');
    }
    const rows = body.split('\n').map((line) => line.trim()).filter(Boolean);
    const scenarios = rows.map((row) => {
      const match = /^-\s+(.+?):\s+(.+?)\s*\|\s*(.+)$/.exec(row);
      if (!match || !options.includes(match[2].trim())) {
        throw new Error('Prediction rows must be: - Setup: exact choice | reason.');
      }
      return { setup: match[1].trim(), answer: match[2].trim(), reason: match[3].trim() };
    });
    if (!scenarios.length || new Set(scenarios.map((row) => row.setup)).size !== scenarios.length) {
      throw new Error('Prediction needs uniquely named setups.');
    }
    return { options, scenarios };
  };
  const Component = ({ body = '', choices = '', question = 'What happens next?', setup = 'Change the setup' }) => {
    if (!React?.createElement) return body;
    const h = React.createElement;
    const wrap = (content) => h('section', { 'data-htmdx-component': 'Prediction', className: 'htmdx-component' }, content);
    let data;
    try { data = parse(body, choices); } catch (error) {
      return wrap(h('p', { role: 'alert' }, error.message));
    }
    // CLI/static renders preserve every answer. Interactive hooks belong only
    // to the browser runtime; lint and compile must not require a browser.
    if (!React.useState) return wrap(h('div', null, h('p', null, question), ...data.scenarios.map((row) => h('p', { key: row.setup }, `${row.setup}: ${row.answer} — ${row.reason}`))));
    const [selected, setSelected] = React.useState(0);
    const [prediction, setPrediction] = React.useState('');
    const [revealed, setRevealed] = React.useState(false);
    const scenario = data.scenarios[selected] ?? data.scenarios[0];
    const reset = () => { setPrediction(''); setRevealed(false); };
    const correct = prediction === scenario.answer;
    return wrap(h('div', { className: 'vs-prediction' },
      h('style', null, css),
      h('label', null, setup, h('select', {
        value: selected,
        onChange: (event) => {
          setSelected(Number(event.target.value));
          // A new setup invalidates the old prediction and feedback. Without
          // this reset the page can teach an answer for a different condition.
          reset();
        },
      }, data.scenarios.map((row, index) => h('option', { key: row.setup, value: index }, row.setup)))),
      h('fieldset', null,
        h('legend', null, question),
        h('div', { className: 'vs-prediction-choices' }, data.options.map((choice) => h('button', {
          key: choice, type: 'button', 'aria-pressed': prediction === choice,
          onClick: () => { setPrediction(choice); setRevealed(false); },
        }, choice)))),
      h('button', { type: 'button', disabled: !prediction, onClick: () => setRevealed(true) }, 'Reveal why'),
      h('div', { role: 'status', 'aria-live': 'polite', className: revealed ? 'vs-prediction-feedback' : undefined },
        revealed ? h('div', null,
          h('strong', null, correct ? `Correct: ${scenario.answer}.` : `The result is ${scenario.answer}.`),
          h('p', null, scenario.reason)) : null),
      h('details', null,
        h('summary', null, 'Read all answers'),
        ...data.scenarios.map((row) => h('p', { key: row.setup }, `${row.setup}: ${row.answer} — ${row.reason}`))),
    ));
  };
  return {
    name: 'Prediction', body: 'markdown',
    purpose: "Teach one cause-and-effect rule by choosing a setup, predicting, and revealing its answer and reason. Each row is '- Setup: exact choice | reason'; changing setup resets feedback. Keep the core explanation outside the controls. Use supplied facts or label the example as illustrative.",
    example: '<Prediction question="Where does the request go?" choices="Saved copy,Server">\n- Lifetime 0 minutes: Server | The two-minute-old copy has expired.\n- Lifetime 5 minutes: Saved copy | Two minutes is less than five.\n</Prediction>',
    props: [
      { name: 'question', type: 'string', default: 'What happens next?', description: 'One prediction about the selected setup.' },
      { name: 'choices', type: 'string', description: 'Distinct comma-separated answers; each row must name one exactly.' },
      { name: 'setup', type: 'string', default: 'Change the setup', description: 'Label for the native scenario selector.' },
    ],
    Component,
  };
};
