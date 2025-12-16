import { validate } from "uuid";
import { getApiKey } from "@/lib/api-key";
import { Thread } from "@langchain/langgraph-sdk";
import { useQueryState } from "nuqs";
import Cookies from "js-cookie";
import { toast } from "sonner";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { createClient } from "./client";

interface ThreadContextType {
  getThreads: () => Promise<Thread[]>;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
  gcpIapUid: string | null;
  gcpIapEmail: string | null;
  deleteThread: (threadId: string) => Promise<void>;
  deletingThreadIds: Set<string>;
  duplicateThread: (threadId: string) => Promise<Thread | undefined>;
  duplicatingThreadIds: Set<string>;
  isTemporaryMode: boolean;
  setIsTemporaryMode: Dispatch<SetStateAction<boolean>>;
  isCurrentThreadTemporary: (threadId: string | null) => boolean;
  renameThread: (threadId: string, title: string) => Promise<void>;
  renamingThreadIds: Set<string>;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

function getThreadSearchMetadata(
  assistantId: string,
): { graph_id: string } | { assistant_id: string } {
  if (validate(assistantId)) {
    return { assistant_id: assistantId };
  } else {
    return { graph_id: assistantId };
  }
}

function getGcpIapUid() {
  if (typeof window === "undefined") {
    return null;
  }
  return Cookies.get("gcp_iap_uid") ?? null;
}

function getGcpIapEmail() {
  if (typeof window === "undefined") {
    return null;
  }
  const email = Cookies.get("gcp_iap_email") ?? null;
  const prefix = "accounts.google.com:";
  if (typeof email === "string" && email.startsWith(prefix)) {
    return email.slice(prefix.length);
  }
  return email;
}

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [apiUrl] = useQueryState("apiUrl");
  const [assistantId] = useQueryState("assistantId");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [deletingThreadIds, setDeletingThreadIds] = useState<Set<string>>(
    new Set(),
  );
  const [duplicatingThreadIds, setDuplicatingThreadIds] = useState<Set<string>>(
    new Set(),
  );
  const [gcpIapUid] = useState<string | null>(getGcpIapUid());
  const [gcpIapEmail] = useState<string | null>(getGcpIapEmail());
  const [renamingThreadIds, setRenamingThreadIds] = useState<Set<string>>(
    new Set(),
  );
  const [isTemporaryMode, setIsTemporaryMode] = useState(false);
  const [allThreadsCache, setAllThreadsCache] = useState<Thread[]>([]);

  const getThreads = useCallback(async (): Promise<Thread[]> => {
    if (!apiUrl || !assistantId) return [];
    const client = createClient(apiUrl, getApiKey() ?? undefined);

    const metadata: Record<string, string> = {
      ...getThreadSearchMetadata(assistantId),
    };

    if (gcpIapUid) {
      metadata.gcp_iap_uid = gcpIapUid;
    }

    const allThreads = await client.threads.search({
      metadata,
      limit: 100,
    });

    // Cache all threads (including temporary ones)
    setAllThreadsCache(allThreads);

    // Filter out temporary threads for display
    return allThreads.filter((thread) => {
      return thread.metadata?.temporary !== "true";
    });
  }, [apiUrl, assistantId, gcpIapUid]);

  const deleteThread = useCallback(
    async (threadId: string) => {
      if (!apiUrl) return;

      // Prevent duplicate delete attempts
      if (deletingThreadIds.has(threadId)) {
        return;
      }

      // Mark thread as being deleted
      setDeletingThreadIds((prev) => new Set(prev).add(threadId));

      const client = createClient(apiUrl, getApiKey() ?? undefined);

      try {
        // Add timeout to prevent indefinite waiting
        const deletePromise = client.threads.delete(threadId);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), 15000),
        );

        await Promise.race([deletePromise, timeoutPromise]);

        setThreads((prevThreads) =>
          prevThreads.filter((t) => t.thread_id !== threadId),
        );
        toast.success("Chat deleted successfully.");
      } catch (error) {
        console.error("Failed to delete thread:", error);
        if (error instanceof Error && error.message === "Request timeout") {
          toast.error(
            "Delete request timed out. Please check your connection and try again.",
            {
              richColors: true,
            },
          );
        } else {
          toast.error("Failed to delete chat. Please try again later.", {
            richColors: true,
          });
        }
      } finally {
        // Always remove from deleting set
        setDeletingThreadIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(threadId);
          return newSet;
        });
      }
    },
    [apiUrl, deletingThreadIds],
  );

  const duplicateThread = useCallback(
    async (threadId: string) => {
      if (!apiUrl) return;

      // Prevent duplicate duplicate attempts
      if (duplicatingThreadIds.has(threadId)) {
        return;
      }

      // Mark thread as being duplicated
      setDuplicatingThreadIds((prev) => new Set(prev).add(threadId));

      const client = createClient(apiUrl, getApiKey() ?? undefined);

      try {
        // Add timeout to prevent indefinite waiting
        const copyPromise = client.threads.copy(threadId);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), 15000),
        );

        const newThread = (await Promise.race([
          copyPromise,
          timeoutPromise,
        ])) as Thread;

        // Refresh the threads list to include the new duplicated thread
        const updatedThreads = await getThreads();
        setThreads(updatedThreads);

        toast.success("Chat duplicated successfully.");
        return newThread;
      } catch (error) {
        console.error("Failed to duplicate thread:", error);
        if (error instanceof Error && error.message === "Request timeout") {
          toast.error(
            "Duplicate request timed out. Please check your connection and try again.",
            {
              richColors: true,
            },
          );
        } else {
          toast.error("Failed to duplicate chat. Please try again later.", {
            richColors: true,
          });
        }
      } finally {
        // Always remove from duplicating set
        setDuplicatingThreadIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(threadId);
          return newSet;
        });
      }
    },
    [apiUrl, duplicatingThreadIds, getThreads],
  );

  const renameThread = useCallback(
    async (threadId: string, title: string) => {
      if (!apiUrl) return;

      if (renamingThreadIds.has(threadId)) {
        return;
      }

      setRenamingThreadIds((prev) => new Set(prev).add(threadId));

      const client = createClient(apiUrl, getApiKey() ?? undefined);

      try {
        const updatePromise = client.threads.update(threadId, {
          metadata: { title },
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), 15000),
        );

        await Promise.race([updatePromise, timeoutPromise]);

        // Optimistically update the thread title in the list
        setThreads((prevThreads) =>
          prevThreads.map((t) => {
            if (t.thread_id === threadId) {
              return {
                ...t,
                metadata: {
                  ...t.metadata,
                  title,
                },
              };
            }
            return t;
          }),
        );

        toast.success("Chat renamed successfully.");
      } catch (error) {
        console.error("Failed to rename thread:", error);
        if (error instanceof Error && error.message === "Request timeout") {
          toast.error(
            "Rename request timed out. Please check your connection and try again.",
            {
              richColors: true,
            },
          );
        } else {
          toast.error("Failed to rename chat. Please try again later.", {
            richColors: true,
          });
        }
      } finally {
        setRenamingThreadIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(threadId);
          return newSet;
        });
      }
    },
    [apiUrl, renamingThreadIds],
  );

  const isCurrentThreadTemporary = useCallback(
    (threadId: string | null) => {
      if (!threadId) return false;
      const thread = allThreadsCache.find((t) => t.thread_id === threadId);
      return thread?.metadata?.temporary === "true";
    },
    [allThreadsCache],
  );

  const value = {
    getThreads,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
    gcpIapUid,
    gcpIapEmail,
    deleteThread,
    deletingThreadIds,
    duplicateThread,
    duplicatingThreadIds,
    isTemporaryMode,
    renameThread,
    renamingThreadIds,
    setIsTemporaryMode,
    isCurrentThreadTemporary,
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}
