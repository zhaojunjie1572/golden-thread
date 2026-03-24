import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { ProtocolModel, markSuccess, markFailure, hasExecutedToday } from '../types/protocol';
import { checkAndAdjust } from '../services/autoAdjustment';
import { notificationService } from '../services/notificationService';

interface ProtocolContextType {
  protocols: ProtocolModel[];
  addProtocol: (protocol: ProtocolModel) => void;
  updateProtocol: (protocol: ProtocolModel) => void;
  deleteProtocol: (id: string) => void;
  getProtocolById: (id: string) => ProtocolModel | undefined;
  markProtocolSuccess: (id: string) => void;
  markProtocolFailure: (id: string) => void;
  getTodayProtocols: () => ProtocolModel[];
  isLoading: boolean;
  requestNotificationPermission: () => Promise<boolean>;
  hasNotificationPermission: () => boolean;
}

const ProtocolContext = createContext<ProtocolContextType | undefined>(undefined);

const STORAGE_KEY = 'golden-thread-protocols';

export function ProtocolProvider({ children }: { children: ReactNode }) {
  const [protocols, setProtocols] = useState<ProtocolModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProtocols();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveProtocols();
      notificationService.scheduleAllReminders(protocols);
    }
  }, [protocols, isLoading]);

  useEffect(() => {
    return () => {
      notificationService.cancelAllReminders();
    };
  }, []);

  function loadProtocols() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setProtocols(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load protocols:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function saveProtocols() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(protocols));
    } catch (error) {
      console.error('Failed to save protocols:', error);
    }
  }

  const addProtocol = useCallback((protocol: ProtocolModel) => {
    setProtocols(prev => [...prev, protocol]);
  }, []);

  const updateProtocol = useCallback((updatedProtocol: ProtocolModel) => {
    setProtocols(prev =>
      prev.map(p => p.id === updatedProtocol.id ? updatedProtocol : p)
    );
  }, []);

  const deleteProtocol = useCallback((id: string) => {
    notificationService.cancelReminder(id);
    setProtocols(prev => prev.filter(p => p.id !== id));
  }, []);

  const getProtocolById = useCallback((id: string) => {
    return protocols.find(p => p.id === id);
  }, [protocols]);

  const markProtocolSuccess = useCallback((id: string) => {
    setProtocols(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        let updated = markSuccess(p);
        updated = checkAndAdjust(updated);
        return updated;
      })
    );
  }, []);

  const markProtocolFailure = useCallback((id: string) => {
    setProtocols(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        let updated = markFailure(p);
        updated = checkAndAdjust(updated);
        return updated;
      })
    );
  }, []);

  const getTodayProtocols = useCallback(() => {
    return protocols
      .filter(p => !hasExecutedToday(p))
      .sort((a, b) => b.priority - a.priority);
  }, [protocols]);

  const requestNotificationPermission = useCallback(async () => {
    return await notificationService.requestPermission();
  }, []);

  const hasNotificationPermission = useCallback(() => {
    return notificationService.hasPermission();
  }, []);

  // 使用 useMemo 缓存 context value，避免不必要的重新渲染
  const contextValue = useMemo(() => ({
    protocols,
    addProtocol,
    updateProtocol,
    deleteProtocol,
    getProtocolById,
    markProtocolSuccess,
    markProtocolFailure,
    getTodayProtocols,
    isLoading,
    requestNotificationPermission,
    hasNotificationPermission
  }), [
    protocols,
    isLoading,
    addProtocol,
    updateProtocol,
    deleteProtocol,
    getProtocolById,
    markProtocolSuccess,
    markProtocolFailure,
    getTodayProtocols,
    requestNotificationPermission,
    hasNotificationPermission
  ]);

  return (
    <ProtocolContext.Provider value={contextValue}>
      {children}
    </ProtocolContext.Provider>
  );
}

export function useProtocols() {
  const context = useContext(ProtocolContext);
  if (context === undefined) {
    throw new Error('useProtocols must be used within a ProtocolProvider');
  }
  return context;
}
