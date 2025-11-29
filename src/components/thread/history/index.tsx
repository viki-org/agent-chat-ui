import { Button } from "@/components/ui/button";
import { useThreads } from "@/providers/Thread";
import { Thread } from "@langchain/langgraph-sdk";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

import { getContentString } from "../utils";
import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PanelRightOpen,
  PanelRightClose,
  SquarePen,
  MoreHorizontal,
  Share,
  Trash2,
  LoaderCircle,
  Copy,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

function ThreadHistoryItemActions({
  threadId,
  onDelete,
  onDuplicate,
  isOpen,
  setIsOpen,
  isDeleting,
  isDuplicating,
}: {
  threadId: string;
  onDelete: (threadId: string) => void;
  onDuplicate: (threadId: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isDeleting: boolean;
  isDuplicating: boolean;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("threadId", threadId);
    navigator.clipboard.writeText(currentUrl.toString());
    toast.success("Shareable URL copied to clipboard");
    setIsOpen(false);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate(threadId);
    setIsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(threadId);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, popoverRef, setIsOpen]);

  return (
    <div
      ref={popoverRef}
      className="absolute top-1/2 right-2 -translate-y-1/2"
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {isOpen && (
        <div className="bg-popover text-popover-foreground ring-opacity-5 absolute right-0 z-10 mt-2 w-36 rounded-md p-1 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
          <button
            onClick={handleShare}
            className="hover:bg-accent hover:text-accent-foreground flex w-full items-center rounded-sm px-3 py-2 text-sm"
          >
            <Share className="mr-3 h-4 w-4" />
            <span>Share</span>
          </button>
          <button
            onClick={handleDuplicate}
            disabled={isDuplicating}
            className="hover:bg-accent hover:text-accent-foreground flex w-full items-center rounded-sm px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDuplicating ? (
              <LoaderCircle className="mr-3 h-4 w-4 animate-spin" />
            ) : (
              <Copy className="mr-3 h-4 w-4" />
            )}
            <span>{isDuplicating ? "Duplicating..." : "Duplicate"}</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive-foreground flex w-full items-center rounded-sm px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? (
              <LoaderCircle className="mr-3 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-3 h-4 w-4" />
            )}
            <span>{isDeleting ? "Deleting..." : "Delete"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function ThreadList({
  threads,
  onThreadClick,
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const {
    deleteThread,
    deletingThreadIds,
    duplicateThread,
    duplicatingThreadIds,
    setIsTemporaryMode,
  } = useThreads();
  const [openPopupId, setOpenPopupId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    deleteThread(id);
    if (threadId === id) {
      setIsTemporaryMode(false);
      setThreadId(null);
    }
  };

  const handleDuplicate = (id: string) => {
    duplicateThread(id);
  };

  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {threads.map((t) => {
        let itemText = t.thread_id;

        // First, try to use title from metadata
        if (
          t.metadata &&
          typeof t.metadata === "object" &&
          "title" in t.metadata &&
          typeof t.metadata.title === "string"
        ) {
          itemText = t.metadata.title;
        } else if (
          typeof t.values === "object" &&
          t.values &&
          "messages" in t.values &&
          Array.isArray(t.values.messages) &&
          t.values.messages?.length > 0
        ) {
          // Fallback to first message content if no title metadata
          const firstMessage = t.values.messages[0];
          itemText = getContentString(firstMessage.content);
        }

        const isPopupOpen = openPopupId === t.thread_id;
        const isAnotherPopupOpen = openPopupId !== null && !isPopupOpen;
        const isDeleting = deletingThreadIds.has(t.thread_id);
        const isDuplicating = duplicatingThreadIds.has(t.thread_id);
        return (
          <div
            key={t.thread_id}
            className={cn(
              "group relative w-full px-1",
              isPopupOpen && "z-20",
              isAnotherPopupOpen && "pointer-events-none opacity-50",
              isDeleting && "opacity-75",
            )}
          >
            <Button
              variant="ghost"
              disabled={isDeleting || isDuplicating}
              className={cn(
                "w-full items-start justify-start pr-8 text-left font-normal disabled:opacity-75",
                t.thread_id === threadId && "bg-accent dark:bg-gray-700",
              )}
              onClick={(e) => {
                e.preventDefault();
                onThreadClick?.(t.thread_id);
                if (t.thread_id === threadId) return;
                setIsTemporaryMode(false);
                setThreadId(t.thread_id);
              }}
            >
              <p className="truncate text-ellipsis">{itemText}</p>
              {isDeleting && (
                <LoaderCircle className="ml-2 h-4 w-4 flex-shrink-0 animate-spin" />
              )}
              {isDuplicating && (
                <LoaderCircle className="ml-2 h-4 w-4 flex-shrink-0 animate-spin" />
              )}
            </Button>
            <ThreadHistoryItemActions
              threadId={t.thread_id}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              isOpen={isPopupOpen}
              isDeleting={isDeleting}
              isDuplicating={isDuplicating}
              setIsOpen={(isOpen) => {
                setOpenPopupId(isOpen ? t.thread_id : null);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {Array.from({ length: 30 }).map((_, i) => (
        <Skeleton
          key={`skeleton-${i}`}
          className="h-10 w-[280px]"
        />
      ))}
    </div>
  );
}

export default function ThreadHistory({
  setThreadId,
  chatStarted,
}: {
  setThreadId: (id: string | null) => void;
  chatStarted: boolean;
}) {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );

  const {
    getThreads,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
    setIsTemporaryMode,
  } = useThreads();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch(console.error)
      .finally(() => setThreadsLoading(false));
  }, [getThreads, setThreads, setThreadsLoading]);

  return (
    <>
      <div className="shadow-inner-right border-border hidden h-screen w-[300px] shrink-0 flex-col items-start justify-start gap-6 border-r-[1px] lg:flex">
        <div className="flex w-full items-center justify-between px-4 pt-1.5">
          <Button
            className="hover:bg-accent"
            variant="ghost"
            onClick={() => setChatHistoryOpen((p) => !p)}
          >
            {chatHistoryOpen ? (
              <PanelRightOpen className="size-5" />
            ) : (
              <PanelRightClose className="size-5" />
            )}
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">Chat History</h1>
        </div>
        {chatStarted && (
          <div className="w-full px-4">
            <Button
              variant="ghost"
              className="flex w-full items-center justify-start gap-2 rounded-md p-2 text-left font-normal"
              onClick={() => {
                setIsTemporaryMode(false);
                setThreadId(null);
              }}
            >
              <SquarePen className="size-5" />
              <span>New chat</span>
            </Button>
          </div>
        )}
        {threadsLoading ? (
          <ThreadHistoryLoading />
        ) : (
          <ThreadList threads={threads} />
        )}
      </div>
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent
            side="left"
            className="flex lg:hidden"
          >
            <SheetHeader>
              <SheetTitle>Chat History</SheetTitle>
            </SheetHeader>
            <ThreadList
              threads={threads}
              onThreadClick={() => setChatHistoryOpen((o) => !o)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
