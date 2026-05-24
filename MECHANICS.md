# TG Warriors — Быстрое восстановление контекста

> Этот файл создан для быстрого погружения в проект. Читать при каждом новом сеансе работы.

---

## Стек и архитектура

| Слой | Технология |
|------|-----------|
| Bot | aiogram 3.7, aiohttp, python-dotenv |
| Backend | FastAPI + SQLAlchemy (async) + PostgreSQL + Redis |
| Frontend | React + TypeScript + Vite (Telegram Mini App) |
| Auth | Telegram initData → кастомный JWT (HS256, без сторонних библиотек) |
| Deploy | GitHub → Railway (автодеплой по push) |

**Структура:**
```
BOT_TG/
├── bot/          — aiogram бот (start.py, notifications.py)
├── backend/      — FastAPI (models, routers, services, schemas, core)
└── frontend/     — React Mini App (App.tsx, pages/, components/, api/)
```

---

## Аутентификация

1. Frontend берёт `window.Telegram.WebApp.initData`
2. POST `/auth/telegram` → backend валидирует HMAC-SHA256 подпись
3. Возвращает кастомный JWT (без `python-jose`, всё через `hmac` + `base64`)
4. JWT хранится в `localStorage` (ключ `access_token`), передаётся как `Bearer`
5. `get_or_create_user()` — создаёт юзера при первом входе

---

## Модель пользователя (User)

```
id              = Telegram user_id (BigInteger, PK)
coins           — основная валюта
iron            — для прокачки оружия (стартует с 10)
crystals        — премиум-ресурс
energy          — макс 50, +1 каждые 6 мин (360 сек)
castle_level    — уровень замка (1–20)
win_streak      — серия побед (PvP + PvE общая)
shield_until    — DateTime до которого активен щит
last_daily_reward — DateTime последнего daily
daily_streak    — счётчик дней подряд
last_raid_at    — DateTime последнего рейда
referrer_id     — кто пригласил
```

---

## Энергия

- Рассчитывается на лету: `current = user.energy + int(elapsed_seconds // 360)`
- При трате: пишем актуальное значение обратно в `user.energy`, обновляем `energy_updated_at`
- Каждый рейд (PvP или PvE) стоит **5 энергии**

---

## Юниты (Warriors) — 20 типов

**Стакинг**: в UI юниты одного типа группируются в карточку-стак (UnitCard.tsx принимает `units: Unit[]`)

**Покупка**: `price = UNIT_BUY_COST × 1.12^(кол-во уже купленных)` — цена растёт с каждым юнитом

**Лимит**: `castle_data[castle_level].max_units` (3 на старте, до 25 на макс уровне замка)

**Прокачка**: `UNIT_UPGRADE_COST_BASE × current_level` монет → +5 power, +3 defense

**Все 20 типов** (в `backend/services/shop_service.py → UNIT_TYPES`):
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

---

## Боевая система

### Формула силы
```python
total_power = sum(unit.power) + weapon.attack_bonus + sum(pet.power_bonus × pet_energy/20)
```

### Модификаторы боя (`_apply_battle_modifiers` в game_service.py)
1. **Замок**: +2% за каждый уровень замка выше противника (макс +20%) — только PvP
2. **Голод питомцев**: если avg_hunger < 30% → -15% к силе
3. **Matchup категорий**: матрица infantry/ranged/cavalry/magic/siege/divine/special
   - infantry бьёт cavalry, ranged бьёт infantry, cavalry бьёт ranged
   - magic бьёт cavalry, siege бьёт пехоту/лучников, divine бьёт магию

### Бросок
- `roll = power × random(0.60, 1.40)` — ±40% к силе каждой стороны (было ±25%)
- Побеждает тот, у кого выше roll

---

## PvP Рейды

1. Проверки: не себя, энергия ≥ 5, цель без щита
2. **Победа**: кража `max(base_steal, rand(40,70))` монет; +iron rand(2,5)
3. **Серия**: каждые 3 победы → +50 монет; каждые 10 побед → +1 кристалл
4. **Проигрыш**: win_streak = 0
5. Защитнику — уведомление через notifications (бот доставляет за 10 сек)
6. **Месть**: `can_revenge=True` в журнале боёв; ответная атака помечает `is_revenged=True`
7. Результат содержит `opponent_name` (никнейм или first_name)

## Случайный матчмейкинг (`/raid/random`)
- Ищет до 30 кандидатов: замок ±3, без щита, не сам себя
- Фильтрует по силе ±30%
- При неудаче — берёт любого из диапазона замка
- Использует `lazy="selectin"` на User → units/pets/weapon грузятся автоматически

## PvE Рейды

- Бот-противник: `bot_power = attacker_power × random(0.7, 1.3)`
- **Победа**: `base = rand(15, 25) × (1 + income_bonus_pct + pet_gold_bonus) / 100`
- **Проигрыш**: -rand(5, 15) монет
- Железо за победу: +random(3, 8)
- Те же streak-бонусы
- Логируется в `Raid` с `attacker_id == defender_id` (признак PvE)

---

## Замок (20 уровней)

Полный массив в `shop_service.py → CASTLE_DATA`. Влияет на:
- Лимит юнитов (3 → 25)
- Бонус дохода от PvE (0% → 50%)
- Доступные типы юнитов
- Лимит питомцев (1 → 10)

---

## Щит

- Стоит `SHIELD_COST` монет
- Активен `SHIELD_DURATION_HOURS` часов
- Пока активен — PvP рейды на игрока заблокированы (403)

---

## Ежедневная награда (Daily)

- Цикл 7 дней: `[50, 75, 120, 200, 240, 300, 700]` монет (обновлено с оригинала)
- Раз в 24 часа; если пропущено **>48 часов** — streak сбрасывается в 0
- День 7 цикла (`streak % 7 == 0`) → дополнительно **+3 кристалла**
- Фронтенд: `DailyReward.tsx` отображает ивентовый календарь 7 дней с подсветкой (✅/⭐/💎/серый)

---

## Реферальная система

- Deep link: `/start ref_<user_id>`
- При регистрации: рефереру автоматически `REFERRAL_REWARD_COINS` монет
- `Referral.reward_claimed = True` сразу

---

## Оружие

- **Покупка**: 100 монет → "Железный меч" (common, +5 attack)
- **Прокачка**: `5 × current_level` железа → +3 attack_bonus
- **Максимальный уровень**: 10
- **Эволюция**: lvl4 common→rare, lvl7 rare→epic, lvl10 epic→legendary

---

## Питомцы (30 видов)

**3 типа яиц** (`EGG_DATA`):
| Яйцо | Цена | Инкубация | Пул |
|------|------|-----------|-----|
| common 🥚 | 200 монет | 2 ч | 10 common питомцев |
| rare 🔮 | 500 монет | 6 ч | 10 rare питомцев |
| elite 💎 | 1200 монет | 12 ч | 10 epic/legendary питомцев |

**Характеристики**:
- `power_bonus` — прибавляется к total_power (пропорционально энергии: `bonus × energy/20`)
- `gold_bonus` — % бонус к монетам от PvE победы
- `energy`: макс 20, +1 каждые 10 мин (600 сек)
- `hunger`: макс 100, -1 каждые 20 мин (1200 сек) = -3%/час → при avg < 30% штраф -15% к силе

**Лимит**: `MAX_PETS[castle_level]` (1–10)

**Еда**: базовая 30 монет (+30 голода), премиум 75 монет (полное восстановление)

**Прокачка**: 5 💎 → +3 power_bonus, +1 gold_bonus, +1 level питомца

**Стакинг**: TODO — одинаковые питомцы пока не стакаются (задача в очереди)

---

## Кристаллы 💎

**Откуда берутся**:
- Каждые 10 побед в серии (PvP/PvE) → +1 кристалл
- 7-й день daily → +3 кристалла
- 10% шанс при победе в бою питомца → +1 кристалл
- Покупка: 500 монет = 1 кристалл (до 10 за раз)

**На что тратятся**:
- Прокачка питомца: 5 💎 → POST `/pets/{id}/upgrade`

---

## Система уведомлений (бот → пользователь)

1. Backend создаёт `Notification(is_sent=False)` в транзакции
2. Бот каждые **10 секунд** делает `GET /internal/notifications/pending`
3. Отправляет `bot.send_message`
4. Помечает через `POST /internal/notifications/{id}/sent`
5. Заголовок: `X-Internal-Token: SECRET_KEY`

**TODO**: добавить inline-кнопку "Отомстить" в уведомление об атаке + уведомления о восстановлении энергии и daily

---

## Журнал боёв

- Таблица `Raid`: `attacker_id`, `defender_id`, `attacker_power`, `defender_power`, `success`, `coins_stolen`, `is_revenged`
- PvE: `attacker_id == defender_id`
- `can_revenge = (не я атаковал) AND success AND NOT is_revenged`

---

## Лидерборд

- Сортировка: `coins`, `wins`, `power`
- Исключает `ADMIN_USER_ID`

---

## Фронтенд — ключевые компоненты

| Файл | Что делает |
|------|------------|
| `App.tsx` | auth flow, загрузка gameState |
| `pages/HomePage.tsx` | главная страница, 6 вкладок (main/units/raid/shop/pets/leaderboard) |
| `components/RaidPanel.tsx` | 3 режима боя (pve/random/pvp), журнал, месть |
| `components/BattleAnimation.tsx` | анимация боя, восстанавливается после смены вкладки через gameStore |
| `components/UnitCard.tsx` | стак юнитов одного типа (UNIT_EMOJIS экспортируется) |
| `components/UnitShop.tsx` | выбор типа юнита с горизонтальным скроллом |
| `components/PetPanel.tsx` | питомцы, яйца, бой питомцев, прокачка за кристаллы |
| `components/DailyReward.tsx` | ивентовый календарь 7 дней |
| `store/gameStore.ts` | Zustand: `ongoingBattle` (прогресс боя переживает смену вкладки) |
| `api/client.ts` | все HTTP-запросы к backend |

---

## Файлы бэкенда — ключевые

| Файл | Что там |
|------|---------|
| `backend/models/user.py` | Полная структура пользователя |
| `backend/services/game_service.py` | **Вся игровая логика** (рейды, энергия, daily, рефералы, кристаллы) |
| `backend/services/shop_service.py` | UNIT_TYPES, CASTLE_DATA, PET_TYPES, EGG_DATA, оружие |
| `backend/services/pet_service.py` | покупка/инкубация/бой питомцев, upgrade_pet |
| `backend/services/auth_service.py` | JWT, get_or_create_user |
| `backend/core/security.py` | Валидация Telegram initData |
| `backend/services/notification_service.py` | create_notification, get_pending |
| `bot/handlers/notifications.py` | Фоновый поллинг (каждые 10 сек) |
| `bot/handlers/start.py` | /start, deep link, реферальный код |

---

## Настройки (settings / .env)

- `BOT_TOKEN`, `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`
- `STARTING_COINS`, `UNIT_BUY_COST`, `UNIT_UPGRADE_COST_BASE`
- `RAID_STEAL_PERCENT`, `SHIELD_COST`, `SHIELD_DURATION_HOURS`
- `REFERRAL_REWARD_COINS`, `ADMIN_USER_ID`, `MINI_APP_URL`

---

## Деплой

- **GitHub → Railway** автодеплой по push
- Три сервиса: `backend` (FastAPI), `frontend` (Vite→nginx), `bot` (aiogram)
- Migrации: вручную через Railway → Postgres → Data/Query (SQL вставить и выполнить)
- PowerShell команды по одной: `git add .` → `git commit -m "..."` → `git push`

---

## Задачи — актуальный статус

| # | Задача | Статус |
|---|--------|--------|
| — | Исходный план задач 1–9 | ✅ выполнено |
| — | Удаление/продажа юнитов (50% возврат) | ✅ `POST /unit/sell` + кнопка 💸 в UnitCard |
| — | Стакинг питомцев | ✅ `PetStackCard` в PetPanel |
| — | Ник в бою (`opponent_name`) | ✅ |
| — | Визуальный скроллбар в UnitShop | ✅ CSS индикатор |
| — | Уведомления бота с inline кнопками | ✅ raid_attack/energy/daily/passive типы |
| — | Пассивный доход замка (каждые 5ч) | ✅ `POST /daily/passive/claim` |
| — | Подписи под вкладками (Замок/Войска/Бой/...) | ✅ в HomePage.tsx |
| — | Тултипы при нажатии в шапке | ✅ `InfoTooltip` компонент в Profile |
| — | Визуал замка (большой, с анимацией) | ✅ Shop → CastleTab |
| — | Fix рефералки (URL param + 1000 монет) | ✅ App.tsx + config.py |
| — | Современный UI (градиент, анимации) | ✅ index.html CSS |

## Миграции БД (выполнить в Railway → Postgres → Query)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_passive_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(32) NOT NULL DEFAULT 'general';
ALTER TABLE units ADD COLUMN IF NOT EXISTS unit_type VARCHAR(32) NOT NULL DEFAULT 'warrior';
```

## Следующие возможные задачи (в очереди)

- Реальные картинки вместо эмодзи (user принесёт ассеты)
- Уведомления о полной энергии (scheduled task в боте)
- Уведомление о готовом daily (scheduled task в боте)
- PvP турниры / клановая система
- Торговая площадка юнитов (market)
