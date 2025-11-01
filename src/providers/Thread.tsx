import { validate } from "uuid";
import { getApiKey } from "@/lib/api-key";
import { Thread } from "@langchain/langgraph-sdk";
import { useQueryState } from "nuqs";
import Cookies from "js-cookie";
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
  deleteThread: (threadId: string) => void;
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
  if (typeof email === 'string' && email.startsWith(prefix)) {
    return email.slice(prefix.length);
  }
  return email;
}

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [apiUrl] = useQueryState("apiUrl");
  const [assistantId] = useQueryState("assistantId");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [gcpIapUid] = useState<string | null>(getGcpIapUid());
  const [gcpIapEmail] = useState<string | null>(getGcpIapEmail());

  const getThreads = useCallback(async (): Promise<Thread[]> => {
    if (!apiUrl || !assistantId) return [];
    const client = createClient(apiUrl, getApiKey() ?? undefined);

    const metadata: Record<string, string> = {
      ...getThreadSearchMetadata(assistantId),
    };

    if (gcpIapUid) {
      metadata.gcp_iap_uid = gcpIapUid;
    }

    const threads = await client.threads.search({
      metadata,
      limit: 100,
    });

    return threads;
  }, [apiUrl, assistantId, gcpIapUid]);

  const deleteThread = useCallback((threadId: string) => {
    setThreads((prevThreads) =>
      prevThreads.filter((t) => t.thread_id !== threadId),
    );
  }, []);

  const value = {
    getThreads,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
    gcpIapUid,
    gcpIapEmail,
    deleteThread,
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
