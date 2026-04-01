# LocationScout-Base — Data Model

## Overview

This document describes the database schema for the **Location Scout** agent.

## Tables

See `db/schema.sql` for the DDL definitions.

### tasks

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Associated project |
| status | VARCHAR(20) | Task status: pending, processing, completed, failed |
| input_data | JSONB | FLACP message payload |
| output_data | JSONB | Processing result |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

## TODO

- Add agent-specific tables for Location Scout artifacts
