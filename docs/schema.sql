--
-- PostgreSQL database dump
--




--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: ledger_entries_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ledger_entries_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only' USING ERRCODE = 'check_violation';
END;
$$;


--
-- Name: transactions_guard_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transactions_guard_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.status IN ('Successful', 'Failed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'transaction % is % and cannot become %', OLD.id, OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.funding_type IS DISTINCT FROM OLD.funding_type
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.reference IS DISTINCT FROM OLD.reference THEN
    RAISE EXCEPTION 'transaction % identity fields are immutable', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;




--
-- Name: account_deletion_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_deletion_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    state boolean DEFAULT true NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: api_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_cache (
    kind text NOT NULL,
    cache_key text NOT NULL,
    payload jsonb NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follows (
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follows_check CHECK ((follower_id <> following_id))
);


--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ledger_entries (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    transaction_id uuid,
    entry_type text NOT NULL,
    amount numeric(20,4) NOT NULL,
    balance_after numeric(20,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ledger_entries_amount_check CHECK ((amount <> (0)::numeric)),
    CONSTRAINT ledger_entries_balance_after_check CHECK ((balance_after >= (0)::numeric)),
    CONSTRAINT ledger_entries_entry_type_check CHECK ((entry_type = ANY (ARRAY['deposit_hold'::text, 'deposit_refund'::text, 'withdrawal_hold'::text, 'withdrawal_refund'::text, 'transfer_out'::text, 'transfer_in'::text, 'referral_bonus'::text, 'adjustment'::text])))
);


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ledger_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ledger_entries_id_seq OWNED BY public.ledger_entries.id;


--
-- Name: match_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_no smallint NOT NULL,
    team1 text NOT NULL,
    team1_flag text,
    team2 text NOT NULL,
    team2_flag text,
    league text NOT NULL,
    league_flag text,
    tip text NOT NULL,
    match_date date DEFAULT CURRENT_DATE NOT NULL,
    "time" text NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT match_predictions_list_no_check CHECK ((list_no = ANY (ARRAY[1, 2])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_user_id uuid NOT NULL,
    to_user_id uuid NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    post_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_events (
    id bigint NOT NULL,
    provider text NOT NULL,
    reference text NOT NULL,
    reported_status text,
    raw jsonb DEFAULT '{}'::jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_events_id_seq OWNED BY public.payment_events.id;


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id smallint NOT NULL,
    is_deposits_open boolean DEFAULT true NOT NULL,
    is_withdrawals_open boolean DEFAULT true NOT NULL,
    disbursed_bonus_balance numeric(20,4) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_settings_disbursed_bonus_balance_check CHECK ((disbursed_bonus_balance >= (0)::numeric)),
    CONSTRAINT platform_settings_id_check CHECK ((id = 1))
);


--
-- Name: post_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_likes (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: post_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    url text NOT NULL,
    type text NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    CONSTRAINT post_media_type_check CHECK ((type = ANY (ARRAY['image'::text, 'video'::text])))
);


--
-- Name: post_saves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_saves (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: post_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_views (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prediction_leagues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prediction_leagues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league text NOT NULL,
    image text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: prediction_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prediction_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team text NOT NULL,
    image text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: qr_code_deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_code_deposits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    fullname text,
    bet_id text NOT NULL,
    amount numeric(20,4) NOT NULL,
    service text,
    qrcode_status text DEFAULT 'Pending'::text NOT NULL,
    used boolean DEFAULT false NOT NULL,
    payment_confirmation text DEFAULT 'Pending'::text NOT NULL,
    valid_until timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qr_code_deposits_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT qr_code_deposits_payment_confirmation_check CHECK ((payment_confirmation = ANY (ARRAY['Pending'::text, 'Successful'::text, 'Failed'::text]))),
    CONSTRAINT qr_code_deposits_qrcode_status_check CHECK ((qrcode_status = ANY (ARRAY['Pending'::text, 'Expired'::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reference text NOT NULL,
    funding_type text NOT NULL,
    status text NOT NULL,
    payment_confirmation text,
    user_id uuid NOT NULL,
    counterparty_id uuid,
    amount numeric(20,4) DEFAULT 0 NOT NULL,
    total_amount numeric(20,4) DEFAULT 0 NOT NULL,
    wallet_amount numeric(20,4) DEFAULT 0 NOT NULL,
    bet_id text,
    momo_number text,
    momo_name text,
    network text,
    service text,
    withdrawal_code text,
    custom_error_code integer,
    authenticated_deposit boolean DEFAULT true NOT NULL,
    qr_code_id uuid,
    provider text,
    provider_transaction_id text,
    idempotency_key text,
    user_email text,
    sender_name text,
    recipient_name text,
    recipient_tag text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transactions_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT transactions_funding_type_check CHECK ((funding_type = ANY (ARRAY['deposits'::text, 'withdrawals'::text, 'send'::text, 'receive'::text, 'bonus'::text]))),
    CONSTRAINT transactions_payment_confirmation_check CHECK ((payment_confirmation = ANY (ARRAY['Pending'::text, 'Successful'::text, 'Failed'::text]))),
    CONSTRAINT transactions_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Successful'::text, 'Failed'::text]))),
    CONSTRAINT transactions_total_amount_check CHECK ((total_amount >= (0)::numeric)),
    CONSTRAINT transactions_wallet_amount_check CHECK ((wallet_amount >= (0)::numeric))
);


--
-- Name: user_bet_ids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_bet_ids (
    user_id uuid NOT NULL,
    bet_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fullname text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    pin_hash text,
    pin_state boolean DEFAULT false NOT NULL,
    bet_id text,
    phone_number text,
    tag text,
    role text DEFAULT 'user'::text NOT NULL,
    is_sub_admin_deposits boolean DEFAULT false NOT NULL,
    is_sub_admin_withdrawals boolean DEFAULT false NOT NULL,
    is_activated boolean DEFAULT true NOT NULL,
    is_logged_in boolean DEFAULT false NOT NULL,
    session_id uuid,
    delete_request_state boolean DEFAULT false NOT NULL,
    image text DEFAULT ''::text NOT NULL,
    image_file_name text DEFAULT ''::text NOT NULL,
    push_token text,
    expo_push_token text,
    color_scheme smallint DEFAULT 2 NOT NULL,
    fedapay_id bigint,
    referrer_id uuid,
    bonus_balance numeric(20,4) DEFAULT 0 NOT NULL,
    restricted_bonus_balance numeric(20,4) DEFAULT 0 NOT NULL,
    successful_deposit_count integer DEFAULT 0 NOT NULL,
    successful_withdrawal_count integer DEFAULT 0 NOT NULL,
    reset_code_hash text,
    reset_code_expires_at timestamp with time zone,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reset_code_attempts smallint DEFAULT 0 NOT NULL,
    CONSTRAINT users_bonus_balance_check CHECK ((bonus_balance >= (0)::numeric)),
    CONSTRAINT users_reset_code_attempts_check CHECK ((reset_code_attempts >= 0)),
    CONSTRAINT users_restricted_bonus_balance_check CHECK ((restricted_bonus_balance >= (0)::numeric)),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text, 'subadmin'::text]))),
    CONSTRAINT users_successful_deposit_count_check CHECK ((successful_deposit_count >= 0)),
    CONSTRAINT users_successful_withdrawal_count_check CHECK ((successful_withdrawal_count >= 0))
);


--
-- Name: ledger_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries ALTER COLUMN id SET DEFAULT nextval('public.ledger_entries_id_seq'::regclass);


--
-- Name: payment_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events ALTER COLUMN id SET DEFAULT nextval('public.payment_events_id_seq'::regclass);


--
-- Name: account_deletion_requests account_deletion_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id);


--
-- Name: api_cache api_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_cache
    ADD CONSTRAINT api_cache_pkey PRIMARY KEY (kind, cache_key);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: match_predictions match_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_predictions
    ADD CONSTRAINT match_predictions_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payment_events payment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: post_media post_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_media
    ADD CONSTRAINT post_media_pkey PRIMARY KEY (id);


--
-- Name: post_saves post_saves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_saves
    ADD CONSTRAINT post_saves_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: post_views post_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_views
    ADD CONSTRAINT post_views_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: prediction_leagues prediction_leagues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_leagues
    ADD CONSTRAINT prediction_leagues_pkey PRIMARY KEY (id);


--
-- Name: prediction_teams prediction_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prediction_teams
    ADD CONSTRAINT prediction_teams_pkey PRIMARY KEY (id);


--
-- Name: qr_code_deposits qr_code_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_code_deposits
    ADD CONSTRAINT qr_code_deposits_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_bet_ids user_bet_ids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_bet_ids
    ADD CONSTRAINT user_bet_ids_pkey PRIMARY KEY (user_id, bet_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: account_deletion_requests_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_deletion_requests_user_idx ON public.account_deletion_requests USING btree (user_id);


--
-- Name: comments_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_post_idx ON public.comments USING btree (post_id, created_at);


--
-- Name: comments_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_user_idx ON public.comments USING btree (user_id);


--
-- Name: follows_following_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX follows_following_idx ON public.follows USING btree (following_id);


--
-- Name: ledger_entries_tx_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ledger_entries_tx_idx ON public.ledger_entries USING btree (transaction_id);


--
-- Name: ledger_entries_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ledger_entries_user_idx ON public.ledger_entries USING btree (user_id, id DESC);


--
-- Name: match_predictions_list_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX match_predictions_list_idx ON public.match_predictions USING btree (list_no, match_date DESC);


--
-- Name: notifications_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_to_idx ON public.notifications USING btree (to_user_id, created_at DESC);


--
-- Name: payment_events_ref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_events_ref_idx ON public.payment_events USING btree (provider, reference);


--
-- Name: post_likes_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_likes_user_idx ON public.post_likes USING btree (user_id);


--
-- Name: post_media_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_media_post_idx ON public.post_media USING btree (post_id, "position");


--
-- Name: post_saves_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_saves_user_idx ON public.post_saves USING btree (user_id);


--
-- Name: posts_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_created_idx ON public.posts USING btree (created_at DESC);


--
-- Name: posts_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_user_idx ON public.posts USING btree (user_id, created_at DESC);


--
-- Name: qr_code_deposits_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_code_deposits_open_idx ON public.qr_code_deposits USING btree (created_at) WHERE ((used = false) AND (qrcode_status = 'Pending'::text));


--
-- Name: qr_code_deposits_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_code_deposits_user_created_idx ON public.qr_code_deposits USING btree (user_id, created_at DESC);


--
-- Name: transactions_dup_window_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_dup_window_idx ON public.transactions USING btree (bet_id, amount, registered_at) WHERE ((funding_type = 'deposits'::text) AND (status = 'Successful'::text));


--
-- Name: transactions_idempotency_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX transactions_idempotency_uq ON public.transactions USING btree (user_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: transactions_provider_ref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_provider_ref_idx ON public.transactions USING btree (provider, provider_transaction_id) WHERE (provider_transaction_id IS NOT NULL);


--
-- Name: transactions_reference_type_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX transactions_reference_type_uq ON public.transactions USING btree (reference, funding_type);


--
-- Name: transactions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_status_idx ON public.transactions USING btree (status) WHERE (status = 'Pending'::text);


--
-- Name: transactions_user_registered_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_user_registered_idx ON public.transactions USING btree (user_id, registered_at DESC);


--
-- Name: users_email_lower_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_lower_uq ON public.users USING btree (lower(email));


--
-- Name: users_referrer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_referrer_idx ON public.users USING btree (referrer_id) WHERE (referrer_id IS NOT NULL);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: users_session_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_session_uq ON public.users USING btree (session_id) WHERE (session_id IS NOT NULL);


--
-- Name: users_tag_lower_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_tag_lower_uq ON public.users USING btree (lower(tag)) WHERE (tag IS NOT NULL);


--
-- Name: ledger_entries ledger_entries_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ledger_entries_no_update BEFORE DELETE OR UPDATE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_append_only();


--
-- Name: transactions transactions_guard_status_trg; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER transactions_guard_status_trg BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.transactions_guard_status();


--
-- Name: account_deletion_requests account_deletion_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ledger_entries ledger_entries_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);


--
-- Name: ledger_entries ledger_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_from_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_to_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_to_user_id_fkey FOREIGN KEY (to_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: post_media post_media_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_media
    ADD CONSTRAINT post_media_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_saves post_saves_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_saves
    ADD CONSTRAINT post_saves_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_saves post_saves_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_saves
    ADD CONSTRAINT post_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: post_views post_views_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_views
    ADD CONSTRAINT post_views_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_views post_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_views
    ADD CONSTRAINT post_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: qr_code_deposits qr_code_deposits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_code_deposits
    ADD CONSTRAINT qr_code_deposits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_counterparty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_counterparty_id_fkey FOREIGN KEY (counterparty_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_qr_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_qr_code_id_fkey FOREIGN KEY (qr_code_id) REFERENCES public.qr_code_deposits(id);


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_bet_ids user_bet_ids_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_bet_ids
    ADD CONSTRAINT user_bet_ids_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


