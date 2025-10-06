import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, MessageSquare, UserCircle, Calculator, Award, Plus } from 'lucide-react';
import GroupsList from '@/components/groups/GroupsList';
import CreateGroup from '@/components/groups/CreateGroup';
import JoinGroup from '@/components/groups/JoinGroup';
import ScoreEntry from '@/components/scores/ScoreEntry';
import Rankings from '@/components/rankings/Rankings';
import GroupChat from '@/components/chat/GroupChat';
import Profile from '@/pages/Profile';
import AppFooter from '@/components/layout/AppFooter';

const Dashboard = () => {
  const { signOut } = useAuth();
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('groups');
  // unread counts per group id
  const [unreadByGroup, setUnreadByGroup] = useState<Record<number, number>>({});

  const incrementUnread = useCallback((groupId: number, delta: number = 1) => {
    if (!groupId || delta <= 0) return;
    setUnreadByGroup(prev => ({ ...prev, [groupId]: (prev[groupId] || 0) + delta }));
  }, []);

  const resetUnread = useCallback((groupId: number) => {
    if (!groupId) return;
    setUnreadByGroup(prev => {
      if (!prev[groupId]) return prev;
      const next = { ...prev };
      next[groupId] = 0;
      return next;
    });
  }, []);

  const { i18n, t } = useTranslation();
  const currentLang = i18n.language === 'ar' ? 'العربية' : 'English';
  const handleLangChange = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };

  // no logout button in header per request

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-muted py-2 shadow-soft">
        <div className="container mx-auto flex h-12 items-center justify-between px-2">
          <div className="ml-12 flex items-center gap-3 overflow-visible">
            <img src="/premier-league-logo.png" alt="Premier League Logo" className="h-20 scale-150 origin-left" />
          </div>
          <div className="flex items-center gap-4">
            {/* زر اختيار اللغة */}
            <button
              onClick={handleLangChange}
              className="flex cursor-pointer items-center border-none bg-transparent py-0.5 px-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
              title={currentLang}
            >
              <span className="mr-1 text-base">🌐</span>
              {currentLang}
              <span className="ml-0.5 text-xs">▼</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mt-8 mb-6 flex justify-center">
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val);
              if (val === 'chat' && selectedGroupId) {
                resetUnread(selectedGroupId);
              }
            }}
            className="w-full max-w-xl"
          >
            <TabsList className="grid w-full grid-cols-5 gap-2 rounded-2xl bg-card p-2 shadow-soft">
              <TabsTrigger
                value="groups"
                className="transition-colors data-[state=active]:bg-[#3a013e] data-[state=active]:text-white data-[state=active]:shadow data-[state=active]:scale-[1.01] hover:bg-muted"
              >
                <Users className="mr-2 h-4 w-4" />
                {t('groups_tab', { defaultValue: 'Groups' })}
              </TabsTrigger>
              <TabsTrigger
                value="scores"
                disabled={!selectedGroupId}
                className="transition-colors data-[state=active]:bg-[#3a013e] data-[state=active]:text-white data-[state=active]:shadow data-[state=active]:scale-[1.01] hover:bg-muted"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {t('points', { defaultValue: 'Points' })}
              </TabsTrigger>
              <TabsTrigger
                value="rankings"
                disabled={!selectedGroupId}
                className="transition-colors data-[state=active]:bg-[#3a013e] data-[state=active]:text-white data-[state=active]:shadow data-[state=active]:scale-[1.01] hover:bg-muted"
              >
                <Award className="h-4 w-4 mr-2" />
                {t('rankings', { defaultValue: 'Rankings' })}
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                disabled={!selectedGroupId}
                className="transition-colors data-[state=active]:bg-[#3a013e] data-[state=active]:text-white data-[state=active]:shadow data-[state=active]:scale-[1.01] hover:bg-muted"
              >
                <div className="inline-flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>{t('chat_tab', { defaultValue: 'Chat' })}</span>
                  {selectedGroupId && (unreadByGroup[selectedGroupId] || 0) > 0 && (
                    <span
                      className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
                      aria-label={`${unreadByGroup[selectedGroupId]} unread messages`}
                    >
                      {unreadByGroup[selectedGroupId]}
                    </span>
                  )}
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="profile"
                className="transition-colors data-[state=active]:bg-[#3a013e] data-[state=active]:text-white data-[state=active]:shadow data-[state=active]:scale-[1.01] hover:bg-muted"
              >
                <UserCircle className="mr-2 h-4 w-4" />
                {t('profile_tab', { defaultValue: 'Profile' })}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="groups" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <CreateGroup />
                <JoinGroup />
              </div>
              <GroupsList 
                onSelectGroup={(groupId: number) => {
                  setSelectedGroupId(groupId);
                  setActiveTab('scores');
                }}
                selectedGroupId={selectedGroupId}
              />
            </TabsContent>
            <TabsContent value="scores">
              {selectedGroupId !== null && <ScoreEntry groupId={selectedGroupId} />}
            </TabsContent>
            <TabsContent value="rankings">
              {selectedGroupId !== null && <Rankings groupId={selectedGroupId} />}
            </TabsContent>
            <TabsContent value="chat">
              {selectedGroupId !== null && (
                <GroupChat
                  groupId={selectedGroupId}
                  onUnreadIncrement={(delta) => {
                    // only accumulate when not currently viewing chat
                    if (activeTab !== 'chat') incrementUnread(selectedGroupId, delta || 1);
                  }}
                />
              )}
            </TabsContent>
            <TabsContent value="profile">
              <Profile />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
;
export default Dashboard;