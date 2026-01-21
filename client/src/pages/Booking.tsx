import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/axios';
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle, ArrowLeft, Clock, Calendar as CalendarIcon, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { getMoscowToday, isTodayMSK, isPastMSK, formatTimeMSK } from '../lib/dateUtils';

interface Specialist {
  id: number;
  name: string;
  bio: string;
  photo_url: string;
}

const Booking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [specialist, setSpecialist] = useState<Specialist | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [fullDays, setFullDays] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  
  const [formData, setFormData] = useState({ name: '', notes: '' });

  useEffect(() => {
    api.get(`/specialists/${id}`)
      .then(res => setSpecialist(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (id) {
      const month = currentMonth.getMonth() + 1;
      const year = currentMonth.getFullYear();
      api.get(`/specialists/${id}/month-availability?month=${month}&year=${year}`)
        .then(res => setFullDays(res.data))
        .catch(console.error);
    }
  }, [currentMonth, id]);

  useEffect(() => {
    if (selectedDate && id) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      api.get(`/specialists/${id}/availability?date=${dateStr}`)
        .then(res => {
          setSlots(res.data);
        })
        .catch(console.error);
    } else {
      setSlots([]);
    }
  }, [selectedDate, id]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !id) return;
    setBookingStatus('submitting');
    try {
      await api.post('/bookings', {
        specialist_id: id,
        client_name: formData.name,
        client_email: 'no-email@mentor.pro',
        start_time: selectedSlot,
        notes: formData.notes
      });
      setBookingStatus('success');
    } catch (error) {
      setBookingStatus('error');
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(addMonths(currentMonth, -1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  if (loading) return <div className="flex justify-center items-center h-screen font-medium text-gray-400">Загрузка...</div>;
  if (!specialist) return <div className="text-center mt-20 text-lg font-medium text-gray-500">Специалист не найден</div>;

  if (bookingStatus === 'success') {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center items-center p-6 text-black">
        <div className="apple-card p-12 text-center max-w-lg w-full">
          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle size={40} strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Запись подтверждена!</h2>
          <p className="text-gray-500 mb-10 text-lg">Ваша сессия с {specialist.name} успешно запланирована.</p>
          <button 
            onClick={() => navigate('/')}
            className="apple-button-primary w-full py-4 text-lg"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-[#94EA00] transition-colors mb-12 group">
          <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" /> Назад к списку
        </Link>

        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 uppercase">{specialist.name}</h1>
          <p className="text-lg text-gray-500">Выберите дату и время для вашей сессии.</p>
        </header>

        <div className="grid grid-cols-1 gap-10">
          {/* Step 1: Date */}
          <div className="apple-card p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-[#f5f5f7] rounded-xl flex items-center justify-center text-[#1d1d1f]">
                <CalendarIcon size={20} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold tracking-tight">Шаг 1: Выберите дату</h3>
            </div>

            <div className="flex justify-between items-center mb-8">
              <h4 className="text-lg font-bold capitalize">{format(currentMonth, 'LLLL yyyy', { locale: ru })}</h4>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-50 text-gray-400 hover:text-black transition-colors">
                  <ChevronLeft size={24} />
                </button>
                <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-50 text-gray-400 hover:text-black transition-colors">
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center font-bold text-[11px] text-gray-400 mb-4 uppercase tracking-wider">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => <div key={d}>{d}</div>)}
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, idx) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isFull = fullDays.includes(dateStr);
                const isPast = isPastMSK(day);
                const isUnavailable = isFull || isPast;

                return (
                  <button
                    key={idx}
                    onClick={() => !isUnavailable && setSelectedDate(day)}
                    disabled={!isSameMonth(day, currentMonth)}
                    className={clsx(
                      "aspect-square rounded-2xl flex flex-col items-center justify-center text-sm font-bold transition-all relative",
                      !isSameMonth(day, currentMonth) && "opacity-0 pointer-events-none",
                      isUnavailable && "text-gray-300 cursor-not-allowed bg-gray-50/50",
                      !isUnavailable && isSameDay(day, selectedDate || new Date(0)) ? "bg-[#94EA00] text-[#1d1d1f]" : "bg-white border border-gray-100 hover:border-[#94EA00] hover:bg-[#94EA00]/5",
                      isTodayMSK(day) && !isSameDay(day, selectedDate || new Date(0)) && "border-2 border-[#94EA00]/30"
                    )}
                  >
                    {format(day, 'd')}
                    {isFull && !isPast && <span className="absolute bottom-2 text-[8px] opacity-50 font-black">FULL</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Time */}
          {selectedDate && (
            <div className="apple-card p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-[#f5f5f7] rounded-xl flex items-center justify-center text-[#1d1d1f]">
                  <Clock size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Шаг 2: Время (МСК)</h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={clsx(
                      "py-4 rounded-2xl font-bold text-base transition-all border",
                      selectedSlot === slot 
                        ? "bg-[#94EA00] text-[#1d1d1f] border-transparent shadow-lg shadow-[#94EA00]/20" 
                        : "bg-white border-gray-100 hover:border-[#94EA00] hover:bg-[#94EA00]/5"
                    )}
                  >
                    {formatTimeMSK(slot)}
                  </button>
                ))}
                {slots.length === 0 && (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400 italic font-bold">
                    <Info size={32} className="mb-2 opacity-20" />
                    <p className="uppercase tracking-widest">Нет доступных слотов на этот день.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Form */}
          {selectedSlot && (
            <div className="apple-card p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-[#f5f5f7] rounded-xl flex items-center justify-center text-[#1d1d1f]">
                  <CheckCircle size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Шаг 3: Детали</h3>
              </div>

              <form onSubmit={handleBooking} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2 ml-1 uppercase tracking-wider">Имя и фамилия</label>
                  <input 
                    required type="text" placeholder="Иван Иванов"
                    className="apple-input text-lg font-bold"
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-400 mb-2 ml-1 uppercase tracking-wider">Тема созвона</label>
                  <textarea 
                    className="apple-input text-lg h-32 resize-none font-bold"
                    placeholder="О чем хотели бы поговорить?"
                    value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
                  />
                </div>
                <button 
                  type="submit" disabled={bookingStatus === 'submitting'}
                  className="apple-button-primary w-full py-5 text-xl mt-4 font-black uppercase tracking-tighter"
                >
                  {bookingStatus === 'submitting' ? 'Обработка...' : 'Забронировать'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Booking;
