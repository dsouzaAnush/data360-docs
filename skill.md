---
name: salesforce-data-360-docs
description: >
  Salesforce Data 360 (Data Cloud) developer documentation covering Connect REST API,
  Query API, Metadata Types, Web/Python/JDBC SDKs, data ingestion, identity resolution,
  segments, activations, and integration patterns. Use when building applications on the
  Salesforce Data 360 platform, querying unified customer profiles, ingesting external data,
  or configuring Data Cloud pipelines.
license: MIT
compatibility: "Requires a Salesforce org with Data Cloud enabled. CLI workflows use the sf data360 plugin."
metadata:
  author: dsouzaAnush
  version: "1.0.0"
  platform: "Salesforce Data 360"
---

# Salesforce Data 360 Developer Documentation

Complete developer documentation for building on Salesforce Data 360 (formerly Data Cloud).

## Capabilities

- **Data Ingestion** — Ingest data via Connect REST API, Ingestion API, Web SDK, or third-party connectors
- **Identity Resolution** — Configure and run identity resolution rulesets to unify customer profiles
- **Segmentation** — Create segments and calculated insights with SQL-based rules
- **Activations** — Activate unified profiles to marketing, analytics, and external platforms
- **Query & Retrieval** — Query unified data via Query API, Profile API, and SQL reference
- **Metadata Management** — Define data sources, data streams, and schemas via Metadata Types API
- **SDK Integration** — Web SDK (JavaScript), Python SDK, and JDBC connector for programmatic access

## Available Skills

### Data Cloud Pipeline Skills

| Skill | Phase | Description |
|-------|-------|-------------|
| `sf-datacloud` | Orchestrator | Multi-phase pipeline orchestration (connect → prepare → harmonize → segment → act) |
| `sf-datacloud-connect` | Connect | Data source connections and connector configuration |
| `sf-datacloud-prepare` | Prepare | Data streams, data lake objects, and transforms |
| `sf-datacloud-harmonize` | Harmonize | Data model objects, field mappings, and identity resolution |
| `sf-datacloud-segment` | Segment | Segments, calculated insights, and SQL segment rules |
| `sf-datacloud-act` | Act | Activations, data actions, and activation targets |
| `sf-datacloud-retrieve` | Retrieve | SQL queries, search, and metadata retrieval |
| `sf-datacloud-unify` | Unify | End-to-end unification workflows |
| `sf-datacloud-mce-unify` | MCE | Marketing Cloud Engagement integration |
| `sf-datacloud-snowflake-salesforce-segment` | Cross-source | Snowflake-to-Salesforce segmentation |

### Cross-Cutting Skills

| Skill | Description |
|-------|-------------|
| `sf-soql` | SOQL query authoring and optimization |
| `sf-metadata` | Salesforce metadata management and deployment |
| `sf-deploy` | Deployment orchestration with sf CLI |

## Documentation Sections

- **Getting Started** — Introduction, quickstart, and architecture overview
- **Developer Guide** — Environments, use cases, identity resolution best practices
- **Connect REST API** — Data ingestion, streams, identity resolution, segments, activations
- **Query API** — Query services, Profile API, calculated insights, data graphs, SQL reference
- **Metadata Types** — Data source, data stream, identity resolution, segments, ingestion schema
- **Web SDK** — Events, identity, consent management
- **Python SDK** — Authentication, queries, DataFrames
- **JDBC Connector** — Authentication, configuration, query examples
- **Integrations** — Ingestion API, connector services, third-party connectors
