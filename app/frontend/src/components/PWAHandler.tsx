"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAHandler() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  // In-app update notice — deliberately NOT the blocking native confirm(),
  // which can be suppressed or jarring and gives no visual context.
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            newWorker?.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New content is available; surface a refresh prompt.
                setUpdateReady(true);
              }
            });
          });
        })
        .catch(() => {
          // Registration can fail in private browsing / storage-restricted
          // contexts — the app works fine without the SW, so stay quiet.
        });
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
  };

  if (updateReady) {
    return (
      <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-500">
        <div className="bg-neutral-900 border border-cyan-500/30 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/20">
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6 text-white fill-current"
              >
                <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Update available</h3>
              <p className="text-sm text-neutral-400 mt-1">
                A new version of Stellar Basic DAO is ready. Refresh to get the
                latest features.
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-white text-black text-sm font-bold py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Refresh now
                </button>
                <button
                  onClick={() => setUpdateReady(false)}
                  className="px-4 py-2.5 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!showBanner || isInstalled) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:w-96 z-50 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 text-white fill-current"
            >
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">
              Install Stellar Basic DAO App
            </h3>
            <p className="text-sm text-neutral-400 mt-1">
              Add Stellar Basic DAO to your home screen for a faster, offline-ready
              experience.
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleInstall}
                className="flex-1 bg-white text-black text-sm font-bold py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
              >
                Install Now
              </button>
              <button
                onClick={() => setShowBanner(false)}
                className="px-4 py-2.5 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
