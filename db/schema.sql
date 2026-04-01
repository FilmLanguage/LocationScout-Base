-- LocationScout-Base — Database Schema
-- Location Scout Agent operational database
--
-- TODO: Define tables for this agent's operational state.
-- See docs/data-model.md for documentation.

-- Example: Task tracking
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    input_data JSONB,
    output_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TODO: Add agent-specific tables
