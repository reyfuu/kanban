-- ============================================================================
-- SIGAP -- Modul A (Evidence Vault) migration -- stage 4: external portal
--
-- Adds the external-auditor access grant (FR-A-018) and a proposal marker on
-- request_item (FR-A-018 rule 3). Additive only.
--
-- Source of truth: docs/03-FRD.md FR-A-018, FR-X-004; docs/07-API-CONTRACT.md
-- Sec 4.7.
-- ============================================================================

CREATE TYPE external_access_status AS ENUM ('MENUNGGU_AKTIVASI', 'AKTIF', 'KEDALUWARSA', 'DICABUT');

CREATE TABLE external_access (
  id            uuid PRIMARY KEY,
  engagement_id uuid NOT NULL REFERENCES engagement (id),
  user_id       uuid NOT NULL REFERENCES app_user (id),
  email         varchar(320) NOT NULL,
  full_name     varchar(200) NOT NULL,
  organization  varchar(200),
  scope_note    text,
  access_until  date NOT NULL,
  status        external_access_status NOT NULL DEFAULT 'MENUNGGU_AKTIVASI',
  invited_by    uuid NOT NULL REFERENCES app_user (id),
  invited_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_external_access_engagement_user UNIQUE (engagement_id, user_id)
);

COMMENT ON TABLE external_access IS
  'Time-boxed external-auditor access to one engagement (FR-A-018). Bridges an engagement to an EXTERNAL app_user (FR-X-004). access_until is per-grant (rule 7), independent of app_user.expires_at, so the same auditor invited to two engagements can have different end dates. Access is live only while status = AKTIF and access_until has not passed; the portal read paths check both. Revocation and expiry both close access (rules 7). All portal activity is audited (rule 5).';

CREATE INDEX idx_external_access_user_id ON external_access (user_id);
CREATE INDEX idx_external_access_status ON external_access (status);

-- FR-A-018 rule 3: an external auditor may propose a request item; it starts
-- DRAF and needs AUDITOR_INT to publish. proposed_by_external_id names the
-- proposer (an EXTERNAL app_user), NULL for internally authored requests.
ALTER TABLE request_item
  ADD COLUMN proposed_by_external_id uuid REFERENCES app_user (id);

COMMENT ON COLUMN request_item.proposed_by_external_id IS
  'FR-A-018 rule 3: set when an external auditor proposed this request. A proposal is an ordinary DRAF request that only AUDITOR_INT can publish -- the external auditor cannot publish their own proposal.';

GRANT SELECT, INSERT, UPDATE, DELETE ON external_access TO sigap_app;
