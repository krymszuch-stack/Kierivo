import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Layers,
  CheckSquare,
  Radio,
  FileCheck2,
  Calendar,
  Building,
  Plus,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  MasterVault,
  InterviewLoopSession,
  JobOffer,
} from '../../types';
import {
  createInterviewSession,
  loadInterviewSessions,
  saveInterviewSession,
  deleteInterviewSession,
} from '../../lib/interviewLoopEngine';
import { PreCallChecklistView } from '../../components/loop/PreCallChecklistView';
import { LiveTrackerView } from '../../components/loop/LiveTrackerView';
import { PostCallDebriefView } from '../../components/loop/PostCallDebriefView';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { useAuth } from '../../context/AuthContext';
import { ANONYMOUS_PROFILE_ID } from '../../lib/localProfile';

export interface InterviewLoopModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: MasterVault;
  jobOffer?: JobOffer;
}

export type LoopSubSkillTab = 'CHECKLIST' | 'LIVE_TRACKER' | 'DEBRIEF';

export const InterviewLoopModal: React.FC<InterviewLoopModalProps> = ({
  isOpen,
  onClose,
  vault,
  jobOffer,
}) => {
  const { user } = useAuth();
  const profileId = user?.id ?? ANONYMOUS_PROFILE_ID;
  const [activeTab, setActiveTab] = useState<LoopSubSkillTab>('CHECKLIST');
  const [sessionsState, setSessionsState] = useState<{ profileId: string; items: InterviewLoopSession[] }>({ profileId, items: [] });
  const sessions = sessionsState.profileId === profileId ? sessionsState.items : [];
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Ładowanie sesji przy otwarciu
  useEffect(() => {
    if (isOpen) {
      const stored = loadInterviewSessions(profileId);
      if (stored.length > 0) {
        setSessionsState({ profileId, items: stored });
        setActiveSessionId(stored[0].id);
      } else {
        // Jeśli brak sesji, utwórz nową na bazie bieżącej oferty lub profilu
        const newSession = createInterviewSession(
          jobOffer?.company || 'Firma Rekrutująca',
          jobOffer?.title || vault.personalInfo?.title || 'Stanowisko Docelowe',
          undefined,
          jobOffer?.id
        );
        saveInterviewSession(profileId, newSession);
        setSessionsState({ profileId, items: [newSession] });
        setActiveSessionId(newSession.id);
      }
    }
  }, [isOpen, jobOffer, vault, profileId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const handleUpdateSession = (updated: InterviewLoopSession) => {
    setSessionsState((prev) => ({
      profileId,
      items: (prev.profileId === profileId ? prev.items : []).map((s) => (s.id === updated.id ? updated : s)),
    }));
    saveInterviewSession(profileId, updated);
  };

  const handleCreateNewSession = () => {
    const newSession = createInterviewSession(
      'Nowa Rozmowa',
      vault.personalInfo?.title || 'Stanowisko'
    );
    saveInterviewSession(profileId, newSession);
    setSessionsState((prev) => ({ profileId, items: [newSession, ...(prev.profileId === profileId ? prev.items : [])] }));
    setActiveSessionId(newSession.id);
    setActiveTab('CHECKLIST');
  };

  const handleDeleteSession = (id: string) => {
    deleteInterviewSession(profileId, id);
    const remaining = sessions.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      const freshSession = createInterviewSession(
        'Nowa Rozmowa',
        vault.personalInfo?.title || 'Stanowisko'
      );
      saveInterviewSession(profileId, freshSession);
      setSessionsState({ profileId, items: [freshSession] });
      setActiveSessionId(freshSession.id);
      setActiveTab('CHECKLIST');
      return;
    }

    setSessionsState({ profileId, items: remaining });
    if (activeSessionId === id) {
      setActiveSessionId(remaining[0].id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-4xl rounded-3xl border border-line bg-elevated shadow-floating p-6 space-y-5 my-8"
      >
        {/* Header Modala */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-on-brand shadow-raised">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-ink tracking-tight font-mono">
                  Interview Loop Manager
                </h3>
                <Chip variant="brand" size="sm">
                  Cykl 360°
                </Chip>
              </div>
              <p className="text-xs text-muted">
                3 zintegrowane sub-skille: Checklista Techniczna • Live Tracker • Post-Call Debrief
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted hover:bg-sunken hover:text-ink transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Pasek wyboru aktywnej sesji rozmowy */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-mono transition-all ${
                  sess.id === activeSession.id
                    ? 'border-brand-500 bg-brand-500/10 text-brand-700 font-bold'
                    : 'border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveSessionId(sess.id)}
                  className="truncate max-w-[140px]"
                >
                  {sess.companyName} ({sess.roleTitle})
                </button>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSession(sess.id)}
                    className="text-muted hover:text-error"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Plus}
            onClick={handleCreateNewSession}
          >
            Nowa Rozmowa
          </Button>
        </div>

        {/* Nawigacja Sub-skilli */}
        <div className="flex rounded-2xl bg-sunken p-1 border border-line">
          <button
            type="button"
            onClick={() => setActiveTab('CHECKLIST')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 font-mono text-xs font-bold transition-all ${
              activeTab === 'CHECKLIST'
                ? 'bg-ink text-surface shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            <span>1. Pre-Call Checklist</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LIVE_TRACKER')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 font-mono text-xs font-bold transition-all ${
              activeTab === 'LIVE_TRACKER'
                ? 'bg-brand-600 text-on-brand shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            <span>2. Live Tracker</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DEBRIEF')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 font-mono text-xs font-bold transition-all ${
              activeTab === 'DEBRIEF'
                ? 'bg-ink text-surface shadow-xs'
                : 'text-muted hover:text-ink'
            }`}
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>3. Post-Call Debrief</span>
          </button>
        </div>

        {/* Zawartość wybranego Sub-skilla */}
        <div>
          {activeTab === 'CHECKLIST' && (
            <PreCallChecklistView
              session={activeSession}
              onUpdateSession={handleUpdateSession}
              onStartLiveTracking={() => setActiveTab('LIVE_TRACKER')}
            />
          )}

          {activeTab === 'LIVE_TRACKER' && (
            <LiveTrackerView
              session={activeSession}
              onUpdateSession={handleUpdateSession}
              onFinishToDebrief={() => setActiveTab('DEBRIEF')}
            />
          )}

          {activeTab === 'DEBRIEF' && (
            <PostCallDebriefView
              profileId={profileId}
              session={activeSession}
              vault={vault}
              onUpdateSession={handleUpdateSession}
              onClose={onClose}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
};
