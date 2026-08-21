import {
  createAgent as createPathgradeAgent,
  type AgentName,
  type AgentOptions,
} from '@wix/pathgrade';

export const DEFAULT_PATHGRADE_AGENT: AgentName = 'codex';
export const DEFAULT_PATHGRADE_CODEX_MODEL = 'gpt-5.6-luna';

export function resolvePathgradeAgentOptions(
  options: AgentOptions,
  env: NodeJS.ProcessEnv = process.env,
): AgentOptions {
  const agent = options.agent ??
    (env.PATHGRADE_AGENT as AgentName | undefined) ??
    DEFAULT_PATHGRADE_AGENT;

  return {
    ...options,
    agent,
    ...(agent === 'codex' && options.model === undefined
      ? {
          model:
            env.PATHGRADE_CODEX_MODEL ?? DEFAULT_PATHGRADE_CODEX_MODEL,
        }
      : {}),
  };
}

export function createAgent(options: AgentOptions) {
  return createPathgradeAgent(resolvePathgradeAgentOptions(options));
}
