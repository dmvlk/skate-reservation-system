import { useEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router'
import { ArrowUpRight, Clock3, MountainSnow } from 'lucide-react'
import { Brand } from './components/ui'
import { DEMO_MODE } from './lib/api'
import { Home } from './pages/Home'
import { Booking } from './pages/Booking'
import { MyBookings } from './pages/MyBookings'
import { AdminLayout, AdminLogin, AdminBookings, AdminInventory } from './pages/Admin'

export function App() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])
  return (
    <>
      {DEMO_MODE && (
        <div className="demo-banner">
          Демонстрационный режим · Брони учебные, сохраняются только в этой вкладке · Вход
          сотрудника: demo / demo
        </div>
      )}
      <a href="#main" className="skip-link">
        К содержимому
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="Основная навигация">
            <NavLink to="/" end>
              Снаряжение
            </NavLink>
            <NavLink to="/my-bookings">Мои брони</NavLink>
          </nav>
          <span className="header-hours">
            <Clock3 size={15} />
            10:00–20:00
          </span>
        </div>
      </header>
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/booking/:category" element={<Booking />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminBookings />} />
            <Route path="inventory" element={<AdminInventory />} />
          </Route>
          <Route
            path="*"
            element={
              <div className="container not-found">
                <MountainSnow size={60} />
                <h1>Кажется, вы сбились с маршрута</h1>
                <p>Такой страницы нет. Вернёмся к снаряжению?</p>
                <Link className="button primary" to="/">
                  На главную
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Brand />
          <Link to="/admin">
            Для сотрудников <ArrowUpRight size={14} />
          </Link>
        </div>
      </footer>
    </>
  )
}
