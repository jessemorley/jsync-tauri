import { useEffect, useRef } from 'react';

export function useScheduler(
  enabled: boolean,
  intervalMinutes: number,
  onTrigger: () => void
) {
  const lastBackupRef = useRef<Date | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const checkInterval = setInterval(() => {
      const now = new Date();
      const lastBackup = lastBackupRef.current;

      if (!lastBackup || (now.getTime() - lastBackup.getTime()) >= intervalMinutes * 60 * 1000) {
        lastBackupRef.current = now;
        onTrigger();
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [enabled, intervalMinutes, onTrigger]);

  // Function to manually update last backup time (call after successful backup)
  const updateLastBackup = () => {
    lastBackupRef.current = new Date();
  };

  return { updateLastBackup };
}
