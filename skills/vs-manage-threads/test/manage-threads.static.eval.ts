import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';

const SKILL_PATH = path.resolve(__dirname, '..', 'SKILL.md');
const SKILL = fs.existsSync(SKILL_PATH) ? fs.readFileSync(SKILL_PATH, 'utf8') : '';

describe('vs-manage-threads live control-tower contract', () => {
  it('auto-detects recently active tasks with a one-hour default', () => {
    expect(SKILL).toContain('list_threads');
    expect(SKILL).toMatch(/last hour|60 minutes/i);
    expect(SKILL).toContain('updatedAt');
    expect(SKILL).toMatch(/exclude\s+the\s+(calling|current|control)[\s\S]*(task|thread)/i);
    expect(SKILL).toContain('read_thread');
    expect(SKILL).toMatch(/confirm.*user.*(message|interact|activity)|user.*activity.*confirm/is);
  });

  it('preserves host identity for every cross-task operation', () => {
    expect(SKILL).toContain('hostId');
    expect(SKILL).toMatch(/retain|preserve/i);
    expect(SKILL).toMatch(/read_thread.*hostId|hostId.*read_thread/is);
    expect(SKILL).toMatch(/wait_threads.*hostId|hostId.*wait_threads/is);
    expect(SKILL).toMatch(/send_message_to_thread.*hostId|hostId.*send_message_to_thread/is);
  });

  it('keeps live monitoring stateful and cheap', () => {
    expect(SKILL).toContain('wait_threads');
    expect(SKILL).toMatch(/up to eight/i);
    expect(SKILL).toContain('afterCursor');
    expect(SKILL).toMatch(/300000/);
    expect(SKILL).toMatch(/600000/);
    expect(SKILL).toMatch(/completion.*attention.*user input.*wake|wake.*completion.*attention.*user input/is);
    expect(SKILL).not.toMatch(/timeout of at most 60\s+seconds/i);
    expect(SKILL).toMatch(/do not.*re-?read.*unchanged timeout|unchanged timeout.*do not.*re-?read/is);
    expect(SKILL).toMatch(/rotate.*(batch|queue).*(timeout|cycle)|(timeout|cycle).*rotate.*(batch|queue)/is);
    expect(SKILL).toMatch(/report only.*change|delta/i);
    expect(SKILL).toMatch(/timeout.*not.*stalled|not.*stalled.*timeout/is);
  });

  it('pops up only real user decisions and routes the answer back', () => {
    expect(SKILL).toContain('request_user_input');
    expect(SKILL).toMatch(/decision|approval|choice/i);
    expect(SKILL).toContain('send_message_to_thread');
    expect(SKILL).toMatch(/answer.*owning task|owning task.*answer/is);
    expect(SKILL).toMatch(/status update.*not.*popup|do not.*popup.*status/is);
  });

  it('never takes over domain work in the control task', () => {
    expect(SKILL).toMatch(/do not.*take over|never.*take over/is);
    expect(SKILL).toMatch(/route.*owning task|owning task.*route/is);
    expect(SKILL).toMatch(/delivery.*fail.*unknown|unknown.*delivery.*fail/is);
  });

  it('separates progress gates and preserves authorization boundaries', () => {
    expect(SKILL).toMatch(/CI.*approval.*merge.*deploy.*production/is);
    expect(SKILL).toMatch(/pin|archive|rename/);
    expect(SKILL).toMatch(/explicit (authority|authorization|request)/i);
    expect(SKILL).toMatch(/one status (request|nudge).*cursor|cursor.*one status (request|nudge)/is);
  });

  it('defines terminal states for the continuous loop', () => {
    expect(SKILL).toMatch(/user stops|user asks.*stop/i);
    expect(SKILL).toMatch(/no managed (task|thread).*active|all managed (tasks|threads).*terminal/i);
    expect(SKILL).toMatch(/host.*interrupt|new user input/i);
  });

  it('stays distinct from retrospective search and PR babysitting', () => {
    expect(SKILL).toContain('vs-search-threads');
    expect(SKILL).toContain('vs-baby-sit');
    expect(SKILL).toMatch(/retrospective|historical/i);
    expect(SKILL).toMatch(/single PR|one PR/i);
  });
});
