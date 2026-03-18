import { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import {
  Bell,
  BellOff,
  FolderTree,
  Check,
  Minus,
  Folder,
  FileCode,
  Clock,
  Loader2,
  RefreshCw,
  Settings,
  RefreshCcw,
} from "lucide-react";
import type { SessionItem } from "./lib/types";
import { usePersistedState } from "./hooks/useStore";
import {
  getCaptureOneSession,
  getSessionContents,
  loadSessionConfig,
  saveSessionConfig,
  checkForAppUpdates,
} from "./lib/tauri";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";

type Tab = "general" | "sync" | "updates";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <Settings size={16} /> },
  { id: "sync", label: "Sync", icon: <FolderTree size={16} /> },
  { id: "updates", label: "Updates", icon: <RefreshCcw size={16} /> },
];

function PrefsApp() {
  const [activeTab, setActiveTab] = useState<Tab>("general");

  const [sessionPath, setSessionPath] = useState<string>("");
  const [sessionName, setSessionName] = useState<string>("");
  const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
  const [appVersion, setAppVersion] = useState("");

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);

  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const sessionPathRef = useRef("");
  const sessionNameRef = useRef("");

  const [intervalMinutes, setIntervalMinutes] = usePersistedState("intervalMinutes", 15);
  const [notificationsEnabled, setNotificationsEnabled] = usePersistedState("notificationsEnabled", true);
  const [tooltipsEnabled, setTooltipsEnabled] = usePersistedState("tooltipsEnabled", true);

  useEffect(() => {
    getVersion().then(setAppVersion);
    getCaptureOneSession()
      .then(async (s) => {
        setSessionPath(s.path);
        setSessionName(s.name);
        sessionPathRef.current = s.path;
        sessionNameRef.current = s.name;
        const [items, config] = await Promise.all([
          getSessionContents(s.path),
          loadSessionConfig(s.path, s.name),
        ]);
        setSessionItems(items);
        setSelectedPaths(config.selected_paths);
        setIsLoadingConfig(false);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (isLoadingConfig || !sessionPathRef.current) return;
    loadSessionConfig(sessionPathRef.current, sessionNameRef.current)
      .then((config) =>
        saveSessionConfig(sessionPathRef.current, sessionNameRef.current, {
          ...config,
          selected_paths: selectedPaths,
        })
      )
      .catch(console.error);
  }, [selectedPaths, isLoadingConfig]);

  useEffect(() => {
    if (isEditingCustom && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [isEditingCustom]);

  const sessionTree = {
    id: sessionPath || "session",
    label: sessionName || "Session",
    children: sessionItems.map((item) => ({
      id: item.id,
      label: item.label,
      type: item.item_type,
    })),
  };

  const isSelected = (id: string) => {
    if (selectedPaths.includes(sessionPath)) return true;
    return selectedPaths.includes(id);
  };

  const getFolderStatus = (folderId: string) => {
    if (folderId === sessionPath) {
      if (selectedPaths.includes(sessionPath)) return "all";
      const childrenIds = sessionItems.map((i) => i.id);
      if (childrenIds.length === 0) return "none";
      const selectedChildren = childrenIds.filter((id) => selectedPaths.includes(id));
      if (selectedChildren.length === 0) return "none";
      if (selectedChildren.length === childrenIds.length) return "all";
      return "mixed";
    }
    return isSelected(folderId) ? "all" : "none";
  };

  const togglePath = (id: string) => {
    const allChildrenIds = sessionItems.map((i) => i.id);
    setSelectedPaths((prev) => {
      const isRoot = id === sessionPath;
      if (isRoot) {
        return getFolderStatus(sessionPath) === "all" ? [] : [sessionPath];
      }
      let newPaths = [...prev];
      const isRootSelected = newPaths.includes(sessionPath);
      if (isRootSelected) {
        newPaths = allChildrenIds.filter((childId) => childId !== id);
      } else {
        if (newPaths.includes(id)) {
          newPaths = newPaths.filter((p) => p !== id);
        } else {
          newPaths.push(id);
        }
        const allSelected =
          allChildrenIds.length > 0 &&
          allChildrenIds.every((childId) => newPaths.includes(childId));
        if (allSelected) return [sessionPath];
      }
      return newPaths;
    });
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateReady(false);
    setUpdateStatus("Checking for update...");
    try {
      const update = await checkForAppUpdates();
      if (update) {
        const confirmed = window.confirm(
          `Update available: v${update.version}\n\nDo you want to download and install it now?`,
        );
        if (confirmed) {
          let totalBytes = 0;
          let downloadedBytes = 0;
          setUpdateStatus(`Downloading v${update.version}...`);
          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case "Started":
                totalBytes = event.data.contentLength ?? 0;
                downloadedBytes = 0;
                setUpdateStatus("Downloading...");
                break;
              case "Progress":
                downloadedBytes += event.data.chunkLength;
                if (totalBytes > 0) {
                  const pct = Math.round((downloadedBytes / totalBytes) * 100);
                  setUpdateStatus(`Downloading... ${pct}%`);
                } else {
                  setUpdateStatus(`Downloading... ${(downloadedBytes / 1024 / 1024).toFixed(1)}MB`);
                }
                break;
              case "Finished":
                setUpdateStatus("Installing...");
                break;
            }
          });
          setUpdateStatus("Update complete!");
          setUpdateReady(true);
          setIsCheckingUpdate(false);
        } else {
          setUpdateStatus(null);
        }
      } else {
        setUpdateStatus("Up to date");
        setTimeout(() => setUpdateStatus(null), 3000);
      }
    } catch (error) {
      console.error("Update check failed:", error);
      setUpdateStatus("Check failed");
      setTimeout(() => setUpdateStatus(null), 3000);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const resizeWindow = useCallback(() => {
    if (!containerRef.current) return;
    const win = getCurrentWindow();
    if (win.label !== "prefs") return;
    const h = containerRef.current.getBoundingClientRect().height;
    win.setSize(new LogicalSize(400, Math.ceil(h)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(resizeWindow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [resizeWindow]);

  return (
    <div className="w-full text-white font-sans select-none">
      <style>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
      <div ref={containerRef} className="relative w-full overflow-hidden bg-[#1c1c1e]">

        {/* Header */}
        <div className="relative px-5 pt-[6px] pb-3 flex items-center justify-center bg-black/30">
          <div className="flex items-center gap-1.5 text-blue-400 pointer-events-none">
            <Settings size={13} />
            <h1 className="text-[12px] font-semibold text-white">Preferences</h1>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-white/[0.06] bg-black/30">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-blue-400 border-b-2 border-blue-400 -mb-px"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4 space-y-4">

          {activeTab === "general" && <>
            {/* Backup Interval */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Clock size={12} className="text-white/20" />
                <span className="text-[9px] font-bold uppercase text-white/20 tracking-[0.12em]">
                  Backup Interval
                </span>
              </div>
              <div className="flex gap-1.5">
                {[5, 15, 30].map((min) => (
                  <button
                    key={min}
                    onClick={() => { setIntervalMinutes(min); setIsEditingCustom(false); }}
                    className={`flex-1 py-2 text-[11px] rounded-xl border transition-all ${
                      intervalMinutes === min && !isEditingCustom
                        ? "bg-blue-600 border-blue-500 text-white font-bold shadow-md"
                        : "bg-transparent border-white/[0.08] text-white/40 hover:bg-white/[0.04]"
                    }`}
                  >
                    {min}m
                  </button>
                ))}
                <div className="flex-1 relative">
                  {isEditingCustom ? (
                    <input
                      ref={customInputRef}
                      type="number"
                      min="1"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      onBlur={() => {
                        const val = parseInt(customValue);
                        if (!isNaN(val) && val > 0) setIntervalMinutes(val);
                        setIsEditingCustom(false);
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") customInputRef.current?.blur(); }}
                      className="w-full py-2 text-[11px] text-center rounded-xl border bg-blue-600/20 border-blue-500 text-blue-400 font-bold focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => { setCustomValue(""); setIsEditingCustom(true); }}
                      className={`w-full py-2 text-[11px] rounded-xl border transition-all ${
                        ![5, 15, 30].includes(intervalMinutes)
                          ? "bg-blue-600 border-blue-500 text-white font-bold shadow-md"
                          : "bg-transparent border-white/[0.08] text-white/40 hover:bg-white/[0.04]"
                      }`}
                    >
                      {![5, 15, 30].includes(intervalMinutes) ? `${intervalMinutes}m` : "Custom"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Notifications & Tooltips */}
            <div className="bg-transparent border border-white/[0.08] rounded-2xl overflow-hidden">
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] border-b border-white/[0.06] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={`transition-colors duration-200 ${notificationsEnabled ? "text-amber-400" : "text-white/20"}`}>
                    {notificationsEnabled ? <Bell size={13} /> : <BellOff size={13} />}
                  </div>
                  <span className="text-[12px] font-semibold text-white/60 group-hover:text-white/80 transition-colors">
                    System Notifications
                  </span>
                </div>
                <div className={`w-9 h-5 rounded-full relative transition-colors ${notificationsEnabled ? "bg-blue-500" : "bg-white/10"}`}>
                  <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-all ${notificationsEnabled ? "left-[18px]" : "left-[2px]"}`} />
                </div>
              </button>

              <button
                onClick={() => setTooltipsEnabled(!tooltipsEnabled)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={`transition-colors duration-200 ${tooltipsEnabled ? "text-blue-400" : "text-white/20"}`}>
                    <Settings size={13} />
                  </div>
                  <span className="text-[12px] font-semibold text-white/60 group-hover:text-white/80 transition-colors">
                    Tooltips
                  </span>
                </div>
                <div className={`w-9 h-5 rounded-full relative transition-colors ${tooltipsEnabled ? "bg-blue-500" : "bg-white/10"}`}>
                  <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full transition-all ${tooltipsEnabled ? "left-[18px]" : "left-[2px]"}`} />
                </div>
              </button>
            </div>
          </>}

          {activeTab === "sync" && <>
            {/* Selective Sync */}
            <div className="space-y-3 select-none">
              <div className="flex items-center gap-2 px-1">
                <FolderTree size={12} className="text-white/20" />
                <span className="text-[9px] font-bold uppercase text-white/20 tracking-[0.12em]">
                  Selective Sync
                </span>
              </div>
              <div className="bg-transparent border border-white/[0.08] rounded-2xl overflow-hidden">
                <div
                  className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.04] border-b border-white/[0.06] transition-all cursor-pointer"
                  onClick={() => togglePath(sessionTree.id)}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                      getFolderStatus(sessionTree.id) !== "none"
                        ? "bg-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                        : "border border-white/20"
                    }`}
                    onClick={(e) => { e.stopPropagation(); togglePath(sessionTree.id); }}
                  >
                    {getFolderStatus(sessionTree.id) === "all" && <Check size={10} strokeWidth={4} />}
                    {getFolderStatus(sessionTree.id) === "mixed" && <Minus size={10} strokeWidth={4} />}
                  </div>
                  <span className="text-[12px] font-semibold text-white/60 truncate">{sessionTree.label}</span>
                </div>
                <div className="py-1">
                  {sessionTree.children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center gap-3 px-4 py-2 pl-10 cursor-pointer hover:bg-white/[0.04] transition-all"
                      onClick={() => togglePath(child.id)}
                    >
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${isSelected(child.id) ? "bg-blue-500/80 text-white" : "border border-white/10"}`}>
                        {isSelected(child.id) && <Check size={10} strokeWidth={4} />}
                      </div>
                      <div className="text-white/20">
                        {child.type === "folder" ? <Folder size={12} /> : <FileCode size={12} />}
                      </div>
                      <span className={`text-[11px] font-medium ${isSelected(child.id) ? "text-white/60" : "text-white/30"}`}>
                        {child.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>}

          {activeTab === "updates" && <>
            {/* App Update */}
            <div className="bg-transparent border border-white/[0.08] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="/tray-icon.png" alt="JSync" className="w-5 h-5 opacity-20" style={{ filter: "invert(1)" }} />
                  <div>
                    <p className="text-[12px] font-semibold text-white/60">JSync</p>
                    <p className="text-[10px] text-white/30 mt-0.5">Version {appVersion}</p>
                  </div>
                </div>
                {updateReady ? (
                  <button
                    onClick={() => invoke("relaunch_app")}
                    className="px-4 py-1.5 rounded-xl border border-green-500/40 bg-green-500/15 text-green-400 text-[11px] font-bold hover:bg-green-500/25 transition-all flex items-center gap-2"
                  >
                    <RefreshCw size={12} />
                    <span>Restart to update</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCheckForUpdates}
                    disabled={isCheckingUpdate}
                    className="px-4 py-1.5 rounded-xl border border-white/[0.08] text-white/40 text-[11px] font-semibold hover:bg-white/[0.04] hover:text-white/60 transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    {isCheckingUpdate ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    <span>{isCheckingUpdate ? (updateStatus ?? "Checking...") : "Check for update"}</span>
                  </button>
                )}
              </div>
              {updateStatus && !updateReady && (
                <div className="px-4 py-2 border-t border-white/[0.06]">
                  <p className="text-[11px] text-white/40">{updateStatus}</p>
                </div>
              )}
            </div>
          </>}

        </div>
      </div>
    </div>
  );
}

export default PrefsApp;
