-- ============================================================
-- ADD ALL MISSING INDEXES
-- Each group wrapped in DO block so it skips safely if table doesn't exist
-- ============================================================

DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_schedule_tasks_project_id ON public.schedule_tasks(project_id); CREATE INDEX IF NOT EXISTS idx_schedule_tasks_user_id ON public.schedule_tasks(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_job_cost_entries_project_id ON public.job_cost_entries(project_id); CREATE INDEX IF NOT EXISTS idx_job_cost_entries_user_id ON public.job_cost_entries(user_id); CREATE INDEX IF NOT EXISTS idx_job_cost_entries_date ON public.job_cost_entries(date DESC NULLS LAST); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_variations_project_id ON public.variations(project_id); CREATE INDEX IF NOT EXISTS idx_variations_user_id ON public.variations(user_id); CREATE INDEX IF NOT EXISTS idx_variations_status ON public.variations(status); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_plan_pages_project_id ON public.plan_pages(project_id); CREATE INDEX IF NOT EXISTS idx_plan_pages_user_id ON public.plan_pages(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_plan_measurements_plan_page_id ON public.plan_measurements(plan_page_id); CREATE INDEX IF NOT EXISTS idx_plan_measurements_user_id ON public.plan_measurements(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_plan_symbols_plan_page_id ON public.plan_symbols(plan_page_id); CREATE INDEX IF NOT EXISTS idx_plan_symbols_user_id ON public.plan_symbols(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_plan_schedules_plan_page_id ON public.plan_schedules(plan_page_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_plan_quantities_plan_page_id ON public.plan_quantities(plan_page_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_app_projects_user_id ON public.projects(user_id); EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_app_projects_status ON public.projects(status); CREATE INDEX IF NOT EXISTS idx_app_projects_created_at ON public.projects(created_at DESC NULLS LAST); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_cost_centers_project_id ON public.cost_centers(project_id); CREATE INDEX IF NOT EXISTS idx_cost_centers_user_id ON public.cost_centers(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_overhead_items_project_id ON public.overhead_items(project_id); EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_chat_conversations_project_id ON public.chat_conversations(project_id); CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id); CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_estimate_sections_user_id ON public.estimate_sections(user_id); CREATE INDEX IF NOT EXISTS idx_estimate_sections_estimate_id ON public.estimate_sections(estimate_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_pricing_history_project_id ON public.pricing_history(project_id); CREATE INDEX IF NOT EXISTS idx_pricing_history_user_id ON public.pricing_history(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_tender_templates_user_id ON public.tender_templates(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_plan_sections_user_id ON public.plan_sections(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_custom_materials_user_id ON public.custom_materials(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_custom_sow_rates_user_id ON public.custom_sow_rates(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_custom_trades_user_id ON public.custom_trades(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_tender_documents_user_id ON public.tender_documents(user_id); CREATE INDEX IF NOT EXISTS idx_tender_documents_project_id ON public.tender_documents(project_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id); CREATE INDEX IF NOT EXISTS idx_team_members_status ON public.team_members(status); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_subscriptions_team_id ON public.subscriptions(team_id); EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_trades_org_id ON public.trades(org_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_element_categories_org_id ON public.element_categories(org_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_cost_items_org_id ON public.cost_items(org_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_assemblies_org_id ON public.assemblies(org_id); CREATE INDEX IF NOT EXISTS idx_assemblies_cloned_from ON public.assemblies(cloned_from_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_prelim_drivers_assembly_id ON public.prelim_drivers(assembly_id); CREATE INDEX IF NOT EXISTS idx_prelim_drivers_cost_item_id ON public.prelim_drivers(cost_item_id); CREATE INDEX IF NOT EXISTS idx_prelim_drivers_trade_id ON public.prelim_drivers(trade_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_assembly_components_cost_item_id ON public.assembly_components(cost_item_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_ai_analyses_project_id ON public.ai_analyses(project_id); CREATE INDEX IF NOT EXISTS idx_ai_analyses_user_id ON public.ai_analyses(user_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_tenders_estimate_id ON public.tenders(estimate_id); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_rate_overrides_updated_by ON public.rate_overrides(updated_by); EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON public.webhook_deliveries(next_retry_at) WHERE next_retry_at IS NOT NULL; EXCEPTION WHEN undefined_table THEN NULL; END $$;
