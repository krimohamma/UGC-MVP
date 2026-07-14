-- =============================================================================
-- Migration 0006: Add the 'pending_admin_review' order status.
--
-- This migration deliberately contains ONLY the enum change. Postgres will not
-- let a newly-added enum value be *used* in the same transaction that added it
-- ("unsafe use of new value of enum type"), and the deliverables RLS policies
-- need to reference 'pending_admin_review' in their USING expressions. So the
-- value is committed here, and everything that consumes it lives in
-- 0007_fulfillment_objects.sql.
-- =============================================================================

alter type order_status add value if not exists 'pending_admin_review' before 'delivered';
