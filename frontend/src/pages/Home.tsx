import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowRight, Check, Clock3, Snowflake } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '../lib/api'
import { categories, isCategory } from '../lib/format'
import { EquipmentArt } from '../components/EquipmentArt'
import { ErrorNotice, Loading } from '../components/ui'

export function Home() {
  const catalog = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => api.categories(signal),
  })
  return (
    <div className="container home">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" />
            ПРОКАТ СНАРЯЖЕНИЯ
          </div>
          <h1>
            Зимнее снаряжение
            <br />
            <span>напрокат</span>
          </h1>
          <a className="button primary" href="#equipment">
            Выбрать снаряжение <ArrowDown size={18} />
          </a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="sun" />
          <svg fill="none" viewBox="0 0 610 440" preserveAspectRatio="xMidYMid slice">
            <path d="M0 310 130 151l76 93 104-189 184 237 70-92 116 144v96H0Z" fill="#c0d4e3" />
            <path
              d="m130 151-43 88 43-27 29 26 20-27-49-60ZM310 55l-70 127 49-31 22 24 28-30 39 22-68-112Z"
              fill="#f5f9fd"
            />
            <path d="M-80 420 150 262l84 56 132-106 290 228H-80Z" fill="#8fadc4" />
            <path
              d="m150 262-50 62 49-20 24 17 24-20-47-39Zm216-50-62 79 57-25 35 23 24-35-54-42Z"
              fill="#eaf2f9"
            />
            <path d="M-40 420c112-94 218-44 295-74 118-45 226-42 408 40v54H-40Z" fill="#e3ecf5" />
            <path d="M-40 432c195-76 335-19 478-81" stroke="#fff" strokeWidth="8" />
          </svg>
        </div>
      </section>
      <section id="equipment" className="equipment-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">СНАРЯЖЕНИЕ</div>
            <h2>Что выберете сегодня?</h2>
          </div>
          <p>Ваш размер. Ваш день. Ваше приключение.</p>
        </div>
        {catalog.isPending && <Loading text="Загружаем снаряжение…" />}
        <ErrorNotice
          error={catalog.error}
          retry={() => {
            void catalog.refetch()
          }}
        />
        <div className="category-grid">
          {Object.entries(categories).map(([code, info]) => {
            if (!isCategory(code)) return null
            const exists = catalog.data?.some((c) => c.code === code)
            return (
              <article className={`category-card category-${code}`} key={code}>
                <div className="category-visual">
                  <EquipmentArt kind={code} />
                </div>
                <div className="category-copy">
                  <div>
                    <h3>{info.name}</h3>
                    <p>{info.description}</p>
                  </div>
                  {exists ? (
                    <Link
                      to={`/booking/${code}`}
                      className="round-link"
                      aria-label={`Забронировать: ${info.name}`}
                    >
                      <ArrowRight size={22} />
                    </Link>
                  ) : (
                    <span className="unavailable-label">
                      {catalog.isPending ? 'Загрузка' : 'Недоступно'}
                    </span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>
      <section className="how-section">
        <div>
          <div className="eyebrow">ВСЁ ПРОСТО</div>
          <h2>
            До приключения —<br /> всего три шага
          </h2>
          <Link to="/my-bookings" className="text-link">
            Уже забронировали? <ArrowRight size={16} />
          </Link>
        </div>
        <div className="how-step">
          <span>1</span>
          <h3>Найдите своё</h3>
          <p>
            Выберите снаряжение
            <br />и подходящий размер.
          </p>
        </div>
        <div className="how-step">
          <span>2</span>
          <h3>Выберите время</h3>
          <p>
            Свободные часы видны сразу.
            <br /> Планируйте на неделю вперёд.
          </p>
        </div>
        <div className="how-step">
          <span>3</span>
          <h3>Приходите кататься</h3>
          <p>
            Сохраните номер брони
            <br />и назовите его при получении.
          </p>
        </div>
      </section>
    </div>
  )
}
