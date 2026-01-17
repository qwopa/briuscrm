import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, Lock, Loader2 } from 'lucide-react';
import api from '../lib/axios';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      if (res.data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Неверный email или пароль. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] p-6">
      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-black transition-colors mb-10 group">
          <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" /> На главную
        </Link>
        
        <div className="apple-card p-10 md:p-12">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Войдите в личный кабинет</h2>
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-xs font-bold text-center mb-8 border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Email адрес</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#7bb300] transition-colors">
                  <User size={18} />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="apple-input pl-14"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Пароль</label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#7bb300] transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="apple-input pl-14"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="apple-button-primary w-full py-4 text-base flex items-center justify-center gap-3 mt-4"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
