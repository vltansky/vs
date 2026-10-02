// vs-prototype logic harness: [[TOPIC]]
// Run: node [[FILE]]   (Node 24 strips the types; no build, no deps)
//
// Edit only the PROTOTYPE block: State, initialState, Action, reducer, controls.
// Keep the reducer pure: throw an Error to reject an illegal transition; the
// shell shows the error and keeps the previous state.
import * as readline from 'node:readline';

// ---- PROTOTYPE: edit from here -------------------------------------------

type State = {
  status: 'idle' | 'running' | 'done';
  count: number;
};

const initialState: State = { status: 'idle', count: 0 };

type Action =
  | { type: 'start' }
  | { type: 'add'; amount: number }
  | { type: 'finish' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      if (state.status !== 'idle') throw new Error(`cannot start from ${state.status}`);
      return { ...state, status: 'running' };
    case 'add':
      if (state.status !== 'running') throw new Error('add only while running');
      return { ...state, count: state.count + action.amount };
    case 'finish':
      return { ...state, status: 'done' };
  }
}

// One line per control: key typed at the prompt -> action. `arg` is the rest of the line.
const controls: Record<string, { label: string; toAction: (arg: string) => Action }> = {
  s: { label: 'start', toAction: () => ({ type: 'start' }) },
  a: { label: 'add <n>', toAction: (arg) => ({ type: 'add', amount: Number(arg || 1) }) },
  f: { label: 'finish', toAction: () => ({ type: 'finish' }) },
};

// ---- shell: no edits needed below ----------------------------------------

const TITLE = '[[TOPIC]] prototype';
const tty = process.stdout.isTTY;
const paint = (code: string, text: string) => (tty ? `\x1b[${code}m${text}\x1b[0m` : text);

let state = initialState;
const history: State[] = [];
let lastAction = '(none)';
let lastError = '';

function render(): void {
  // Full-frame redraw: clear + home on a TTY so every frame shows the whole state.
  const lines = [
    paint('1;33', `PROTOTYPE · ${TITLE}`) + paint('2', '  in-memory state, nothing persists'),
    '',
    paint('1', 'State'),
    ...JSON.stringify(state, null, 2).split('\n').map((line) => `  ${paint('36', line)}`),
    '',
    `${paint('1', 'Last action')}  ${lastAction}   ${paint('2', `steps: ${history.length}`)}`,
    lastError ? paint('31', `Rejected: ${lastError}`) : '',
    paint('1', 'Controls'),
    ...Object.entries(controls).map(([key, c]) => `  ${paint('32', key)}  ${c.label}`),
    `  ${paint('32', 'u')}  undo   ${paint('32', 'r')}  reset   ${paint('32', 'q')}  quit`,
    '',
  ];
  process.stdout.write((tty ? '\x1b[2J\x1b[H' : '\n') + lines.join('\n') + '\n');
}

function handle(line: string): boolean {
  const [key = '', ...rest] = line.trim().split(/\s+/);
  const arg = rest.join(' ');
  lastError = '';
  if (key === 'q') return false;
  if (key === 'u') {
    state = history.pop() ?? state;
    lastAction = 'undo';
  } else if (key === 'r') {
    history.length = 0;
    state = initialState;
    lastAction = 'reset';
  } else if (controls[key]) {
    const action = controls[key].toAction(arg);
    lastAction = JSON.stringify(action);
    try {
      const next = reducer(state, action);
      history.push(state);
      state = next;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  } else if (key) {
    lastError = `unknown control "${key}"`;
  }
  render();
  return true;
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
render();
rl.on('line', (line) => {
  if (!handle(line)) rl.close();
});
rl.on('close', () => process.exit(0));
