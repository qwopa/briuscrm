-- Create Users table (Admins and Specialists)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'specialist')),
  name VARCHAR(255) NOT NULL,
  photo_url TEXT,
  bio TEXT,
  timezone VARCHAR(100) DEFAULT 'UTC',
    telegram_chat_id BIGINT,
    tg_link_code VARCHAR(10) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create Schedules table
CREATE TABLE schedules (
  id SERIAL PRIMARY KEY,
  specialist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(specialist_id, day_of_week)
);

-- Create Bookings table
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  specialist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_overlap UNIQUE (specialist_id, start_time) -- Simplified check, app logic should handle ranges better
);

-- Indexes
CREATE INDEX idx_bookings_specialist_date ON bookings(specialist_id, start_time);
CREATE INDEX idx_users_role ON users(role);
