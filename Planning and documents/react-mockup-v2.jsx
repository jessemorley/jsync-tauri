import React, { useState, useEffect, useRef } from 'react';
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
  Power,
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

const App = () => {
  // Application State
  const [view, setView] = useState('main'); // 'main' or 'prefs'
  const [backupState, setBackupState] = useState('idle'); // 'idle', 'running', 'success'
  const [globalProgress, setGlobalProgress] = useState(0);
  const [scheduledBackup, setScheduledBackup] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasBackedUpOnce, setHasBackedUpOnce] = useState(false);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const customInputRef = useRef(null);
  
  // Preferences State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // File Tree State
  const [selectedPaths, setSelectedPaths] = useState([
    'session',
    'session/Capture',
    'session/Selects',
    'session/Summer_Fashion_2024.cosessiondb',
    'session/Bonus'
  ]);

  const [destinations, setDestinations] = useState([
    { id: 1, path: "/Volumes/RAID_BACKUP/C1_Backups", enabled: true, type: 'external', label: "RAID_BACKUP" },
    { id: 2, path: "/Users/jmorley/Dropbox/CaptureOne_Sync", enabled: true, type: 'cloud', label: "Dropbox" },
    { id: 4, path: "/Users/jmorley/Backups/Local", enabled: true, type: 'local', label: "Backups" }
  ]);

  // Tree Definition
  const sessionTree = {
    id: 'session',
    label: 'Summer_Fashion_2024',
    type: 'root',
    children: [
      { id: 'session/Capture', label: 'Capture', type: 'folder' },
      { id: 'session/Selects', label: 'Selects', type: 'folder' },
      { id: 'session/Output', label: 'Output', type: 'folder' },
      { id: 'session/Trash', label: 'Trash', type: 'folder' },
      { id: 'session/Bonus', label: 'Bonus', type: 'folder' },
      { id: 'session/Summer_Fashion_2024.cosessiondb', label: 'Summer_Fashion_2024.cosessiondb', type: 'file' },
    ]
  };

  const isSelected = (id) => selectedPaths.includes(id);

  const getFolderStatus = (folderId) => {
    if (folderId === 'session') {
      const children = sessionTree.children.map(c => c.id);
      const selectedChildren = children.filter(id => selectedPaths.includes(id));
      if (selectedChildren.length === 0) return 'none';
      if (selectedChildren.length === children.length) return 'all';
      return 'mixed';
    }
    return isSelected(folderId) ? 'all' : 'none';
  };

  const togglePath = (id) => {
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

  // Focus input when entering custom mode
  useEffect(() => {
    if (isEditingCustom && customInputRef.current) {
      customInputRef.current.focus();
      customInputRef.current.select();
    }
  }, [isEditingCustom]);

  const sessionInfo = {
    name: "Summer_Fashion_2024_Editorial_NYC",
    size: "3.1 GB",
    lastSyncLabel: hasBackedUpOnce ? "Last sync just now" : "Last sync 4 minutes ago"
  };

  const truncateMiddle = (str, startLen = 18, endLen = 8) => {
    if (str.length <= startLen + endLen) return str;
    return str.substring(0, startLen) + "..." + str.substring(str.length - endLen);
  };

  const enabledCount = destinations.filter(d => d.enabled).length;

  const getDestinationIcon = (type, enabled) => {
    const colorClass = enabled ? "" : "text-gray-600";
    switch (type) {
      case 'external': return <HardDrive size={14} className={enabled ? "text-amber-500" : colorClass} />;
      case 'cloud': return <Cloud size={14} className={enabled ? "text-blue-500" : colorClass} />;
      case 'network': return <Network size={14} className={enabled ? "text-purple-500" : colorClass} />;
      default: return <Monitor size={14} className={enabled ? "text-gray-300" : colorClass} />;
    }
  };

  const startBackup = () => {
    if (backupState === 'running' || enabledCount === 0) return;
    setBackupState('running');
    setGlobalProgress(0);
    
    let currentStep = 0;
    const totalSteps = 40; 
    const interval = setInterval(() => {
      if (currentStep >= totalSteps) {
        clearInterval(interval);
        setBackupState('success');
        setGlobalProgress(100);
        setHasBackedUpOnce(true);
        setShowPulse(true); // Trigger completion sequence
        
        // Synchronized reset: everything returns to idle exactly when animations finish
        setTimeout(() => {
          setShowPulse(false);
          setBackupState('idle'); 
          setGlobalProgress(0); 
        }, 2000); 
      } else {
        setGlobalProgress(((currentStep + 1) / totalSteps) * 100);
        currentStep++;
      }
    }, 50); 
  };

  const toggleDestination = (id) => {
    setDestinations(prev => prev.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d));
  };

  const removeDestination = (id) => {
    setDestinations(prev => prev.filter(d => d.id !== id));
  };

  const addDefaultLocation = () => {
    const newId = Date.now();
    setDestinations([...destinations, { id: newId, path: "/Volumes/NEW_DRIVE/Backups", enabled: true, type: 'external', label: "New Destination" }]);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0f0f0f] text-white font-sans selection:bg-blue-500/30">
      <style>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }

        @keyframes completion-pulse {
          0% { border-color: rgba(96, 165, 250, 0.2); }
          25% { border-color: rgba(96, 165, 250, 1); }
          100% { border-color: rgba(255, 255, 255, 0.1); }
        }

        @keyframes fill-fade-out {
          0% { opacity: 0.4; }
          25% { opacity: 0.4; } /* Hold at peak while border pulse reaches max */
          100% { opacity: 0; }
        }

        .animate-completion-pulse {
          animation: completion-pulse 2s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
        }

        .animate-fill-fade {
          animation: fill-fade-out 2s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
        }
      `}</style>

      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-indigo-900/10 via-black to-blue-900/10" />
      
      <div className={`w-[360px] rounded-2xl border shadow-2xl overflow-hidden relative bg-[#1c1c1e]/95 backdrop-blur-2xl shadow-black/50 transition-all duration-300 ${
        (showPulse && isCollapsed) ? 'animate-completion-pulse' : 'border-white/10'
      }`}>
        
        {/* VIEW: MAIN APP */}
        {view === 'main' && (
          <>
            {/* Header */}
            <div className="relative flex flex-col bg-white/5">
              {(backupState === 'running' || backupState === 'success') && isCollapsed && (
                <div 
                  className={`absolute inset-0 bg-blue-600 transition-all duration-300 ease-out z-0 ${backupState === 'success' ? 'animate-fill-fade' : 'opacity-40'}`} 
                  style={{ width: `${globalProgress}%` }} 
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
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-500 ${
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
                  onClick={startBackup}
                  disabled={backupState === 'running' || enabledCount === 0}
                  className={`flex-shrink-0 group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ${
                    backupState === 'running' 
                      ? 'bg-blue-500/20 border border-blue-500/50 text-blue-500 cursor-default shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 
                    backupState === 'success' 
                      ? 'bg-blue-600 border border-blue-400 text-white shadow-lg' : 
                    'bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 active:scale-95 active:bg-blue-500/30'
                  } disabled:opacity-30 disabled:grayscale`}
                >
                  {backupState === 'running' ? (
                    <RefreshCw size={18} className="animate-spin" />
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
                        const isSyncing = (backupState === 'running' || backupState === 'success') && dest.enabled;
                        const hasBackup = hasBackedUpOnce && dest.enabled;
                        const shouldPulse = showPulse && !isCollapsed && dest.enabled;
                        
                        return (
                          <div key={dest.id} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all relative overflow-hidden h-[54px] ${
                            !dest.enabled 
                              ? 'bg-black/20 border-white/[0.08] opacity-50' 
                              : (hasBackup ? 'bg-blue-500/10 border-blue-500/20' : 'bg-white/5 border-white/10 shadow-sm')
                          } ${shouldPulse ? 'animate-completion-pulse' : ''}`}>
                            {isSyncing && (
                              <div 
                                className={`absolute inset-y-0 left-0 bg-blue-600 transition-all duration-300 ease-out z-0 ${backupState === 'success' ? 'animate-fill-fade' : 'opacity-40'}`} 
                                style={{ width: `${globalProgress}%` }} 
                              />
                            )}
                            
                            <button 
                              onClick={() => toggleDestination(dest.id)} 
                              disabled={backupState === 'running'}
                              className={`group/icon z-10 relative flex items-center justify-center w-8 h-8 rounded-lg border transition-all overflow-hidden flex-shrink-0 ${
                                dest.enabled ? 'bg-white/5 border-white/10 hover:bg-black/10 shadow-sm' : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/5'
                              } disabled:cursor-default`}
                            >
                              <div className={`transition-all duration-[120ms] ${dest.enabled && backupState !== 'running' ? 'group-hover/icon:opacity-0 group-hover/icon:scale-95' : 'opacity-100'}`}>
                                {getDestinationIcon(dest.type, dest.enabled)}
                              </div>
                              {dest.enabled && backupState !== 'running' && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/icon:opacity-100 transition-all duration-[120ms] text-gray-400">
                                   <Power size={13} strokeWidth={2.5} />
                                </div>
                              )}
                            </button>

                            <div className="z-10 flex-1 min-w-0">
                              <p className={`text-[11px] font-bold leading-none truncate ${dest.enabled ? 'text-gray-200' : 'text-gray-500'}`}>{dest.label}</p>
                              <p className={`text-[9.5px] font-mono truncate mt-1 transition-opacity duration-300 ${dest.enabled ? 'text-white opacity-80' : 'text-gray-500 opacity-40'}`}>{dest.path}</p>
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
          <div className="p-5 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 shadow-sm transition-all active:scale-[0.98]"
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
               <Settings size={12} />
               <span>{view === 'prefs' ? 'Done' : 'Prefs'}</span>
            </button>
            <button className="text-[10px] uppercase font-bold tracking-[0.1em] text-gray-500 hover:text-red-500">Quit</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;