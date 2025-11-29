import { AIMessage, ToolMessage } from "@langchain/langgraph-sdk";
import { useState, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MarkdownText } from "../markdown-text";

function isComplexValue(value: any): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

export function ToolCalls({
  toolCalls,
}: {
  toolCalls: AIMessage["tool_calls"];
}) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mx-auto grid w-full gap-2">
      {toolCalls.map((tc, idx) => {
        const { thinking, ...args } = tc.args as Record<string, any>;
        const hasArgs = Object.keys(args).length > 0;
        return (
          <div
            key={idx}
            className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="dark:bg-muted/50 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-gray-50">
                Tool Call:{" "}
                <code className="dark:bg-muted rounded bg-gray-100 px-2 py-1">
                  {tc.name}
                </code>
                {/* {tc.id && (
                  <code className="ml-2 rounded bg-gray-100 px-2 py-1 text-sm">
                    {tc.id}
                  </code>
                )} */}
              </h3>
            </div>
            {hasArgs ? (
              <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 p-4">
                {Object.entries(args).map(([key, value], argIdx) => (
                  <Fragment key={argIdx}>
                    {argIdx > 0 && (
                      <div className="col-span-2 border-t border-gray-200 dark:border-gray-700" />
                    )}
                    <div className="text-sm font-medium whitespace-nowrap text-gray-900 dark:text-gray-50">
                      {key}
                    </div>
                    <div className="min-w-0 text-sm text-gray-700 dark:text-gray-200">
                      {key === "query" && typeof value === "string" ? (
                        <div className="prose prose-sm max-w-none overflow-x-auto">
                          <MarkdownText>{`\`\`\`sql\n${value}\n\`\`\``}</MarkdownText>
                        </div>
                      ) : isComplexValue(value) ? (
                        <code className="bg-gray-5 dark:bg-muted/30 rounded px-2 py-1 font-mono text-sm break-all">
                          {JSON.stringify(value, null, 2)}
                        </code>
                      ) : (
                        String(value)
                      )}
                    </div>
                  </Fragment>
                ))}
              </div>
            ) : (
              <code className="block p-3 text-sm">{"{}"}</code>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ToolResult({ message }: { message: ToolMessage }) {
  const [isExpanded, setIsExpanded] = useState(false);

  let parsedContent: any;
  let isJsonContent = false;

  try {
    if (typeof message.content === "string") {
      parsedContent = JSON.parse(message.content);
      isJsonContent = isComplexValue(parsedContent);
    }
  } catch {
    // Content is not JSON, use as is
    parsedContent = message.content;
  }

  const contentStr = isJsonContent
    ? JSON.stringify(parsedContent, null, 2)
    : String(message.content);
  const contentLines = contentStr.split("\n");
  const shouldTruncate = contentLines.length > 4 || contentStr.length > 500;
  const displayedContent =
    shouldTruncate && !isExpanded
      ? contentStr.length > 500
        ? contentStr.slice(0, 500) + "..."
        : contentLines.slice(0, 4).join("\n") + "\n..."
      : contentStr;

  return (
    <div className="mx-auto grid w-full gap-2">
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="dark:bg-muted/50 border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {message.name ? (
              <h3 className="font-medium text-gray-900 dark:text-gray-50">
                Tool Result:{" "}
                <code className="dark:bg-muted rounded bg-gray-100 px-2 py-1">
                  {message.name}
                </code>
              </h3>
            ) : (
              <h3 className="font-medium text-gray-900 dark:text-gray-50">
                Tool Result
              </h3>
            )}
            {/* {message.tool_call_id && (
              <code className="ml-2 rounded bg-gray-100 px-2 py-1 text-sm">
                {message.tool_call_id}
              </code>
            )} */}
          </div>
        </div>
        <motion.div
          className="dark:bg-muted/20 min-w-full bg-gray-100 text-gray-500 dark:text-gray-400"
          initial={false}
          animate={{ height: "auto" }}
          transition={{ duration: 0.3 }}
        >
          <div className="p-3">
            <AnimatePresence
              mode="wait"
              initial={false}
            >
              <motion.div
                key={isExpanded ? "expanded" : "collapsed"}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                {isJsonContent ? (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {(Array.isArray(parsedContent)
                        ? isExpanded
                          ? parsedContent
                          : parsedContent.slice(0, 5)
                        : Object.entries(parsedContent)
                      ).map((item, argIdx) => {
                        const [key, value] = Array.isArray(parsedContent)
                          ? [argIdx, item]
                          : [item[0], item[1]];
                        return (
                          <tr key={argIdx}>
                            <td className="px-4 py-2 text-sm font-medium whitespace-nowrap text-gray-900 dark:text-gray-50">
                              {key}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                              {isComplexValue(value) ? (
                                <code className="dark:bg-muted/30 rounded bg-gray-50 px-2 py-1 font-mono text-sm break-all">
                                  {JSON.stringify(value, null, 2)}
                                </code>
                              ) : (
                                String(value)
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <code className="block text-sm">
                    {displayedContent || (
                      <span className="pl-2 text-gray-500 dark:text-gray-400 italic">
                        Empty result
                      </span>
                    )}
                  </code>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          {((shouldTruncate && !isJsonContent) ||
            (isJsonContent &&
              Array.isArray(parsedContent) &&
              parsedContent.length > 5)) && (
            <motion.button
              onClick={() => setIsExpanded(!isExpanded)}
              className="dark:hover:bg-muted/50 flex w-full cursor-pointer items-center justify-center border-t-[1px] border-gray-200 py-2 text-gray-500 transition-all duration-200 ease-in-out hover:bg-gray-50 hover:text-gray-600 dark:border-gray-700 dark:text-gray-300 dark:hover:text-gray-200"
              initial={{ scale: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isExpanded ? <ChevronUp /> : <ChevronDown />}
            </motion.button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
