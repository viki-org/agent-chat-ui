import { Message } from "@langchain/langgraph-sdk";

export function calculateAggregatedUsage(messages: Message[]) {
  let currentInput = 0;
  let currentOutput = 0;
  let currentTotal = 0;
  let currentCacheRead = 0;
  let currentReasoning = 0;
  let foundUsage = false;

  for (const m of messages) {
    if (m.type === "ai") {
      const usage = (m as any).usage_metadata;
      if (usage) {
        foundUsage = true;
        currentInput += usage.input_tokens || 0;
        currentOutput += usage.output_tokens || 0;
        currentTotal += usage.total_tokens || 0;
        currentCacheRead += usage.input_token_details?.cache_read || 0;
        currentReasoning += usage.output_token_details?.reasoning || 0;
      }
    }
  }

  if (foundUsage) {
    return {
      input_tokens: currentInput,
      output_tokens: currentOutput,
      total_tokens: currentTotal,
      input_token_details: { cache_read: currentCacheRead },
      output_token_details: { reasoning: currentReasoning },
    };
  }
  return null;
}
