DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'aegis') THEN
        CREATE SCHEMA aegis;
    END IF;
END $EF$;
CREATE TABLE IF NOT EXISTS aegis."__EFMigrationsHistory" (
    migration_id character varying(150) NOT NULL,
    product_version character varying(32) NOT NULL,
    CONSTRAINT pk___ef_migrations_history PRIMARY KEY (migration_id)
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
        IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'aegis') THEN
            CREATE SCHEMA aegis;
        END IF;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.audit_chain_heads (
        id uuid NOT NULL,
        last_sequence_number bigint NOT NULL,
        last_hash text NOT NULL,
        last_updated_at_utc timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_audit_chain_heads PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.audit_log_entries (
        id uuid NOT NULL,
        sequence_number bigint NOT NULL,
        entity_name text NOT NULL,
        entity_id text NOT NULL,
        action text NOT NULL,
        actor_id text NOT NULL,
        actor_role text NOT NULL,
        details_json jsonb NOT NULL,
        previous_hash text NOT NULL,
        current_hash text NOT NULL,
        timestamp_utc timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_audit_log_entries PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.crises (
        id uuid NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        region text NOT NULL,
        severity text NOT NULL,
        status integer NOT NULL,
        declared_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_crises PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.idempotency_records (
        id uuid NOT NULL,
        key text NOT NULL,
        request_path text NOT NULL,
        status_code integer NOT NULL,
        response_body text NOT NULL,
        expires_at_utc timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_idempotency_records PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.notification_outboxes (
        id uuid NOT NULL,
        idempotency_key text NOT NULL,
        channel integer NOT NULL,
        recipient text NOT NULL,
        subject text NOT NULL,
        payload text NOT NULL,
        status integer NOT NULL,
        attempts integer NOT NULL,
        next_attempt_at timestamp with time zone,
        last_error text,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_notification_outboxes PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.organisations (
        id uuid NOT NULL,
        name text NOT NULL,
        code text NOT NULL,
        type text NOT NULL,
        contact_email text NOT NULL,
        contact_phone text NOT NULL,
        is_verified boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_organisations PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.resources (
        id uuid NOT NULL,
        item_name text NOT NULL,
        category text NOT NULL,
        quantity_total integer NOT NULL,
        quantity_available integer NOT NULL,
        unit text NOT NULL,
        depot text NOT NULL,
        latitude double precision NOT NULL,
        longitude double precision NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_resources PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.roles (
        id text NOT NULL,
        name character varying(256),
        normalized_name character varying(256),
        concurrency_stamp text,
        CONSTRAINT pk_roles PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.service_healths (
        id uuid NOT NULL,
        service_name text NOT NULL,
        status text NOT NULL,
        details text,
        last_checked_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_service_healths PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.shelters (
        id uuid NOT NULL,
        name text NOT NULL,
        district text NOT NULL,
        capacity integer NOT NULL,
        occupancy integer NOT NULL,
        facilities text NOT NULL,
        accessibility_tags text NOT NULL,
        latitude double precision NOT NULL,
        longitude double precision NOT NULL,
        contact_person text NOT NULL,
        contact_phone text NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_shelters PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.users (
        id text NOT NULL,
        full_name text NOT NULL,
        organisation_id uuid,
        preferred_language text NOT NULL,
        created_at timestamp with time zone NOT NULL,
        user_name character varying(256),
        normalized_user_name character varying(256),
        email character varying(256),
        normalized_email character varying(256),
        email_confirmed boolean NOT NULL,
        password_hash text,
        security_stamp text,
        concurrency_stamp text,
        phone_number text,
        phone_number_confirmed boolean NOT NULL,
        two_factor_enabled boolean NOT NULL,
        lockout_end timestamp with time zone,
        lockout_enabled boolean NOT NULL,
        access_failed_count integer NOT NULL,
        CONSTRAINT pk_users PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.volunteers (
        id uuid NOT NULL,
        user_id text NOT NULL,
        full_name text NOT NULL,
        phone_number text NOT NULL,
        skills text NOT NULL,
        availability text NOT NULL,
        latitude double precision NOT NULL,
        longitude double precision NOT NULL,
        is_active boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_volunteers PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.assistance_requests (
        id uuid NOT NULL,
        tracking_number text NOT NULL,
        citizen_id text,
        crisis_id uuid NOT NULL,
        category text NOT NULL,
        description text NOT NULL,
        language text NOT NULL,
        area text NOT NULL,
        latitude double precision NOT NULL,
        longitude double precision NOT NULL,
        status integer NOT NULL,
        priority integer NOT NULL,
        urgency_score integer NOT NULL,
        duplicate_of_id uuid,
        consent_given boolean NOT NULL,
        self_reported_urgency integer NOT NULL,
        people_count integer NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_assistance_requests PRIMARY KEY (id),
        CONSTRAINT fk_assistance_requests_assistance_requests_duplicate_of_id FOREIGN KEY (duplicate_of_id) REFERENCES aegis.assistance_requests (id) ON DELETE RESTRICT,
        CONSTRAINT fk_assistance_requests_crises_crisis_id FOREIGN KEY (crisis_id) REFERENCES aegis.crises (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.campaigns (
        id uuid NOT NULL,
        title text NOT NULL,
        description text NOT NULL,
        target_amount numeric NOT NULL,
        current_amount numeric NOT NULL,
        crisis_id uuid NOT NULL,
        is_active boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_campaigns PRIMARY KEY (id),
        CONSTRAINT fk_campaigns_crises_crisis_id FOREIGN KEY (crisis_id) REFERENCES aegis.crises (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.operational_areas (
        id uuid NOT NULL,
        crisis_id uuid NOT NULL,
        name text NOT NULL,
        district text NOT NULL,
        center_latitude double precision NOT NULL,
        center_longitude double precision NOT NULL,
        radius_kilometers double precision NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_operational_areas PRIMARY KEY (id),
        CONSTRAINT fk_operational_areas_crises_crisis_id FOREIGN KEY (crisis_id) REFERENCES aegis.crises (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.role_claims (
        id integer GENERATED BY DEFAULT AS IDENTITY,
        role_id text NOT NULL,
        claim_type text,
        claim_value text,
        CONSTRAINT pk_role_claims PRIMARY KEY (id),
        CONSTRAINT fk_role_claims_roles_role_id FOREIGN KEY (role_id) REFERENCES aegis.roles (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.user_claims (
        id integer GENERATED BY DEFAULT AS IDENTITY,
        user_id text NOT NULL,
        claim_type text,
        claim_value text,
        CONSTRAINT pk_user_claims PRIMARY KEY (id),
        CONSTRAINT fk_user_claims_users_user_id FOREIGN KEY (user_id) REFERENCES aegis.users (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.user_logins (
        login_provider text NOT NULL,
        provider_key text NOT NULL,
        provider_display_name text,
        user_id text NOT NULL,
        CONSTRAINT pk_user_logins PRIMARY KEY (login_provider, provider_key),
        CONSTRAINT fk_user_logins_users_user_id FOREIGN KEY (user_id) REFERENCES aegis.users (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.user_roles (
        user_id text NOT NULL,
        role_id text NOT NULL,
        CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id),
        CONSTRAINT fk_user_roles_roles_role_id FOREIGN KEY (role_id) REFERENCES aegis.roles (id) ON DELETE CASCADE,
        CONSTRAINT fk_user_roles_users_user_id FOREIGN KEY (user_id) REFERENCES aegis.users (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.user_tokens (
        user_id text NOT NULL,
        login_provider text NOT NULL,
        name text NOT NULL,
        value text,
        CONSTRAINT pk_user_tokens PRIMARY KEY (user_id, login_provider, name),
        CONSTRAINT fk_user_tokens_users_user_id FOREIGN KEY (user_id) REFERENCES aegis.users (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.ai_recommendations (
        id uuid NOT NULL,
        request_id uuid NOT NULL,
        model_name text NOT NULL,
        model_version text NOT NULL,
        priority integer NOT NULL,
        confidence double precision NOT NULL,
        rationale_json jsonb NOT NULL,
        feature_scores_json jsonb NOT NULL,
        status integer NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_ai_recommendations PRIMARY KEY (id),
        CONSTRAINT fk_ai_recommendations_assistance_requests_request_id FOREIGN KEY (request_id) REFERENCES aegis.assistance_requests (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.request_evidences (
        id uuid NOT NULL,
        request_id uuid NOT NULL,
        file_name text NOT NULL,
        stored_file_name text NOT NULL,
        content_type text NOT NULL,
        file_size_bytes bigint NOT NULL,
        sha256hash text NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_request_evidences PRIMARY KEY (id),
        CONSTRAINT fk_request_evidences_assistance_requests_request_id FOREIGN KEY (request_id) REFERENCES aegis.assistance_requests (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.request_histories (
        id uuid NOT NULL,
        request_id uuid NOT NULL,
        from_status text NOT NULL,
        to_status text NOT NULL,
        changed_by_id text NOT NULL,
        notes text NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_request_histories PRIMARY KEY (id),
        CONSTRAINT fk_request_histories_assistance_requests_request_id FOREIGN KEY (request_id) REFERENCES aegis.assistance_requests (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.resource_allocations (
        id uuid NOT NULL,
        resource_id uuid NOT NULL,
        request_id uuid NOT NULL,
        quantity_dispatched integer NOT NULL,
        dispatched_by_id text NOT NULL,
        status text NOT NULL,
        dispatched_at timestamp with time zone NOT NULL,
        estimated_eta text NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_resource_allocations PRIMARY KEY (id),
        CONSTRAINT fk_resource_allocations_assistance_requests_request_id FOREIGN KEY (request_id) REFERENCES aegis.assistance_requests (id) ON DELETE CASCADE,
        CONSTRAINT fk_resource_allocations_resources_resource_id FOREIGN KEY (resource_id) REFERENCES aegis.resources (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.shelter_allocations (
        id uuid NOT NULL,
        shelter_id uuid NOT NULL,
        request_id uuid NOT NULL,
        persons_allocated integer NOT NULL,
        allocated_by_id text NOT NULL,
        allocated_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_shelter_allocations PRIMARY KEY (id),
        CONSTRAINT fk_shelter_allocations_assistance_requests_request_id FOREIGN KEY (request_id) REFERENCES aegis.assistance_requests (id) ON DELETE CASCADE,
        CONSTRAINT fk_shelter_allocations_shelters_shelter_id FOREIGN KEY (shelter_id) REFERENCES aegis.shelters (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.volunteer_assignments (
        id uuid NOT NULL,
        volunteer_id uuid NOT NULL,
        request_id uuid NOT NULL,
        assigned_by_id text NOT NULL,
        status text NOT NULL,
        assigned_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_volunteer_assignments PRIMARY KEY (id),
        CONSTRAINT fk_volunteer_assignments_assistance_requests_request_id FOREIGN KEY (request_id) REFERENCES aegis.assistance_requests (id) ON DELETE CASCADE,
        CONSTRAINT fk_volunteer_assignments_volunteers_volunteer_id FOREIGN KEY (volunteer_id) REFERENCES aegis.volunteers (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.donations (
        id uuid NOT NULL,
        campaign_id uuid NOT NULL,
        donor_name text NOT NULL,
        donor_email text NOT NULL,
        amount numeric NOT NULL,
        currency text NOT NULL,
        flagged boolean NOT NULL,
        flag_reason text,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_donations PRIMARY KEY (id),
        CONSTRAINT fk_donations_campaigns_campaign_id FOREIGN KEY (campaign_id) REFERENCES aegis.campaigns (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE TABLE aegis.decisions (
        id uuid NOT NULL,
        recommendation_id uuid NOT NULL,
        action integer NOT NULL,
        decided_by_id text NOT NULL,
        justification text NOT NULL,
        second_approver_id text,
        decided_at timestamp with time zone NOT NULL,
        is_critical_action boolean NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_decisions PRIMARY KEY (id),
        CONSTRAINT fk_decisions_ai_recommendations_recommendation_id FOREIGN KEY (recommendation_id) REFERENCES aegis.ai_recommendations (id) ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_ai_recommendations_request_id ON aegis.ai_recommendations (request_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_assistance_requests_crisis_id ON aegis.assistance_requests (crisis_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_assistance_requests_duplicate_of_id ON aegis.assistance_requests (duplicate_of_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_assistance_requests_tracking_number ON aegis.assistance_requests (tracking_number);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_audit_log_entries_sequence_number ON aegis.audit_log_entries (sequence_number);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_campaigns_crisis_id ON aegis.campaigns (crisis_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_decisions_recommendation_id ON aegis.decisions (recommendation_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_donations_campaign_id ON aegis.donations (campaign_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_idempotency_records_key ON aegis.idempotency_records (key);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_notification_outboxes_idempotency_key ON aegis.notification_outboxes (idempotency_key);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_operational_areas_crisis_id ON aegis.operational_areas (crisis_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_request_evidences_request_id ON aegis.request_evidences (request_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_request_histories_request_id ON aegis.request_histories (request_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_resource_allocations_request_id ON aegis.resource_allocations (request_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_resource_allocations_resource_id ON aegis.resource_allocations (resource_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_role_claims_role_id ON aegis.role_claims (role_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE UNIQUE INDEX "RoleNameIndex" ON aegis.roles (normalized_name);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_shelter_allocations_request_id ON aegis.shelter_allocations (request_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_shelter_allocations_shelter_id ON aegis.shelter_allocations (shelter_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_user_claims_user_id ON aegis.user_claims (user_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_user_logins_user_id ON aegis.user_logins (user_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_user_roles_role_id ON aegis.user_roles (role_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX "EmailIndex" ON aegis.users (normalized_email);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE UNIQUE INDEX "UserNameIndex" ON aegis.users (normalized_user_name);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_volunteer_assignments_request_id ON aegis.volunteer_assignments (request_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    CREATE INDEX ix_volunteer_assignments_volunteer_id ON aegis.volunteer_assignments (volunteer_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084559_InitialCreate') THEN
    INSERT INTO aegis."__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20261116084559_InitialCreate', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084828_HardeningAndTriggers') THEN

                    ALTER TABLE aegis.shelters 
                    ADD CONSTRAINT ck_shelters_occupancy_le_capacity 
                    CHECK (occupancy <= capacity);
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084828_HardeningAndTriggers') THEN

                    ALTER TABLE aegis.resources 
                    ADD CONSTRAINT ck_resources_qty_available_nonneg 
                    CHECK (quantity_available >= 0);
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084828_HardeningAndTriggers') THEN

                    ALTER TABLE aegis.decisions 
                    ADD CONSTRAINT ck_decisions_second_approver_diff 
                    CHECK (second_approver_id IS NULL OR second_approver_id <> decided_by_id);
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084828_HardeningAndTriggers') THEN

                    CREATE OR REPLACE FUNCTION aegis.fn_prevent_audit_tampering()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        RAISE EXCEPTION 'AuditLogEntry is strictly append-only and cannot be updated or deleted.';
                    END;
                    $$ LANGUAGE plpgsql;

                    DROP TRIGGER IF EXISTS trg_audit_no_update ON aegis.audit_log_entries;
                    CREATE TRIGGER trg_audit_no_update
                    BEFORE UPDATE ON aegis.audit_log_entries
                    FOR EACH ROW EXECUTE FUNCTION aegis.fn_prevent_audit_tampering();

                    DROP TRIGGER IF EXISTS trg_audit_no_delete ON aegis.audit_log_entries;
                    CREATE TRIGGER trg_audit_no_delete
                    BEFORE DELETE ON aegis.audit_log_entries
                    FOR EACH ROW EXECUTE FUNCTION aegis.fn_prevent_audit_tampering();
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084828_HardeningAndTriggers') THEN

                    DO $$
                    DECLARE
                        t text;
                    BEGIN
                        FOR t IN 
                            SELECT table_name 
                            FROM information_schema.tables 
                            WHERE table_schema = 'aegis' AND table_type = 'BASE TABLE'
                        LOOP
                            EXECUTE format('ALTER TABLE aegis.%I ENABLE ROW LEVEL SECURITY;', t);
                        END LOOP;
                    END $$;

                    REVOKE ALL ON SCHEMA aegis FROM anon, authenticated;
                    REVOKE ALL ON ALL TABLES IN SCHEMA aegis FROM anon, authenticated;
                    REVOKE ALL ON ALL SEQUENCES IN SCHEMA aegis FROM anon, authenticated;
                    REVOKE ALL ON ALL ROUTINES IN SCHEMA aegis FROM anon, authenticated;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116084828_HardeningAndTriggers') THEN
    INSERT INTO aegis."__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20261116084828_HardeningAndTriggers', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116094443_AddRefreshTokens') THEN
    CREATE TABLE aegis.refresh_tokens (
        id uuid NOT NULL,
        user_id text NOT NULL,
        token_hash text NOT NULL,
        expires_at_utc timestamp with time zone NOT NULL,
        is_revoked boolean NOT NULL,
        replaced_by_token_hash text,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_refresh_tokens PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116094443_AddRefreshTokens') THEN
    CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON aegis.refresh_tokens (token_hash);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116094443_AddRefreshTokens') THEN

                    ALTER TABLE aegis.refresh_tokens ENABLE ROW LEVEL SECURITY;
                    REVOKE ALL ON aegis.refresh_tokens FROM anon, authenticated;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116094443_AddRefreshTokens') THEN
    INSERT INTO aegis."__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20261116094443_AddRefreshTokens', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116095349_AuditDetailsAsText') THEN
    ALTER TABLE aegis.audit_log_entries ALTER COLUMN details_json TYPE text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116095349_AuditDetailsAsText') THEN

                    DO $$
                    DECLARE n bigint;
                    BEGIN
                        SELECT count(*) INTO n FROM aegis.audit_log_entries;
                        IF n > 50 THEN
                            RAISE EXCEPTION 'Refusing to reset audit log: % entries present (expected only dev smoke-test data).', n;
                        END IF;

                        ALTER TABLE aegis.audit_log_entries DISABLE TRIGGER trg_audit_no_delete;
                        DELETE FROM aegis.audit_log_entries;
                        ALTER TABLE aegis.audit_log_entries ENABLE TRIGGER trg_audit_no_delete;

                        DELETE FROM aegis.audit_chain_heads;
                    END $$;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116095349_AuditDetailsAsText') THEN

                    DROP TRIGGER IF EXISTS trg_audit_no_truncate ON aegis.audit_log_entries;
                    CREATE TRIGGER trg_audit_no_truncate
                    BEFORE TRUNCATE ON aegis.audit_log_entries
                    FOR EACH STATEMENT EXECUTE FUNCTION aegis.fn_prevent_audit_tampering();
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116095349_AuditDetailsAsText') THEN
    INSERT INTO aegis."__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20261116095349_AuditDetailsAsText', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN
    CREATE TABLE aegis.districts (
        id uuid NOT NULL,
        province_code text NOT NULL,
        name text NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_districts PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN
    CREATE TABLE aegis.provinces (
        id uuid NOT NULL,
        code text NOT NULL,
        name text NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_provinces PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN
    CREATE TABLE aegis.request_categories (
        id uuid NOT NULL,
        code text NOT NULL,
        name text NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_request_categories PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN
    CREATE UNIQUE INDEX ix_districts_name ON aegis.districts (name);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN
    CREATE UNIQUE INDEX ix_provinces_code ON aegis.provinces (code);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN
    CREATE UNIQUE INDEX ix_request_categories_code ON aegis.request_categories (code);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN

                    ALTER TABLE aegis.provinces ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE aegis.districts ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE aegis.request_categories ENABLE ROW LEVEL SECURITY;
                    REVOKE ALL ON aegis.provinces, aegis.districts, aegis.request_categories FROM anon, authenticated;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN

                    ALTER TABLE aegis.audit_log_entries DISABLE TRIGGER trg_audit_no_delete;
                    ALTER TABLE aegis.audit_log_entries DISABLE TRIGGER trg_audit_no_truncate;
                    DELETE FROM aegis.audit_log_entries;
                    DELETE FROM aegis.audit_chain_heads;
                    ALTER TABLE aegis.audit_log_entries ENABLE TRIGGER trg_audit_no_delete;
                    ALTER TABLE aegis.audit_log_entries ENABLE TRIGGER trg_audit_no_truncate;

                    TRUNCATE TABLE
                        aegis.decisions,
                        aegis.ai_recommendations,
                        aegis.request_histories,
                        aegis.request_evidences,
                        aegis.shelter_allocations,
                        aegis.resource_allocations,
                        aegis.volunteer_assignments,
                        aegis.assistance_requests,
                        aegis.shelters,
                        aegis.resources,
                        aegis.volunteers,
                        aegis.donations,
                        aegis.campaigns,
                        aegis.operational_areas,
                        aegis.crises,
                        aegis.organisations,
                        aegis.notification_outboxes,
                        aegis.idempotency_records,
                        aegis.refresh_tokens,
                        aegis.user_roles,
                        aegis.user_claims,
                        aegis.user_logins,
                        aegis.user_tokens,
                        aegis.users
                    RESTART IDENTITY CASCADE;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN

                    INSERT INTO aegis.roles (id, name, normalized_name, concurrency_stamp) VALUES
                        ('role-citizen', 'Citizen', 'CITIZEN', 'c1'),
                        ('role-emergency-coordinator', 'EmergencyCoordinator', 'EMERGENCYCOORDINATOR', 'c2'),
                        ('role-case-manager', 'CaseManager', 'CASEMANAGER', 'c3'),
                        ('role-logistics-manager', 'LogisticsManager', 'LOGISTICSMANAGER', 'c4'),
                        ('role-shelter-admin', 'ShelterAdmin', 'SHELTERADMIN', 'c5'),
                        ('role-volunteer-coordinator', 'VolunteerCoordinator', 'VOLUNTEERCOORDINATOR', 'c6'),
                        ('role-donor-officer', 'DonorOfficer', 'DONOROFFICER', 'c7'),
                        ('role-partner-officer', 'PartnerOfficer', 'PARTNEROFFICER', 'c8'),
                        ('role-system-admin', 'SystemAdmin', 'SYSTEMADMIN', 'c9')
                    ON CONFLICT DO NOTHING;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN

                    INSERT INTO aegis.request_categories (id, code, name, created_at, is_deleted) VALUES
                        ('10000000-0000-0000-0000-000000000001', 'MEDICAL', 'Medical', NOW(), false),
                        ('10000000-0000-0000-0000-000000000002', 'WATER', 'Water', NOW(), false),
                        ('10000000-0000-0000-0000-000000000003', 'FOOD', 'Food', NOW(), false),
                        ('10000000-0000-0000-0000-000000000004', 'SHELTER', 'Shelter', NOW(), false),
                        ('10000000-0000-0000-0000-000000000005', 'TRANSPORT', 'Transport', NOW(), false),
                        ('10000000-0000-0000-0000-000000000006', 'SANITATION', 'Sanitation', NOW(), false),
                        ('10000000-0000-0000-0000-000000000007', 'PROTECTION', 'Protection', NOW(), false),
                        ('10000000-0000-0000-0000-000000000008', 'SEARCH_RESCUE', 'Search and Rescue', NOW(), false)
                    ON CONFLICT (code) DO NOTHING;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN

                    INSERT INTO aegis.provinces (id, code, name, created_at, is_deleted) VALUES
                        ('20000000-0000-0000-0000-000000000001', 'WP', 'Western Province', NOW(), false),
                        ('20000000-0000-0000-0000-000000000002', 'CP', 'Central Province', NOW(), false),
                        ('20000000-0000-0000-0000-000000000003', 'SP', 'Southern Province', NOW(), false),
                        ('20000000-0000-0000-0000-000000000004', 'NP', 'Northern Province', NOW(), false),
                        ('20000000-0000-0000-0000-000000000005', 'EP', 'Eastern Province', NOW(), false),
                        ('20000000-0000-0000-0000-000000000006', 'NWP', 'North Western Province', NOW(), false),
                        ('20000000-0000-0000-0000-000000000007', 'NCP', 'North Central Province', NOW(), false),
                        ('20000000-0000-0000-0000-000000000008', 'UP', 'Uva Province', NOW(), false),
                        ('20000000-0000-0000-0000-000000000009', 'SGP', 'Sabaragamuwa Province', NOW(), false)
                    ON CONFLICT (code) DO NOTHING;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN

                    INSERT INTO aegis.districts (id, province_code, name, created_at, is_deleted) VALUES
                        ('30000000-0000-0000-0000-000000000001', 'WP', 'Colombo', NOW(), false),
                        ('30000000-0000-0000-0000-000000000002', 'WP', 'Gampaha', NOW(), false),
                        ('30000000-0000-0000-0000-000000000003', 'WP', 'Kalutara', NOW(), false),
                        ('30000000-0000-0000-0000-000000000004', 'CP', 'Kandy', NOW(), false),
                        ('30000000-0000-0000-0000-000000000005', 'CP', 'Matale', NOW(), false),
                        ('30000000-0000-0000-0000-000000000006', 'CP', 'Nuwara Eliya', NOW(), false),
                        ('30000000-0000-0000-0000-000000000007', 'SP', 'Galle', NOW(), false),
                        ('30000000-0000-0000-0000-000000000008', 'SP', 'Matara', NOW(), false),
                        ('30000000-0000-0000-0000-000000000009', 'SP', 'Hambantota', NOW(), false),
                        ('30000000-0000-0000-0000-000000000010', 'NP', 'Jaffna', NOW(), false),
                        ('30000000-0000-0000-0000-000000000011', 'NP', 'Kilinochchi', NOW(), false),
                        ('30000000-0000-0000-0000-000000000012', 'NP', 'Mannar', NOW(), false),
                        ('30000000-0000-0000-0000-000000000013', 'NP', 'Vavuniya', NOW(), false),
                        ('30000000-0000-0000-0000-000000000014', 'NP', 'Mullaitivu', NOW(), false),
                        ('30000000-0000-0000-0000-000000000015', 'EP', 'Batticaloa', NOW(), false),
                        ('30000000-0000-0000-0000-000000000016', 'EP', 'Ampara', NOW(), false),
                        ('30000000-0000-0000-0000-000000000017', 'EP', 'Trincomalee', NOW(), false),
                        ('30000000-0000-0000-0000-000000000018', 'NWP', 'Kurunegala', NOW(), false),
                        ('30000000-0000-0000-0000-000000000019', 'NWP', 'Puttalam', NOW(), false),
                        ('30000000-0000-0000-0000-000000000020', 'NCP', 'Anuradhapura', NOW(), false),
                        ('30000000-0000-0000-0000-000000000021', 'NCP', 'Polonnaruwa', NOW(), false),
                        ('30000000-0000-0000-0000-000000000022', 'UP', 'Badulla', NOW(), false),
                        ('30000000-0000-0000-0000-000000000023', 'UP', 'Moneragala', NOW(), false),
                        ('30000000-0000-0000-0000-000000000024', 'SGP', 'Ratnapura', NOW(), false),
                        ('30000000-0000-0000-0000-000000000025', 'SGP', 'Kegalle', NOW(), false)
                    ON CONFLICT (name) DO NOTHING;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116113307_ReferenceDataOnly') THEN
    INSERT INTO aegis."__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20261116113307_ReferenceDataOnly', '10.0.4');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    ALTER TABLE aegis.users ADD consent_given_at_utc timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    ALTER TABLE aegis.users ADD is_enabled boolean NOT NULL DEFAULT TRUE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    ALTER TABLE aegis.users ADD masked_nic text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    ALTER TABLE aegis.users ADD nic_ciphertext text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    ALTER TABLE aegis.users ADD nic_hmac text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    ALTER TABLE aegis.users ADD personal_data_consent boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    CREATE TABLE aegis.email_otp_challenges (
        id uuid NOT NULL,
        email text NOT NULL,
        purpose text NOT NULL,
        code_hash text NOT NULL,
        expires_at_utc timestamp with time zone NOT NULL,
        attempts integer NOT NULL,
        max_attempts integer NOT NULL,
        resend_available_at_utc timestamp with time zone NOT NULL,
        consumed_at_utc timestamp with time zone,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_email_otp_challenges PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    CREATE TABLE aegis.staff_invitations (
        id uuid NOT NULL,
        email text NOT NULL,
        full_name text NOT NULL,
        role text NOT NULL,
        preferred_language text NOT NULL,
        token_hash text NOT NULL,
        expires_at_utc timestamp with time zone NOT NULL,
        accepted_at_utc timestamp with time zone,
        invited_by_id text NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone,
        is_deleted boolean NOT NULL,
        CONSTRAINT pk_staff_invitations PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    CREATE UNIQUE INDEX ix_users_nic_hmac ON aegis.users (nic_hmac);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    CREATE INDEX ix_email_otp_challenges_email_purpose ON aegis.email_otp_challenges (email, purpose);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    CREATE UNIQUE INDEX ix_staff_invitations_token_hash ON aegis.staff_invitations (token_hash);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN

                    ALTER TABLE aegis.email_otp_challenges ENABLE ROW LEVEL SECURITY;
                    ALTER TABLE aegis.staff_invitations ENABLE ROW LEVEL SECURITY;
                    REVOKE ALL ON aegis.email_otp_challenges, aegis.staff_invitations FROM anon, authenticated;
                
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM aegis."__EFMigrationsHistory" WHERE "migration_id" = '20261116121814_AuthNicAndOtp') THEN
    INSERT INTO aegis."__EFMigrationsHistory" (migration_id, product_version)
    VALUES ('20261116121814_AuthNicAndOtp', '10.0.4');
    END IF;
END $EF$;
COMMIT;

