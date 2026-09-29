import os
import sys
import asyncio

# Ensure vanna package is importable from workspace root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from vanna.capabilities.agent_memory import ToolMemory
from vanna.core.tool import ToolContext
from vanna.core.user.models import User

# Training examples compiled from Enterprise Portal reporting controllers and services:
# 1. libs/plugins/rbac/src/controllers/admin-dashboard.controller.ts
# 2. libs/plugins/rbac/src/controllers/admin-reports.controller.ts
# 3. apps/api/src/modules/officer/desk-handling-report.service.ts
# 4. apps/api/src/modules/officer/officer-reports.service.ts

training_examples = [
    # =========================================================================
    # 1. ADMIN DASHBOARD CONTROLLER (libs/plugins/rbac/src/controllers/admin-dashboard.controller.ts)
    # =========================================================================
    ToolMemory(
        question="What is the total number of registered users in the system?",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT COUNT(*)::int AS cnt
            FROM sdk_rbac_users
            WHERE deleted_at IS NULL;
            """
        }
    ),
    ToolMemory(
        question="What is the total count of active system roles?",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT COUNT(*)::int AS cnt
            FROM sdk_rbac_roles
            WHERE 1=1;
            """
        }
    ),
    ToolMemory(
        question="What is the total count of form templates in the system?",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT COUNT(*)::int AS cnt
            FROM sdk_fb_forms
            WHERE 1=1;
            """
        }
    ),
    ToolMemory(
        question="What are the total application counts grouped by application status?",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT status, COUNT(*)::int AS cnt
            FROM rts_citizen_applications
            WHERE 1=1 AND status NOT IN ('deleted', 'started', 'draft', 'in_progress')
            GROUP BY status;
            """
        }
    ),
    ToolMemory(
        question="Show me the monthly application submission trend for the last 12 months",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT
              TO_CHAR(created_at, 'Mon') AS month,
              COUNT(*)::int AS cnt
            FROM rts_citizen_applications
            WHERE created_at >= NOW() - INTERVAL '12 months'
              AND status NOT IN ('deleted', 'started', 'draft', 'in_progress')
            GROUP BY TO_CHAR(created_at, 'Mon'), DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) ASC;
            """
        }
    ),

    # =========================================================================
    # 2. ADMIN REPORTS CONTROLLER (libs/plugins/rbac/src/controllers/admin-reports.controller.ts)
    # =========================================================================
    ToolMemory(
        question="What is the total count of submitted citizen applications for a given tenant?",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT COUNT(*)::int AS cnt
            FROM rts_citizen_applications
            WHERE deleted_at IS NULL
              AND status NOT IN ('deleted', 'started', 'draft', 'in_progress')
              AND tenant_id = :tenant_id;
            """
        }
    ),
    ToolMemory(
        question="What is the application status breakdown for a specific tenant?",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT status, COUNT(*)::int AS cnt
            FROM rts_citizen_applications
            WHERE deleted_at IS NULL
              AND status NOT IN ('deleted', 'started', 'draft', 'in_progress')
              AND tenant_id = :tenant_id
            GROUP BY status;
            """
        }
    ),
    ToolMemory(
        question="Show user count breakdown by user type (citizen vs officer) for a tenant",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT LOWER(TRIM(user_type)) AS ut, COUNT(*)::int AS cnt
            FROM sdk_rbac_users
            WHERE deleted_at IS NULL
              AND tenant_id = :tenant_id
            GROUP BY LOWER(TRIM(user_type));
            """
        }
    ),
    ToolMemory(
        question="What is the count of active villages for a given tenant?",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT COUNT(*)::int AS cnt
            FROM sdk_core_villages w
            WHERE w.deleted_at IS NULL
              AND w.is_active = true
              AND (w.tenant_id = :tenant_id OR w.tenant_id IS NULL);
            """
        }
    ),
    ToolMemory(
        question="What are the top 12 villages by application volume for a tenant?",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT
              w.village_name AS "villageName",
              w.village_code AS "villageCode",
              COUNT(a.id)::int AS cnt
            FROM rts_citizen_applications a
            INNER JOIN sdk_core_villages w ON w.id = a.village_id AND w.deleted_at IS NULL
            WHERE a.deleted_at IS NULL
              AND a.status NOT IN ('deleted', 'started', 'draft', 'in_progress')
              AND a.tenant_id = :tenant_id
              AND a.village_id IS NOT NULL
            GROUP BY w.id, w.village_name, w.village_code
            ORDER BY cnt DESC
            LIMIT 12;
            """
        }
    ),

    # =========================================================================
    # 3. DESK HANDLING REPORT SERVICE (apps/api/src/modules/officer/desk-handling-report.service.ts)
    # =========================================================================
    ToolMemory(
        question="What is the total count of applications matching department, service, date range, and search parameters for desk handling reports?",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT COUNT(*)::int AS total
            FROM rts_citizen_applications a
            JOIN sdk_svc_services svc ON svc.id = a.service_id AND svc.deleted_at IS NULL
            JOIN sdk_svc_departments d ON d.id = svc.department_id AND d.deleted_at IS NULL
            WHERE a.status NOT IN ('draft','started','in_progress','deleted')
              AND (:department_ids::uuid[] IS NULL OR d.id = ANY(:department_ids::uuid[]))
              AND (:service_id::uuid IS NULL OR a.service_id = :service_id::uuid)
              AND (:from_date::date IS NULL OR CAST(a.submitted_at AS date) >= :from_date::date)
              AND (:to_date::date IS NULL OR CAST(a.submitted_at AS date) <= :to_date::date)
              AND (
                :search_text::text IS NULL
                OR a.application_number ILIKE '%' || :search_text || '%'
                OR svc.name ILIKE '%' || :search_text || '%'
              );
            """
        }
    ),
    ToolMemory(
        question="Show application desk-by-desk SLA turnaround times and working days spent across all department desks",
        tool_name="run_sql",
        args={
            "sql": """
            WITH cal AS (
              SELECT d::date AS day,
                     SUM(CASE WHEN EXTRACT(ISODOW FROM d) < 6 AND h.date IS NULL THEN 1 ELSE 0 END)
                         OVER (ORDER BY d) AS wd_index
              FROM generate_series('2024-01-01'::date, CURRENT_DATE + 1, interval '1 day') d
              LEFT JOIN sdk_svc_holidays h ON h.date = d::date
            ),
            apps AS (
              SELECT a.id AS application_id,
                     a.application_number,
                     a.workflow_instance_id,
                     d.name AS department_name,
                     d.code AS department_code,
                     svc.name AS service_label,
                     a.status AS app_status,
                     a.submitted_at,
                     CASE WHEN a.status IN ('completed','approved','rejected','cancelled')
                          THEN COALESCE(a.completed_at, a.rejected_at) END AS app_closed_at,
                     CASE WHEN wi.status = 'PAUSED' THEN wi.paused_at END AS paused_at
              FROM rts_citizen_applications a
              JOIN sdk_svc_services svc ON svc.id = a.service_id AND svc.deleted_at IS NULL
              JOIN sdk_svc_departments d ON d.id = svc.department_id AND d.deleted_at IS NULL
              LEFT JOIN sdk_aw_workflow_instances wi ON wi.id = a.workflow_instance_id
              WHERE a.status NOT IN ('draft','started','in_progress','deleted')
            ),
            txn_raw AS (
              SELECT ap.application_id, ap.paused_at, ap.submitted_at, t.created_at, t.action,
                     COALESCE(t.completed_at, ap.app_closed_at, ap.paused_at) AS ended_at,
                     (t.completed_at IS NULL AND ap.app_closed_at IS NULL) AS still_open,
                     st.name AS stage_name, st.stage_order,
                     COALESCE(st.metadata->>'stageType', '') AS stage_type,
                     REGEXP_REPLACE(
                       UPPER(BTRIM(COALESCE(
                         NULLIF(st.assignee_config->>'roleCode', ''),
                         NULLIF(st.assignee_config->>'roleName', ''),
                         CASE WHEN UPPER(BTRIM(COALESCE(t.assignee_type, ''))) = 'ROLE' THEN NULLIF(BTRIM(t.assignee_id), '') END,
                         NULLIF(t.assignee_name, ''), ''))),
                       '[_ ]', '', 'g') AS role_norm,
                     t.id AS task_id
              FROM apps ap
              JOIN sdk_aw_workflow_tasks t ON t.instance_id = ap.workflow_instance_id AND t.deleted_at IS NULL AND t.status <> 'SKIPPED'
              LEFT JOIN sdk_aw_workflow_stages st ON st.id = t.stage_id
            ),
            txn AS (
              SELECT r.application_id, r.paused_at, r.created_at, r.ended_at, r.still_open, r.stage_name, r.stage_order,
                     CASE
                       WHEN r.action = 'PAYMENT' OR r.stage_type = 'PAYMENT' THEN 'payment'
                       WHEN r.role_norm = 'FO' THEN 'fo'
                       WHEN r.role_norm IN ('CFO', 'CFO1') THEN 'cfo'
                       WHEN r.role_norm LIKE 'ACCOUNT%' OR r.role_norm IN ('ACCOUNTS', 'ACCOUNT', 'ACCOUNTANT') THEN 'accounts'
                       WHEN r.role_norm IN ('ASSISTANTTOWNPLANNER', 'ATP') THEN 'atp'
                       WHEN r.role_norm IN ('ADTP', 'DDTP') THEN 'adtp'
                       WHEN r.role_norm IN ('DTP', 'TP') THEN 'tp'
                       WHEN r.role_norm IN ('AC', 'AMC') THEN 'amc'
                       WHEN r.role_norm = 'DESK1' THEN 'desk1'
                       WHEN r.role_norm = 'DESK2' THEN 'desk2'
                       WHEN r.role_norm = 'DESK3' THEN 'desk3'
                       WHEN r.role_norm IN ('SI', 'JE') THEN 'si'
                       WHEN r.role_norm = 'TAHSILDAR' THEN 'tahsildar'
                       WHEN r.role_norm IN ('JC', 'JOINTCOMMISSIONER') THEN 'jc'
                       WHEN r.role_norm IN ('DEPT', 'DEPT3') THEN 'dept'
                       ELSE 'other'
                     END AS desk,
                     GREATEST(COALESCE(LAG(r.ended_at) OVER (PARTITION BY r.application_id ORDER BY r.ended_at NULLS LAST, r.task_id), r.submitted_at), r.created_at) AS arrived_at,
                     r.task_id
              FROM txn_raw r
            ),
            seq AS (
              SELECT x.*, ROW_NUMBER() OVER (PARTITION BY x.application_id, x.desk ORDER BY x.ended_at NULLS LAST, x.task_id) AS visit_no
              FROM txn x
            ),
            dd_task AS (
              SELECT s.application_id,
                     CASE
                       WHEN s.desk = 'cfo' AND s.visit_no > 1 THEN 'cfo2'
                       WHEN s.desk = 'cfo' THEN 'cfo1'
                       WHEN s.desk = 'accounts' AND (s.visit_no > 1 OR s.stage_name ILIKE '%Verification%') THEN 'accounts2'
                       WHEN s.desk = 'accounts' THEN 'accounts1'
                       WHEN s.desk = 'adtp' AND (s.visit_no > 1 OR s.stage_name ILIKE '%E-Sign%' OR s.stage_name ILIKE '%ESIGN%' OR s.stage_name ILIKE '%DDTP%') THEN 'adtp2'
                       WHEN s.desk = 'adtp' THEN 'adtp1'
                       ELSE s.desk
                     END AS bucket,
                     SUM(GREATEST(ce.wd_index - ca.wd_index + 1, 0)) AS days_total,
                     BOOL_OR(s.still_open) AS has_open
              FROM seq s
              JOIN cal ca ON ca.day = CAST(s.arrived_at AS date)
              JOIN cal ce ON ce.day = CAST(COALESCE(s.ended_at, CURRENT_DATE) AS date)
              GROUP BY 1, 2
            ),
            df_task AS (
              SELECT dd.*,
                     CASE WHEN has_open AND days_total = 0 THEN 'Pending (same day)'
                          WHEN has_open THEN 'Pending (' || days_total || ' days)'
                          WHEN days_total = 0 THEN 'Same day'
                          WHEN days_total = 1 THEN '1 day'
                          ELSE days_total || ' days' END AS label
              FROM dd_task dd
            ),
            citizen AS (
              SELECT s.application_id, SUM(GREATEST(cc.wd_index - cp.wd_index, 0)) AS gap_days
              FROM seq s
              JOIN cal cp ON cp.day = CAST(s.prev_ended AS date)
              JOIN cal cc ON cc.day = CAST(s.created_at AS date)
              WHERE s.prev_ended IS NOT NULL AND s.created_at > s.prev_ended
              GROUP BY 1
            ),
            report AS (
              SELECT ap.application_id, ap.application_number, ap.department_name, ap.department_code, ap.service_label, ap.submitted_at, ap.app_status,
                     COALESCE(MAX(f.label) FILTER (WHERE f.bucket = 'fo'), '-') AS b_fo,
                     COALESCE(MAX(f.label) FILTER (WHERE f.bucket = 'cfo1'), '-') AS b_cfo1,
                     COALESCE(MAX(f.label) FILTER (WHERE f.bucket = 'cfo2'), '-') AS b_cfo2,
                     COALESCE(MAX(f.label) FILTER (WHERE f.bucket = 'atp'), '-') AS b_atp,
                     COALESCE(MAX(f.label) FILTER (WHERE f.bucket = 'tp'), '-') AS b_tp,
                     COALESCE(MAX(f.label) FILTER (WHERE f.bucket = 'adtp1'), '-') AS b_adtp1,
                     COALESCE(MAX(f.label) FILTER (WHERE f.bucket = 'adtp2'), '-') AS b_adtp2,
                     COALESCE(MAX(f.label) FILTER (WHERE f.bucket = 'amc'), '-') AS b_amc,
                     COALESCE(MAX(f.label) FILTER (WHERE f.bucket = 'accounts1'), '-') AS b_accounts1,
                     COALESCE(MAX(f.label) FILTER (WHERE f.bucket = 'accounts2'), '-') AS b_accounts2,
                     COALESCE(MAX(f.label) FILTER (WHERE f.bucket = 'payment'), '-') AS b_payment,
                     COALESCE(SUM(f.days_total) FILTER (WHERE f.bucket IN ('fo','cfo1','cfo2','atp','tp','adtp1','adtp2','amc','desk1','desk2','desk3','si','tahsildar','jc','dept','accounts1','accounts2','other')), 0) AS total_office_days,
                     COALESCE(MAX(c.gap_days), 0) AS citizen_side_days
              FROM apps ap
              LEFT JOIN df_task f ON f.application_id = ap.application_id
              LEFT JOIN citizen c ON c.application_id = ap.application_id
              GROUP BY ap.application_id, ap.application_number, ap.department_name, ap.department_code, ap.service_label, ap.submitted_at, ap.app_status
            )
            SELECT * FROM report
            ORDER BY total_office_days DESC NULLS LAST, application_number ASC;
            """
        }
    ),

    # =========================================================================
    # 4. OFFICER REPORTS SERVICE (apps/api/src/modules/officer/officer-reports.service.ts)
    # =========================================================================
    ToolMemory(
        question="What is the Vivaran report summarizing served, rejected, and pending applications against stipulated RTS SLA time limits by department and service?",
        tool_name="run_sql",
        args={
            "sql": """
            WITH cal AS (
              SELECT d::date AS day,
                     SUM(CASE WHEN EXTRACT(ISODOW FROM d) < 6 AND h.date IS NULL THEN 1 ELSE 0 END) OVER (ORDER BY d) AS wd_index
              FROM generate_series('2024-01-01'::date, CURRENT_DATE + 1, interval '1 day') d
              LEFT JOIN sdk_svc_holidays h ON h.date = d::date
            )
            SELECT
              d.id AS department_id,
              d.name AS department_name,
              d.name_mr AS department_name_mr,
              svc.id AS service_id,
              svc.name AS service_name,
              svc.name_mr AS service_name_mr,
              svc.stipulated_days AS stipulated_days,
              COUNT(a.id)::int AS total_applications,
              SUM(CASE WHEN a.status IN ('approved','completed') AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) <= svc.stipulated_days THEN 1 ELSE 0 END)::int AS served_within_time,
              SUM(CASE WHEN a.status IN ('approved','completed') AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) > svc.stipulated_days THEN 1 ELSE 0 END)::int AS served_after_time,
              SUM(CASE WHEN a.status = 'rejected' AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) <= svc.stipulated_days THEN 1 ELSE 0 END)::int AS rejected_within_time,
              SUM(CASE WHEN a.status = 'rejected' AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) > svc.stipulated_days THEN 1 ELSE 0 END)::int AS rejected_after_time,
              SUM(CASE WHEN a.status IN ('submitted','under_review') AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) <= svc.stipulated_days THEN 1 ELSE 0 END)::int AS pending_within_time,
              SUM(CASE WHEN a.status IN ('submitted','under_review') AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) > svc.stipulated_days THEN 1 ELSE 0 END)::int AS pending_after_time,
              SUM(CASE WHEN a.status = 'needs_revision' THEN 1 ELSE 0 END)::int AS pending_at_citizen
            FROM rts_citizen_applications a
            JOIN sdk_svc_services svc ON svc.id = a.service_id AND svc.deleted_at IS NULL
            JOIN sdk_svc_departments d ON d.id = svc.department_id AND d.deleted_at IS NULL
            LEFT JOIN cal ca ON ca.day = CAST(a.submitted_at AS date)
            LEFT JOIN cal ce ON ce.day = CAST(COALESCE(a.completed_at, a.rejected_at, CURRENT_DATE) AS date)
            WHERE a.status NOT IN ('draft','started','in_progress','deleted')
            GROUP BY d.id, d.name, d.name_mr, svc.id, svc.name, svc.name_mr, svc.stipulated_days;
            """
        }
    ),
    ToolMemory(
        question="Show Executive Summary dashboard KPIs including statutory penalty exposure and closed on-time performance",
        tool_name="run_sql",
        args={
            "sql": """
            WITH cal AS (
              SELECT d::date AS day,
                     SUM(CASE WHEN EXTRACT(ISODOW FROM d) < 6 AND h.date IS NULL THEN 1 ELSE 0 END) OVER (ORDER BY d) AS wd_index
              FROM generate_series('2024-01-01'::date, CURRENT_DATE + 1, interval '1 day') d
              LEFT JOIN sdk_svc_holidays h ON h.date = d::date
            ),
            apps AS (
              SELECT a.id, a.application_number, a.status, a.submitted_at, a.completed_at, a.rejected_at,
                     svc.stipulated_days
              FROM rts_citizen_applications a
              JOIN sdk_svc_services svc ON svc.id = a.service_id AND svc.deleted_at IS NULL
              WHERE a.status NOT IN ('draft','started','in_progress','deleted')
            ),
            closed_stats AS (
              SELECT COUNT(*)::int AS closed_total,
                     SUM(CASE WHEN GREATEST(ce.wd_index - ca.wd_index + 1, 0) <= ap.stipulated_days THEN 1 ELSE 0 END)::int AS closed_on_time,
                     AVG(GREATEST(ce.wd_index - ca.wd_index + 1, 0)) AS avg_days_to_close
              FROM apps ap
              JOIN cal ca ON ca.day = CAST(ap.submitted_at AS date)
              JOIN cal ce ON ce.day = CAST(COALESCE(ap.completed_at, ap.rejected_at) AS date)
              WHERE ap.status IN ('completed','approved','rejected')
            ),
            pending_stats AS (
              SELECT COUNT(*)::int AS pending_total,
                     SUM(CASE WHEN GREATEST(ce.wd_index - ca.wd_index + 1, 0) > ap.stipulated_days THEN 1 ELSE 0 END)::int AS late_files,
                     SUM(CASE WHEN GREATEST(ce.wd_index - ca.wd_index + 1, 0) > ap.stipulated_days THEN 5000 ELSE 0 END)::int AS penalty_exposure
              FROM apps ap
              JOIN cal ca ON ca.day = CAST(ap.submitted_at AS date)
              JOIN cal ce ON ce.day = CURRENT_DATE
              WHERE ap.status IN ('submitted','under_review')
            )
            SELECT * FROM closed_stats, pending_stats;
            """
        }
    ),
    ToolMemory(
        question="What is the Department Service Summary (Goshwara report) showing online applications received, pending, rejected with reason, and rejected without reason?",
        tool_name="run_sql",
        args={
            "sql": """
            WITH cal AS (
              SELECT d::date AS day,
                     SUM(CASE WHEN EXTRACT(ISODOW FROM d) < 6 AND h.date IS NULL THEN 1 ELSE 0 END) OVER (ORDER BY d) AS wd_index
              FROM generate_series('2024-01-01'::date, CURRENT_DATE + 1, interval '1 day') d
              LEFT JOIN sdk_svc_holidays h ON h.date = d::date
            )
            SELECT
              d.id AS department_id,
              d.name AS department_name,
              d.name_mr AS department_name_mr,
              svc.id AS service_id,
              svc.name AS service_name,
              svc.name_mr AS service_name_mr,
              COUNT(a.id)::int AS online_applications_count,
              SUM(CASE WHEN a.status IN ('approved','completed') AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) <= svc.stipulated_days THEN 1 ELSE 0 END)::int AS received_within_time,
              SUM(CASE WHEN a.status IN ('approved','completed') AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) > svc.stipulated_days THEN 1 ELSE 0 END)::int AS received_after_time,
              SUM(CASE WHEN a.status IN ('submitted','under_review') AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) <= svc.stipulated_days THEN 1 ELSE 0 END)::int AS pending_within_time,
              SUM(CASE WHEN a.status IN ('submitted','under_review') AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) > svc.stipulated_days THEN 1 ELSE 0 END)::int AS pending_after_time,
              SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END)::int AS rejected_applications_count,
              SUM(CASE WHEN a.status = 'rejected' AND (a.rejection_reason IS NULL OR TRIM(a.rejection_reason) = '') THEN 1 ELSE 0 END)::int AS rejected_without_reason
            FROM rts_citizen_applications a
            JOIN sdk_svc_services svc ON svc.id = a.service_id AND svc.deleted_at IS NULL
            JOIN sdk_svc_departments d ON d.id = svc.department_id AND d.deleted_at IS NULL
            LEFT JOIN cal ca ON ca.day = CAST(a.submitted_at AS date)
            LEFT JOIN cal ce ON ce.day = CAST(COALESCE(a.completed_at, a.rejected_at, CURRENT_DATE) AS date)
            WHERE a.status NOT IN ('draft','started','in_progress','deleted')
            GROUP BY d.id, d.name, d.name_mr, svc.id, svc.name, svc.name_mr;
            """
        }
    ),
    ToolMemory(
        question="Show accounts and finance department fee collection summary with online and offline payment mode breakdowns",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT
              a.id AS application_id,
              a.application_number,
              a.submitted_at,
              tx.transaction_id,
              tx.amount AS total_amount,
              tx.payment_mode,
              tx.status AS payment_status,
              COALESCE(CAST(tx.fee_breakdown->>'scrutinyFee' AS numeric), 0) AS scrutiny_fee,
              COALESCE(CAST(tx.fee_breakdown->>'developmentCharge' AS numeric), 0) AS dev_charge,
              COALESCE(CAST(tx.fee_breakdown->>'labourCess' AS numeric), 0) AS labour_cess,
              COALESCE(CAST(tx.fee_breakdown->>'securityDeposit' AS numeric), 0) AS security_deposit
            FROM rts_citizen_applications a
            JOIN sdk_pg_transactions tx ON tx.application_id = a.id AND tx.status = 'SUCCESS'
            WHERE a.status NOT IN ('draft','started','in_progress','deleted')
              AND (:payment_mode::text IS NULL OR tx.payment_mode = :payment_mode);
            """
        }
    ),
    ToolMemory(
        question="Show applications transferred between officers via building permission transfer workflow",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT
              a.id AS application_id,
              a.application_number,
              t.id AS task_id,
              t.metadata->>'transferredBy' AS transferred_by_user_id,
              t.metadata->>'transferredTo' AS transferred_to_user_id,
              t.metadata->>'transferReason' AS transfer_reason,
              t.created_at AS transferred_at
            FROM rts_citizen_applications a
            JOIN sdk_aw_workflow_tasks t ON t.instance_id = a.workflow_instance_id
            WHERE t.metadata->>'transferredBy' IS NOT NULL
              AND (:officer_id::text IS NULL OR t.metadata->>'transferredBy' = :officer_id);
            """
        }
    ),
    ToolMemory(
        question="Show citizen application appeals filtered by appeal stage (L1/L2), appeal reason, and status",
        tool_name="run_sql",
        args={
            "sql": """
            SELECT
              app.id AS appeal_id,
              app.application_id,
              a.application_number,
              app.stage,
              app.appeal_reason,
              app.status AS appeal_status,
              app.created_at AS appeal_date
            FROM rts_citizen_application_appeals app
            JOIN rts_citizen_applications a ON a.id = app.application_id
            WHERE app.deleted_at IS NULL
              AND (:stage::text IS NULL OR app.stage = :stage)
              AND (:appeal_reason::text IS NULL OR app.appeal_reason = :appeal_reason);
            """
        }
    ),
    ToolMemory(
        question="Show taluka league table with on-time percentage, closed cases, late cases, and pending counts per taluka",
        tool_name="run_sql",
        args={
            "sql": """
            WITH cal AS (
              SELECT d::date AS day,
                     SUM(CASE WHEN EXTRACT(ISODOW FROM d) < 6 AND h.date IS NULL THEN 1 ELSE 0 END) OVER (ORDER BY d) AS wd_index
              FROM generate_series('2024-01-01'::date, CURRENT_DATE + 1, interval '1 day') d
              LEFT JOIN sdk_svc_holidays h ON h.date = d::date
            )
            SELECT
              t.taluka_name AS taluka,
              COUNT(a.id)::int AS total_received,
              SUM(CASE WHEN a.status IN ('completed','approved') THEN 1 ELSE 0 END)::int AS closed,
              SUM(CASE WHEN a.status IN ('submitted','under_review') AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) > svc.stipulated_days THEN 1 ELSE 0 END)::int AS late,
              SUM(CASE WHEN a.status IN ('submitted','under_review') THEN 1 ELSE 0 END)::int AS pending,
              ROUND(
                SUM(CASE WHEN a.status IN ('completed','approved') AND GREATEST(ce.wd_index - ca.wd_index + 1, 0) <= svc.stipulated_days THEN 1 ELSE 0 END)::numeric * 100.0 /
                NULLIF(SUM(CASE WHEN a.status IN ('completed','approved') THEN 1 ELSE 0 END), 0), 2
              ) AS on_time_percent
            FROM rts_citizen_applications a
            JOIN sdk_svc_services svc ON svc.id = a.service_id AND svc.deleted_at IS NULL
            LEFT JOIN sdk_core_villages v ON v.id = a.village_id
            LEFT JOIN sdk_core_talukas t ON t.id = v.taluka_id
            LEFT JOIN cal ca ON ca.day = CAST(a.submitted_at AS date)
            LEFT JOIN cal ce ON ce.day = CAST(COALESCE(a.completed_at, a.rejected_at, CURRENT_DATE) AS date)
            WHERE a.status NOT IN ('draft','started','in_progress','deleted')
            GROUP BY t.taluka_name
            ORDER BY on_time_percent DESC NULLS LAST;
            """
        }
    )
]

async def register_training_data(agent_or_memory, user: User = None):
    """Registers manual Question-SQL pair training examples into Vanna Agent Memory."""
    if user is None:
        user = User(id="admin@example.com", email="admin@example.com", group_memberships=["admin"])
    
    memory = getattr(agent_or_memory, "agent_memory", agent_or_memory)
    
    dummy_context = ToolContext(
        user=user,
        conversation_id="system_init",
        request_id="init_training_data",
        agent_memory=memory
    )
    
    count = 0
    for example in training_examples:
        await memory.save_tool_usage(
            question=example.question,
            tool_name=example.tool_name,
            args=example.args,
            context=dummy_context,
            success=True
        )
        count += 1
    return count

if __name__ == "__main__":
    from vanna.integrations.local.agent_memory import DemoAgentMemory
    
    async def main():
        mem = DemoAgentMemory()
        registered = await register_training_data(mem)
        print(f"Successfully verified and loaded {registered} manual Question-SQL training pairs into Vanna Agent Memory.")
        dummy_user = User(id="admin@example.com", email="admin@example.com", group_memberships=["admin"])
        dummy_context = ToolContext(user=dummy_user, conversation_id="test", request_id="test", agent_memory=mem)
        memories = await mem.get_recent_memories(dummy_context, limit=100)
        print(f"Verified memory store count: {len(memories)} entries.")
        for idx, m in enumerate(memories, 1):
            print(f"  {idx}. [{m.tool_name}] Question: {m.question}")

    asyncio.run(main())
