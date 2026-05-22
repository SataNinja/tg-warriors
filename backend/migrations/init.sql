-- TG Warriors — инициализация базы данных
-- Выполняется один раз при первом запуске postgres-контейнера

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Пользователи ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT          PRIMARY KEY,           -- Telegram user_id
    username        VARCHAR(64),
    first_name      VARCHAR(128)    NOT NULL,
    last_name       VARCHAR(128),
    coins           BIGINT          NOT NULL DEFAULT 100,
    shield_until    TIMESTAMPTZ,
    last_daily_reward TIMESTAMPTZ,
    last_raid_at    TIMESTAMPTZ,
    referrer_id     BIGINT          REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

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

-- ── Индексы ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_units_owner       ON units(owner_id);
CREATE INDEX IF NOT EXISTS idx_raids_attacker    ON raids(attacker_id);
CREATE INDEX IF NOT EXISTS idx_raids_defender    ON raids(defender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_sent);
CREATE INDEX IF NOT EXISTS idx_transactions_user  ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
