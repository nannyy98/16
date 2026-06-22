/*
  # ShopCoin Managed Internal Economy v2

  Core: TOTAL_SUPPLY = USER_BALANCES + TREASURY + RESERVED
  Coins circulate, never destroyed — spent coins return to Treasury.
*/

-- ============================================================
-- 1. GLOBAL CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS coin_config (
  key   text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO coin_config (key, value) VALUES
  ('total_supply',      '1000000'),
  ('treasury_balance',  '700000'),
  ('reserved_balance',  '100000'),
  ('earning_enabled',   'true'),
  ('spending_enabled',  'true'),
  ('max_daily_earn_per_user', '50'),
  ('max_monthly_earn_per_user', '300'),
  ('version',           '1')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. TREASURY
-- ============================================================
CREATE TABLE IF NOT EXISTS treasury (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  balance       integer NOT NULL DEFAULT 700000,
  reserved      integer NOT NULL DEFAULT 100000,
  total_minted  bigint  NOT NULL DEFAULT 0,
  total_returned bigint NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

INSERT INTO treasury (balance, reserved) VALUES (700000, 100000)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. WALLETS (updated with daily/monthly tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id     bigint UNIQUE NOT NULL,
  balance         integer NOT NULL DEFAULT 0,
  total_earned    integer NOT NULL DEFAULT 0,
  total_spent     integer NOT NULL DEFAULT 0,
  frozen          integer NOT NULL DEFAULT 0,
  daily_earned    integer NOT NULL DEFAULT 0,
  monthly_earned  integer NOT NULL DEFAULT 0,
  last_earn_reset date,
  last_month_reset date,
  is_frozen       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallets_telegram_id ON wallets(telegram_id);

-- ============================================================
-- 4. WALLET TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id     uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  telegram_id   bigint NOT NULL,
  type          text NOT NULL CHECK (type IN ('earn','spend','freeze','unfreeze','admin_adjust','expire')),
  amount        integer NOT NULL CHECK (amount > 0),
  balance_after integer NOT NULL,
  source        text NOT NULL,
  description   text,
  reference_id  text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wt_wallet   ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wt_user     ON wallet_transactions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_wt_created  ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wt_source   ON wallet_transactions(source);

-- ============================================================
-- 5. REWARD RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS coin_rewards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action          text UNIQUE NOT NULL,
  amount          integer NOT NULL,
  description     text,
  is_active       boolean DEFAULT true,
  max_per_user_day   integer,
  max_per_user_month integer,
  cooldown_hours  integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

INSERT INTO coin_rewards (action, amount, description, max_per_user_day, max_per_user_month) VALUES
  ('invite_friend',     1, 'Пригласил друга',          NULL, 20),
  ('friend_registered', 1, 'Друг зарегистрировался',   NULL, 20),
  ('friend_first_order',2, 'Первая покупка друга',      NULL, 10),
  ('first_order',       3, 'Первая покупка',            1,    1),
  ('purchase',          1, 'Покупка (за каждые 5000 сум)', NULL, 30),
  ('daily_visit',       1, 'Ежедневный визит',          1,    30),
  ('review',            1, 'Отзыв на товар',            NULL, 10),
  ('birthday',          5, 'День рождения',             1,    1)
ON CONFLICT (action) DO NOTHING;

-- ============================================================
-- 6. REWARD STORE (what users can buy with coins)
-- ============================================================
CREATE TABLE IF NOT EXISTS reward_store (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  name_uz           text,
  description       text,
  description_uz    text,
  cost              integer NOT NULL CHECK (cost > 0),
  discount_type     text NOT NULL CHECK (discount_type IN ('percent','fixed','free_delivery','exclusive','cashback')),
  discount_value    integer NOT NULL,
  icon_url          text,
  is_active         boolean DEFAULT true,
  stock             integer DEFAULT -1,
  max_per_user      integer DEFAULT 3,
  min_order_amount  integer DEFAULT 0,
  valid_from        timestamptz DEFAULT now(),
  valid_until       timestamptz,
  usage_count       integer DEFAULT 0,
  sort_order        integer DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

INSERT INTO reward_store (name, name_uz, cost, discount_type, discount_value, min_order_amount, max_per_user, sort_order) VALUES
  ('Скидка 3%',       '3% chegirma',       8,  'percent',       3,   50000,  3, 1),
  ('Скидка 5%',       '5% chegirma',       15, 'percent',       5,  100000,  2, 2),
  ('Скидка 10%',      '10% chegirma',      35, 'percent',       10, 200000,  1, 3),
  ('Бесплатная доставка','Bepul yetkazish', 12, 'free_delivery', 1,  0,      2, 4),
  ('Эксклюзивный доступ','Ekskluziv kirish', 50,'exclusive',     1,  0,      1, 5),
  ('Кэшбэк 2%',       '2% cashback',       20, 'cashback',      2,  80000,  2, 6)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. INVITES
-- ============================================================
CREATE TABLE IF NOT EXISTS invites (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_telegram_id  bigint NOT NULL,
  invited_telegram_id  bigint,
  invite_code      text UNIQUE NOT NULL,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','registered','first_order')),
  inviter_reward   integer DEFAULT 0,
  invited_reward   integer DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  registered_at    timestamptz,
  first_order_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_invites_inviter ON invites(inviter_telegram_id);
CREATE INDEX IF NOT EXISTS idx_invites_code    ON invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_invites_invited ON invites(invited_telegram_id);

-- ============================================================
-- 8. ADMIN COIN LOG (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_coin_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      text NOT NULL,
  action        text NOT NULL,
  target_user   bigint,
  amount        integer,
  old_balance   integer,
  new_balance   integer,
  reason        text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_log_created ON admin_coin_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_log_user    ON admin_coin_log(target_user);

-- ============================================================
-- 9. RLS
-- ============================================================
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_coin_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='wallets_select' AND tablename='wallets') THEN
    CREATE POLICY wallets_select ON wallets FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='wallets_all_auth' AND tablename='wallets') THEN
    CREATE POLICY wallets_all_auth ON wallets FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='wt_select' AND tablename='wallet_transactions') THEN
    CREATE POLICY wt_select ON wallet_transactions FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='wt_insert_auth' AND tablename='wallet_transactions') THEN
    CREATE POLICY wt_insert_auth ON wallet_transactions FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='cr_select' AND tablename='coin_rewards') THEN
    CREATE POLICY cr_select ON coin_rewards FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='cr_all_auth' AND tablename='coin_rewards') THEN
    CREATE POLICY cr_all_auth ON coin_rewards FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='rs_select' AND tablename='reward_store') THEN
    CREATE POLICY rs_select ON reward_store FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='rs_all_auth' AND tablename='reward_store') THEN
    CREATE POLICY rs_all_auth ON reward_store FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='inv_select' AND tablename='invites') THEN
    CREATE POLICY inv_select ON invites FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='inv_all_auth' AND tablename='invites') THEN
    CREATE POLICY inv_all_auth ON invites FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='tr_select' AND tablename='treasury') THEN
    CREATE POLICY tr_select ON treasury FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='tr_all_auth' AND tablename='treasury') THEN
    CREATE POLICY tr_all_auth ON treasury FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='cc_select' AND tablename='coin_config') THEN
    CREATE POLICY cc_select ON coin_config FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='cc_all_auth' AND tablename='coin_config') THEN
    CREATE POLICY cc_all_auth ON coin_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='acl_select' AND tablename='admin_coin_log') THEN
    CREATE POLICY acl_select ON admin_coin_log FOR SELECT USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE pname='acl_insert_auth' AND tablename='admin_coin_log') THEN
    CREATE POLICY acl_insert_auth ON admin_coin_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 10. RPC FUNCTIONS
-- ============================================================

-- Get or create wallet (with daily/monthly reset)
CREATE OR REPLACE FUNCTION get_or_create_wallet(p_telegram_id bigint)
RETURNS wallets AS $$
DECLARE
  v_wallet wallets;
  v_today date := current_date;
  v_month date := date_trunc('month', current_date)::date;
BEGIN
  SELECT * INTO v_wallet FROM wallets WHERE telegram_id = p_telegram_id;

  IF v_wallet IS NULL THEN
    INSERT INTO wallets (telegram_id, last_earn_reset, last_month_reset)
    VALUES (p_telegram_id, v_today, v_month)
    RETURNING * INTO v_wallet;
  ELSE
    -- reset daily counter
    IF v_wallet.last_earn_reset < v_today THEN
      UPDATE wallets SET daily_earned = 0, last_earn_reset = v_today WHERE id = v_wallet.id;
      v_wallet.daily_earned := 0;
    END IF;
    -- reset monthly counter
    IF v_wallet.last_month_reset < v_month THEN
      UPDATE wallets SET monthly_earned = 0, last_month_reset = v_month WHERE id = v_wallet.id;
      v_wallet.monthly_earned := 0;
    END IF;
  END IF;

  RETURN v_wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Internal: transfer coins between wallet and treasury
CREATE OR REPLACE FUNCTION transfer_coins(
  p_telegram_id bigint,
  p_amount integer,
  p_direction text,
  p_source text,
  p_description text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb AS $$
DECLARE
  v_wallet wallets;
  v_treasury treasury;
  v_new_balance integer;
  v_max_daily integer;
  v_max_monthly integer;
  v_config_earning boolean;
BEGIN
  -- check if earning is enabled
  SELECT value::boolean INTO v_config_earning FROM coin_config WHERE key = 'earning_enabled';
  IF v_config_earning = false AND p_direction = 'earn' THEN
    RAISE EXCEPTION 'Earning is currently disabled';
  END IF;

  -- check spending enabled
  IF p_direction = 'spend' THEN
    SELECT value::boolean INTO v_config_earning FROM coin_config WHERE key = 'spending_enabled';
    IF v_config_earning = false THEN
      RAISE EXCEPTION 'Spending is currently disabled';
    END IF;
  END IF;

  -- get/create wallet
  v_wallet := get_or_create_wallet(p_telegram_id);

  IF v_wallet.is_frozen THEN
    RAISE EXCEPTION 'Wallet is frozen';
  END IF;

  -- get treasury
  SELECT * INTO v_treasury FROM treasury LIMIT 1;

  IF p_direction = 'earn' THEN
    -- check daily limit
    SELECT value::integer INTO v_max_daily FROM coin_config WHERE key = 'max_daily_earn_per_user';
    IF v_wallet.daily_earned + p_amount > v_max_daily THEN
      RAISE EXCEPTION 'Daily earning limit reached (%/%)', v_wallet.daily_earned, v_max_daily;
    END IF;

    -- check monthly limit
    SELECT value::integer INTO v_max_monthly FROM coin_config WHERE key = 'max_monthly_earn_per_user';
    IF v_wallet.monthly_earned + p_amount > v_max_monthly THEN
      RAISE EXCEPTION 'Monthly earning limit reached (%/%)', v_wallet.monthly_earned, v_max_monthly;
    END IF;

    -- check treasury has enough
    IF v_treasury.balance < p_amount THEN
      RAISE EXCEPTION 'Treasury insufficient (available: %)', v_treasury.balance;
    END IF;

    v_new_balance := v_wallet.balance + p_amount;

    -- update wallet
    UPDATE wallets SET
      balance = v_new_balance,
      total_earned = total_earned + p_amount,
      daily_earned = daily_earned + p_amount,
      monthly_earned = monthly_earned + p_amount,
      updated_at = now()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;

    -- transfer from treasury
    UPDATE treasury SET
      balance = balance - p_amount,
      total_minted = total_minted + p_amount,
      updated_at = now();

  ELSIF p_direction = 'spend' THEN
    IF v_wallet.balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient balance: % < %', v_wallet.balance, p_amount;
    END IF;

    v_new_balance := v_wallet.balance - p_amount;

    UPDATE wallets SET
      balance = v_new_balance,
      total_spent = total_spent + p_amount,
      updated_at = now()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;

    -- return to treasury
    UPDATE treasury SET
      balance = balance + p_amount,
      total_returned = total_returned + p_amount,
      updated_at = now();

  ELSE
    RAISE EXCEPTION 'Invalid direction: %', p_direction;
  END IF;

  -- log transaction
  INSERT INTO wallet_transactions (
    wallet_id, telegram_id, type, amount, balance_after,
    source, description, reference_id, metadata
  ) VALUES (
    v_wallet.id, p_telegram_id,
    CASE WHEN p_direction = 'earn' THEN 'earn' ELSE 'spend' END,
    p_amount, v_new_balance,
    p_source, p_description, p_reference_id, p_metadata
  );

  RETURN jsonb_build_object(
    'wallet', row_to_json(v_wallet),
    'treasury_balance', (SELECT balance FROM treasury LIMIT 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public: add coins (earn)
CREATE OR REPLACE FUNCTION add_coins(
  p_telegram_id bigint,
  p_amount integer,
  p_source text,
  p_description text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb AS $$
BEGIN
  RETURN transfer_coins(p_telegram_id, p_amount, 'earn', p_source, p_description, p_reference_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Public: spend coins
CREATE OR REPLACE FUNCTION spend_coins(
  p_telegram_id bigint,
  p_amount integer,
  p_source text,
  p_description text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb AS $$
BEGIN
  RETURN transfer_coins(p_telegram_id, p_amount, 'spend', p_source, p_description, p_reference_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process invite
CREATE OR REPLACE FUNCTION process_invite_reward(
  p_inviter_telegram_id bigint,
  p_invited_telegram_id bigint
)
RETURNS jsonb AS $$
DECLARE
  v_inviter_reward integer;
  v_invited_reward integer;
  v_inviter_result jsonb;
  v_invited_result jsonb;
BEGIN
  SELECT amount INTO v_inviter_reward FROM coin_rewards WHERE action = 'invite_friend' AND is_active = true;
  SELECT amount INTO v_invited_reward FROM coin_rewards WHERE action = 'friend_registered' AND is_active = true;
  v_inviter_reward := COALESCE(v_inviter_reward, 1);
  v_invited_reward := COALESCE(v_invited_reward, 1);

  v_inviter_result := add_coins(p_inviter_telegram_id, v_inviter_reward, 'invite_friend', 'Приглашение друга', p_invited_telegram_id::text);
  v_invited_result := add_coins(p_invited_telegram_id, v_invited_reward, 'friend_registered', 'Регистрация по приглашению', p_inviter_telegram_id::text);

  RETURN jsonb_build_object(
    'inviter_balance', (v_inviter_result->>'wallet')::jsonb->>'balance',
    'invited_balance', (v_invited_result->>'wallet')::jsonb->>'balance',
    'inviter_reward', v_inviter_reward,
    'invited_reward', v_invited_reward
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process first order reward
CREATE OR REPLACE FUNCTION process_first_order_reward(p_telegram_id bigint)
RETURNS jsonb AS $$
DECLARE
  v_reward integer;
  v_order_count bigint;
BEGIN
  SELECT count(*) INTO v_order_count FROM orders WHERE telegram_user_id = p_telegram_id;
  IF v_order_count > 1 THEN
    RETURN jsonb_build_object('rewarded', false);
  END IF;

  SELECT amount INTO v_reward FROM coin_rewards WHERE action = 'first_order' AND is_active = true;
  v_reward := COALESCE(v_reward, 3);

  RETURN add_coins(p_telegram_id, v_reward, 'first_order', 'Награда за первую покупку');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process purchase reward (1 coin per 5000 sum)
CREATE OR REPLACE FUNCTION process_purchase_reward(
  p_telegram_id bigint,
  p_order_amount numeric,
  p_order_id text
)
RETURNS jsonb AS $$
DECLARE
  v_per_unit integer;
  v_reward integer;
BEGIN
  SELECT amount INTO v_per_unit FROM coin_rewards WHERE action = 'purchase' AND is_active = true;
  v_per_unit := COALESCE(v_per_unit, 1);

  v_reward := GREATEST(1, FLOOR(p_order_amount / 5000)::int * v_per_unit);
  v_reward := LEAST(v_reward, 20);

  RETURN add_coins(p_telegram_id, v_reward, 'purchase', format('Покупка #%s', left(p_order_id, 8)), p_order_id, jsonb_build_object('order_amount', p_order_amount));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get economy stats (admin)
CREATE OR REPLACE FUNCTION get_economy_stats()
RETURNS jsonb AS $$
DECLARE
  v_treasury treasury;
  v_total_user_balance integer;
  v_user_count bigint;
  v_total_supply integer;
BEGIN
  SELECT * INTO v_treasury FROM treasury LIMIT 1;
  SELECT COALESCE(sum(balance), 0), count(*) INTO v_total_user_balance, v_user_count FROM wallets;

  v_total_supply := v_treasury.balance + v_treasury.reserved + v_total_user_balance;

  RETURN jsonb_build_object(
    'total_supply', (SELECT value::integer FROM coin_config WHERE key = 'total_supply'),
    'treasury_balance', v_treasury.balance,
    'reserved', v_treasury.reserved,
    'circulating', v_total_user_balance,
    'total_minted', v_treasury.total_minted,
    'total_returned', v_treasury.total_returned,
    'user_count', v_user_count,
    'actual_total', v_total_supply,
    'treasury_pct', CASE WHEN v_total_supply > 0 THEN round(v_treasury.balance::numeric / v_total_supply * 100, 1) ELSE 0 END,
    'circulating_pct', CASE WHEN v_total_supply > 0 THEN round(v_total_user_balance::numeric / v_total_supply * 100, 1) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: adjust user balance
CREATE OR REPLACE FUNCTION admin_adjust_balance(
  p_admin_id text,
  p_target_telegram_id bigint,
  p_amount integer,
  p_reason text
)
RETURNS jsonb AS $$
DECLARE
  v_wallet wallets;
  v_old_balance integer;
  v_new_balance integer;
BEGIN
  v_wallet := get_or_create_wallet(p_target_telegram_id);
  v_old_balance := v_wallet.balance;
  v_new_balance := v_old_balance + p_amount;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Balance cannot go negative';
  END IF;

  UPDATE wallets SET
    balance = v_new_balance,
    total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END,
    total_spent = CASE WHEN p_amount < 0 THEN total_spent + abs(p_amount) ELSE total_spent END,
    updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  INSERT INTO wallet_transactions (
    wallet_id, telegram_id, type, amount, balance_after,
    source, description, metadata
  ) VALUES (
    v_wallet.id, p_target_telegram_id, 'admin_adjust', abs(p_amount), v_new_balance,
    'admin', p_reason, jsonb_build_object('admin_id', p_admin_id, 'adjustment', p_amount)
  );

  INSERT INTO admin_coin_log (admin_id, action, target_user, amount, old_balance, new_balance, reason)
  VALUES (p_admin_id, 'adjust_balance', p_target_telegram_id, p_amount, v_old_balance, v_new_balance, p_reason);

  RETURN jsonb_build_object('wallet', row_to_json(v_wallet));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: freeze/unfreeze wallet
CREATE OR REPLACE FUNCTION admin_freeze_wallet(
  p_admin_id text,
  p_target_telegram_id bigint,
  p_freeze boolean,
  p_reason text
)
RETURNS jsonb AS $$
DECLARE
  v_wallet wallets;
BEGIN
  v_wallet := get_or_create_wallet(p_target_telegram_id);

  UPDATE wallets SET is_frozen = p_freeze, updated_at = now() WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  INSERT INTO admin_coin_log (admin_id, action, target_user, reason, metadata)
  VALUES (p_admin_id, CASE WHEN p_freeze THEN 'freeze' ELSE 'unfreeze' END, p_target_telegram_id, p_reason, jsonb_build_object('frozen', p_freeze));

  RETURN jsonb_build_object('wallet', row_to_json(v_wallet));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Purchase reward from store
CREATE OR REPLACE FUNCTION purchase_reward(
  p_telegram_id bigint,
  p_reward_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_reward reward_store;
  v_user_uses bigint;
BEGIN
  SELECT * INTO v_reward FROM reward_store WHERE id = p_reward_id AND is_active = true;
  IF v_reward IS NULL THEN
    RAISE EXCEPTION 'Reward not found or inactive';
  END IF;

  IF v_reward.stock = 0 THEN
    RAISE EXCEPTION 'Reward out of stock';
  END IF;

  SELECT count(*) INTO v_user_uses FROM wallet_transactions
  WHERE telegram_id = p_telegram_id AND source = 'reward_store' AND reference_id = p_reward_id::text;

  IF v_user_uses >= v_reward.max_per_user THEN
    RAISE EXCEPTION 'Purchase limit reached';
  END IF;

  -- spend coins (goes back to treasury)
  PERFORM spend_coins(p_telegram_id, v_reward.cost, 'reward_store', v_reward.name, p_reward_id::text);

  -- decrease stock if not unlimited
  IF v_reward.stock > 0 THEN
    UPDATE reward_store SET stock = stock - 1, usage_count = usage_count + 1, updated_at = now() WHERE id = p_reward_id;
  ELSE
    UPDATE reward_store SET usage_count = usage_count + 1, updated_at = now() WHERE id = p_reward_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'reward_name', v_reward.name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get wallet stats
CREATE OR REPLACE FUNCTION get_wallet_stats(p_telegram_id bigint)
RETURNS jsonb AS $$
DECLARE
  v_wallet wallets;
  v_tx_count bigint;
BEGIN
  SELECT * INTO v_wallet FROM wallets WHERE telegram_id = p_telegram_id;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('wallet', null, 'total_transactions', 0);
  END IF;

  SELECT count(*) INTO v_tx_count FROM wallet_transactions WHERE wallet_id = v_wallet.id;

  RETURN jsonb_build_object('wallet', row_to_json(v_wallet), 'total_transactions', v_tx_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
