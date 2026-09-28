# Changelog

> For the complete documentation index, see [llms.txt](/llms.txt). Markdown versions of documentation pages are available by appending `.md` to the page URL.

> The latest features and updates to the OpenAI API.

Upcoming deprecations are listed on the [deprecations page](/api/docs/deprecations).

## September, 2026

### Sep 25

Fix · Model: gpt-6-sol · Model: gpt-6-luna

Fixed a bug in image encoding that degraded image understanding in [GPT-6 Sol](https://developers.openai.com/api/docs/models/gpt-6-sol) and [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna). This update improves results on visual tasks in the API and Codex, including computer use.

If your use cases involve image inputs, we recommend rerunning your evaluations and retrying workflows affected by the issue.

### Sep 22

Feature · Model: gpt-6-sol · Model: gpt-6-luna · API: v1/responses · API: v1/chat/completions

Released [GPT-6 Sol](https://developers.openai.com/api/docs/models/gpt-6-sol) (`gpt-6-sol`) and [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna) (`gpt-6-luna`).

These reasoning models accept text and image inputs and generate text through the Responses and Chat Completions APIs.

Standard pricing per 1M tokens for prompts with up to 272K input tokens:

- GPT-6 Sol: $2 input, $0.20 cached input, and $10 output.
- GPT-6 Luna: $0.10 input, $0.01 cached input, and $0.50 output.

Compare capabilities in the [model catalog](https://developers.openai.com/api/docs/models), and see [pricing](https://developers.openai.com/api/docs/pricing) for cache writes, longer prompts, and other processing tiers.

### Sep 15

Feature

Added API key creation governance controls at the organization and project levels. Administrators can allow only service-account keys, allow only user-owned project keys, or disable all new API key creation. Organization restrictions take precedence over project settings, and existing API keys are unaffected. See [production best practices](https://developers.openai.com/api/docs/guides/production-best-practices#api-keys) for details.

### Sep 10

Feature

You can now set expiration dates when creating project API keys. Administrators can also enforce a maximum key lifetime at the organization or project level in Platform settings, requiring newly created keys to expire within the configured limit. See [production best practices](https://developers.openai.com/api/docs/guides/production-best-practices#api-keys) for guidance on key expiration and rotation.

### Sep 10

Feature

Released the [Agents API](https://developers.openai.com/api/docs/guides/agents-api/overview) in public beta. Build agents with a managed Codex harness while OpenAI handles session orchestration, context compaction, and recovery.

Use durable sessions to continue work across turns, stream progress, and connect your own tools and MCP servers. Run agents in OpenAI-hosted sandboxes or connect a sandbox from your own infrastructure or a supported provider.

Start with the [Agents API quickstart](https://developers.openai.com/api/docs/guides/agents-api/quickstart).

### Sep 10

Feature · Model: gpt-live-1 · API: v1/live/sessions

[GPT-Live 1](https://developers.openai.com/api/docs/models/gpt-live-1) is now generally available in the API. Build full-duplex voice conversations that can continue while a backend model or agent handles reasoning and tools.

Use Responses delegation with an OpenAI model, or client delegation to connect your own backend. Voice sessions cost $0.05 per minute, billed per second; backend model and tool usage is charged separately.

Start with [GPT-Live](https://developers.openai.com/api/docs/guides/live), [prompting](https://developers.openai.com/api/docs/guides/live-prompting), and [migration guidance](https://developers.openai.com/api/docs/guides/live-migration). See [pricing](https://developers.openai.com/api/docs/pricing) for details.

