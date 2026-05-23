-- TG Warriors — инициализация базы данных
-- Выполняется один раз при первом запуске postgres-контейнера

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Пользователи ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                  BIGINT      PRIMARY KEY,
    username            VARCHAR(64),
    first_name          VARCHAR(128) NOT NULL,
    last_name           VARCHAR(128),
    nickname            VARCHAR(32),
    coins               BIGINT      NOT NULL DEFAULT 100,
    energy              INTEGER     NOT NULL DEFAULT 50,
    energy_updated_at   TIMESTAMPTZ,
    shield_until        TIMESTAMPTZ,
    last_daily_reward   TIMESTAMPTZ,
    last_raid_at        TIMESTAMPTZ,
    referrer_id         BIGINT      REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Добавляем колонки если таблица уже существует (для существующих БД)
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS energy INTEGER NOT NULL DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS energy_updated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS castle_level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS win_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS iron INTEGER NOT NULL DEFAULT 10;
ALTER TABLE users ADD COLUMN IF NOT EXISTS crystals INTEGER NOT NULL DEFAULT 0;

-- ── Юниты ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(64)     NOT NULL DEFAULT 'Warrior',
    level       INTEGER         NOT NULL DEFAULT 1,
    power       INTEGER         NOT NULL DEFAULT 10,
    defense     INTEGER         NOT NULL DEFAULT 5,
    is_for_sale BOOLEAN         NOT NULL DEFAULT FALSE,
    sale_price  BIGINT,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ── Рейды ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raids (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    attacker_id     BIGINT      NOT NULL REFERENCES users(id),
    defender_id     BIGINT      NOT NULL REFERENCES users(id),
    attacker_power  INTEGER     NOT NULL DEFAULT 0,
    defender_power  INTEGER     NOT NULL DEFAULT 0,
    success         BOOLEAN     NOT NULL DEFAULT FALSE,
    coins_stolen    BIGINT      NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Рыночные лоты ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_listings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id     UUID        NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    seller_id   BIGINT      NOT NULL REFERENCES users(id),
    price       BIGINT      NOT NULL,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Рефералы ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id     BIGINT      NOT NULL REFERENCES users(id),
    referred_id     BIGINT      NOT NULL UNIQUE REFERENCES users(id),
    reward_claimed  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Уведомления ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message     TEXT        NOT NULL,
    is_sent     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Транзакции ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount      BIGINT      NOT NULL,
    type        VARCHAR(32) NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Оружие ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weapons (
    id          SERIAL      PRIMARY KEY,
    owner_id    BIGINT      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(64) NOT NULL DEFAULT 'Железный меч',
    rarity      VARCHAR(16) NOT NULL DEFAULT 'common',
    level       INTEGER     NOT NULL DEFAULT 1,
    attack_bonus INTEGER    NOT NULL DEFAULT 5,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Питомцы ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pets (
    id                  SERIAL      PRIMARY KEY,
    owner_id            BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(64) NOT NULL,
    pet_type            VARCHAR(16) NOT NULL,
    rarity              VARCHAR(16) NOT NULL DEFAULT 'common',
    level               INTEGER     NOT NULL DEFAULT 1,
    power_bonus         INTEGER     NOT NULL DEFAULT 0,
    gold_bonus          INTEGER     NOT NULL DEFAULT 0,
    energy              INTEGER     NOT NULL DEFAULT 20,
    energy_updated_at   TIMESTAMPTZ,
    last_battle_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Добавляем is_revenged для существующих БД
ALTER TABLE raids ADD COLUMN IF NOT EXISTS is_revenged BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Индексы ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_units_owner       ON units(owner_id);
CREATE INDEX IF NOT EXISTS idx_raids_attacker    ON raids(attacker_id);
CREATE INDEX IF NOT EXISTS idx_raids_defender    ON raids(defender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_sent);
CREATE INDEX IF NOT EXISTS idx_transactions_user  ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_pets_owner        ON pets(owner_id);

-- ── Кланы ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clans (
    id          SERIAL      PRIMARY KEY,
    name        VARCHAR(32) NOT NULL UNIQUE,
    description TEXT,
    leader_id   BIGINT      NOT NULL REFERENCES users(id),
    emblem      VARCHAR(8)  NOT NULL DEFAULT '⚔️',
    total_power INTEGER     NOT NULL DEFAULT 0,
    wins        INTEGER     NOT NULL DEFAULT 0,
    losses      INTEGER     NOT NULL DEFAULT 0,
    war_stage   INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clan_members (
    id          SERIAL      PRIMARY KEY,
    clan_id     INTEGER     NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
    user_id     BIGINT      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(16) NOT NULL DEFAULT 'member',
    contribution INTEGER    NOT NULL DEFAULT 0,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Клановые войны (3 этапа — заготовка)
CREATE TABLE IF NOT EXISTS clan_wars (
    id              SERIAL      PRIMARY KEY,
    clan_a_id       INTEGER     NOT NULL REFERENCES clans(id),
    clan_b_id       INTEGER     NOT NULL REFERENCES clans(id),
    stage           INTEGER     NOT NULL DEFAULT 1,
    stage_1_score_a INTEGER     NOT NULL DEFAULT 0,
    stage_2_score_a INTEGER     NOT NULL DEFAULT 0,
    stage_3_score_a INTEGER     NOT NULL DEFAULT 0,
    stage_1_score_b INTEGER     NOT NULL DEFAULT 0,
    stage_2_score_b INTEGER     NOT NULL DEFAULT 0,
    stage_3_score_b INTEGER     NOT NULL DEFAULT 0,
    winner_clan_id  INTEGER,
    is_finished     BOOLEAN     NOT NULL DEFAULT FALSE,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clan_members_clan ON clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_wars_clans   ON clan_wars(clan_a_id, clan_b_id);
