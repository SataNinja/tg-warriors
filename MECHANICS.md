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

**Структура:**
```
BOT_TG/
├── bot/          — aiogram бот (start.py, notifications.py)
├── backend/      — FastAPI (models, routers, services, schemas, core)
└── frontend/     — React Mini App (App.tsx, pages/, api/)
```

---

## Аутентификация

1. Frontend берёт `window.Telegram.WebApp.initData`
2. POST `/auth/telegram` → backend валидирует HMAC-SHA256 подпись (алгоритм: `HMAC(HMAC("WebAppData", bot_token), sorted_fields)`)
3. Возвращает кастомный JWT (нет `python-jose`, всё вручную через `hmac` + `base64`)
4. JWT хранится в `localStorage` (ключ `access_token`), передаётся как `Bearer` в каждом запросе
5. `get_or_create_user()` — создаёт юзера при первом входе, обновляет имя при повторных

---

## Модель пользователя (User)

```
id              = Telegram user_id (BigInteger, PK)
coins           — основная валюта
iron            — для прокачки оружия (стартует с 10)
crystals        — премиум-ресурс (за победные серии и daily)
energy          — макс 50, регенерация +1 каждые 6 мин (360 сек), полный реген за 5 часов
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

## Юниты (Warriors)

- **Покупка**: `price = UNIT_BUY_COST × 1.12^(кол-во уже купленных)` — цена растёт с каждым юнитом
- **Лимит юнитов** = `castle_data[castle_level].max_units` (3 на старте, до 25 на макс уровне замка)
- **Прокачка**: стоит `UNIT_UPGRADE_COST_BASE × текущий_уровень` монет → +5 power, +3 defense
- **Базовые характеристики**: level=1, power=10, defense=5, name="Warrior"
- Юниты можно выставить на маркет (`is_for_sale`, `sale_price`)

---

## Боевая система (сила)

```python
total_power = sum(unit.power for unit in units)
           + weapon.attack_bonus (если есть)
           + sum(pet.power_bonus × pet_current_energy/20 for pet in pets)
```
Питомец вносит бонус пропорционально своей текущей энергии (20 max).

---

## PvP Рейды

1. Проверки: не себя, энергия ≥ 5, цель без щита
2. Бросок: `attacker_roll = power × random(0.75, 1.25)` для обоих
3. **Победа**: кража `max(base_steal, rand(40,70))` монет, где `base_steal = min(defender.coins × RAID_STEAL_PERCENT, defender.coins)`
4. **Серия**: каждые **3 победы** → +50 монет бонус; каждые **10 побед** → +1 кристалл
5. Железо за победу: `+random(2, 5)`
6. **Проигрыш**: win_streak = 0
7. Защитнику всегда уходит **уведомление** (запись в `notifications` → бот доставляет за 10 сек)
8. **Месть**: если тебя атаковали и победили, `can_revenge=True` в журнале боёв; при ответной атаке `is_revenged=True`

---

## PvE Рейды

1. Бот-противник: `bot_power = attacker_power × random(0.7, 1.3)`
2. Те же броски ±25%
3. **Победа**: `base = rand(15, 25)`, умноженное на `1 + (income_bonus + pet_gold_bonus) / 100`
4. **Проигрыш**: -rand(5, 15) монет
5. Железо за победу: `+random(3, 8)`
6. Те же streak-бонусы (+50 монет / +1 кристалл)
7. Логируется в `Raid` с `attacker_id == defender_id` (признак PvE)

---

## Замок (20 уровней)

| Уровень | Название | Юниты | Бонус дохода | Цена |
|---------|---------|-------|--------------|------|
| 1 | Деревня | 3 | 0% | — |
| 2 | Крепость | 4 | 0% | 200 |
| 3 | Замок | 5 | 5% | 360 |
| 5 | Бастион | 7 | 10% | 1 166 |
| 10 | Вечная Твердыня | 15 | 25% | 22 032 |
| 20 | Ультимативная Твердыня | 25 | 50% | 7 954 000 |

Полный массив в `shop_service.py → CASTLE_DATA`.

---

## Щит

- Стоит `SHIELD_COST` монет (из settings)
- Активен `SHIELD_DURATION_HOURS` часов (из settings)
- Пока активен — PvP рейды на игрока заблокированы с ошибкой 403

---

## Ежедневная награда (Daily)

- Цикл 7 дней: `[50, 75, 100, 150, 200, 250, 400]` монет
- Раз в 24 часа; если пропущено **>48 часов** — streak сбрасывается в 0
- День 7 цикла (`streak % 7 == 0`) → дополнительно **+3 кристалла**

---

## Реферальная система

- Deep link: `/start ref_<user_id>` → `?startapp=ref_<user_id>` в Mini App
- При регистрации нового пользователя: рефереру **автоматически** начисляются `REFERRAL_REWARD_COINS` монет
- `Referral.reward_claimed = True` сразу (не нужно вручную клеймить)
- Endpoint `/referral/claim` — для более старой схемы (unclaimed рефералы)

---

## Оружие

- **Покупка**: 100 монет → "Железный меч" (common, +5 attack)
- **Прокачка**: стоит `5 × current_level` железа → +3 attack_bonus за уровень
- **Максимальный уровень**: 10
- **Эволюция редкости**:
  - lvl 4: common → rare ("Стальной клинок")
  - lvl 7: rare → epic ("Клинок Судьбы")
  - lvl 10: epic → legendary ("Меч Дракона")
- Одно оружие на игрока, влияет на `total_power`

---

## Питомцы (30 видов)

**3 типа яиц:**
| Яйцо | Цена | Инкубация | Пул |
|------|------|-----------|-----|
| common 🥚 | 200 монет | 2 ч | 10 common питомцев |
| rare 🔮 | 500 монет | 6 ч | 10 rare питомцев |
| elite 💎 | 1200 монет | 12 ч | 10 epic/legendary питомцев |

**Характеристики питомцев:**
- `power_bonus` — прибавляется к total_power (пропорционально энергии питомца)
- `gold_bonus` — % бонус к монетам от PvE победы

**Энергия питомца**: макс 20, +1 каждые 10 минут (600 сек)

**Лимит питомцев** = `MAX_PETS[castle_level]` (от 1 до 10 в зависимости от уровня замка)

**Еда:**
- Базовая: 30 монет, +30 к голоду
- Премиум: 75 монет, полное восстановление голода

---

## Система уведомлений (бот → пользователь)

1. Backend создаёт `Notification(is_sent=False)` в транзакции
2. Бот каждые **10 секунд** делает `GET /internal/notifications/pending`
3. Отправляет сообщения через `bot.send_message`
4. Помечает через `POST /internal/notifications/{id}/sent`
5. Заголовок авторизации: `X-Internal-Token: SECRET_KEY`

---

## Журнал боёв

- Таблица `Raid`: `attacker_id`, `defender_id`, `attacker_power`, `defender_power`, `success`, `coins_stolen`, `is_revenged`
- PvE определяется по `attacker_id == defender_id`
- `can_revenge = (не я атаковал) AND success AND NOT is_revenged`

---

## Лидерборд

- Сортировка по: `coins`, `wins` (win_streak), `power` (считается в Python)
- Исключает `ADMIN_USER_ID`

---

## Типы транзакций

`earn | spend | steal | lose | daily | referral | shield | upgrade | buy_unit | castle | weapon | egg`

---

## Файлы, которые важно знать

| Файл | Что там |
|------|---------|
| `backend/models/user.py` | Полная структура пользователя |
| `backend/services/game_service.py` | **Вся игровая логика** (рейды, энергия, daily, рефералы) |
| `backend/services/shop_service.py` | Замок, оружие, яйца/питомцы, константы |
| `backend/services/auth_service.py` | JWT, get_or_create_user |
| `backend/core/security.py` | Валидация Telegram initData |
| `backend/services/notification_service.py` | Создание и получение уведомлений |
| `bot/handlers/notifications.py` | Фоновый поллинг уведомлений (каждые 10 сек) |
| `bot/handlers/start.py` | /start, deep link, реферальный код |
| `frontend/src/App.tsx` | Точка входа Mini App, auth flow |

---

## Настройки (settings / .env)

Ключевые переменные (из `core/config.py`, значения в `.env`):
- `BOT_TOKEN` — токен бота
- `SECRET_KEY` — для JWT и внутренних запросов
- `STARTING_COINS` — монеты при регистрации
- `UNIT_BUY_COST` — базовая цена юнита
- `UNIT_UPGRADE_COST_BASE` — множитель цены прокачки
- `RAID_STEAL_PERCENT` — доля монет при краже
- `SHIELD_COST`, `SHIELD_DURATION_HOURS`
- `REFERRAL_REWARD_COINS`
- `REDIS_URL`, `DATABASE_URL`
- `ADMIN_USER_ID` — исключён из лидерборда
- `MINI_APP_URL` — URL Mini App (в боте)
