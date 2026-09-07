"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  parseStoredWatchlist,
  WATCHLIST_STORAGE_KEY,
} from "@/contexts/watchlist-storage";

export type WatchlistItem = {
  id: string;
  username: string;
  addedAt: Date;
};

type WatchlistContextType = {
  watchlist: WatchlistItem[];
  addToWatchlist: (id: string, username: string) => void;
  removeFromWatchlist: (id: string) => void;
  isInWatchlist: (id: string) => boolean;
  toggleWatchlist: (id: string, username: string) => void;
};

const WatchlistContext = createContext<WatchlistContextType | undefined>(
  undefined,
);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Load watchlist from localStorage on mount, dropping malformed entries
  // instead of letting one corrupt record take down the whole list.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (stored) {
        setWatchlist(parseStoredWatchlist(JSON.parse(stored)));
      }
    } catch (error) {
      // Unparsable JSON: start empty rather than crashing the marketplace.
      console.error("Failed to load watchlist from localStorage:", error);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  // Save watchlist to localStorage whenever it changes — but never before the
  // mount read has finished, or the initial empty state would clobber the
  // user's saved list on every page load.
  useEffect(() => {
    if (!hasHydrated) {
      return;
    }
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
    } catch (error) {
      console.error("Failed to save watchlist to localStorage:", error);
    }
  }, [hasHydrated, watchlist]);

  const addToWatchlist = (id: string, username: string) => {
    setWatchlist((prev) => {
      // Don't add if already exists
      if (prev.some((item) => item.id === id)) return prev;

      return [
        ...prev,
        {
          id,
          username,
          addedAt: new Date(),
        },
      ];
    });
  };

  const removeFromWatchlist = (id: string) => {
    setWatchlist((prev) => prev.filter((item) => item.id !== id));
  };

  const isInWatchlist = (id: string) => {
    return watchlist.some((item) => item.id === id);
  };

  const toggleWatchlist = (id: string, username: string) => {
    if (isInWatchlist(id)) {
      removeFromWatchlist(id);
    } else {
      addToWatchlist(id, username);
    }
  };

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        addToWatchlist,
        removeFromWatchlist,
        isInWatchlist,
        toggleWatchlist,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error("useWatchlist must be used within a WatchlistProvider");
  }
  return context;
}
