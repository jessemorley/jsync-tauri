import React, { useState } from 'react';
import {
  ArrowLeft,
  Monitor,
  ExternalLink,
  Star,
  Trash2,
  ChevronRight
} from 'lucide-react';

const location = {
  key: 'macbook',
  label: 'MacBook Studio',
  path: '/Volumes/SSD_PRO',
  icon: <Monitor size={24} />,
  used: '516GB',
  total: '2TB',
  percent: 25.8,
  lastSynced: '4 mins ago'
};

export default function LocationDetail() {
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="min-h-screen bg-cover bg-center flex flex-col items-center justify-start pt-[15vh] p-8 font-sans antialiased text-white" style={{ backgroundImage: 'url(/img/wallpaper.png)' }}>
      <div className="w-[380px] bg-[#141416] rounded-[26px] shadow-[0_80px_160px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] flex flex-col relative border border-white/[0.08] overflow-hidden origin-top">
        <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">

          {/* Nav header */}
          <div className="shrink-0 px-5 py-4 bg-black/60 border-b border-white/5">
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-xl bg-white/5 text-white/30 hover:text-white/60 transition-colors">
                <ArrowLeft size={16} />
              </button>
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/60">Location Details</span>
            </div>
          </div>

          {/* Location info */}
          <div className="shrink-0 px-6 pt-5 pb-5 bg-black/20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEnabled(!enabled)}
                className={`p-2 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${
                  enabled ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-white/20'
                }`}
                title={enabled ? 'Disable Location' : 'Enable Location'}
              >
                {location.icon}
              </button>
              <div>
                <h2 className="text-[15px] font-bold text-white tracking-tight">{location.label}</h2>
                <p className="text-[10px] text-white/30 font-mono mt-0.5 break-all">{location.path}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4 flex-1 space-y-4 overflow-y-auto bg-black/20">

            {/* Last Synced */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em]">Last Synced</span>
              <span className="text-[11px] font-medium text-white/40">{location.lastSynced}</span>
            </div>

            {/* Capacity Card */}
            <div className="bg-transparent border border-white/[0.08] px-3.5 py-3 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-white/20">Destination Capacity</span>
                <span className="text-white/40">{location.used} / {location.total}</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${enabled ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.4)]' : 'bg-white/20'}`}
                  style={{ width: `${location.percent}%` }}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="bg-transparent border border-white/[0.08] rounded-2xl overflow-hidden">
              <button className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.04] border-b border-white/[0.06] transition-all group">
                <div className="flex items-center gap-3">
                  <ExternalLink size={14} className="text-blue-400/40 group-hover:text-blue-400 transition-colors" />
                  <span className="text-[12px] font-bold text-white/70">Open in Finder</span>
                </div>
                <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors" />
              </button>

              <button className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.04] border-b border-white/[0.06] transition-all group">
                <div className="flex items-center gap-3">
                  <Star size={14} className="text-yellow-500/40 group-hover:text-yellow-500 transition-colors" />
                  <span className="text-[12px] font-bold text-white/70">Make Default Location</span>
                </div>
                <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors" />
              </button>

              <button className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.04] transition-all group">
                <div className="flex items-center gap-3">
                  <Trash2 size={14} className="text-red-500/40 group-hover:text-red-500 transition-colors" />
                  <span className="text-[12px] font-bold text-white/70">Delete existing backup</span>
                </div>
                <ChevronRight size={14} className="text-white/20 group-hover:text-white/50 transition-colors" />
              </button>
            </div>

          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 pt-3 pb-5 bg-black/20">
            <button className="w-full h-[42px] bg-red-500/10 hover:bg-red-500/20 text-red-400 font-black rounded-2xl transition-all uppercase text-[11px] tracking-[0.2em] border border-red-500/20">
              Remove Location
            </button>
          </div>

        </div>
      </div>

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px] -z-10" />
    </div>
  );
}
