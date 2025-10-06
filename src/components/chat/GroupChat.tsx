import { useEffect, useState, useRef, useMemo } from 'react';
import { listMessages, sendMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface GroupChatProps {
  groupId: number;
  onUnreadIncrement?: (delta: number) => void;
}

interface Message {
  id: number;
  content: string;
  created_at: string;
  user_id: number;
  username?: string;
}

const GroupChat = ({ groupId, onUnreadIncrement }: GroupChatProps) => {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const lastSeenIdRef = useRef<number>(0);
  const { user } = useAuth();
  const currentUserId = user?.id;

  // no recording feature

  // Build a map to detect duplicate two-letter initials among participants
  const initialsCount = useMemo(() => {
    const counts = new Map<string, number>();
    const uniqByUser = new Map<number, string>();
    messages.forEach(m => {
      if (!uniqByUser.has(m.user_id)) uniqByUser.set(m.user_id, m.username || '');
    });
    for (const [, uname] of uniqByUser.entries()) {
      const base = twoLetterInitials(uname);
      counts.set(base, (counts.get(base) || 0) + 1);
    }
    return counts;
  }, [messages]);

  function twoLetterInitials(name?: string) {
    const n = String(name || '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }

  function threeLetterInitials(name?: string) {
    const n = String(name || '').trim();
    if (!n) return '???';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 3) return (parts[0][0] + parts[1][0] + parts[2][0]).toUpperCase();
    if (parts.length === 2) return (parts[0][0] + parts[1].slice(0,2)).toUpperCase();
    return n.slice(0, 3).toUpperCase();
  }

  function getInitials(name?: string) {
    const base = twoLetterInitials(name);
    if ((initialsCount.get(base) || 0) > 1) return threeLetterInitials(name);
    return base;
  }

  // Deterministic EPL-themed gradient per user
  const gradients = [
    'linear-gradient(135deg, #7A3C85 0%, #F2A6D2 100%)', // soft purple -> soft pink
    'linear-gradient(135deg, #7A3C85 0%, #B9F6CE 100%)', // soft purple -> mint
    'linear-gradient(135deg, #7A3C85 0%, #AFD8FF 100%)', // soft purple -> light sky
    'linear-gradient(135deg, #E494C0 0%, #FFE990 100%)', // soft magenta -> light yellow
    'linear-gradient(135deg, #73D5D8 0%, #A9F0E2 100%)', // light teal
    'linear-gradient(135deg, #B494FF 0%, #F0B3FF 100%)', // light violet -> light fuchsia
  ];
  function gradientForUser(id?: number) {
    const idx = Math.abs(Number(id ?? 0)) % gradients.length;
    return gradients[idx];
  }

  // Detect if message content is an audio URL we created
  function isAudioMessage(content: string): boolean {
    if (!content) return false;
    try {
      return /^https?:\/\/.*\/uploads\/audio\//.test(content) || /\.(webm|ogg|m4a|mp3)(\?|#|$)/i.test(content);
    } catch {
      return false;
    }
  }

  // no recording timer formatter

  useEffect(() => {
    fetchMessages();
  }, [groupId]);

  // no recording timer

  // Track if user is near bottom to decide showing the jump button
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 24;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
      setAtBottom(nearBottom);
    };
    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Lightweight polling + refetch on visibility for persistence UX
  useEffect(() => {
    const iv = setInterval(() => {
      fetchMessages();
    }, 4000);
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchMessages();
    };
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      clearInterval(iv);
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [groupId]);
  // no recording handlers

  const scrollToBottom = () => {
    const el = containerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
    }
  };

  async function fetchMessages() {
    try {
      const res = await listMessages(groupId);
      const formatted = (res.messages || []).map((m: any) => ({
        id: m.id,
        content: m.content,
        created_at: m.created_at,
        user_id: m.user_id,
        username: m.username || t('rankings_page.player', { defaultValue: 'Player' }),
      })) as Message[];
      // Detect new incoming message (not from self)
      const prevLast = lastSeenIdRef.current || 0;
      const newLast = formatted.length ? Math.max(...formatted.map(m => m.id)) : 0;
      setMessages(formatted);
      if (newLast > prevLast) {
        // count how many new messages from others since last seen
        const newFromOthers = formatted.filter(m => m.id > prevLast && m.user_id !== currentUserId).length;
        if (newFromOthers > 0) {
          notifyNewMessage();
          try { onUnreadIncrement?.(newFromOthers); } catch {}
        }
        lastSeenIdRef.current = newLast;
      }
    } catch (error: any) {
      toast.error(t('chat.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  function notifyNewMessage() {
    try {
      // vibration (if supported)
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
      // short beep using Web Audio API
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880; // A5
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      o.start();
      o.stop(ctx.currentTime + 0.21);
      // auto close context shortly to free resources
      setTimeout(() => ctx.close().catch(() => {}), 400);
    } catch {}
  }

  // Realtime removed for now; could be added with websockets in future

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await sendMessage(groupId, newMessage);
      setNewMessage('');
      // optimistic update: append to list with current user
      setMessages(prev => [...prev, {
        id: Date.now(),
        content: newMessage,
        created_at: new Date().toISOString(),
        user_id: currentUserId || 0,
        username: user?.username || t('rankings_page.player', { defaultValue: 'Me' }),
      }]);
      // Auto-scroll only when I send a message
      setTimeout(() => scrollToBottom(), 0);
    } catch (error: any) {
      toast.error(error.message || t('chat.send_failed'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('chat.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={containerRef} className="h-[400px] overflow-y-auto space-y-3 p-4 bg-muted/30 rounded-lg relative">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.user_id === currentUserId ? 'justify-end' : 'justify-start'}`}
            >
              {msg.user_id !== currentUserId && (
                <div className="mr-2 mt-1">
                  <Avatar className="h-8 w-8 border shadow-sm overflow-hidden">
                    <AvatarFallback
                      className="text-[11px] font-bold text-white"
                      style={{ background: gradientForUser(msg.user_id) }}
                    >
                      {getInitials(msg.username)}
                    </AvatarFallback>
                  </Avatar>
                  {/* Jump to latest button */}
          {!atBottom && (
            <div className="sticky bottom-2 flex justify-center">
              <button
                type="button"
                onClick={scrollToBottom}
                className="px-3 py-1.5 text-xs rounded-full bg-[#3a013e] text-white shadow hover:opacity-90"
              >
                {t('chat.jump_to_latest', { defaultValue: 'Jump to latest' })}
              </button>
            </div>
          )}
        </div>
              )}
              <div className="flex flex-col max-w-[70%]">
                <div
                  className={`rounded-lg p-3 ${
                    msg.user_id === currentUserId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border'
                  }`}
                >
                  {/* الاسم مخفي حسب الطلب */}
                  {isAudioMessage(msg.content) ? (
                    <audio controls className="w-56" src={msg.content}>متصفحك لا يدعم تشغيل الصوت</audio>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
                <div className={`mt-1 text-[10px] text-muted-foreground ${msg.user_id === currentUserId ? 'text-right pr-1' : 'text-left pl-1'}`}>
                  {new Date(msg.created_at).toLocaleTimeString(i18n.language?.startsWith('ar') ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {msg.user_id === currentUserId && (
                <div className="ml-2 mt-1">
                  <Avatar className="h-8 w-8 border shadow-sm overflow-hidden">
                    <AvatarFallback
                      className="text-[11px] font-bold text-white"
                      style={{ background: gradientForUser(msg.user_id) }}
                    >
                      {getInitials(msg.username)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={t('chat.placeholder')}
            disabled={sending}
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !newMessage.trim()} className="h-10">
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default GroupChat;
