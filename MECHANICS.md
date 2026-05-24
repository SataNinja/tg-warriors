# TG Warriors — Полная документация проекта

> **Читать при каждом новом сеансе.** Здесь собрано всё: архитектура, механики, что сделано, что предстоит, подводные камни.

---

## 1. Стек и архитектура

| Слой | Технология |
|------|-----------|
| Bot | Python, aiogram 3.7, aiohttp, python-dotenv |
| Backend | FastAPI + SQLAlchemy (async) + PostgreSQL + asyncpg |
| Frontend | React + TypeScript + Vite (Telegram Mini App) |
| Auth | Telegram initData → кастомный JWT (HS256, без сторонних библиотек) |
| Deploy | GitHub → Railway (автодеплой по push в main) |
| Cache | Redis (зарезервирован, активно не используется пока) |

### Структура репозитория

```
BOT_TG/
├── bot/
│   ├── main.py                    — запуск бота + фоновая задача уведомлений
│   ├── handlers/
│   │   ├── start.py               — /start, deep link реферальный
│   │   ├── notifications.py       — poll_and_send_notifications (каждые 10 сек)
│   │   └── admin.py               — /admin команды
│   └── keyboards/inline.py        — клавиатура "Играть" + WebApp кнопка
│
├── backend/
│   ├── main.py                    — FastAPI app, lifespan (миграции + notification_trigger_loop)
│   ├── core/
│   │   ├── config.py              — Settings (pydantic-settings, .env)
│   │   ├── database.py            — AsyncSessionLocal, engine, Base
│   │   └── security.py            — валидация Telegram initData (HMAC-SHA256)
│   ├── models/                    — SQLAlchemy ORM модели
│   ├── schemas/                   — Pydantic схемы (in/out)
│   ├── routers/                   — FastAPI роутеры
│   ├── services/
│   │   ├── game_service.py        — ВСЯ игровая логика (рейды, энергия, daily, passive)
│   │   ├── shop_service.py        — UNIT_TYPES, CASTLE_DATA, оружие, питомцы
│   │   ├── pet_service.py         — бои питомцев, инкубация, кормёжка, upgrade
│   │   ├── auth_service.py        — JWT, get_or_create_user
│   │   ├── notification_service.py — create_notification, get_pending, mark_sent
│   │   └── notification_triggers.py — НОВЫЙ: фоновый loop (каждые 5 мин) создаёт уведомления
│   └── migrations/init.sql        — SQL создание таблиц (выполняется при старте backend)
│
└── frontend/
    ├── index.html                 — CSS анимации (floatUp, pulse-glow, shimmer, fadeIn)
    ├── src/
    │   ├── App.tsx                — auth flow, загрузка gameState
    │   ├── types/index.ts         — все TypeScript типы
    │   ├── api/client.ts          — все HTTP-запросы к backend
    │   ├── store/gameStore.ts     — Zustand: ongoingBattle (живёт при смене вкладок)
    │   ├── pages/HomePage.tsx     — 6 вкладок + MainCastleCard компонент
    │   └── components/
    │       ├── Profile.tsx        — шапка с InfoTooltip (через createPortal)
    │       ├── RaidPanel.tsx      — 3 режима боя, журнал, месть
    │       ├── BattleAnimation.tsx — анимация PvP боя
    │       ├── UnitCard.tsx       — стак юнитов одного типа + кнопка продажи
    │       ├── UnitShop.tsx       — выбор типа юнита + scrollbar индикатор
    │       ├── PetPanel.tsx       — питомцы, яйца, PetStackCard, прокачка
    │       ├── Shop.tsx           — замок/оружие/питомцы в Лавке
    │       └── DailyReward.tsx    — календарь 7 дней
```

---

## 2. Аутентификация

1. Frontend берёт `window.Telegram.WebApp.initData`
2. `POST /auth/telegram` → backend валидирует HMAC-SHA256 подпись Telegram
3. Возвращает кастомный JWT (без `python-jose`, реализовано через `hmac` + `base64`)
4. JWT хранится в `localStorage['access_token']`, передаётся как `Bearer` header
5. `get_or_create_user()` — создаёт юзера при первом входе

### Реферальная система

- Deep link формат: `t.me/BOT?start=ref_<user_id>`
- Mini App URL формат: `t.me/BOT/app?startapp=ref_<user_id>`
- **Важно**: `tg.initDataUnsafe.start_param` работает только для `t.me` ссылок.  
  Для WebApp кнопок нужно читать из URL: `new URLSearchParams(window.location.search).get('startapp')`
- App.tsx читает оба источника:
  ```js
  const startParam =
    tg.initDataUnsafe?.start_param ||
    new URLSearchParams(window.location.search).get('startapp') || ''
  ```
- Награда за реферала: **1000 монет** (REFERRAL_REWARD_COINS в config.py)

---

## 3. Модель данных

### Таблица `users`

```
id                BIGINT PK       — Telegram user_id
username          VARCHAR(64)
first_name        VARCHAR(128)
last_name         VARCHAR(128)
nickname          VARCHAR(32)     — первый раз бесплатно, потом 100 монет
coins             BIGINT          — основная валюта (стартует с 100)
iron              INTEGER         — ресурс для прокачки оружия (стартует с 10)
crystals          INTEGER         — премиум-валюта (стартует с 0)
energy            INTEGER         — макс 50, стартует с 50
energy_updated_at TIMESTAMPTZ     — момент последней траты энергии
castle_level      INTEGER         — уровень замка (1–20)
win_streak        INTEGER         — серия побед (PvP + PvE общая)
shield_until      TIMESTAMPTZ     — до которого активен щит
last_daily_reward TIMESTAMPTZ     — последний daily
daily_streak      INTEGER         — дней подряд daily
last_raid_at      TIMESTAMPTZ     — последний рейд (кулдаун не используется)
last_passive_at   TIMESTAMPTZ     — последнее получение пассивного дохода
referrer_id       BIGINT          — кто пригласил
```

### Relationships (lazy="selectin" — загружаются автоматически с каждым User запросом)

```python
units:   list[Unit]     — армия игрока
pets:    list[Pet]      — питомцы
weapon:  Optional[Weapon]
```

### Таблица `notifications`

```
id        UUID PK
user_id   BIGINT FK
message   TEXT
type      VARCHAR(32)    — "general" | "raid_attack" | "energy_full" | "daily_ready" | "passive_ready"
is_sent   BOOLEAN
created_at TIMESTAMPTZ
```

---

## 4. Энергия

- Рассчитывается на лету (не хранится актуальное значение):
  ```python
  current = user.energy + int(elapsed_seconds // 360)  # +1 каждые 6 минут
  current = min(50, current)
  ```
- При трате: `user.energy = current - amount; user.energy_updated_at = now()`
- Каждый рейд (PvP или PvE) стоит **5 энергии**
- Максимум: **50**

---

## 5. Игровые константы (config.py)

```python
UNIT_BUY_COST          = 50         # базовая цена юнита (множится на 1.12^count)
UNIT_UPGRADE_COST_BASE = 30         # апгрейд = base * current_level монет
SHIELD_COST            = 20         # монеты за щит
SHIELD_DURATION_HOURS  = 8          # часов действия щита
REFERRAL_REWARD_COINS  = 1000       # монеты рефереру за приглашённого
STARTING_COINS         = 100        # монеты при регистрации
RAID_STEAL_PERCENT     = 0.15       # 15% монет жертвы при рейде
NICKNAME_CHANGE_COST   = 100        # монеты за смену ника (первый раз бесплатно)
ADMIN_USER_ID          = 6320200740 # скрыт из лидерборда
```

---

## 6. Юниты — 20 типов

Открываются с ростом замка. Полный список в `shop_service.py → UNIT_TYPES`.

| Тип | Эмодзи | Замок | Power | Категория |
|-----|--------|-------|-------|-----------|
| warrior | ⚔️ | 1 | 10 | infantry |
| archer | 🏹 | 2 | 12 | ranged |
| knight | 🐴 | 3 | 14 | cavalry |
| mage | 🔮 | 4 | 16 | magic |
| spearman | 🗡️ | 5 | 11 | infantry |
| crossbow | 🎯 | 6 | 15 | ranged |
| paladin | ✝️ | 7 | 13 | divine |
| catapult | 💥 | 8 | 20 | siege |
| assassin | 🥷 | 9 | 18 | special |
| berserker | 💢 | 10 | 22 | infantry |
| dragon_rider | 🐲 | 11 | 25 | cavalry |
| warlock | 🌑 | 12 | 24 | magic |
| death_knight | 💀 | 13 | 28 | infantry |
| titan | 🗿 | 14 | 30 | siege |
| demon_lord | 😈 | 15 | 35 | special |
| phoenix_guard | 🔥 | 16 | 32 | divine |
| golem | 🤖 | 17 | 38 | siege |
| angel | 👼 | 18 | 36 | divine |
| void_walker | 🌌 | 19 | 42 | special |
| god_warrior | ☀️ | 20 | 50 | divine |

**Цена покупки**: `UNIT_BUY_COST × 1.12^(кол-во уже купленных)`  
**Лимит**: `CASTLE_DATA[castle_level].max_units`  
**Прокачка**: `UNIT_UPGRADE_COST_BASE × current_level` монет → +5 power, +3 defense  
**Продажа**: `POST /unit/sell` → возврат ~50% от стоимости покупки  
**Стакинг в UI**: юниты одного типа группируются в `UnitCard` (принимает `units: Unit[]`)

---

## 7. Боевая система

### Формула общей силы

```python
total_power = (
  sum(unit.power for unit in units)
  + (weapon.attack_bonus if weapon else 0)
  + sum(pet.power_bonus * (pet_energy / 20) for pet in pets)
)
```

### Модификаторы (применяются перед броском)

1. **Замок (только PvP)**: +2% за каждый уровень замка выше противника (макс +20%)
2. **Голод питомцев**: если среднее `hunger < 30%` → -15% к total_power
3. **Matchup категорий** (`_MATCHUP` в game_service.py):
   - infantry → cavalry ×1.15; ranged → infantry ×1.15; cavalry → ranged ×1.15
   - magic → cavalry ×1.20; siege → infantry/ranged ×1.10; divine → magic ×1.20

### Бросок и победа

```python
attacker_roll = attacker_power * random.uniform(0.60, 1.40)  # ±40%
defender_roll = defender_power * random.uniform(0.60, 1.40)
winner = attacker if attacker_roll > defender_roll else defender
```

---

## 8. PvP Рейды (`/raid/pvp`)

1. Проверки: не себя, энергия ≥ 5, цель без щита
2. Трата: 5 энергии у атакующего
3. **Победа**:
   - `available = max(0, defender.coins - 50)` — защитник всегда сохраняет **минимум 50 монет**
   - `steal = min(max(base_15%, rand(40,70)), available)`
   - defender.coins -= steal; attacker.coins += steal
   - +iron rand(2,5) атакующему
4. **Серия побед**: каждые 3 победы → +50 монет; каждые 10 побед → +1 кристалл
5. **Проигрыш**: win_streak = 0
6. Защитнику — уведомление типа `raid_attack` (бот доставляет за ≤10 сек)
7. **Месть**: в журнале боёв `can_revenge=True`; ответная атака → `is_revenged=True`

### Матчмейкинг (`/raid/random`)

- До 30 кандидатов: замок ±3, без щита, не сам, не бот-аккаунт
- Фильтр силы ±30%; при неудаче — берёт любого в диапазоне замка

---

## 9. PvE Рейды (`/raid/pve`)

- Бот: `bot_power = attacker_power × random(0.7, 1.3)`
- **Победа**: `coins = rand(15,25) × (1 + income_bonus% + pet_gold_bonus%) / 100`
- **Проигрыш**: -rand(5,15) монет
- Железо за победу: +rand(3,8)
- Те же streak-бонусы
- PvE лог: `Raid` с `attacker_id == defender_id`

---

## 10. Замок (20 уровней)

Полные данные в `shop_service.py → CASTLE_DATA`:

| Уровень | Название | Юниты | Бонус дохода | Стоимость |
|---------|----------|-------|-------------|-----------|
| 1 | Деревня | 3 | 0% | — |
| 2 | Крепость | 4 | 0% | 200 |
| 3 | Замок | 5 | 5% | 360 |
| 4 | Цитадель | 6 | 5% | 648 |
| 5 | Бастион | 7 | 10% | 1 166 |
| 6 | Крепость Дракона | 8 | 10% | 2 099 |
| 7 | Твердыня | 9 | 15% | 3 778 |
| 8 | Легендарный Замок | 10 | 15% | 6 800 |
| 9 | Небесная Цитадель | 12 | 20% | 12 240 |
| 10 | Вечная Твердыня | 15 | 25% | 22 032 |
| 11–20 | ... | 16–25 | 30–50% | 40k–7.9M |

Замок влияет на:
- Лимит юнитов (3 → 25)
- Бонус дохода от PvE
- Доступные типы юнитов
- Лимит питомцев: `min(10, ceil(level / 2))`
- Пассивный доход: `50 × (1 + income_bonus / 100)` монет каждые 5 часов

---

## 11. Щит

- Стоит 20 монет (SHIELD_COST)
- Активен 8 часов (SHIELD_DURATION_HOURS)
- Пока активен — PvP рейды на игрока заблокированы (403)

---

## 12. Ежедневная награда

- Цикл 7 дней: `[50, 75, 120, 200, 240, 300, 700]` монет
- Доступна раз в 24 часа; если пропущено **>48 ч** → streak сбрасывается
- День 7 цикла (`streak % 7 == 6`) → дополнительно **+3 кристалла**
- Компонент: `DailyReward.tsx` — календарь с 7 слотами (✅/⭐/💎/серый)

---

## 13. Пассивный доход (каждые 5 часов)

- `PASSIVE_INCOME_BASE = 50` монет (умножается на castle income_bonus)
- `claim_passive_income()` в `game_service.py`
- Эндпоинты: `POST /daily/passive/claim`, `GET /daily/passive/status`
- Статус передаётся через `GameStateOut`: `passive_income_ready`, `passive_income_amount`, `passive_income_next_in`
- UI: карточка "💰 Доход замка" в главной вкладке

---

## 14. Система уведомлений

### Схема работы

```
Backend (старт) → notification_trigger_loop() (каждые 5 мин)
  └── check_and_create_notifications() → пишет в таблицу notifications

Bot (постоянно) → poll_and_send_notifications() (каждые 10 сек)
  └── GET /internal/notifications/pending → send_message → POST .../sent
```

### Типы уведомлений и inline-кнопки

| type | Сообщение | Кнопка бота |
|------|-----------|-------------|
| `raid_attack` | Тебя атаковали | 🗡 Отомстить (вкладка Бой) |
| `energy_full` | Энергия заполнена | ⚡ В бой! (вкладка Бой) |
| `daily_ready` | Ежедневная награда готова | 🎁 Забрать награду (вкладка Замок) |
| `passive_ready` | Пассивный доход готов | 💰 Забрать доход (вкладка Замок) |
| `general` | Любое другое | ⚔️ Играть |

### Антиспам (notification_triggers.py)

- `energy_full`: не чаще 1 раза в 6 часов
- `daily_ready`: не чаще 1 раза в 24 часа
- `passive_ready`: не чаще 1 раза в 5 часов
- Проверка: `_has_recent_notification(db, user_id, type, since=now - interval)`

### Защита эндпоинтов

- Заголовок: `X-Internal-Token: SECRET_KEY`
- Проверяется в `routers/internal.py → verify_internal_token`

---

## 15. Оружие

- **Покупка**: 100 монет → "Железный меч" (common, +5 attack_bonus)
- **Прокачка**: `5 × current_level` железа → +3 attack_bonus; макс уровень 10
- **Эволюция редкости**: lvl4 → rare, lvl7 → epic, lvl10 → legendary
- В БД: `UNIQUE` по `owner_id` — у каждого игрока одно оружие
- Железо зарабатывается в боях (PvP: +rand(2,5), PvE: +rand(3,8))

---

## 16. Питомцы (30 видов)

### Яйца

| Тип | Цена | Инкубация | Пул питомцев |
|-----|------|-----------|--------------|
| common 🥚 | 200 монет | 2 ч | 10 common |
| rare 🔮 | 500 монет | 6 ч | 10 rare |
| elite 💎 | 1200 монет | 12 ч | 10 epic/legendary |

### Характеристики питомца

```
power_bonus       — прибавляется к total_power (масштабируется: bonus × energy/20)
gold_bonus        — % бонус к монетам от PvE победы
energy            — макс 20, +1 каждые 10 мин (600 сек)
hunger            — макс 100, -1 каждые 20 мин; если avg < 30% → -15% к силе
rarity            — common/rare/epic/legendary (влияет на power_bonus и gold_bonus)
```

### Лимит питомцев

`min(10, ceil(castle_level / 2))` — растёт с уровнем замка

### Прокачка

5 💎 → +3 power_bonus, +1 gold_bonus, +1 level питомца

### Кристаллы 💎

- 10 побед в серии → +1 кристалл
- 7-й день daily → +3 кристалла
- 10% шанс при победе питомца → +1 кристалл
- Покупка: 500 монет = 1 кристалл

### Стакинг в UI (PetStackCard)

Питомцы одного типа (`pet_type`) группируются:
- Свёрнутый вид: шапка с эмодзи, именем, счётчиком ×N, суммарной силой, стрелкой ▼/▲
- Раскрытый вид: каждый питомец — полная карточка с кнопками
- Одиночные питомцы всегда показываются развёрнуто

---

## 17. Фронтенд — детали реализации

### CSS-анимации (index.html)

```css
.anim-float  — плавающее движение (4 сек, замок, оружие, питомцы)
.anim-pulse  — пульсирующее свечение (кнопка daily/passive)
.anim-fadein — появление снизу (0.25 сек)
.anim-spin-slow — медленное вращение
```

**Важно**: `position: fixed` внутри анимированного предка (`transform`) не работает как viewport-fixed (CSS containment). Тултипы рендерятся через `createPortal(tooltip, document.body)` в `Profile.tsx`.

### Тултипы (InfoTooltip в Profile.tsx)

- `createPortal` → рендер в `document.body` (обход CSS transform containment)
- `getBoundingClientRect()` → вычисление координат при клике
- `width = Math.min(220, window.innerWidth - 24)` — адаптируется к ширине экрана
- Клик снаружи (touchstart + mousedown) закрывает тултип

### Главная вкладка (tab='main')

1. `MainCastleCard` — замок с анимацией, прогресс уровня, статы (нет API-запроса, данные из user)
2. `DailyReward` — календарь 7 дней
3. Карточка пассивного дохода — кнопка "Забрать" с таймером
4. Кнопка щита (если щит не активен)
5. Реферальная ссылка с копированием

### Навигация

6 вкладок с подписями: Замок / Войска / Бой / Лавка / Питомник / ТОП

---

## 18. Деплой и окружение

### Railway

- Проект: `happy-reflection` (рабочий)
- Сервисы: `backend`, `frontend`, `bot`, `Postgres`, `Redis` — все Online
- Автодеплой: push в GitHub → Railway пересобирает и деплоит

### Переменные окружения (.env)

```
BOT_TOKEN=...
SECRET_KEY=...
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
MINI_APP_URL=https://...         # URL Mini App (без слеша в конце)
BACKEND_URL=http://backend:8000  # внутри Railway network
VITE_BOT_USERNAME=...            # имя бота для реферальных ссылок
VITE_API_URL=/api                # префикс API на фронте
```

### Git-команды для деплоя (PowerShell — по одной строке)

```
git add .
git commit -m "описание"
git push
```

### SQL-миграции (Railway → Postgres → Data → Query)

Все миграции применяются автоматически через `init.sql` при старте backend.  
Для ручного применения на существующей БД:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_passive_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(32) DEFAULT 'general';
ALTER TABLE units ADD COLUMN IF NOT EXISTS unit_type VARCHAR(32) NOT NULL DEFAULT 'warrior';
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_streak INTEGER NOT NULL DEFAULT 0;
```

---

## 19. Что сделано (полная история)

| Фича | Статус | Файлы |
|------|--------|-------|
| Auth через Telegram initData | ✅ | core/security.py, routers/auth.py |
| PvP и PvE рейды | ✅ | services/game_service.py |
| Журнал боёв + месть | ✅ | routers/raid.py |
| Замок 20 уровней | ✅ | shop_service.py |
| Оружие (купить/прокачать) | ✅ | shop_service.py, routers/shop.py |
| Питомцы (яйца, инкубация, бой, кормёжка) | ✅ | pet_service.py |
| Прокачка питомцев за кристаллы | ✅ | pet_service.py |
| Daily reward (7 дней, streak) | ✅ | game_service.py |
| Пассивный доход замка (каждые 5 ч) | ✅ | game_service.py, routers/daily.py |
| Продажа юнитов (50% возврат) | ✅ | routers/unit.py, UnitCard.tsx |
| Стакинг юнитов в UI | ✅ | UnitCard.tsx |
| Стакинг питомцев в UI | ✅ | PetPanel.tsx → PetStackCard |
| Визуальный скроллбар в UnitShop | ✅ | UnitShop.tsx |
| Реферальная система + fix URL param | ✅ | App.tsx (dual-source), config.py (1000 монет) |
| Уведомления с inline-кнопками | ✅ | notifications.py, handlers/notifications.py |
| Фоновые триггеры уведомлений | ✅ | services/notification_triggers.py, backend/main.py |
| Бот отправляет уведомления (fix) | ✅ | bot/main.py (asyncio.create_task) |
| Никнеймы (бесплатно/100 монет) | ✅ | routers/user.py |
| Тултипы в шапке (InfoTooltip) | ✅ | Profile.tsx (createPortal) |
| Замок на главном экране | ✅ | HomePage.tsx → MainCastleCard |
| Визуал замка с анимацией в Лавке | ✅ | Shop.tsx → CastleTab |
| Анимация float на оружии | ✅ | Shop.tsx → WeaponTab |
| Анимация float на питомцах | ✅ | PetPanel.tsx (заголовок + стак) |
| Подписи под вкладками | ✅ | HomePage.tsx |
| Glassmorphism UI + CSS анимации | ✅ | index.html |
| Защита монет при рейде (мин. 50) | ✅ | game_service.py (MIN_KEEP = 50) |
| Клановая система (заготовка) | ✅ БД | migrations/init.sql (clans, clan_members, clan_wars) |

---

## 20. Что предстоит сделать

### Высокий приоритет

| Задача | Описание |
|--------|----------|
| **Замена эмодзи на изображения** | Пользователь принесёт PNG/WebP ассеты; нужно подключить в UnitCard, PetPanel, Shop |
| **Клановая система (UI)** | Таблицы в БД уже есть (clans, clan_members, clan_wars); нужен роутер + компонент |
| **PvP турниры** | Запланировано, детали не определены |

### Средний приоритет

| Задача | Описание |
|--------|----------|
| **Торговая площадка (market)** | Таблица market_listings в БД есть; нужен UI для продажи юнитов другим игрокам |
| **Инвентарь с пагинацией** | При большом кол-ве юнитов/питомцев добавить навигацию страницами |
| **Уведомление о вылуплении яйца** | Создавать уведомление когда яйцо готово |

### Технический долг

| Задача | Описание |
|--------|----------|
| **Redis кэш** | Подключён, но не используется; можно кэшировать лидерборд и castle info |
| **TypeScript строгость** | Некоторые типы используют `any` |
| **Тесты** | Нет ни одного теста |

---

## 21. Известные особенности и подводные камни

### Backend

1. **lazy="selectin"** на User → units/pets/weapon: загружаются автоматически. Если добавить новый relationship — указывать `lazy="selectin"` или `lazy="noload"` явно.
2. **notification_trigger_loop** стартует через 30 сек после запуска backend (ждёт инициализацию БД).
3. **init.sql** выполняется при каждом старте; все `ALTER TABLE` завёрнуты в `IF NOT EXISTS` — безопасно.
4. **RAID_COOLDOWN_SECONDS** в config.py = 3600, но в логике **кулдаун отключён** (возвращает 0). Поле `last_raid_at` пишется, но не проверяется.

### Frontend

1. **`position: fixed` внутри `transform`-анимации** — не работает как viewport-fixed. Всегда использовать `createPortal(el, document.body)` для оверлеев/тултипов внутри анимированных компонентов.
2. **`window.Telegram.WebApp.initData`** — пустая строка при тестировании вне Telegram. Добавить fallback или мок для разработки.
3. **VITE_BOT_USERNAME** — должен быть без `@`. Пример: `my_game_first_bot`.
4. **Два проекта на Railway**: `affectionate-charisma` (старый, можно удалить) и `happy-reflection` (рабочий).

### Деплой

1. PowerShell не поддерживает `&&` между командами — вводить по одной строке.
2. Railway автодеплоит только при push в ветку `main` (или ту что настроена в проекте).
3. После добавления новых колонок в модели — обязательно добавить `ALTER TABLE IF NOT EXISTS` в `init.sql`.
