import z from "@deepseek-ai/schemastery";

const CONVERSATION_SETTINGS_NAMESPACE = "ui-conversation";
const BUSY_ENTER_FIELD = "busyEnter";
const BUSY_ENTER_BEHAVIORS = ["queue", "steer"];
const DEFAULT_BUSY_ENTER_BEHAVIOR = "queue";
const SHOW_INTERMEDIATE_TOKENS_FIELD = "showIntermediateTokens";

const ConversationSettingsSchema = z.object({
  [BUSY_ENTER_FIELD]: z.union([...BUSY_ENTER_BEHAVIORS]).default(DEFAULT_BUSY_ENTER_BEHAVIOR),
  [SHOW_INTERMEDIATE_TOKENS_FIELD]: z.boolean().default(true)
});

function apply(ctx) {
  ctx.inject(["settings"], (settingsCtx) => {
    settingsCtx.settings.register(
      CONVERSATION_SETTINGS_NAMESPACE,
      ConversationSettingsSchema
    );
  });
}

export {
  BUSY_ENTER_BEHAVIORS,
  BUSY_ENTER_FIELD,
  SHOW_INTERMEDIATE_TOKENS_FIELD,
  CONVERSATION_SETTINGS_NAMESPACE,
  DEFAULT_BUSY_ENTER_BEHAVIOR,
  ConversationSettingsSchema,
  apply
};
