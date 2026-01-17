import { useEffect, useState } from 'react';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { LogOut, CheckCircle, XCircle, MessageCircle, Copy, Check, Clock, Save, Calendar, User } from 'lucide-react';
import { clsx } from 'clsx';

interface Booking {
  id: number;
  client_name: string;
  client_email: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string;
}

interface TelegramInfo {
  linked: boolean;
  linkCode: string;
}

interface Schedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [telegramInfo, setTelegramInfo] = useState<TelegramInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [hidePast, setHidePast] = useState(false);
  
  useEffect(() => {
    api.get('/my/bookings')
      .then(res => setBookings(res.data))
      .catch(console.error);
    
    api.get('/my/telegram')
      .then(res => setTelegramInfo(res.data))
      .catch(console.error);

    // Load schedule with Monday-first ordering
    api.get('/my/schedule')
      .then(res => {
        const existing = res.data as Schedule[];
        const full: Schedule[] = [];
        // Monday (1) to Sunday (0)
        const dayOrder = [1, 2, 3, 4, 5, 6, 0];
        for (const i of dayOrder) {
          const found = existing.find(s => s.day_of_week === i);
          full.push(found || { day_of_week: i, start_time: '09:00', end_time: '17:00', is_active: false });
        }
        setSchedules(full);
      })
      .catch(console.error);
  }, []);

  const copyCode = () => {
    if (telegramInfo?.linkCode) {
      navigator.clipboard.writeText(`/start ${telegramInfo.linkCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const regenerateCode = async () => {
    try {
      const res = await api.post('/my/telegram/regenerate');
      setTelegramInfo(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.put(`/bookings/${id}/status`, { status });
      setBookings(bookings.map(b => b.id === id ? { ...b, status } : b));
    } catch (error) {
      console.error(error);
    }
  };

  const saveSchedule = async () => {
    setSavingSchedule(true);
    setScheduleMessage('');
    try {
      const activeSchedules = schedules.filter(s => s.is_active);
      await api.put('/my/schedule', { schedules: activeSchedules });
      setScheduleMessage('Сохранено');
      setTimeout(() => setScheduleMessage(''), 3000);
    } catch (error) {
      setScheduleMessage('Ошибка');
    } finally {
      setSavingSchedule(false);
    }
  };

  const updateScheduleDay = (index: number, field: keyof Schedule, value: any) => {
    const updated = [...schedules];
    (updated[index] as any)[field] = value;
    setSchedules(updated);
  };

  const filteredBookings = bookings.filter(booking => {
    if (!hidePast) return true;
    const isFuture = new Date(booking.start_time).getTime() > Date.now();
    const isConfirmed = booking.status === 'confirmed';
    return isFuture && isConfirmed;
  });

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <nav className="backdrop-blur-xl bg-white/70 border-b border-gray-200/50 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 bg-white">
            {user?.photo_url ? (
              <img src={user.photo_url.startsWith('http') ? user.photo_url : `http://localhost:3000${user.photo_url}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                <User size={20} />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">{user?.name}</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Панель специалиста</p>
          </div>
        </div>
        <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
          <LogOut size={20} />
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Schedule Sidebar */}
          <div className="md:col-span-1 space-y-8">
            <div className="apple-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <Clock size={18} className="text-[#7bb300]" />
                <h3 className="text-lg font-bold">График работы</h3>
              </div>
              
              <div className="space-y-4">
                {schedules.map((schedule, idx) => (
                  <div key={schedule.day_of_week} className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={schedule.is_active}
                        onChange={e => updateScheduleDay(idx, 'is_active', e.target.checked)}
                        className="w-4 h-4 accent-[#94EA00] rounded-md"
                      />
                      <span className={`text-sm font-bold ${schedule.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                        {DAYS[schedule.day_of_week].slice(0, 2).toUpperCase()}
                      </span>
                      {schedule.is_active && (
                        <div className="flex items-center gap-1 ml-auto">
                          <input 
                            type="time" value={schedule.start_time}
                            onChange={e => updateScheduleDay(idx, 'start_time', e.target.value)}
                            className="bg-transparent text-sm font-bold border-none p-0 focus:ring-0 w-[80px]"
                          />
                          <span className="text-[10px] text-gray-300">→</span>
                          <input 
                            type="time" value={schedule.end_time}
                            onChange={e => updateScheduleDay(idx, 'end_time', e.target.value)}
                            className="bg-transparent text-sm font-bold border-none p-0 focus:ring-0 w-[80px]"
                          />
                        </div>
                      )}
                    </label>
                  </div>
                ))}
              </div>

              <button 
                onClick={saveSchedule}
                disabled={savingSchedule}
                className="apple-button-primary w-full mt-8 py-3 text-sm flex items-center justify-center gap-2"
              >
                <Save size={16} />
                {savingSchedule ? 'Сохранение...' : 'Сохранить график'}
              </button>
              {scheduleMessage && (
                <p className="mt-3 text-center text-xs font-bold text-green-600 uppercase">{scheduleMessage}</p>
              )}
            </div>

            {/* Telegram */}
            {telegramInfo && (
              <div className="apple-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <MessageCircle size={18} className="text-[#7bb300]" />
                  <h3 className="text-lg font-bold">Telegram</h3>
                </div>
                
                {telegramInfo.linked ? (
                  <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-green-700">Подключено</span>
                    <button onClick={regenerateCode} className="text-[10px] font-bold text-green-600 hover:underline">Отвязать</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 leading-relaxed">Отправьте команду боту <span className="font-bold text-gray-900">@briuscrmbot</span>:</p>
                    <div className="bg-[#f5f5f7] p-3 rounded-xl font-mono text-[11px] break-all border border-gray-100">
                      /start {telegramInfo.linkCode}
                    </div>
                    <button 
                      onClick={copyCode}
                      className="apple-button-secondary w-full py-2.5 text-xs flex items-center justify-center gap-2"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Скопировано' : 'Копировать'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main Content: Bookings */}
          <div className="md:col-span-2 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 px-2">
              <h2 className="text-2xl font-bold tracking-tight">Записи на созвон</h2>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative w-5 h-5">
                    <input 
                      type="checkbox" 
                      checked={hidePast}
                      onChange={e => setHidePast(e.target.checked)}
                      className="w-full h-full accent-[#94EA00] rounded-md border-2 border-[#3a3a3c] bg-black appearance-none checked:bg-[#94EA00] transition-all cursor-pointer"
                    />
                    {hidePast && <Check className="absolute top-0.5 left-0.5 pointer-events-none text-black" size={14} strokeWidth={4} />}
                  </div>
                  <span className="text-xs font-bold text-gray-400 group-hover:text-gray-300 transition-colors uppercase tracking-widest">Скрыть прошедшие</span>
                </label>
                <div className="bg-white px-3 py-1 rounded-full border border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  ВСЕГО: {filteredBookings.length}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {filteredBookings.map((booking) => (
                <div key={booking.id} className="apple-card p-6 flex flex-col sm:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-gray-400 mb-1">
                          <Calendar size={14} />
                          <span className="text-xs font-bold uppercase tracking-wider">{format(new Date(booking.start_time), 'd MMM yyyy', { locale: ru })}</span>
                        </div>
                        <h4 className="text-lg font-bold">{booking.client_name}</h4>
                      </div>
                      <span className={clsx(
                        "text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider uppercase",
                        booking.status === 'confirmed' ? "bg-green-50 text-[#7bb300]" : 
                        booking.status === 'cancelled' ? "bg-red-50 text-red-400" : 
                        "bg-gray-100 text-gray-500"
                      )}>
                        {booking.status === 'confirmed' ? 'Ожидается' : booking.status === 'cancelled' ? 'Отменено' : 'Завершено'}
                      </span>
                    </div>
                    
                    {booking.notes && (
                      <div className="bg-[#f5f5f7] p-4 rounded-2xl">
                        <p className="text-sm text-gray-600 italic">«{booking.notes}»</p>
                      </div>
                    )}
                  </div>

                  <div className="sm:w-32 flex flex-row sm:flex-col justify-end gap-2 border-t sm:border-t-0 sm:border-l border-gray-100 pt-4 sm:pt-0 sm:pl-6">
                    <div className="flex items-center gap-2 text-[#7bb300] font-bold mb-auto">
                      <Clock size={16} />
                      <span>{format(new Date(booking.start_time), 'HH:mm')}</span>
                    </div>
                    
                    {booking.status === 'confirmed' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => updateStatus(booking.id, 'completed')}
                          className="flex-1 sm:w-full p-2 bg-gray-50 text-gray-400 hover:bg-green-50 hover:text-green-500 rounded-xl transition-colors"
                          title="Завершить"
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button 
                          onClick={() => updateStatus(booking.id, 'cancelled')}
                          className="flex-1 sm:w-full p-2 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors"
                          title="Отменить"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {filteredBookings.length === 0 && (
                <div className="apple-card p-20 text-center flex flex-col items-center justify-center text-gray-300">
                  <Calendar size={48} strokeWidth={1} className="mb-4 opacity-20" />
                  <p className="text-lg font-medium">Записей пока нет.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
