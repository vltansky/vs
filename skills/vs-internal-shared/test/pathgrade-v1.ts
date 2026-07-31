import type {
  Agent,
  AskUserQuestion,
  ConverseOptions,
  Reaction,
} from '@wix/pathgrade';

type TextReactionInput = {
  when: RegExp;
  unless?: RegExp;
  reply: string;
  once?: boolean;
};

type ToolEventLike = {
  action: string;
  summary?: string;
  arguments?: unknown;
};

/** Prefer a recommended/default option label when the host offers a ballot. */
export function answerPreferredOption(question: AskUserQuestion): string {
  if (question.options?.length) {
    const recommended = question.options.find(
      (option) =>
        /recommend|default/i.test(option.label) ||
        /recommend|default/i.test(option.description ?? ''),
    );
    return (recommended ?? question.options[0]).label;
  }
  return 'Keep going with your recommendation.';
}

/** Catch-all so unmatched AskUserQuestion / request_user_input batches resolve. */
export const CATCH_ALL_ASK_USER: Reaction = {
  whenAsked: () => true,
  answer: answerPreferredOption,
};

export const CONVERSE_ASK_USER_DEFAULTS: Pick<
  ConverseOptions,
  'onUnmatchedAskUser' | 'askUserTimeoutMs'
> = {
  onUnmatchedAskUser: 'first-option',
  askUserTimeoutMs: 30_000,
};

/**
 * Keep TextReactions for Markdown ballots, add matching AskUserReactions for
 * structured questions, and finish with a catch-all.
 */
export function withAskUserSupport(
  textReactions: TextReactionInput[],
): Reaction[] {
  const askUser: Reaction[] = textReactions.map((reaction) => ({
    whenAsked: reaction.when,
    answer: reaction.reply,
    ...(reaction.once !== undefined ? { once: reaction.once } : {}),
  }));
  return [...askUser, ...textReactions, CATCH_ALL_ASK_USER];
}

/**
 * One model turn that answers structured questions instead of stalling on the
 * PathGrade ask-bus (agent.prompt() has no reaction / onUnmatchedAskUser path).
 */
export async function promptOnce(
  agent: Agent,
  firstMessage: string,
  extras: Partial<ConverseOptions> = {},
) {
  const { reactions, ...rest } = extras;
  return agent.runConversation({
    firstMessage,
    maxTurns: 1,
    reactions: reactions ?? [CATCH_ALL_ASK_USER],
    ...CONVERSE_ASK_USER_DEFAULTS,
    ...rest,
  });
}

/**
 * For evals that only need the ask_user tool event recorded. AskUserQuestion
 * ends the one-shot prompt with bus_rejection / non-zero exit after the tool
 * call is already in the log.
 */
export async function promptAllowingAskUserInterrupt(
  agent: Agent,
  message: string,
) {
  try {
    await agent.prompt(message);
  } catch {
    // Intentionally swallow — scorers read toolEvents / transcript next.
  }
}

export function askUserHaystack(toolEvents: ToolEventLike[]): string {
  return toolEvents
    .filter((event) => event.action === 'ask_user')
    .map(
      (event) =>
        `${event.summary ?? ''} ${JSON.stringify(event.arguments ?? {})}`,
    )
    .join('\n');
}

export function hasAskUserEvent(
  toolEvents: ToolEventLike[],
  pattern?: RegExp,
): boolean {
  return toolEvents.some((event) => {
    if (event.action !== 'ask_user') return false;
    if (!pattern) return true;
    const haystack = `${event.summary ?? ''} ${JSON.stringify(event.arguments ?? {})}`;
    return pattern.test(haystack);
  });
}

/** True when the agent asked via AskUserQuestion or a Markdown fallback. */
export function askedClarifyingQuestion(ctx: {
  transcript: string;
  toolEvents: ToolEventLike[];
}): boolean {
  if (hasAskUserEvent(ctx.toolEvents)) return true;
  const early = ctx.transcript.slice(0, 2_000);
  return (
    /\?/.test(early) &&
    /clarif|which|what|how|should we|do you|need to know|before (?:i|we)/i.test(
      early,
    )
  );
}
