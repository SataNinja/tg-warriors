# TG Warriors — Полный план доработок

> Согласованные дизайн-решения зафиксированы здесь. Читать перед каждой сессией работы.

---

## Статус задач

| # | Задача | Статус |
|---|--------|--------|
| 1 | Эмодзи юнитов/питомцев в анимации боя | ⬜ |
| 2 | Фикс: бой питомцев останавливается при смене вкладки | ⬜ |
| 3 | Новые факторы боя + рандом | ⬜ |
| 4 | Daily reward — новые значения | ✅ |
| 5 | Кристаллы — применение и заработок | ⬜ |
| 6 | Стакинг юнитов в UI | ⬜ |
| 7 | Новые типы юнитов (20 типов для 20 уровней замка) | ⬜ |
| 8 | Бой со случайным реальным игроком (матчмейкинг) | ⬜ |
| 9 | Голод питомцев — исправление бага + 3%/час | ✅ |

---

## Задача 1: Эмодзи юнитов и питомцев в анимации боя

**Что сейчас:** в `BattleAnimation.tsx` захардкожены пулы `ATTACKER_UNITS` / `DEFENDER_UNITS`.

**Что нужно сделать:**
- В `RaidPanel.tsx` при запуске боя передавать `attackerUnits: string[]` (эмодзи юнитов игрока) и `attackerPets: string[]` (эмодзи питомцев)
- В `BattleAnimation` принять эти пропсы и использовать вместо дефолтных пулов
- Для PvE: на стороне бота оставить BOT_UNITS (🤖 и т.п.)
- Для PvP: у защитника нет данных в реальном времени → оставить `DEFENDER_UNITS` или передавать через battle journal

**Файлы:** `BattleAnimation.tsx`, `RaidPanel.tsx`, `api/client.ts`

**Откуда брать эмодзи:**
```ts
// Из GameState.user.units → unit_type → UNIT_EMOJIS[unit_type]
// Из fetchPets() → pet_type → PET_EMOJIS[pet_type]
```

---

## Задача 2: Фикс бага анимации питомцев при смене вкладки

**Что сейчас:** `PetFightAnimation` считает прогресс через счётчик фреймов (`frameRef.current`). Когда вкладка неактивна, `setInterval` тормозит → анимация останавливается и сразу прыгает к результату.

**Что нужно сделать:** переписать анимацию на `Date.now()`-based прогресс (как уже сделано в `BattleAnimation.tsx`).

```tsx
// Было:
const id = setInterval(() => {
  frameRef.current += 1
  if (frameRef.current >= totalFrames) { clearInterval(id); onDone() }
}, 200)

// Надо:
const startedAt = Date.now()
const totalMs = totalFrames * 200  // ~6000ms
const id = setInterval(() => {
  const elapsed = Date.now() - startedAt
  const t = Math.min(1, elapsed / totalMs)
  setFrame(Math.floor(t * totalFrames))
  if (elapsed >= totalMs) { clearInterval(id); onDone() }
}, 100)
```

**Файл:** `frontend/src/components/PetPanel.tsx` → функция `PetFightAnimation`

---

## Задача 3: Новые факторы боя

### Согласованные решения:
- **Рандом:** "мягкий" — слабее на 50% = ~20% шанс победы → расширить диапазон броска с ±25% до **±40%**
- **Уровень замка:** +2% к итоговой силе за каждый уровень замка выше противника (макс +20%)
- **Голод питомцев:** если средний голод питомцев < 30% → **-15% к total_power**
- **Тип юнитов:** система бонус/штраф (+10–20% к силе атакующего в зависимости от соотношения типов)

### Matchup-матрица (доминирующий тип vs доминирующий тип):

| Атакующий \ Защитник | infantry | ranged | cavalry | magic | siege | divine | special |
|---|---|---|---|---|---|---|---|
| **infantry** | 1.0 | 0.90 | **1.15** | 1.0 | 1.0 | 0.95 | 1.0 |
| **ranged** | **1.15** | 1.0 | 0.85 | 1.0 | 0.90 | 1.0 | 1.0 |
| **cavalry** | 0.90 | **1.15** | 1.0 | 0.80 | 1.0 | 0.90 | 1.0 |
| **magic** | 1.0 | 1.0 | **1.20** | 1.0 | 0.90 | 0.85 | 1.0 |
| **siege** | **1.10** | **1.10** | **1.10** | 0.80 | 1.0 | 0.90 | 1.0 |
| **divine** | 1.05 | 1.0 | **1.10** | **1.20** | **1.10** | 1.0 | 1.0 |
| **special** | 1.05 | 1.05 | 1.05 | 1.05 | 1.0 | 0.95 | 1.0 |

### Формула боя (обновлённая):
```python
# 1. Базовая сила
attacker_power = _total_power(attacker.units, attacker.weapon, attacker.pets)
defender_power = _total_power(defender.units, defender.weapon, defender.pets)

# 2. Castle level bonus (за каждый уровень выше)
castle_diff = attacker.castle_level - defender.castle_level
castle_mult = 1.0 + max(0, min(10, castle_diff)) * 0.02  # +2% per level, cap +20%
attacker_power = int(attacker_power * castle_mult)

# 3. Pet hunger penalty (для обеих сторон)
if _avg_pet_hunger(attacker.pets) < 30: attacker_power = int(attacker_power * 0.85)
if _avg_pet_hunger(defender.pets) < 30: defender_power = int(defender_power * 0.85)

# 4. Unit type matchup
matchup_mult = get_matchup_multiplier(attacker.units, defender.units)
attacker_power = int(attacker_power * matchup_mult)

# 5. Рандомный бросок ±40%
attacker_roll = attacker_power * random.uniform(0.60, 1.40)
defender_roll = defender_power * random.uniform(0.60, 1.40)
success = attacker_roll > defender_roll
```

**Файл:** `backend/services/game_service.py`

---

## Задача 4: Daily reward — новый цикл

**Новые значения (7 дней):** `[50, 75, 120, 200, 240, 300, 700]`

Старые были: `[50, 75, 100, 150, 200, 250, 400]`

**Файл:** `backend/services/game_service.py` → `DAILY_REWARDS`
**Фронтенд:** `DailyReward.tsx` если там захардкожены цифры — обновить

---

## Задача 5: Кристаллы — применение и заработок

### Применение: Улучшение питомца
- Новый эндпоинт: `POST /pets/{pet_id}/upgrade`
- Стоимость: **5 кристаллов** за улучшение
- Макс уровень питомца: **10**
- При улучшении:
  - `pet.level += 1`
  - `pet.power_bonus += 2` (+2 к attack bonus)
  - `pet.gold_bonus += 1` (+1% к gold)
  - `pet.max_energy += 5` (нужно добавить поле в модель Pet)

### Заработок кристаллов:
| Источник | Кристаллы |
|----------|-----------|
| Серия побед ×10 (уже есть) | +1 |
| Серия побед ×5 (добавить) | +1 |
| 7-й день daily (уже есть: +3) | +3 |
| Победа в бою питомца (10% шанс) | +1 |
| Покупка за монеты (новый эндпоинт) | 1 кристалл = 500 монет |

**Файлы:**
- `backend/models/pet.py` — добавить поле `max_energy` (Integer, default=20)
- `backend/services/pet_service.py` — новая функция `upgrade_pet()`
- `backend/routers/pets.py` — новый маршрут
- `backend/routers/shop.py` — эндпоинт покупки кристаллов
- `frontend/src/components/PetPanel.tsx` — кнопка улучшения

---

## Задача 6: Стакинг юнитов в UI

**Решение: только UI-слой** — backend хранит отдельные записи (для прокачки), frontend группирует по `unit_type` и показывает стак.

```tsx
// Из: [Warrior, Warrior, Warrior, Archer, Archer]
// В:  "⚔️ Воин × 3" и "🏹 Лучник × 2"

const stacked = units.reduce((acc, unit) => {
  const key = unit.unit_type
  if (!acc[key]) acc[key] = { ...unit, count: 0, totalPower: 0 }
  acc[key].count++
  acc[key].totalPower += unit.power
  return acc
}, {} as Record<string, ...>)
```

**Файлы:** `frontend/src/components/UnitCard.tsx`, `frontend/src/pages/HomePage.tsx`
**Backend:** никаких изменений, но нужно убедиться что `unit_type` передаётся в ответе API

---

## Задача 7: Новые типы юнитов

### Полная таблица (20 типов):

| Тип | Название | Эмодзи | Замок | Base Power | Defense | Категория | Специализация |
|-----|---------|--------|-------|-----------|---------|-----------|---------------|
| warrior | Воин | ⚔️ | 1 | 10 | 5 | infantry | Базовый. Бьёт кавалерию |
| archer | Лучник | 🏹 | 2 | 12 | 3 | ranged | Бьёт пехоту, слаб vs кавалерия |
| knight | Рыцарь | 🐴 | 3 | 14 | 6 | cavalry | Бьёт лучников, слаб vs пехота |
| mage | Маг | 🔮 | 4 | 16 | 2 | magic | Бьёт кавалерию, слаб vs divine |
| spearman | Копейщик | 🗡️ | 5 | 11 | 8 | infantry | Усиленная пехота против кавалерии |
| crossbow | Арбалетчик | 🎯 | 6 | 15 | 4 | ranged | Тяжёлый лучник, +бронебойность |
| paladin | Паладин | ✝️ | 7 | 13 | 12 | divine | Высокая защита, бьёт магию |
| catapult | Катапульта | 💥 | 8 | 20 | 1 | siege | Массовый урон, слаб vs магия |
| assassin | Ассасин | 🗡️ | 9 | 18 | 3 | special | Первый удар: +rand бонус |
| berserker | Берсерк | 💢 | 10 | 22 | 2 | infantry | Высокая атака, почти нет защиты |
| dragon_rider | Наездник Дракона | 🐲 | 11 | 25 | 7 | cavalry | Летящий, игнорирует matchup-штраф |
| warlock | Чернокнижник | 🌑 | 12 | 24 | 3 | magic | Проклятие: -10% к силе врага |
| death_knight | Рыцарь Смерти | 💀 | 13 | 28 | 8 | infantry | Нежить: второй шанс (если есть 2+ юнита этого типа) |
| titan | Титан | 🗿 | 14 | 30 | 10 | siege | Огромная атака и защита |
| demon_lord | Демон-Лорд | 😈 | 15 | 35 | 5 | special | Хаос: ±50% random к броску |
| phoenix_guard | Страж Феникса | 🔥 | 16 | 32 | 9 | divine | Огонь: +5% к power за каждый раунд побед streak |
| golem | Голем Войны | 🗿 | 17 | 38 | 15 | siege | Поглощает первый удар (снижает рандом врага) |
| angel | Архангел | 👼 | 18 | 36 | 12 | divine | +20% к total power всех friendly юнитов |
| void_walker | Пожиратель Пространства | 🌌 | 19 | 42 | 6 | special | Непредсказуем: 30% шанс double damage |
| god_warrior | Бог Войны | ☀️ | 20 | 50 | 20 | divine | Все matchup бонусы применяются |

### Backend изменения:
1. Добавить поле `unit_type: str` в `models/unit.py` (default="warrior")
2. Добавить `UNIT_TYPES` dict в `services/shop_service.py`
3. Обновить `buy_unit` — принимает `unit_type`, проверяет требование к замку
4. Обновить `upgrade_unit` — при прокачке power/defense берутся из базовых для типа + level bonus
5. Схема `BuyUnitRequest` — добавить `unit_type: str`
6. API ответ — добавить `unit_type` и `category` в `UnitOut`

---

## Задача 8: Матчмейкинг — бой со случайным игроком

### Логика поиска:
```python
# Шаг 1: Найти игроков с power в диапазоне ±30%
# Шаг 2: Из них — с castle_level ± 3
# Шаг 3: Исключить: себя, защищённых щитом, кого атаковали <1 часа назад
# Шаг 4: Если нашли — случайный выбор → стандартный do_raid()
# Шаг 5: Если не нашли → расширить до ±60% силы
# Шаг 6: Если всё равно никого → вернуть 404 "Нет подходящих противников"
```

**Новый эндпоинт:** `POST /raid/random`
**Новый маршрут в фронтенде:** третья вкладка в RaidPanel: `🎲 Случайный PvP`

**Файлы:**
- `backend/routers/raid.py` — новый маршрут
- `backend/services/game_service.py` — новая функция `do_random_raid()`
- `frontend/src/components/RaidPanel.tsx` — новая вкладка

---

## Задача 9: Голод питомцев — исправление бага + настройка скорости

### Текущий баг:
При вылуплении питомца `hunger_updated_at = None` → `get_pet_current_hunger()` всегда возвращает начальное значение (100) → голод никогда не уменьшается.

### Исправление:
В `hatch_egg()` добавить:
```python
pet = Pet(
    ...
    hunger=PET_MAX_HUNGER,
    hunger_updated_at=now_utc(),  # ← ДОБАВИТЬ ЭТО
)
```

### Скорость:
Пользователь выбрал **3% в час**.  
Текущий `HUNGER_DEPLE_SECONDS = 1200` (= -1% каждые 20 минут = -3% в час) — **уже правильно!**  
Нужно только исправить баг с `hunger_updated_at`.

**Файл:** `backend/services/pet_service.py` → `hatch_egg()`

---

## Порядок реализации (рекомендуемый)

1. **Задача 9** — самая простая, один баг, одна строчка
2. **Задача 4** — одна константа в game_service.py
3. **Задача 2** — UI-фикс анимации питомца
4. **Задача 6** — UI-стакинг (только фронт)
5. **Задача 3** — Новые факторы боя (бэкенд)
6. **Задача 7** — Новые типы юнитов (бэкенд + фронт + миграция БД)
7. **Задача 1** — Эмодзи в анимации боя (зависит от задачи 7 — нужны unit_type)
8. **Задача 5** — Кристаллы/апгрейд питомцев (бэкенд + фронт)
9. **Задача 8** — Матчмейкинг (бэкенд + фронт)

---

## Миграции БД (нужны)

| Таблица | Изменение |
|---------|-----------|
| `units` | + колонка `unit_type VARCHAR(32) DEFAULT 'warrior'` |
| `pets` | + колонка `max_energy INTEGER DEFAULT 20` |
| `pets` | `hunger_updated_at` — нужно убедиться что колонка существует (есть в модели) |

---

## Технические заметки

- Все изменения бэкенда требуют `alembic revision --autogenerate` + `alembic upgrade head`
- Фронтенд: `UNIT_EMOJIS` словарь нужно синхронизировать с бэкендовым `UNIT_TYPES`
- Для матчмейкинга: защита от атаки одного и того же игрока 2 раза подряд уже есть через `last_raid_at` на attackerе, но нужно также проверять со стороны defender (добавить `last_attacked_at` или использовать таблицу Raid)
