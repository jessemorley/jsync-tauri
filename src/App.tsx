import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Timer,
  RefreshCw,
  HardDrive,
  Cloud,
  Network,
  Monitor,
  CheckCircle2,
  Clock,
  Database,
  ChevronDown,
  ChevronUp,
  Settings,
  Bell,
  BellOff,
  FolderTree,
  X,
  Check,
  Minus,
  Folder,
  FileCode
} from 'lucide-react';
import './App.css';
import type { Destination, SessionInfo } from './lib/types';
import { usePersistedState } from './hooks/useStore';
import { useScheduler } from './hooks/useScheduler';
import {
  getCaptureOneSession,
  openFolderPicker,
  parseDestination,
  startBackup,
  cancelBackup,
  onBackupProgress,
  onBackupComplete,
  onBackupError,
  sendBackupNotification,
  onRefreshSession,
  requestNotificationPermission,
} from './lib/tauri';
import { invoke } from '@tauri-apps/api/core';

const completionAnimations = `
  @keyframes completion-pulse {
    0% { border-color: rgba(59, 130, 246, 0.2); }
    25% { border-color: rgba(37, 99, 235, 1); }
    100% { border-color: rgba(255, 255, 255, 0.1); }
  }

  @keyframes fill-fade-out {
    0%, 20% { opacity: 0.4; width: 100%; }
    100% { opacity: 0; width: 100%; }
  }

  .animate-completion-pulse {
    animation: completion-pulse 2s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }

  .animate-fill-fade {
    animation: fill-fade-out 2s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }
`;

function App() {
  // Application State
  const [view, setView] = useState<'main' | 'prefs'>('main');
  const [backupState, setBackupState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [globalProgress, setGlobalProgress] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasBackedUpOnce, setHasBackedUpOnce] = useState(false);
  const [backedUpDestinations, setBackedUpDestinations] = useState<Set<number>>(new Set());
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [isHoveringSync, setIsHoveringSync] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);

  // Reset backup status when session changes
  useEffect(() => {
    setBackedUpDestinations(new Set());
    setHasBackedUpOnce(false);
  }, [session?.path]);

  // Persisted State
  const [scheduledBackup, setScheduledBackup] = usePersistedState('scheduledBackup', true);
  const [intervalMinutes, setIntervalMinutes] = usePersistedState('intervalMinutes', 15);
  const [destinations, setDestinations] = usePersistedState<Destination[]>('destinations', []);
  const [selectedPaths, setSelectedPaths] = usePersistedState<string[]>('selectedPaths', [
    'session',
    'session/Capture',
    'session/Selects',
  ]);
  const [notificationsEnabled, setNotificationsEnabled] = usePersistedState('notificationsEnabled', true);
  const notificationsEnabledRef = useRef(notificationsEnabled);

  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  // Request notification permission on mount
  useEffect(() => {
    if (notificationsEnabled) {
      requestNotificationPermission();
    }
  }, []);

  // Focus input when entering custom mode
  useEffect(() => {
    if (isEditingCustom && customInputRef.current) {
      customInputRef.current.focus();
      customInputRef.current.select();
    }
  }, [isEditingCustom]);

  // Load session info
  const refreshSession = useCallback(() => {
    getCaptureOneSession()
      .then(setSession)
      .catch(err => {
        console.error('Failed to get Capture One session:', err);
        setSession(null);
      });
  }, []);

  useEffect(() => {
    refreshSession();
    
    // Poll for session changes every 30 seconds
    const interval = setInterval(refreshSession, 30000);
    
    // Also refresh when the window becomes visible
    const handleFocus = () => refreshSession();
    window.addEventListener('focus', handleFocus);

    let unlisten: () => void;
    onRefreshSession(() => {
      refreshSession();
    }).then(u => unlisten = u);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      if (unlisten) unlisten();
    };
  }, [refreshSession]);

  // Inject completion animations CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = completionAnimations;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Setup backup event listeners
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenProgress = await onBackupProgress((progress) => {
        setGlobalProgress(progress.percent);
      });

      unlistenComplete = await onBackupComplete((result) => {
        if (result.success) {
          // Add destination to backed-up set
          setBackedUpDestinations(prev => new Set([...prev, result.destination_id]));

          setBackupState('success');
          setGlobalProgress(100); // Ensure 100% before animations start
          setHasBackedUpOnce(true);
          
          if (notificationsEnabledRef.current) {
            sendBackupNotification('Backup Complete', `Backup completed successfully`);
          }
          
          setTimeout(() => {
            setBackupState('idle');
            setGlobalProgress(0);
          }, 3000);
        }
      });

      unlistenError = await onBackupError((error) => {
        setBackupState('error');
        if (notificationsEnabledRef.current && error.error) {
          sendBackupNotification('Backup Failed', error.error);
        }
        setTimeout(() => {
          setBackupState('idle');
          setGlobalProgress(0);
        }, 3000);
      });
    };

    setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
      if (unlistenError) unlistenError();
    };
  }, []); // Empty dependency array, using refs for dynamic state

  const handleStartBackup = useCallback(async () => {
    if (enabledCount === 0 || !session) return;

    if (backupState === 'running') {
      console.log('User requested backup cancellation');
      try {
        await cancelBackup();
        console.log('cancelBackup command sent to backend');
        setBackupState('idle');
        setGlobalProgress(0);
      } catch (error) {
        console.error('Failed to cancel backup:', error);
      }
      return;
    }

    setBackupState('running');
    setGlobalProgress(0);

    try {
      await startBackup(session.path, session.name, destinations, selectedPaths);
      updateLastBackup();
    } catch (error) {
      console.log('Backup error/cancel received:', error);
      if (error === 'Backup cancelled') {
        console.log('Setting state to idle due to cancellation');
        setBackupState('idle');
      } else {
        console.error('Backup failed:', error);
        setBackupState('error');
      }
      setTimeout(() => {
        setBackupState('idle');
        setGlobalProgress(0);
      }, 3000);
    }
  }, [session, destinations, selectedPaths, backupState]);

  // Scheduler setup
  const { updateLastBackup } = useScheduler(
    scheduledBackup,
    intervalMinutes,
    handleStartBackup
  );

  const sessionInfo = {
    name: session?.name || "No Session",
    size: session?.size || "0B",
    lastSyncLabel: hasBackedUpOnce ? "Last sync just now" : "Never synced"
  };

  // Mock tree - in production this would come from getSessionContents
  const sessionTree = {
    id: 'session',
    label: session?.name || 'Session',
    type: 'root',
    children: [
      { id: 'session/Capture', label: 'Capture', type: 'folder' },
      { id: 'session/Selects', label: 'Selects', type: 'folder' },
      { id: 'session/Output', label: 'Output', type: 'folder' },
      { id: 'session/Trash', label: 'Trash', type: 'folder' },
    ]
  };

  const truncateMiddle = (str: string, startLen = 18, endLen = 8) => {
    if (str.length <= startLen + endLen) return str;
    return str.substring(0, startLen) + "..." + str.substring(str.length - endLen);
  };

  const enabledCount = destinations.filter(d => d.enabled).length;

  const getDestinationIcon = (type: string, enabled: boolean) => {
    const colorClass = enabled ? "" : "text-gray-600";
    switch (type) {
      case 'external': return <HardDrive size={14} className={enabled ? "text-amber-500" : colorClass} />;
      case 'cloud': return <Cloud size={14} className={enabled ? "text-blue-500" : colorClass} />;
      case 'network': return <Network size={14} className={enabled ? "text-purple-500" : colorClass} />;
      default: return <Monitor size={14} className={enabled ? "text-gray-300" : colorClass} />;
    }
  };

  const toggleDestination = (id: number) => {
    setDestinations(prev => prev.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d));
  };

  const removeDestination = (id: number) => {
    setDestinations(prev => prev.filter(d => d.id !== id));
    setBackedUpDestinations(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const addDefaultLocation = async () => {
    const path = await openFolderPicker();
    if (path) {
      const destination = await parseDestination(path);
      setDestinations(prev => [...prev, destination]);
    }
  };

  const isSelected = (id: string) => selectedPaths.includes(id);

  const getFolderStatus = (folderId: string) => {
    if (folderId === 'session') {
      const children = sessionTree.children.map(c => c.id);
      const selectedChildren = children.filter(id => selectedPaths.includes(id));
      if (selectedChildren.length === 0) return 'none';
      if (selectedChildren.length === children.length) return 'all';
      return 'mixed';
    }
    return isSelected(folderId) ? 'all' : 'none';
  };

  const togglePath = (id: string) => {
    if (id === 'session') {
      const status = getFolderStatus('session');
      if (status === 'all') {
        setSelectedPaths([]);
      } else {
        setSelectedPaths(['session', ...sessionTree.children.map(c => c.id)]);
      }
      return;
    }

    setSelectedPaths(prev => {
      const newPaths = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      const hasAny = sessionTree.children.some(c => newPaths.includes(c.id));
      if (hasAny && !newPaths.includes('session')) return [...newPaths, 'session'];
      if (!hasAny && newPaths.includes('session')) return newPaths.filter(p => p !== 'session');
      return newPaths;
    });
  };

  return (
    <div className="w-full h-full text-white font-sans select-none">
      <style>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>

      <div className={`w-full h-full rounded-2xl border overflow-hidden relative bg-[#1c1c1e] transition-all duration-300 ${
        backupState === 'success' && isCollapsed ? 'animate-completion-pulse' : 'border-white/10'
      }`}>

        {/* VIEW: MAIN APP */}
        {view === 'main' && (
          <>
            {/* Header */}
            <div className="relative flex flex-col bg-white/5">
              {(backupState === 'running' || backupState === 'success') && isCollapsed && (
                <div
                  className={`absolute inset-0 bg-blue-600 transition-all duration-300 ease-out z-0 ${
                    backupState === 'success' ? 'animate-fill-fade opacity-40' : 'opacity-40'
                  }`}
                  style={{ width: backupState === 'success' ? '100%' : `${globalProgress}%` }}
                />
              )}

              <div className="p-4 px-5 flex items-center justify-between gap-3 z-10">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1.5 -ml-1 rounded-lg transition-all flex-shrink-0 hover:bg-white/10 text-gray-400 active:bg-white/5"
                  >
                    {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>

                  <div className="flex-1 min-w-0 py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        !session ? 'bg-gray-500' :
                        backupState === 'running' ? 'bg-blue-500 animate-pulse' :
                        backupState === 'success' ? 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.6)]' :
                        'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]'
                      }`} />
                      <h3 className="font-bold text-[13px] tracking-tight leading-none text-white truncate" title={sessionInfo.name}>
                        {truncateMiddle(sessionInfo.name)}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400 opacity-80">
                      <Database size={10} className="flex-shrink-0" />
                      <p className="text-[10px] font-bold tracking-wide uppercase">{sessionInfo.size}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleStartBackup}
                  onMouseEnter={() => setIsHoveringSync(true)}
                  onMouseLeave={() => setIsHoveringSync(false)}
                  disabled={enabledCount === 0}
                  className={`flex-shrink-0 group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ${
                    backupState === 'running'
                      ? (isHoveringSync ? 'bg-red-500/20 border border-red-500/50 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-blue-500/20 border border-blue-500/50 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]') :
                    backupState === 'success'
                      ? 'bg-blue-600 border border-blue-400 text-white shadow-lg' :
                    'bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 active:scale-95 active:bg-blue-500/30'
                  } disabled:opacity-30 disabled:grayscale`}
                >
                  {backupState === 'running' ? (
                    isHoveringSync ? <X size={18} /> : <RefreshCw size={18} className="animate-spin" />
                  ) : backupState === 'success' ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <RefreshCw size={18} className="transition-transform duration-500 group-hover:rotate-180 ease-in-out" />
                  )}
                </button>
              </div>
              <div className="h-px w-full bg-white/5" />
            </div>

            {/* Collapsible Content */}
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isCollapsed ? 'max-h-0' : 'max-h-[600px]'}`}>
              <div className="p-4 space-y-4">
                {/* Locations Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                     <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 text-white">Locations</span>
                     <button
                      onClick={addDefaultLocation}
                      className="p-1 rounded-md transition-colors hover:bg-white/10 text-blue-400">
                       <Plus size={14} />
                     </button>
                  </div>

                  <div className="space-y-2">
                    {destinations.length > 0 ? (
                      destinations.map((dest) => {
                        const isBackingUp = (backupState === 'running' || backupState === 'success') && dest.enabled;
                        const hasBackup = backedUpDestinations.has(dest.id) && dest.enabled;
                        const shouldPulse = backupState === 'success' && !isCollapsed && dest.enabled;
                        return (
                          <div key={dest.id} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all relative overflow-hidden h-[54px] ${
                            !dest.enabled
                              ? 'bg-black/20 border-white/[0.08] opacity-50'
                              : hasBackup
                                ? 'bg-blue-500/10 border-blue-500/20'
                                : 'bg-white/5 border-white/10 shadow-sm'
                          } ${shouldPulse ? 'animate-completion-pulse' : ''}`}>
                            {isBackingUp && (
                              <div
                                className={`absolute inset-y-0 left-0 bg-blue-600 transition-all duration-300 ease-out z-0 ${
                                  backupState === 'success' ? 'animate-fill-fade opacity-40' : 'opacity-40'
                                }`}
                                style={{ width: backupState === 'success' ? '100%' : `${globalProgress}%` }}
                              />
                            )}

                            <button
                              onClick={() => toggleDestination(dest.id)}
                              disabled={backupState === 'running'}
                              className={`group/icon z-10 relative flex items-center justify-center w-8 h-8 rounded-lg border transition-all overflow-hidden flex-shrink-0 ${
                                dest.enabled ? 'bg-white/5 border-white/10 hover:bg-black/10 shadow-sm' : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/5'
                              } disabled:cursor-default`}
                            >
                              {getDestinationIcon(dest.destination_type, dest.enabled)}
                            </button>

                            <div className="z-10 flex-1 min-w-0">
                              <p className={`text-[11px] font-bold leading-none truncate ${dest.enabled ? 'text-gray-200' : 'text-gray-500'}`}>{dest.label}</p>
                              <p className="text-[9.5px] font-mono truncate text-gray-500 mt-1">{dest.path}</p>
                            </div>

                            <button
                              onClick={() => removeDestination(dest.id)}
                              disabled={backupState === 'running'}
                              className="z-10 p-1 transition-colors disabled:opacity-0 text-gray-600 hover:text-red-400"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <button
                        onClick={addDefaultLocation}
                        className="group w-full flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] hover:bg-white/5 transition-all h-[54px]"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-gray-500 group-hover:text-blue-400 transition-all flex-shrink-0">
                          <Plus size={16} />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-[11px] font-bold leading-none text-gray-400">No destinations added</p>
                          <p className="text-[9.5px] truncate mt-1 text-gray-600">Click to add a drive or cloud folder</p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                <div className="h-px -mx-4 bg-white/5" />

                {/* Schedule Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                     <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 text-white">Schedule</span>
                  </div>

                  <div className="p-2.5 border border-white/10 rounded-xl space-y-3 shadow-sm bg-white/5">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Timer size={13} className={scheduledBackup ? 'text-blue-400' : 'text-gray-500'} />
                        <span className="text-[10px] font-bold uppercase text-gray-500">{scheduledBackup ? 'Sync Every' : 'Paused'}</span>
                      </div>
                      <button onClick={() => setScheduledBackup(!scheduledBackup)} className={`w-7 h-4 rounded-full relative transition-colors ${scheduledBackup ? 'bg-blue-500' : 'bg-gray-400'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${scheduledBackup ? 'left-[15px]' : 'left-0.5'}`} />
                      </button>
                    </div>

                    {scheduledBackup && (
                      <div className="flex gap-1.5 p-0.5">
                        {[5, 15, 30].map((min) => (
                          <button
                            key={min}
                            onClick={() => { setIntervalMinutes(min); setIsEditingCustom(false); }}
                            className={`flex-1 py-1.5 text-[9px] rounded-lg border transition-all ${
                              intervalMinutes === min && !isEditingCustom
                                ? 'bg-blue-600 border-blue-500 text-white font-bold shadow-md'
                                : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'
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
                              value={intervalMinutes}
                              onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 1)}
                              onBlur={() => setIsEditingCustom(false)}
                              className="w-full py-1.5 text-[9px] text-center rounded-lg border bg-blue-600/20 border-blue-500 text-blue-400 font-bold focus:outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => setIsEditingCustom(true)}
                              className={`w-full py-1.5 text-[9px] rounded-lg border transition-all ${
                                ! [5, 15, 30].includes(intervalMinutes)
                                  ? 'bg-blue-600 border-blue-500 text-white font-bold shadow-md'
                                  : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'
                              }`}
                            >
                              {![5, 15, 30].includes(intervalMinutes) ? `${intervalMinutes}m` : 'Custom'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* VIEW: PREFERENCES */}
        {view === 'prefs' && (
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-white flex items-center gap-2">
                <Settings size={14} className="text-blue-400" />
                Preferences
              </h2>
              <button
                onClick={() => setView('main')}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Session File Tree Selection */}
            <div className="space-y-3 select-none">
              <div className="flex items-center gap-2 px-1">
                <FolderTree size={12} className="text-gray-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Session Contents</span>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden shadow-sm bg-white/5">
                {/* Root Level */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer"
                  onClick={() => togglePath(sessionTree.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded flex items-center justify-center ${
                      getFolderStatus(sessionTree.id) !== 'none' ? 'bg-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'border border-white/20'
                    }`}>
                      {getFolderStatus(sessionTree.id) === 'all' && <Check size={10} strokeWidth={4} />}
                      {getFolderStatus(sessionTree.id) === 'mixed' && <Minus size={10} strokeWidth={4} />}
                    </div>
                    <span className="text-[11px] font-bold text-gray-200 truncate">{sessionTree.label}</span>
                  </div>
                </div>

                {/* Children with Darker BG */}
                <div className="bg-black/40 border-t border-white/5 py-1">
                  {sessionTree.children.map(child => (
                    <div
                      key={child.id}
                      className="flex items-center justify-between p-2 pl-9 cursor-pointer"
                      onClick={() => togglePath(child.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${
                          isSelected(child.id) ? 'bg-blue-500/80 text-white' : 'border border-white/10'
                        }`}>
                          {isSelected(child.id) && <Check size={10} strokeWidth={4} />}
                        </div>

                        {/* File Type Icons */}
                        <div className="text-gray-500/80">
                          {child.type === 'folder' ? <Folder size={12} /> : <FileCode size={12} />}
                        </div>

                        <span className={`text-[10px] font-medium ${isSelected(child.id) ? 'text-gray-300' : 'text-gray-500'}`}>
                          {child.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            {/* Notifications Toggle */}
            <div className="space-y-3">
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`transition-colors duration-200 ${notificationsEnabled ? 'text-amber-400' : 'text-gray-400'}`}>
                    {notificationsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-bold text-white">System Notifications</p>
                    <p className="text-[9px] text-gray-500">Alert when backup completes</p>
                  </div>
                </div>
                <div className={`w-7 h-4 rounded-full relative transition-colors ${notificationsEnabled ? 'bg-blue-500' : 'bg-gray-600'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${notificationsEnabled ? 'left-[15px]' : 'left-0.5'}`} />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/5 bg-black/40 flex items-center justify-between z-20">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500">
            <Clock size={10} className="opacity-70" />
            <span>{view === 'prefs' ? 'Auto-saved' : sessionInfo.lastSyncLabel}</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView(view === 'main' ? 'prefs' : 'main')}
              className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                view === 'prefs' ? 'text-blue-400' : 'text-gray-500 hover:text-blue-400'
              }`}
            >
               {view === 'main' && <Settings size={12} />}
               <span>{view === 'prefs' ? 'Done' : 'Settings'}</span>
            </button>
            {view === 'main' && (
              <button
                onClick={() => invoke('quit_app')}
                className="text-[10px] uppercase font-bold tracking-[0.1em] text-gray-500 hover:text-red-500 transition-colors"
              >
                Quit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
