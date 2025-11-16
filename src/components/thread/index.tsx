import { v4 as uuidv4 } from "uuid";
import React, {
  ReactNode,
  useEffect,
  useRef,
  useMemo,
  useState,
  FormEvent,
} from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStreamContext } from "@/providers/Stream";
import { Button } from "../ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import { LangGraphLogoSVG } from "../icons/langgraph";
import { TooltipIconButton } from "./tooltip-icon-button";
import {
  ArrowDown,
  LoaderCircle,
  PanelRightOpen,
  PanelRightClose,
  SquarePen,
  XIcon,
  Plus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { ProfileLogoSVG } from "../icons/profile";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useFileUpload } from "@/hooks/use-file-upload";
import { ContentBlocksPreview } from "./ContentBlocksPreview";
import { contentBlockToMessageContent } from "@/lib/multimodal-utils";
import {
  useArtifactOpen,
  ArtifactContent,
  ArtifactTitle,
  useArtifactContext,
} from "./artifact";
import { useThreads } from "@/providers/Thread";

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div
        ref={context.contentRef}
        className={props.contentClassName}
      >
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="h-4 w-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function ProfileAvatar({ gcpIapEmail }: { gcpIapEmail: string | null }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mr-4 flex items-center justify-center">
            <ProfileLogoSVG
              width="30"
              height="30"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{gcpIapEmail}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function extractNameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const namePart = email.split("@")[0];
  if (!namePart) return null;
  const firstName = namePart.split(".")[0];
  return firstName.toUpperCase();
}

function PersonalizedGreeting({ name }: { name: string | null }) {
  if (!name) return null;
  return (
    <div className="mb-4 rounded-lg p-4 text-center text-4xl font-extrabold bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400 bg-clip-text text-transparent">
      Hello, {name}
    </div>
  );
}

const sampleMessages = [
  "List all redis that are used by apiproxy",
  "List all maxmind databases used by apiproxy",
  "List all database hosts used in content-platform team",
  "Show me all configurations in monetization-middleware service",
  "List some unused resources in GCP for cost optimization",
  "Query GCP assets and list all GKE clusters that apiproxy are deployed in. And what are their version?",
  "List all affected resources by the email in this pdf/image <Upload PDF or Image>",
];

function SampleMessages({
  onSelectMessage,
}: {
  onSelectMessage: (message: string) => void;
}) {
  return (
    <div className="rounded-lg p-4">
      <h2 className="mb-2 font-semibold text-gray-800">Sample messages:</h2>
      <ul className="list-inside list-decimal text-gray-700">
        {sampleMessages.map((msg, i) => (
          <li
            key={i}
            className="cursor-pointer hover:underline"
            onClick={() => onSelectMessage(msg)}
          >
            {msg}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TemporaryChatToggle({
  isTemporary,
  onToggle,
}: {
  isTemporary: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="temporary-chat"
        checked={isTemporary}
        onCheckedChange={onToggle}
      />
      <Label
        htmlFor="temporary-chat"
        className="cursor-pointer text-sm text-gray-600"
      >
        Temporary Chat
      </Label>
    </div>
  );
}

export function Thread() {
  const {
    gcpIapUid,
    gcpIapEmail,
    isTemporaryMode,
    setIsTemporaryMode,
    isCurrentThreadTemporary,
  } = useThreads();
  const [artifactContext, setArtifactContext] = useArtifactContext();
  const [artifactOpen, closeArtifact] = useArtifactOpen();

  const [threadId, _setThreadId] = useQueryState("threadId");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );
  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    resetBlocks: _resetBlocks,
    dragOver,
    handlePaste,
  } = useFileUpload();
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const stream = useStreamContext();

  // Accumulate all AI/tool messages seen during streaming to prevent them from disappearing
  // The LangGraph SDK replaces messages in state as the agent moves through nodes,
  // but we want to show ALL intermediate messages from start to finish
  const [streamedMessages, setStreamedMessages] = useState<
    Map<string, Message>
  >(new Map());

  // Persist intermediate message groups across streaming sessions
  const [persistedIntermediateGroups, setPersistedIntermediateGroups] =
    useState<Map<string, Message[]>>(new Map());

  // Track the message count when streaming starts to identify messages from current turn
  const [streamingStartMessageCount, setStreamingStartMessageCount] = useState<
    number | null
  >(null);

  // Track which intermediate message sections are expanded
  const [expandedIntermediates, setExpandedIntermediates] = useState<
    Set<string>
  >(new Set());

  // Track when streaming starts/stops
  useEffect(() => {
    if (stream.isLoading && streamingStartMessageCount === null) {
      // Streaming just started - record the current message count
      // Messages before this point are from previous turns and should remain visible
      setStreamingStartMessageCount(stream.messages.length);
    } else if (!stream.isLoading && streamingStartMessageCount !== null) {
      // Streaming finished - reset the counter
      setStreamingStartMessageCount(null);
    }
  }, [stream.isLoading, streamingStartMessageCount, stream.messages.length]);

  // Persist intermediate groups when streaming completes
  useEffect(() => {
    if (!stream.isLoading && streamedMessages.size > 0) {
      // Streaming just finished - persist the intermediate groups
      const lastHumanIndex = stream.messages.findLastIndex(
        (msg) => msg.type === "human",
      );

      if (lastHumanIndex >= 0) {
        const humanMsg = stream.messages[lastHumanIndex];
        if (humanMsg.id) {
          // Collect intermediate messages from this streaming session
          // Exclude the final message (which is still in stream.messages)
          const currentMessageIds = new Set(stream.messages.map((m) => m.id));
          const intermediates = Array.from(streamedMessages.values()).filter(
            (msg) => !currentMessageIds.has(msg.id),
          );

          if (intermediates.length > 0) {
            const humanMsgId = humanMsg.id;
            setPersistedIntermediateGroups((prev) => {
              const updated = new Map(prev);
              updated.set(humanMsgId, intermediates);
              return updated;
            });
          }
        }
      }

      // Clear streamed messages after persisting
      setStreamedMessages(new Map());
    }
  }, [stream.isLoading, streamedMessages, stream.messages]);

  // Capture and accumulate all messages during streaming
  useEffect(() => {
    if (!stream.isLoading) {
      return;
    }

    // During streaming, capture all AI and tool messages
    stream.messages.forEach((msg) => {
      if (msg.id && (msg.type === "ai" || msg.type === "tool")) {
        setStreamedMessages((prev) => new Map(prev).set(msg.id!, msg));
      }
    });
  }, [stream.messages, stream.isLoading]);

  // Merge streamed messages with current messages and identify intermediate vs final messages
  const { messages, intermediateGroups } = useMemo(() => {
    const messageMap = new Map<string, Message>();
    const messageOrder: string[] = [];
    const intermediates = new Map<string, Message[]>(
      persistedIntermediateGroups,
    );
    const intermediateIds = new Set<string>();

    // Add all current messages from stream
    stream.messages.forEach((msg) => {
      if (msg.id) {
        messageMap.set(msg.id, msg);
        messageOrder.push(msg.id);
      }
    });

    // Mark existing persisted intermediate messages as intermediate
    persistedIntermediateGroups.forEach((msgs) => {
      msgs.forEach((msg) => {
        if (msg.id) {
          intermediateIds.add(msg.id);
        }
      });
    });

    // If we're streaming or have accumulated streamed messages, identify intermediates
    if (stream.isLoading || streamedMessages.size > 0) {
      const intermediateMessages: Message[] = [];

      // Add messages from streamedMessages that are no longer in current stream
      streamedMessages.forEach((msg, id) => {
        if (!messageMap.has(id)) {
          intermediateMessages.push(msg);
          intermediateIds.add(id);
        }
      });

      // During active streaming, treat only NEW AI/tool messages (from current turn) as intermediate
      // Messages that existed before streaming started should remain visible as final messages
      if (stream.isLoading && streamingStartMessageCount !== null) {
        stream.messages.forEach((msg, index) => {
          // Only treat messages added after streaming started as intermediate
          if (
            msg.id &&
            (msg.type === "ai" || msg.type === "tool") &&
            index >= streamingStartMessageCount
          ) {
            intermediateIds.add(msg.id);
            // Only add to intermediate messages if not already there
            if (!intermediateMessages.find((m) => m.id === msg.id)) {
              intermediateMessages.push(msg);
            }
          }
        });
      }

      // Group intermediate messages by the last human message
      if (intermediateMessages.length > 0) {
        const lastHumanIndex = messageOrder.findLastIndex((msgId) => {
          const m = messageMap.get(msgId);
          return m?.type === "human";
        });

        if (lastHumanIndex >= 0) {
          const humanMsgId = messageOrder[lastHumanIndex];
          intermediates.set(humanMsgId, intermediateMessages);
        }
      }
    }

    // Filter out intermediate messages from the main message flow
    const finalMessageOrder = messageOrder.filter(
      (id) => !intermediateIds.has(id),
    );

    return {
      messages: finalMessageOrder
        .map((id) => messageMap.get(id)!)
        .filter(Boolean),
      intermediateGroups: intermediates,
    };
  }, [
    stream.messages,
    streamedMessages,
    stream.isLoading,
    streamingStartMessageCount,
    persistedIntermediateGroups,
  ]);

  const isLoading = stream.isLoading;

  const lastError = useRef<string | undefined>(undefined);

  const setThreadId = (id: string | null) => {
    _setThreadId(id);

    // close artifact and reset artifact context
    closeArtifact();
    setArtifactContext({});

    // Clear accumulated streamed messages when switching threads
    setStreamedMessages(new Map());
    setPersistedIntermediateGroups(new Map());
    setExpandedIntermediates(new Set());
    setStreamingStartMessageCount(null);
  };

  useEffect(() => {
    if (threadId === null) {
      inputRef.current?.focus();
    }
  }, [threadId]);

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as any).message;
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      // no-op
    }
  }, [stream.error]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((input.trim().length === 0 && contentBlocks.length === 0) || isLoading)
      return;

    // Clear accumulated streamed messages from previous run
    setStreamedMessages(new Map());

    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
        ...contentBlocks.map(contentBlockToMessageContent),
      ] as Message["content"],
    };

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);

    const context =
      Object.keys(artifactContext).length > 0 ? artifactContext : undefined;

    const metadata: Record<string, string> = {};

    if (!threadId && gcpIapUid) {
      metadata.gcp_iap_uid = gcpIapUid;
    }

    if (!threadId && isTemporaryMode) {
      metadata.temporary = "true";
    }

    if (!threadId && input.trim().length > 0) {
      const title = input.trim().slice(0, 50);
      metadata.title = title;
    }

    stream.submit(
      { messages: [...toolMessages, newHumanMessage], context },
      {
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        streamMode: ["values"],
        streamSubgraphs: true,
        streamResumable: true,
        optimisticValues: (prev) => ({
          ...prev,
          context,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      },
    );

    setInput("");
    setContentBlocks([]);
  };

  const handleRegenerate = (
    parentCheckpoint: Checkpoint | null | undefined,
  ) => {
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      streamMode: ["values"],
      streamSubgraphs: true,
      streamResumable: true,
    });
  };

  const chatStarted = !!threadId || !!messages.length;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );

  const isTemporaryActive =
    isTemporaryMode || isCurrentThreadTemporary(threadId);

  const userName = useMemo(
    () => extractNameFromEmail(gcpIapEmail),
    [gcpIapEmail],
  );

  return (
    <div
      className={cn(
        "relative flex h-screen w-full overflow-hidden transition-colors duration-300",
        isTemporaryActive && !chatStarted ? "bg-gray-200" : "bg-white",
      )}
    >
      <div className="relative hidden lg:flex">
        <motion.div
          className="absolute z-20 h-full overflow-hidden border-r bg-white"
          style={{ width: 300 }}
          animate={
            isLargeScreen
              ? { x: chatHistoryOpen ? 0 : -300 }
              : { x: chatHistoryOpen ? 0 : -300 }
          }
          initial={{ x: -300 }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          <div
            className="relative h-full"
            style={{ width: 300 }}
          >
            <ThreadHistory
              setThreadId={setThreadId}
              chatStarted={chatStarted}
            />
          </div>
        </motion.div>
      </div>

      <div
        className={cn(
          "grid w-full grid-cols-[1fr_0fr] transition-all duration-500",
          artifactOpen && "grid-cols-[3fr_2fr]",
        )}
      >
        <motion.div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden",
            !chatStarted && "grid-rows-[1fr]",
          )}
          layout={isLargeScreen}
          animate={{
            marginLeft: chatHistoryOpen ? (isLargeScreen ? 300 : 0) : 0,
            width: chatHistoryOpen
              ? isLargeScreen
                ? "calc(100% - 300px)"
                : "100%"
              : "100%",
          }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          {!chatStarted && (
            <div className="absolute top-0 left-0 z-10 flex w-full items-center justify-between gap-3 p-2 pl-4">
              <div>
                {(!chatHistoryOpen || !isLargeScreen) && (
                  <Button
                    className="hover:bg-gray-100"
                    variant="ghost"
                    onClick={() => setChatHistoryOpen((p) => !p)}
                  >
                    {chatHistoryOpen ? (
                      <PanelRightOpen className="size-5" />
                    ) : (
                      <PanelRightClose className="size-5" />
                    )}
                  </Button>
                )}
              </div>
              <div className="absolute top-2 right-4 flex items-center gap-8">
                {(!threadId || isCurrentThreadTemporary(threadId)) && (
                  <TemporaryChatToggle
                    isTemporary={threadId ? true : isTemporaryMode}
                    onToggle={
                      threadId
                        ? () => {}
                        : () => setIsTemporaryMode((prev) => !prev)
                    }
                  />
                )}
                <ProfileAvatar gcpIapEmail={gcpIapEmail} />
              </div>
            </div>
          )}
          {chatStarted && (
            <div
              className={cn(
                "relative z-10 flex items-center justify-between gap-3 p-2",
                isTemporaryActive && chatStarted
                  ? "to-gray-0 bg-gradient-to-b from-gray-300 via-gray-200"
                  : "bg-white",
              )}
            >
              <div className="relative flex items-center justify-start gap-2">
                <div className="absolute left-0 z-10 ml-2 flex flex-col gap-2 pt-9">
                  {(!chatHistoryOpen || !isLargeScreen) && (
                    <Button
                      className="my-2 hover:bg-gray-100"
                      variant="ghost"
                      onClick={() => setChatHistoryOpen((p) => !p)}
                    >
                      {chatHistoryOpen ? (
                        <PanelRightOpen className="size-5" />
                      ) : (
                        <PanelRightClose className="size-5" />
                      )}
                    </Button>
                  )}
                  {!chatHistoryOpen && (
                    <TooltipIconButton
                      size="lg"
                      className="ml-1.5"
                      tooltip="New chat"
                      variant="ghost"
                      onClick={() => {
                        if (threadId) {
                          setIsTemporaryMode(false);
                        }
                        setThreadId(null);
                      }}
                    >
                      <SquarePen className="size-5" />
                    </TooltipIconButton>
                  )}
                </div>
                <motion.button
                  className="flex cursor-pointer items-center gap-2"
                  onClick={() => {
                    if (threadId) {
                      setIsTemporaryMode(false);
                    }
                    setThreadId(null);
                  }}
                  animate={{
                    marginLeft: !chatHistoryOpen ? 56 : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <LangGraphLogoSVG
                    width={32}
                    height={32}
                  />
                  <span className="text-xl font-semibold tracking-tight">
                    OpsGPT
                  </span>
                </motion.button>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-8">
                  {isCurrentThreadTemporary(threadId) && (
                    <TemporaryChatToggle
                      isTemporary={true}
                      onToggle={() => {}}
                    />
                  )}
                  <ProfileAvatar gcpIapEmail={gcpIapEmail} />
                </div>
              </div>

              <div className="from-background to-background/0 absolute inset-x-0 top-full h-5 bg-gradient-to-b" />
            </div>
          )}

          <StickToBottom className="relative flex-1 overflow-hidden">
            <StickyToBottomContent
              className={cn(
                "absolute inset-0 overflow-y-scroll px-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent",
                !chatStarted && "flex flex-col items-stretch justify-center",
                chatStarted && "grid grid-rows-[1fr_auto]",
              )}
              contentClassName="pt-8 pb-16  max-w-3xl mx-auto flex flex-col gap-4 w-full"
              content={
                <>
                  {messages
                    .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
                    .map((message, index) => {
                      if (message.type === "human") {
                        // Render human message
                        const humanMsg = (
                          <HumanMessage
                            key={message.id || `${message.type}-${index}`}
                            message={message}
                            isLoading={isLoading}
                          />
                        );

                        // Check if there are intermediate messages for this human message
                        const intermediates = message.id
                          ? intermediateGroups.get(message.id)
                          : undefined;

                        if (intermediates && intermediates.length > 0) {
                          const groupKey = message.id || `group-${index}`;
                          const isExpanded =
                            expandedIntermediates.has(groupKey);

                          return (
                            <React.Fragment
                              key={message.id || `${message.type}-${index}`}
                            >
                              {humanMsg}
                              {/* Collapsible intermediate messages section */}
                              <div className="ml-4 border-l-2 border-gray-200 pl-4">
                                <button
                                  onClick={() => {
                                    setExpandedIntermediates((prev) => {
                                      const next = new Set(prev);
                                      if (isExpanded) {
                                        next.delete(groupKey);
                                      } else {
                                        next.add(groupKey);
                                      }
                                      return next;
                                    });
                                  }}
                                  className="mb-2 flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <span
                                    className={cn(
                                      "font-medium",
                                      isLoading &&
                                        !isExpanded &&
                                        "animate-[shimmer_2s_linear_infinite] bg-gradient-to-r from-gray-500 via-blue-500 to-gray-500 bg-[length:200%_100%] bg-clip-text text-transparent",
                                    )}
                                  >
                                    {isExpanded ? "Hide" : "Show"} thinking
                                    process ({intermediates.length} steps)
                                  </span>
                                </button>

                                {isExpanded && (
                                  <div className="flex flex-col gap-2 text-sm">
                                    {intermediates.map((intMsg, intIndex) => (
                                      <div
                                        key={intMsg.id || `int-${intIndex}`}
                                        className="opacity-70"
                                      >
                                        <AssistantMessage
                                          message={intMsg}
                                          isLoading={false}
                                          handleRegenerate={handleRegenerate}
                                          isIntermediate={true}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </React.Fragment>
                          );
                        }

                        return humanMsg;
                      } else {
                        // Render AI/tool message (final message, not intermediate)
                        return (
                          <AssistantMessage
                            key={message.id || `${message.type}-${index}`}
                            message={message}
                            isLoading={isLoading}
                            handleRegenerate={handleRegenerate}
                          />
                        );
                      }
                    })}
                  {/* Special rendering case where there are no AI/tool messages, but there is an interrupt.
                    We need to render it outside of the messages list, since there are no messages to render */}
                  {hasNoAIOrToolMessages && !!stream.interrupt && (
                    <AssistantMessage
                      key="interrupt-msg"
                      message={undefined}
                      isLoading={isLoading}
                      handleRegenerate={handleRegenerate}
                    />
                  )}
                  {isLoading && <AssistantMessageLoading />}
                </>
              }
              footer={
                <div
                  className={cn(
                    "flex w-full flex-col items-center gap-8 transition-colors duration-300",
                    chatStarted && "sticky bottom-0",
                  )}
                >
                  {!chatStarted && (
                    <div className="flex flex-col items-center gap-3">
                      <PersonalizedGreeting name={userName} />
                      <div className="flex items-center gap-3">
                        <LangGraphLogoSVG className="h-8 flex-shrink-0" />
                        <h1 className="text-2xl font-semibold tracking-tight">
                          OpsGPT
                        </h1>
                      </div>
                    </div>
                  )}

                  <ScrollToBottom className="animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 mb-4 -translate-x-1/2" />

                  <div
                    ref={dropRef}
                    className={cn(
                      "bg-muted relative z-10 mx-auto mb-8 w-full max-w-3xl rounded-2xl shadow-xs transition-all duration-300",
                      dragOver
                        ? "border-primary border-2 border-dotted"
                        : "border border-solid",
                    )}
                  >
                    <form
                      onSubmit={handleSubmit}
                      className="mx-auto grid max-w-3xl grid-rows-[1fr_auto] gap-2"
                    >
                      <ContentBlocksPreview
                        blocks={contentBlocks}
                        onRemove={removeBlock}
                      />
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            !e.shiftKey &&
                            !e.metaKey &&
                            !e.nativeEvent.isComposing
                          ) {
                            e.preventDefault();
                            const el = e.target as HTMLElement | undefined;
                            const form = el?.closest("form");
                            form?.requestSubmit();
                          }
                        }}
                        placeholder="Type your message..."
                        className="resize-none border-none bg-transparent p-3.5 pb-0 shadow-none ring-0 transition-colors duration-300 outline-none focus:ring-0 focus:outline-none"
                        autoFocus
                      />

                      <div className="flex items-center gap-6 p-2 pt-4">
                        <div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="render-tool-calls"
                              checked={hideToolCalls ?? false}
                              onCheckedChange={setHideToolCalls}
                            />
                            <Label
                              htmlFor="render-tool-calls"
                              className="text-sm text-gray-600"
                            >
                              Hide Tool Calls
                            </Label>
                          </div>
                        </div>
                        <Label
                          htmlFor="file-input"
                          className="flex cursor-pointer items-center gap-2"
                        >
                          <Plus className="size-5 text-gray-600" />
                          <span className="text-sm text-gray-600">
                            Upload PDF or Image
                          </span>
                        </Label>
                        <input
                          id="file-input"
                          type="file"
                          onChange={handleFileUpload}
                          multiple
                          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                          className="hidden"
                        />
                        {stream.isLoading ? (
                          <Button
                            key="stop"
                            onClick={() => stream.stop()}
                            className="ml-auto"
                          >
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Cancel
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            className="ml-auto shadow-md transition-all"
                            disabled={
                              isLoading ||
                              (!input.trim() && contentBlocks.length === 0)
                            }
                          >
                            Send
                          </Button>
                        )}
                      </div>
                    </form>
                  </div>
                  {!chatStarted && (
                    <SampleMessages onSelectMessage={setInput} />
                  )}
                </div>
              }
            />
          </StickToBottom>
        </motion.div>
        <div className="relative flex flex-col border-l">
          <div className="absolute inset-0 flex min-w-[30vw] flex-col">
            <div className="grid grid-cols-[1fr_auto] border-b p-4">
              <ArtifactTitle className="truncate overflow-hidden" />
              <button
                onClick={closeArtifact}
                className="cursor-pointer"
              >
                <XIcon className="size-5" />
              </button>
            </div>
            <ArtifactContent className="relative flex-grow" />
          </div>
        </div>
      </div>
    </div>
  );
}
