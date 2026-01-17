import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { ArrowUpRight } from 'lucide-react';

interface Specialist {
  id: number;
  name: string;
  photo_url: string;
  bio: string;
  role: string;
}

const Home = () => {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/specialists')
      .then(res => setSpecialists(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center items-center h-screen font-medium text-gray-400">Загрузка...</div>;

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <main className="max-w-6xl mx-auto px-6 py-12 md:py-24">
        <div className="mb-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 text-left leading-[1.1]">
            Забронируйте сессию<br />с экспертом.
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {specialists.map((specialist) => (
            <div 
              key={specialist.id} 
              className="apple-card apple-card-hover p-6 cursor-pointer flex flex-col h-full"
              onClick={() => navigate(`/book/${specialist.id}`)}
            >
              <div className="aspect-square rounded-2xl mb-6 overflow-hidden bg-gray-50">
                {specialist.photo_url ? (
                  <img 
                    src={specialist.photo_url.startsWith('http') ? specialist.photo_url : `/api/uploads/${specialist.photo_url.replace('/uploads/', '').replace('uploads/', '')}`} 
                    alt={specialist.name} 
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 font-medium italic">Нет фото</div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-1">{specialist.name}</h3>
                <p className="text-sm text-[#7bb300] font-bold uppercase tracking-wider mb-4">
                  {specialist.bio || 'Эксперт'}
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm font-bold mt-auto pt-4 group">
                Записаться на сессию
                <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>
          ))}
        </div>

        {specialists.length === 0 && (
          <div className="text-center py-32 bg-white rounded-[40px] border border-gray-100">
            <p className="text-lg text-gray-400 font-medium">Эксперты пока не найдены.</p>
          </div>
        )}

        <div className="mt-20 flex justify-center opacity-30 hover:opacity-100 transition-opacity">
          <Link to="/login" className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-black">
            Вход для экспертов
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Home;
