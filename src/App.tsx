import { useState, useEffect, useRef, useCallback } from "react";
import { Tooltip } from "./components/Tooltip";
import { ScrollContainer } from "./components/ScrollContainer";
import { LocationDetail } from "./components/LocationDetail";
import {
  Plus,
  RefreshCw,
  HardDrive,
  Cloud,
  Network,
  Monitor,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Settings,
  X,
  Pin,
  Unplug,
  ChevronRight,
  ExternalLink,
  Info,
} from "lucide-react";
import "./App.css";
import type {
  Destination,
  SessionInfo,
  SessionConfig,
} from "./lib/types";
import { usePersistedState } from "./hooks/useStore";
import { useScheduler } from "./hooks/useScheduler";
import {
  getCaptureOneSession,
  loadSessionConfig,
  saveSessionConfig,
  openFolderPicker,
  parseDestination,
  deleteBackupFolder,
  checkPathExists,
  createDirectory,
  startBackup,
  cancelBackup,
  onBackupProgress,
  onBackupComplete,
  onBackupError,
  sendBackupNotification,
  onRefreshSession,
  requestNotificationPermission,
  openInFinder,
} from "./lib/tauri";
import { invoke } from "@tauri-apps/api/core";

const completionAnimations = `
  @keyframes completion-pulse {
    0% { border-color: rgba(59, 130, 246, 0.2); }
    25% { border-color: rgba(37, 99, 235, 1); }
    100% { border-color: rgba(255, 255, 255, 0.1); }
  }

  @keyframes duplicate-shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }

  @keyframes fill-fade-out {
    0%, 20% { opacity: 0.4; width: 100%; }
    100% { opacity: 0; width: 100%; }
  }

  .animate-completion-pulse {
    animation: completion-pulse 1s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }

  .animate-duplicate-shake {
    animation: duplicate-shake 0.4s ease-in-out;
    border-color: rgba(249, 115, 22, 0.5) !important;
  }

  .animate-fill-fade {
    animation: fill-fade-out 1s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }
`;

function App() {
  // Application State
  const [view, setView] = useState<"main" | "location-detail">("main");
  const [selectedDestId, setSelectedDestId] = useState<number | null>(null);
  const [backupState, setBackupState] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [destProgress, setDestProgress] = useState<Map<number, number>>(new Map());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [backedUpDestinations, setBackedUpDestinations] = useState<Set<number>>(
    new Set(),
  );
  const [isHoveringSync, setIsHoveringSync] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [measuredContentHeight, setMeasuredContentHeight] = useState(480); // Initialize to max cap to prevent overflow on first expand
  const [dynamicHeight, setDynamicHeight] = useState(480);
  const contentRef = useRef<HTMLDivElement>(null);

  // Session State
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [lastSession, setLastSession] = useState<SessionInfo | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [imageCountAtLastBackup, setImageCountAtLastBackup] = useState<number | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // Options Menu State
  const [pulsingLocationId, setPulsingLocationId] = useState<number | null>(
    null,
  );
  const [inaccessibleDests, setInaccessibleDests] = useState<Set<number>>(new Set());

  // Persisted Global State
  const [scheduledBackup, setScheduledBackup] = usePersistedState(
    "scheduledBackup",
    true,
  );
  const [defaultDestinationIds, setDefaultDestinationIds] = usePersistedState<
    number[]
  >("defaultDestinations", []);
  const [intervalMinutes] = usePersistedState("intervalMinutes", 15);
  const [notificationsEnabled] = usePersistedState("notificationsEnabled", true);
  const [tooltipsEnabled] = usePersistedState("tooltipsEnabled", true);

  const notificationsEnabledRef = useRef(notificationsEnabled);
  const sessionRef = useRef(session);
  const destinationsRef = useRef(destinations);
  const selectedPathsRef = useRef(selectedPaths);
  const lastSyncedRef = useRef(lastSynced);

  // Multi-destination completion tracking
  const expectedDestCountRef = useRef(0);
  const completedDestCountRef = useRef(0);
  const failedDestCountRef = useRef(0);
  const failedErrorsRef = useRef<string[]>([]);
  const resetTimeoutRef = useRef<number | undefined>(undefined);
  const suppressFocusRefreshRef = useRef(false);

  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    destinationsRef.current = destinations;
  }, [destinations]);

  useEffect(() => {
    selectedPathsRef.current = selectedPaths;
  }, [selectedPaths]);

  useEffect(() => {
    lastSyncedRef.current = lastSynced;
  }, [lastSynced]);

  // Handle collapse animation
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 200);
    return () => clearTimeout(timer);
  }, [isCollapsed]);

  // Measure content height dynamically
  useEffect(() => {
    if (!contentRef.current || isCollapsed) return;

    const measureContent = () => {
      if (contentRef.current) {
        const height = contentRef.current.scrollHeight;
        if (Math.abs(height - measuredContentHeight) > 1) {
          setMeasuredContentHeight(height);
        }
      }
    };

    // Measure immediately first (synchronous)
    measureContent();

    const resizeObserver = new ResizeObserver(measureContent);
    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isCollapsed, destinations, measuredContentHeight]);

  // Calculate dynamic height with max cap (fit within 600px window)
  useEffect(() => {
    const MAX_CONTENT_HEIGHT = 480; // Cap at 480px (leaves room for header/footer in 600px window)
    const cappedHeight = Math.min(measuredContentHeight, MAX_CONTENT_HEIGHT);
    setDynamicHeight(isCollapsed ? 0 : cappedHeight);
  }, [isCollapsed, measuredContentHeight]);

  // Load Session and its Config
  const loadSessionData = useCallback(async (newSession: SessionInfo) => {
    setIsLoadingConfig(true);
    try {
      const config = await loadSessionConfig(newSession.path, newSession.name);
      setDestinations(config.destinations);
      setSelectedPaths(config.selected_paths);
      setLastSynced(config.last_synced);
      setImageCountAtLastBackup(config.image_count_at_last_backup ?? null);
    } catch (err) {
      console.error("Failed to load session data:", err);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  // Auto-save Config
  useEffect(() => {
    if (session && !isLoadingConfig) {
      const config: SessionConfig = {
        version: 1,
        last_synced: lastSynced,
        image_count_at_last_backup: imageCountAtLastBackup,
        selected_paths: selectedPaths,
        destinations: destinations,
      };
      saveSessionConfig(session.path, session.name, config).catch(
        console.error,
      );
    }
  }, [session, destinations, selectedPaths, lastSynced, imageCountAtLastBackup, isLoadingConfig]);

  // Reset backup status when session changes
  useEffect(() => {
    setBackedUpDestinations(new Set());
    setInaccessibleDests(new Set());
  }, [session?.path]);

  // Poll destination accessibility every 10 seconds
  useEffect(() => {
    if (destinations.length === 0) return;

    const checkAccessibility = async () => {
      const inaccessible = new Set<number>();
      for (const dest of destinations) {
        const exists = await checkPathExists(dest.path);
        if (!exists) inaccessible.add(dest.id);
      }
      setInaccessibleDests(inaccessible);
    };

    checkAccessibility();
    const interval = setInterval(checkAccessibility, 10000);
    return () => clearInterval(interval);
  }, [destinations]);

  // Request notification permission on mount
  useEffect(() => {
    if (notificationsEnabled) {
      requestNotificationPermission();
    }
  }, []);

  // Auto-clear pulsing location highlight
  useEffect(() => {
    if (pulsingLocationId) {
      const timer = setTimeout(() => {
        setPulsingLocationId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [pulsingLocationId]);

  // Load session info
  const refreshSession = useCallback(() => {
    getCaptureOneSession()
      .then((newSession) => {
        if (
          !sessionRef.current ||
          newSession.path !== sessionRef.current.path
        ) {
          setLastSession(null);
          setSession(newSession);
          loadSessionData(newSession);
        } else {
          // Just update volatile info like size/image count
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  size: newSession.size,
                  image_count: newSession.image_count,
                }
              : newSession,
          );
        }
      })
      .catch((err) => {
        if (sessionRef.current) {
          console.error("Failed to get Capture One session:", err);
          setLastSession(sessionRef.current);
          setSession(null);
        }
      });
  }, [loadSessionData]);

  useEffect(() => {
    refreshSession();

    // Poll for session changes every 30 seconds
    const interval = setInterval(refreshSession, 30000);

    // Also refresh when the window becomes visible
    const handleFocus = () => {
      if (suppressFocusRefreshRef.current) return;
      refreshSession();
    };
    window.addEventListener("focus", handleFocus);

    let unlisten: () => void;
    onRefreshSession(() => {
      refreshSession();
    }).then((u) => (unlisten = u));

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      if (unlisten) unlisten();
    };
  }, [refreshSession]);

  // Inject completion animations CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = completionAnimations;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Setup backup event listeners
  useEffect(() => {
    let cancelled = false;
    let unlistenProgress: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    const checkAllDestinationsComplete = () => {
      if (completedDestCountRef.current < expectedDestCountRef.current) return;

      const failed = failedDestCountRef.current;
      const total = expectedDestCountRef.current;
      const succeeded = total - failed;

      setBackupState(failed > 0 ? "error" : "success");
      setLastSynced(new Date().toISOString());
      setImageCountAtLastBackup(sessionRef.current?.image_count ?? null);

      if (notificationsEnabledRef.current) {
        const size = sessionRef.current?.size || "Unknown size";
        if (failed === 0) {
          sendBackupNotification(
            "Backup Complete",
            `Session successfully backed up to ${total} ${total === 1 ? "location" : "locations"}. Total session size: ${size}`,
          );
        } else if (succeeded > 0) {
          sendBackupNotification(
            "Backup Partially Complete",
            `Backed up to ${succeeded} of ${total} locations. Session size: ${size}`,
          );
        } else {
          const detail = failedErrorsRef.current.length > 0
            ? failedErrorsRef.current.join(", ")
            : "All destinations failed";
          sendBackupNotification("Backup Failed", detail);
        }
      }

      resetTimeoutRef.current = window.setTimeout(() => {
        setBackupState("idle");
        setDestProgress(new Map());
      }, 1500);
    };

    const setupListeners = async () => {
      unlistenProgress = await onBackupProgress((progress) => {
        setDestProgress((prev) => {
          const next = new Map(prev);
          next.set(progress.destination_id, progress.percent);
          return next;
        });
      });
      if (cancelled) { unlistenProgress(); return; }

      unlistenComplete = await onBackupComplete((result) => {
        if (result.success) {
          // Per-destination: pulse animation
          setBackedUpDestinations(
            (prev) => new Set([...prev, result.destination_id]),
          );

          // Update destinations to mark that they have a backup now (persists to .jsync)
          setDestinations((prev) =>
            prev.map((d) =>
              d.id === result.destination_id
                ? { ...d, has_existing_backup: true, image_count_at_last_backup: result.image_count ?? null }
                : d,
            ),
          );
        }

        completedDestCountRef.current += 1;
        checkAllDestinationsComplete();
      });
      if (cancelled) { unlistenProgress?.(); unlistenComplete(); return; }

      unlistenError = await onBackupError((error) => {
        completedDestCountRef.current += 1;
        failedDestCountRef.current += 1;
        if (error.error) {
          failedErrorsRef.current.push(error.error);
        }
        checkAllDestinationsComplete();
      });
      if (cancelled) { unlistenProgress?.(); unlistenComplete?.(); unlistenError(); return; }
    };

    setupListeners();

    return () => {
      cancelled = true;
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
      if (unlistenError) unlistenError();
    };
  }, []); // Empty dependency array, using refs for dynamic state

  const handleStartBackup = useCallback(async () => {
    if (enabledCount === 0 || !session) return;

    if (backupState === "running") {
      console.log("User requested backup cancellation");
      try {
        await cancelBackup();
        console.log("cancelBackup command sent to backend");
        setBackupState("idle");
        setDestProgress(new Map());
      } catch (error) {
        console.error("Failed to cancel backup:", error);
      }
      return;
    }

    // Pre-flight: auto-create local destinations that don't exist
    const enabledDests = destinations.filter(d => d.enabled);
    for (const dest of enabledDests) {
      if (dest.destination_type === "local") {
        const exists = await checkPathExists(dest.path);
        if (!exists) {
          try {
            await createDirectory(dest.path);
          } catch (error) {
            console.error("Failed to create local directory:", error);
          }
        }
      }
    }

    setBackupState("running");
    setDestProgress(new Map());
    setBackedUpDestinations(new Set());

    // Clear stale timeouts from previous backup
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = undefined;
    }

    // Track multi-destination completion
    expectedDestCountRef.current = destinations.filter(d => d.enabled).length;
    completedDestCountRef.current = 0;
    failedDestCountRef.current = 0;
    failedErrorsRef.current = [];

    try {
      await startBackup(
        session.path,
        session.name,
        destinations,
        selectedPaths,
        session.image_count,
      );
      updateLastBackup();
    } catch (error) {
      console.log("Backup error/cancel received:", error);
      if (error === "Backup cancelled") {
        console.log("Setting state to idle due to cancellation");
        setBackupState("idle");
        setDestProgress(new Map());
      } else {
        console.error("Backup failed:", error);
        setBackupState("error");
        resetTimeoutRef.current = window.setTimeout(() => {
          setBackupState("idle");
          setDestProgress(new Map());
        }, 1500);
      }
    }
  }, [session, destinations, selectedPaths, backupState]);

  // Scheduler setup
  const { updateLastBackup } = useScheduler(
    scheduledBackup,
    intervalMinutes,
    handleStartBackup,
  );

  const formatLastSync = (iso: string | null) => {
    if (!iso) return "Never synced";
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Last backup just now";
    if (diffMins < 60) return `Last backup ${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Last backup ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Last backup ${diffDays}d ago`;

    const diffWeeks = Math.floor(diffDays / 7);
    return `Last backup ${diffWeeks}w ago`;
  };

  const sessionClosed = !session && !!lastSession;
  const sessionInfo = {
    name: session?.name || lastSession?.name || "No Session",
    size: session ? session.size : "Open Capture One to begin backup",
    lastSyncLabel: formatLastSync(lastSynced),
  };

  const newImageCount =
    session && imageCountAtLastBackup !== null && backupState === "idle"
      ? Math.max(0, session.image_count - imageCountAtLastBackup)
      : 0;

  const truncateMiddle = (str: string, startLen = 18, endLen = 8) => {
    if (str.length <= startLen + endLen) return str;
    return (
      str.substring(0, startLen) + "..." + str.substring(str.length - endLen)
    );
  };

  const enabledCount = destinations.filter((d) => d.enabled).length;

  const getDestinationIcon = (type: string, enabled: boolean) => {
    const colorClass = enabled ? "" : "text-gray-600";
    switch (type) {
      case "external":
        return (
          <HardDrive
            size={14}
            className={enabled ? "text-amber-500" : colorClass}
          />
        );
      case "cloud":
        return (
          <Cloud size={14} className={enabled ? "text-blue-500" : colorClass} />
        );
      case "network":
        return (
          <Network
            size={14}
            className={enabled ? "text-purple-500" : colorClass}
          />
        );
      default:
        return (
          <Monitor
            size={14}
            className={enabled ? "text-gray-300" : colorClass}
          />
        );
    }
  };

  const toggleDestination = (id: number) => {
    setDestinations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, enabled: !d.enabled } : d)),
    );
  };

  const removeDestination = (id: number) => {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
    setBackedUpDestinations((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const isDefault = (id: number) => defaultDestinationIds.includes(id);

  const toggleDefault = (id: number) => {
    setDefaultDestinationIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((dId) => dId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleConfirmDeleteBackup = async (dest: Destination) => {
    if (!session) return;

    try {
      await deleteBackupFolder(dest.path, session.name);

      // Update destination state
      setDestinations((prev) =>
        prev.map((d) =>
          d.id === dest.id ? { ...d, has_existing_backup: false } : d,
        ),
      );

    } catch (error) {
      console.error("Failed to delete backup:", error);
    }
  };

  const addDefaultLocation = async () => {
    suppressFocusRefreshRef.current = true;
    const path = await openFolderPicker();

    // Bring window back to focus after folder picker
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const mainWindow = getCurrentWindow();
    await mainWindow.show();
    await mainWindow.setFocus();
    suppressFocusRefreshRef.current = false;

    if (path) {
      // Check if this path already exists
      const existingDestination = destinations.find((d) => d.path === path);
      if (existingDestination) {
        setPulsingLocationId(existingDestination.id);
        return;
      }

      const destination = await parseDestination(path);
      // Backend parse_destination doesn't know about our sidecar extension yet
      const newDest: Destination = {
        ...destination,
        has_existing_backup: false, // Will be checked on next session load
      };
      setDestinations((prev) => [...prev, newDest]);
    }
  };

  return (
    <div className="w-full h-full text-white font-sans select-none">
      <style>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div
        className={`relative w-full h-full rounded-[26px] border overflow-hidden bg-[#1c1c1e] transition-all duration-300 ${
          backupState === "success" && isCollapsed
            ? "animate-completion-pulse"
            : "border-white/10"
        }`}
        style={{display: 'grid', gridTemplateRows: 'auto 1fr auto'}}
      >
        {/* Ambient gradient glow — blue while syncing only */}
        {view === "main" && (
          <div
            className="absolute top-0 left-0 right-0 pointer-events-none z-0 transition-opacity duration-500"
            style={{
              height: '300px',
              backgroundImage: 'radial-gradient(ellipse 200% 80% at 0% 0%, rgba(59,130,246,0.05) 0%, transparent 100%)',
              opacity: backupState === "running" ? 1 : 0,
            }}
          />
        )}
        {/* VIEW: MAIN APP */}
        {view === "main" && (
          <>
            {/* Header */}
            <div className="relative flex flex-col">
              {(backupState === "running" || backupState === "success") &&
                isCollapsed && (
                  <div
                    className={`absolute inset-0 bg-blue-600 transition-all duration-300 ease-out z-0 ${
                      backupState === "success"
                        ? "animate-fill-fade opacity-40"
                        : "opacity-40"
                    }`}
                    style={{
                      width:
                        backupState === "success"
                          ? "100%"
                          : (() => { const vals = [...destProgress.values()]; return vals.length ? `${vals.reduce((a, b) => a + b, 0) / vals.length}%` : "0%"; })(),
                    }}
                  />
                )}

              <div className="px-3 pt-5.5 pb-4 z-10 space-y-4">
                <div className="flex items-center justify-between px-1 cursor-pointer" onClick={() => setIsCollapsed(!isCollapsed)}>
                  <div
                    className={`group/session inline-flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase min-w-0 ${
                      session ? "text-white" : sessionClosed ? "text-white/50" : "text-white/20"
                    }`}
                    title={session?.path ?? lastSession?.path}
                    onClick={(e) => { if (session) { e.stopPropagation(); openInFinder(session.path); } }}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      session && backupState === "running"
                        ? "bg-blue-500 shadow-[0_0_3px_rgba(59,130,246,0.12)] animate-pulse"
                        : session
                          ? "bg-green-500 shadow-[0_0_3px_rgba(34,197,94,0.12)]"
                          : "bg-white/20"
                    }`} />
                    <span className="truncate">{truncateMiddle(sessionInfo.name)}</span>
                    {sessionClosed && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[8px] font-semibold bg-white/10 text-white/40 tracking-wider">
                        Closed
                      </span>
                    )}
                    <ExternalLink size={10} className="opacity-0 group-hover/session:opacity-60 transition-opacity shrink-0" />
                  </div>
                  <Tooltip content={isCollapsed ? 'Expand view' : 'Collapse view'} disabled={!tooltipsEnabled}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
                      className="transition-all flex-shrink-0 text-white/40 hover:text-white/70 active:text-white/20"
                    >
                      {isCollapsed ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronUp size={16} />
                      )}
                    </button>
                  </Tooltip>
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-3 px-1">
                    <div className="flex flex-col">
                      <span className="text-white/30 text-[9px] uppercase font-bold tracking-wider">Size</span>
                      <span className="text-[14px] font-bold text-white tracking-tight">{session ? sessionInfo.size : lastSession ? lastSession.size : "—"}</span>
                    </div>
                    <div className="w-[1px] h-4 bg-white/10" />
                    <div className="flex flex-col">
                      <span className="text-white/30 text-[9px] uppercase font-bold tracking-wider">{(session ?? lastSession)?.image_count === 1 ? "Image" : "Images"}</span>
                      <span className="text-[14px] font-bold text-white tracking-tight">{session ? session.image_count : lastSession ? lastSession.image_count : "—"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Tooltip content="Auto sync" disabled={!tooltipsEnabled}>
                      <button
                        onClick={() => setScheduledBackup(!scheduledBackup)}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className={`w-5 h-[34px] rounded-full relative transition-colors ${scheduledBackup ? "bg-blue-500" : "bg-white/10"}`}>
                          <div className={`absolute left-[3px] w-[14px] h-[14px] bg-white rounded-full transition-all ${scheduledBackup ? "top-[3px]" : "top-[17px]"}`} />
                        </div>
                      </button>
                    </Tooltip>
                    <Tooltip
                      content={() => {
                        if (backupState === 'running') return 'Cancel backup';
                        if (backupState === 'success') return 'Backup complete';
                        return 'Start backup';
                      }}
                      disabled={!tooltipsEnabled}
                    >
                      <button
                        onClick={handleStartBackup}
                        onMouseEnter={() => setIsHoveringSync(true)}
                        onMouseLeave={() => setIsHoveringSync(false)}
                        disabled={enabledCount === 0 || sessionClosed}
                        className={`relative group flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${
                          backupState === "running"
                            ? isHoveringSync
                              ? "bg-red-500/20 text-red-500"
                              : "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                            : backupState === "success"
                              ? "bg-blue-600 text-white shadow-lg"
                              : "bg-white/10 hover:bg-white/20 text-white active:scale-95"
                        } disabled:opacity-30 disabled:grayscale`}
                      >
                        {backupState === "running" ? (
                          isHoveringSync ? (
                            <X size={14} />
                          ) : (
                            <RefreshCw size={14} className="animate-spin" />
                          )
                        ) : backupState === "success" ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <RefreshCw
                            size={14}
                            className="transition-transform duration-500 group-hover:rotate-180 ease-in-out"
                          />
                        )}
                        <span className="text-[11px] font-bold tracking-wide uppercase text-center w-[52px]">
                          {backupState === "running" ? (isHoveringSync ? "Cancel" : "Syncing") : backupState === "success" ? "Done" : scheduledBackup && !isHoveringSync ? "Auto" : "Sync"}
                        </span>
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>

            </div>

            {/* New images chip */}
            {newImageCount > 0 && backupState === "idle" && (
              <div className="px-4 pb-3 -mt-1">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                  newImageCount >= 50
                    ? "bg-amber-400/10 text-amber-400/80"
                    : "bg-white/5 text-white/40"
                }`}>
                  <Info size={10} />
                  {newImageCount} new {newImageCount === 1 ? "image" : "images"}
                </div>
              </div>
            )}

            <div className="h-px bg-white/[0.05]" />

            {/* Collapsible Content */}
            <div
              style={{
                height: `${dynamicHeight}px`,
                transition: 'height 200ms ease-out',
                overflow: 'hidden'
              }}
            >
              <ScrollContainer
                className="h-full"
                defer={isCollapsed || isAnimating}
                enableScroll={measuredContentHeight > 480}
              >
                <div className="px-3 space-y-5 pb-4 pt-3" ref={contentRef}>
                {/* Locations Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-bold uppercase text-white/30 tracking-[0.08em]">
                      Locations
                    </span>
                    <Tooltip content="Add new backup location" disabled={!tooltipsEnabled}>
                      <button
                        onClick={addDefaultLocation}
                        className="p-1 rounded-md transition-colors hover:bg-white/10 text-blue-400"
                      >
                        <Plus size={14} />
                      </button>
                    </Tooltip>
                  </div>

                  <div className="rounded-[24px] bg-[oklab(0_0_0/0.4)] shadow-[inset_0_4px_8px_rgba(0,0,0,0.4)] border border-neutral-900 overflow-hidden">
                  <div>
                    {destinations.length > 0 ? (
                      destinations.map((dest, index) => {
                        const isInaccessible = inaccessibleDests.has(dest.id);
                        const isBackingUp =
                          (backupState === "running" ||
                            backupState === "success") &&
                          dest.enabled;
                        const shouldPulse =
                          backupState === "success" &&
                          !isCollapsed &&
                          backedUpDestinations.has(dest.id);
                        const isDuplicate = pulsingLocationId === dest.id;
                        const backupStatus = (() => {
                          if (!dest.has_existing_backup) return null;
                          if (session?.image_count == null) return "green";
                          const countAtBackup = dest.image_count_at_last_backup ?? imageCountAtLastBackup;
                          if (countAtBackup == null) return "green";
                          const newImages = Math.max(0, session.image_count - countAtBackup);
                          if (newImages >= 50) return "orange";
                          if (newImages > 0) return "grey";
                          return "green";
                        })();
                        return (
                          <div key={dest.id}>
                            {index > 0 && (
                              <div className="mx-4 h-px bg-white/[0.04]" />
                            )}
                            <div
                              onClick={() => {
                                if (backupState === "running") return;
                                setSelectedDestId(dest.id);
                                setView("location-detail");
                              }}
                              className={`group relative overflow-hidden flex items-center justify-between px-3.5 py-3.5 transition-all cursor-pointer ${
                                isInaccessible
                                  ? "opacity-40 cursor-default"
                                  : shouldPulse && !isDuplicate
                                    ? "animate-completion-pulse"
                                    : isDuplicate
                                      ? "animate-duplicate-shake"
                                      : "hover:bg-white/[0.03]"
                              }`}
                            >
                              {/* Backup progress overlay */}
                              {isBackingUp && (
                                <div
                                  className={`absolute inset-0 bg-blue-500/20 pointer-events-none ${
                                    backupState === "success" ? "animate-fill-fade" : "transition-all duration-300 ease-out"
                                  }`}
                                  style={{ width: backupState === "success" ? "100%" : `${destProgress.get(dest.id) ?? 0}%` }}
                                />
                              )}

                              <div className="flex items-center gap-3 relative z-10">
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleDestination(dest.id); }}
                                  className={`p-1.5 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 ${
                                    dest.enabled ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-white/20"
                                  }`}
                                >
                                  {getDestinationIcon(dest.destination_type, dest.enabled)}
                                </button>
                                <span className={`text-[12px] font-bold truncate ${dest.enabled ? "text-white/80" : "text-white/30"}`}>
                                  {dest.destination_type === "local"
                                    ? dest.path.split("/")[3] ?? dest.label
                                    : dest.label}
                                  <span className={`font-normal ${dest.enabled ? "text-white/30" : "text-white/15"}`}>
                                    <span className="ml-1.5">{"/"}{dest.path.split("/").pop()}</span>
                                  </span>
                                </span>
                                {isDefault(dest.id) && (
                                  <Pin size={10} strokeWidth={3} className="text-blue-400 flex-shrink-0" />
                                )}
                              </div>

                              <div className="flex items-center gap-2 relative z-10">
                                {backupStatus && !isBackingUp && !isInaccessible && (
                                  <CheckCircle2
                                    size={14}
                                    className={
                                      backupStatus === "green"
                                        ? "text-green-400"
                                        : backupStatus === "orange"
                                        ? "text-orange-400"
                                        : "text-white/25"
                                    }
                                  />
                                )}
                                {isInaccessible ? (
                                  <Unplug size={12} className="text-orange-400/70" />
                                ) : isBackingUp ? (
                                  <span className="text-[10px] font-mono font-bold text-blue-400">{Math.round(destProgress.get(dest.id) ?? 0)}%</span>
                                ) : (
                                  <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <button
                        onClick={addDefaultLocation}
                        className="group w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-all"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-gray-500 group-hover:text-blue-400 transition-all flex-shrink-0">
                          <Plus size={16} />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-[11px] font-bold leading-none text-gray-400">
                            No Destinations Added
                          </p>
                          <p className="text-[9.5px] truncate mt-1 text-gray-600">
                            Click to add a drive or cloud folder
                          </p>
                        </div>
                      </button>
                    )}
                  </div>
                  </div>
                </div>

              </div>
              </ScrollContainer>
            </div>
          </>
        )}

        {/* VIEW: LOCATION DETAIL */}
        {view === "location-detail" && (() => {
          const selectedDest = destinations.find(d => d.id === selectedDestId);
          if (!selectedDest) return null;
          return (
            <div
              key="location-detail"
              className="flex flex-col overflow-hidden min-h-0"
              style={{ gridRow: '1 / 3' }}
            >
              <LocationDetail
                dest={selectedDest}
                lastSynced={lastSynced}
                isDefault={isDefault(selectedDest.id)}
                onBack={() => setView("main")}
                onToggleEnabled={() => toggleDestination(selectedDest.id)}
                onToggleDefault={() => toggleDefault(selectedDest.id)}
                onDeleteBackup={() => handleConfirmDeleteBackup(selectedDest)}
                onRemove={() => {
                  removeDestination(selectedDest.id);
                  setView("main");
                }}
                onOpenInFinder={() => openInFinder(selectedDest.path).catch(console.error)}
                formatLastSync={formatLastSync}
              />
            </div>
          );
        })()}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 text-[11px] font-medium text-white/40">
            <div className="flex items-center gap-1.5">
              <Info size={12} className="opacity-70 flex-shrink-0" />
              <span>
                {backupState === "running"
                  ? "Syncing"
                  : formatLastSync(lastSynced)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => invoke("open_preferences")}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-white/60 hover:text-white transition-colors"
            >
              <Settings size={14} />
              SETTINGS
            </button>
            <button
              onClick={() => invoke("quit_app")}
              className="text-[11px] uppercase font-bold text-red-400/80 hover:text-red-400 transition-colors"
            >
              Quit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
