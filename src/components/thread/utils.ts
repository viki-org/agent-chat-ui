import type { Message } from "@langchain/langgraph-sdk";

/**
 * Extracts a string summary from a message's content, supporting multimodal (text, image, file, etc.).
 * - If text is present, returns the joined text.
 * - If not, returns a label for the first non-text modality (e.g., 'Image', 'Other').
 * - If unknown, returns 'Multimodal message'.
 */
export function getContentString(content: Message["content"]): string {
  if (typeof content === "string") return content;
  const texts = content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text);
  return texts.join(" ");
}

/**
 * Extracts the thinking or recommendation field from a LangGraph message object.
 * Checks multiple locations where structured output might be stored:
 * 1. message.tool_calls[].args.thinking or recommendation
 * 2. message.additional_kwargs.thinking or recommendation
 * 3. message.additional_kwargs.tool_calls[].function.arguments (JSON parsed)
 * 4. message.content (JSON parsed as fallback)
 *
 * Priority: thinking > recommendation
 */
export function extractThinkingFromMessage(message: any): string | null {
  if (!message) return null;

  // Check tool_calls array for thinking/recommendation in args
  if (message.tool_calls && Array.isArray(message.tool_calls)) {
    for (const toolCall of message.tool_calls) {
      if (toolCall.args?.thinking) {
        return toolCall.args.thinking;
      }
      if (toolCall.args?.recommendation) {
        return toolCall.args.recommendation;
      }
    }
  }

  // Check additional_kwargs for thinking/recommendation
  if (message.additional_kwargs?.thinking) {
    return message.additional_kwargs.thinking;
  }
  if (message.additional_kwargs?.recommendation) {
    return message.additional_kwargs.recommendation;
  }

  // Check additional_kwargs.tool_calls (different structure)
  if (
    message.additional_kwargs?.tool_calls &&
    Array.isArray(message.additional_kwargs.tool_calls)
  ) {
    for (const toolCall of message.additional_kwargs.tool_calls) {
      if (toolCall.function?.arguments) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          if (args.thinking) {
            return args.thinking;
          }
          if (args.recommendation) {
            return args.recommendation;
          }
        } catch {
          // Not valid JSON or no thinking/recommendation field
        }
      }
    }
  }

  // Fallback: try parsing content as JSON
  if (typeof message.content === "string") {
    try {
      const parsed = JSON.parse(message.content);
      if (parsed.thinking) {
        return parsed.thinking;
      }
      if (parsed.recommendation) {
        return parsed.recommendation;
      }
    } catch {
      // Not JSON, ignore
    }
  }

  return null;
}

/**
 * Extracts the 'thinking' field from structured LLM responses (if present).
 * This is used to display concise summaries in intermediate messages.
 * @param content The message content
 * @returns The thinking text if found, or null
 * @deprecated Use extractThinkingFromMessage instead
 */
export function extractThinkingFromContent(
  content: Message["content"],
): string | null {
  const contentString = getContentString(content);
  if (!contentString) return null;

  try {
    // Try to parse as JSON
    const parsed = JSON.parse(contentString);
    if (parsed && typeof parsed === "object" && "thinking" in parsed) {
      return parsed.thinking;
    }
  } catch {
    // Not valid JSON, might be partial JSON or plain text
    // Try to extract thinking field using regex as fallback
    const thinkingMatch = contentString.match(/"thinking":\s*"([^"]*)"/);
    if (thinkingMatch && thinkingMatch[1]) {
      return thinkingMatch[1];
    }
  }

  return null;
}
