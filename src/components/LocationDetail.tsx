import { useState } from "react";
import {
  ArrowLeft,
  HardDrive,
  Cloud,
  Network,
  Monitor,
  ExternalLink,
  Trash2,
  ChevronRight,
  Pin,
  PinOff,
  X,
  Check,
} from "lucide-react";
import type { Destination } from "../lib/types";

interface LocationDetailProps {
  dest: Destination;
  lastSynced: string | null;
  isDefault: boolean;
  onBack: () => void;
  onToggleEnabled: () => void;
  onToggleDefault: () => void;
  onDeleteBackup: () => Promise<void>;
  onRemove: () => void;
  onOpenInFinder: () => void;
  formatLastSync: (iso: string | null) => string;
}

function getIcon(type: string, enabled: boolean, size = 20) {
  const color = enabled ? undefined : "text-white/20";
  switch (type) {
    case "external":
      return <HardDrive size={size} className={enabled ? "text-amber-500" : color} />;
    case "cloud":
      return <Cloud size={size} className={enabled ? "text-blue-400" : color} />;
    case "network":
      return <Network size={size} className={enabled ? "text-purple-400" : color} />;
    default:
      return <Monitor size={size} className={enabled ? "text-gray-300" : color} />;
  }
}

export function LocationDetail({
  dest,
  lastSynced,
  isDefault,
  onBack,
  onToggleEnabled,
  onToggleDefault,
  onDeleteBackup,
  onRemove,
  onOpenInFinder,
  formatLastSync,
}: LocationDetailProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteBackup = async () => {
    setIsDeleting(true);
    try {
      await onDeleteBackup();
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">

      {/* Nav header */}
      <div className="shrink-0 px-4 py-3 bg-black/40 border-b border-white/[0.06] flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-xl bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40">
          Location Details
        </span>
      </div>

      {/* Location info */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleEnabled}
            className={`p-2 rounded-xl transition-all hover:scale-105 active:scale-95 ${
              dest.enabled
                ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                : "bg-white/5 text-white/20 hover:bg-white/10"
            }`}
            title={dest.enabled ? "Disable Location" : "Enable Location"}
          >
            {getIcon(dest.destination_type, dest.enabled)}
          </button>
          <div className="min-w-0">
            <h2 className="text-[14px] font-bold text-white tracking-tight truncate">
              {dest.label}
            </h2>
            <p className="text-[10px] text-white/30 font-mono mt-0.5 truncate">
              {dest.path}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">

        {/* Last Synced */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.12em]">
            Last Synced
          </span>
          <span className="text-[11px] font-medium text-white/40">
            {formatLastSync(lastSynced)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="bg-transparent border border-white/[0.08] rounded-2xl overflow-hidden">
          {/* Open in Finder */}
          <button
            onClick={onOpenInFinder}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] border-b border-white/[0.06] transition-all group"
          >
            <div className="flex items-center gap-3">
              <ExternalLink size={13} className="text-blue-400/40 group-hover:text-blue-400 transition-colors" />
              <span className="text-[12px] font-semibold text-white/60 group-hover:text-white/80 transition-colors">
                Open in Finder
              </span>
            </div>
            <ChevronRight size={13} className="text-white/20 group-hover:text-white/50 transition-colors" />
          </button>

          {/* Make Default */}
          <button
            onClick={onToggleDefault}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.04] border-b border-white/[0.06] transition-all group"
          >
            <div className="flex items-center gap-3">
              {isDefault ? (
                <PinOff size={13} className="text-blue-400/60 group-hover:text-blue-400 transition-colors" />
              ) : (
                <Pin size={13} className="text-yellow-500/40 group-hover:text-yellow-400 transition-colors" />
              )}
              <span className="text-[12px] font-semibold text-white/60 group-hover:text-white/80 transition-colors">
                {isDefault ? "Remove Default" : "Make Default Location"}
              </span>
            </div>
            {isDefault ? (
              <Check size={13} className="text-blue-400" />
            ) : (
              <ChevronRight size={13} className="text-white/20 group-hover:text-white/50 transition-colors" />
            )}
          </button>

          {/* Delete backup */}
          {confirmingDelete ? (
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
              <span className="flex-1 text-[11px] text-white/40">Delete backup data?</span>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-colors text-[10px] font-semibold"
              >
                <X size={10} /> Cancel
              </button>
              <button
                onClick={handleDeleteBackup}
                disabled={isDeleting}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-[10px] font-semibold disabled:opacity-50"
              >
                <Trash2 size={10} /> {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => dest.has_existing_backup && setConfirmingDelete(true)}
              disabled={!dest.has_existing_backup}
              className={`w-full px-4 py-3 flex items-center justify-between transition-all group ${
                dest.has_existing_backup
                  ? "hover:bg-white/[0.04]"
                  : "opacity-40 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center gap-3">
                <Trash2
                  size={13}
                  className={
                    dest.has_existing_backup
                      ? "text-red-500/40 group-hover:text-red-500 transition-colors"
                      : "text-white/20"
                  }
                />
                <span className="text-[12px] font-semibold text-white/60 group-hover:text-white/80 transition-colors">
                  Delete existing backup
                </span>
              </div>
              <ChevronRight size={13} className="text-white/20 group-hover:text-white/50 transition-colors" />
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pt-2 pb-4">
        <button
          onClick={onRemove}
          className="w-full h-[38px] bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black rounded-2xl transition-all uppercase text-[10px] tracking-[0.2em] border border-red-500/20"
        >
          Remove Location
        </button>
      </div>
    </div>
  );
}
