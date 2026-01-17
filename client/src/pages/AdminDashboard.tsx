import React, { useEffect, useState, useCallback } from 'react';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { LogOut, Plus, Trash2, Edit2, Upload, X, Users, Clock, Mail, MessageCircle, Copy, Check, RefreshCw, Calendar } from 'lucide-react';
import { clsx } from 'clsx';

interface Specialist {
  id: number;
  name: string;
  email: string;
  bio: string;
  photo_url: string;
  role: string;
}

interface Booking {
  id: number;
  specialist_name: string;
  client_name: string;
  start_time: string;
  status: string;
  notes: string;
}

interface Schedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

interface TelegramInfo {
  linked: boolean;
  linkCode: string;
}

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const AdminDashboard = () => {
  const { logout } = useAuth();
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<'bookings' | 'specialists'>('bookings');

  const [newSpec, setNewSpec] = useState({ name: '', email: '', password: '', bio: '' });
  const [newSpecPhoto, setNewSpecPhoto] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ name: '', bio: '' });
  const [scheduleEditId, setScheduleEditId] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const [telegramInfo, setTelegramInfo] = useState<TelegramInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
    fetchTelegramInfo();
  }, []);

  const fetchData = () => {
    api.get('/specialists').then(res => setSpecialists(res.data));
    api.get('/admin/bookings').then(res => setBookings(res.data));
  };

  const fetchTelegramInfo = () => {
    api.get('/my/telegram')
      .then(res => setTelegramInfo(res.data))
      .catch(console.error);
  };

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

  const createSpecialist = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/specialists', newSpec);
      const specialistId = res.data.id;

      if (newSpecPhoto) {
        const formData = new FormData();
        formData.append('photo', newSpecPhoto);
        await api.post(`/admin/specialists/${specialistId}/photo`, formData);
      }

      setNewSpec({ name: '', email: '', password: '', bio: '' });
      setNewSpecPhoto(null);
      setIsCreating(false);
      fetchData();
    } catch (error) {
      alert('Ошибка при создании специалиста');
    }
  };

  const deleteSpecialist = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого специалиста?')) return;
    try {
      await api.delete(`/admin/specialists/${id}`);
      fetchData();
    } catch (error) {
      alert('Ошибка при удалении');
    }
  };

  const startEdit = (s: Specialist) => {
    setEditingId(s.id);
    setEditData({ name: s.name, bio: s.bio || '' });
  };

  const saveEdit = async (id: number) => {
    try {
      await api.put(`/admin/specialists/${id}`, editData);
      setEditingId(null);
      fetchData();
    } catch (error) {
      alert('Ошибка при сохранении');
    }
  };

  const openScheduleEdit = async (id: number) => {
    setScheduleEditId(id);
    try {
      const res = await api.get(`/admin/specialists/${id}/schedule`);
      const existing = res.data as Schedule[];
      const full: Schedule[] = [];
      // Monday (1) through Sunday (0)
      const order = [1, 2, 3, 4, 5, 6, 0];
      for (const i of order) {
        const found = existing.find(s => s.day_of_week === i);
        full.push(found || { day_of_week: i, start_time: '09:00', end_time: '17:00', is_active: false });
      }
      setSchedules(full);
    } catch (error) {
      console.error(error);
    }
  };

  const saveSchedule = async () => {
    if (!scheduleEditId) return;
    try {
      const active = schedules.filter(s => s.is_active);
      await api.put(`/admin/specialists/${scheduleEditId}/schedule`, { schedules: active });
      setScheduleEditId(null);
      alert('Расписание сохранено');
    } catch (error) {
      alert('Ошибка при сохранении');
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent, specialistId: number) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      await api.post(`/admin/specialists/${specialistId}/photo`, formData);
      fetchData();
    } catch (error) {
      alert('Ошибка при загрузке фото');
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, specialistId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      await api.post(`/admin/specialists/${specialistId}/photo`, formData);
      fetchData();
    } catch (error) {
      alert('Ошибка при загрузке фото');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <nav className="backdrop-blur-xl bg-white/70 border-b border-gray-200/50 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1d1d1f] rounded-lg flex items-center justify-center text-white">
            <Users size={18} />
          </div>
          <h1 className="text-lg font-bold tracking-tight uppercase">Админ-панель</h1>
        </div>
        <button onClick={logout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
          <LogOut size={20} />
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Telegram Notifications Section */}
        {telegramInfo && (
          <div className="apple-card p-6 mb-12 bg-[#94EA00]/5 border-[#94EA00]/20 font-sans">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle size={20} className="text-[#7bb300]" />
              <h3 className="text-lg font-bold">Уведомления всех заявок в Telegram (МСК)</h3>
              <span className={clsx(
                "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider uppercase",
                telegramInfo.linked ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
              )}>
                {telegramInfo.linked ? 'Подключено' : 'Не подключено'}
              </span>
            </div>
            
            {telegramInfo.linked ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 font-medium">Вы получаете уведомления о всех новых записях платформы.</p>
                <button onClick={regenerateCode} className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 font-bold">
                  <RefreshCw size={12} /> Отвязать
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 font-medium leading-relaxed">
                  Привяжите свой аккаунт, чтобы мгновенно получать информацию о новых заявках всех специалистов. 
                  Отправьте команду боту <span className="font-bold text-gray-900">@briuscrmbot</span>:
                </p>
                <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-3">
                  <div className="flex-1 bg-white/50 backdrop-blur p-3 rounded-xl font-mono text-sm border border-gray-100">
                    /start {telegramInfo.linkCode}
                  </div>
                  <button 
                    onClick={copyCode}
                    className="apple-button-primary py-2.5 px-6 text-sm flex items-center justify-center gap-2"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Скопировано' : 'Копировать команду'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex bg-white/50 backdrop-blur p-1.5 rounded-2xl border border-gray-200/50 w-fit mb-12">
          <button 
            onClick={() => setActiveTab('bookings')}
            className={clsx(
              "px-8 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === 'bookings' ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-black"
            )}
          >
            Записи
          </button>
          <button 
            onClick={() => setActiveTab('specialists')}
            className={clsx(
              "px-8 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeTab === 'specialists' ? "bg-white text-black shadow-sm" : "text-gray-400 hover:text-black"
            )}
          >
            Специалисты
          </button>
        </div>

        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {bookings.map((b) => (
                <div key={b.id} className="apple-card p-6 flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Специалист</span>
                      <p className="font-bold uppercase tracking-tight">{b.specialist_name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Клиент</span>
                      <p className="font-bold text-gray-600 uppercase tracking-tight">{b.client_name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Дата и время (МСК)</span>
                      <p className="font-bold flex items-center gap-2">
                        <Calendar size={14} className="text-[#7bb300]" />
                        {format(new Date(b.start_time), 'd MMM, HH:mm', { locale: ru })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                    <span className={clsx(
                      "text-[10px] font-bold px-3 py-1 rounded-full tracking-wider uppercase",
                      b.status === 'confirmed' ? "bg-green-50 text-[#7bb300]" : 
                      b.status === 'cancelled' ? "bg-red-50 text-red-400" : 
                      "bg-gray-100 text-gray-500"
                    )}>
                      {b.status === 'confirmed' ? 'Ожидается' : b.status === 'cancelled' ? 'Отменено' : 'Завершено'}
                    </span>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && (
                <div className="apple-card p-20 text-center text-gray-300 font-medium uppercase tracking-widest">Записей не найдено.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'specialists' && (
          <div className="space-y-8">
            <div className="flex justify-end font-sans">
              <button 
                onClick={() => { setIsCreating(true); setNewSpec({ name: '', email: '', password: '', bio: '' }); }}
                className="apple-button-primary flex items-center gap-2 text-sm uppercase font-bold tracking-tight"
              >
                <Plus size={18} strokeWidth={3} /> Добавить специалиста
              </button>
            </div>

            {isCreating && (
              <div className="apple-card p-8 bg-white/80 animate-in fade-in zoom-in-95 duration-300 font-sans">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold tracking-tight uppercase italic underline decoration-4 underline-offset-8 decoration-[#94EA00]">Новый профиль</h3>
                  <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-black transition-transform hover:rotate-90"><X size={20} /></button>
                </div>
                <form onSubmit={createSpecialist} className="grid grid-cols-1 md:grid-cols-12 gap-10">
                  <div className="md:col-span-4">
                    <div 
                      className={`aspect-square bg-[#f5f5f7] rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center relative cursor-pointer transition-all ${dragOver === -1 ? 'bg-blue-50 border-[#94EA00]' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragOver(-1); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={e => {
                        e.preventDefault();
                        setDragOver(null);
                        const file = e.dataTransfer.files[0];
                        if (file && file.type.startsWith('image/')) {
                          setNewSpecPhoto(file);
                        }
                      }}
                    >
                      {newSpecPhoto ? (
                        <div className="relative w-full h-full p-2">
                          <img 
                            src={URL.createObjectURL(newSpecPhoto)} 
                            className="w-full h-full object-cover rounded-2xl" 
                            alt="Preview" 
                          />
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setNewSpecPhoto(null); }}
                            className="absolute top-4 right-4 p-1.5 bg-black/50 backdrop-blur text-white rounded-full hover:bg-black"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="text-center p-6 space-y-3">
                          <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto text-[#7bb300]">
                            <Upload size={24} strokeWidth={3} />
                          </div>
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Перетащите фото</p>
                        </div>
                      )}
                      <input 
                        type="file" accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) setNewSpecPhoto(file);
                        }}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Имя</label>
                      <input required className="apple-input uppercase tracking-tight font-bold" value={newSpec.name} onChange={e => setNewSpec({...newSpec, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email</label>
                      <input required type="email" className="apple-input" value={newSpec.email} onChange={e => setNewSpec({...newSpec, email: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Пароль</label>
                      <input required type="password" className="apple-input" value={newSpec.password} onChange={e => setNewSpec({...newSpec, password: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Описание</label>
                      <input className="apple-input uppercase tracking-tight font-bold" value={newSpec.bio} onChange={e => setNewSpec({...newSpec, bio: e.target.value})} />
                    </div>
                    <div className="md:col-span-2 pt-6 flex justify-end gap-4">
                      <button type="submit" className="apple-button-primary px-12 font-black uppercase tracking-tighter italic">Создать специалиста</button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Schedule Edit Modal */}
            {scheduleEditId && (
              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300 font-sans">
                <div className="bg-white rounded-[40px] shadow-2xl p-10 max-w-md w-full animate-in zoom-in-95 duration-300 border-4 border-black">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic underline decoration-4 underline-offset-8 decoration-[#94EA00]">Расписание</h3>
                    <button onClick={() => setScheduleEditId(null)} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors"><X size={20} /></button>
                  </div>
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {schedules.map((s, idx) => (
                      <div key={s.day_of_week} className={clsx(
                        "flex items-center gap-4 p-4 rounded-3xl border-2 transition-all font-black uppercase italic text-xs",
                        s.is_active ? "border-black bg-[#94EA00]/10" : "border-gray-50 bg-gray-50/30 opacity-40"
                      )}>
                        <input 
                          type="checkbox" checked={s.is_active}
                          onChange={e => {
                            const updated = [...schedules];
                            updated[idx].is_active = e.target.checked;
                            setSchedules(updated);
                          }}
                          className="w-5 h-5 accent-black rounded-md"
                        />
                        <span className="w-10 text-gray-400">{DAYS[s.day_of_week].slice(0, 2)}</span>
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <input 
                            type="time" value={s.start_time}
                            onChange={e => {
                              const updated = [...schedules];
                              updated[idx].start_time = e.target.value;
                              setSchedules(updated);
                            }}
                            className="bg-white border-2 border-black rounded-xl px-2 py-1.5 text-xs font-black w-[85px] outline-none"
                          />
                          <span className="text-gray-300">→</span>
                          <input 
                            type="time" value={s.end_time}
                            onChange={e => {
                              const updated = [...schedules];
                              updated[idx].end_time = e.target.value;
                              setSchedules(updated);
                            }}
                            className="bg-white border-2 border-black rounded-xl px-2 py-1.5 text-xs font-black w-[85px] outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={saveSchedule}
                    className="apple-button-primary w-full mt-10 py-5 text-xl font-black uppercase tracking-tighter italic shadow-xl shadow-[#94EA00]/20"
                  >
                    Сохранить изменения
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {specialists.filter(s => s.role === 'specialist').map(s => (
                <div key={s.id} className="apple-card overflow-hidden group hover:border-[#94EA00]/50">
                  <div 
                    className={`aspect-square bg-gray-100 relative overflow-hidden transition-all ${dragOver === s.id ? 'opacity-50' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(s.id); }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={e => handleDrop(e, s.id)}
                  >
                    {s.photo_url ? (
                      <img src={s.photo_url.startsWith('http') ? s.photo_url : `/api/uploads/${s.photo_url.replace('/uploads/', '').replace('uploads/', '')}`} alt={s.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                        <Upload size={32} className="mb-2 opacity-50" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Загрузить фото</span>
                      </div>
                    )}
                    <input 
                      type="file" accept="image/*"
                      onChange={e => handleFileSelect(e, s.id)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>

                  <div className="p-6">
                    {editingId === s.id ? (
                      <div className="space-y-4 animate-in fade-in duration-300 font-sans">
                        <input className="apple-input py-3 text-sm font-black uppercase tracking-tight" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                        <input className="apple-input py-3 text-sm font-bold uppercase tracking-tight" value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} placeholder="Описание" />
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(s.id)} className="flex-1 py-2.5 bg-black text-white rounded-xl text-xs font-black uppercase italic tracking-tighter">Сохранить</button>
                          <button onClick={() => setEditingId(null)} className="px-4 py-2.5 bg-gray-50 rounded-xl text-xs font-bold text-gray-400"><X size={14} /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-2xl font-black uppercase mb-1 tracking-tighter italic leading-none underline decoration-black decoration-2 underline-offset-4">{s.name}</h3>
                          <div className="flex items-center gap-2 text-gray-400 mt-3">
                            <Mail size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest truncate">{s.email}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50 font-sans">
                          <button 
                            onClick={() => startEdit(s)}
                            className="p-2.5 bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xl transition-all hover:scale-105"
                            title="Изменить"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => openScheduleEdit(s.id)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#94EA00] text-black rounded-xl text-xs font-black uppercase italic tracking-tighter hover:bg-[#a5f51a] transition-all shadow-sm"
                          >
                            <Clock size={14} strokeWidth={3} /> ГРАФИК
                          </button>
                          <button 
                            onClick={() => deleteSpecialist(s.id)}
                            className="p-2.5 ml-auto bg-red-50 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all hover:scale-105"
                            title="Удалить"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
