# Data 360 Developer Docs

Developer documentation for Salesforce Data 360 (formerly Data Cloud).

## Overview

This documentation site provides comprehensive guides for:

- **Connect REST API** - The primary REST API for Data 360 operations
- **Query API** - SQL queries, profile APIs, and metadata
- **Web SDK** - Capture web interactions and events
- **Data Model Objects (DMOs)** - Understanding data models
- **Integrations** - Connectors and integration options

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Local Development

```bash
# Install Mintlify CLI
npm install -g mintlify

# Run local development server
mintlify dev
```

### Crawling Documentation

To update documentation from Salesforce:

```bash
# Install dependencies
npm install

# Run crawler
node scripts/crawl-docs.js
```

The crawler now writes source metadata into each synced MDX page:

- `source_url`
- `source_hash`
- `source_etag`
- `source_last_modified`
- `sync_status`

Run `npm run check:content` to re-fetch the configured official pages and fail when local content drifts.

### Syncing the Connect REST API

The API reference is sourced from the official Salesforce Data 360 Connect REST API OpenAPI spec:

- Reference page: https://developer.salesforce.com/docs/data/connectapi/references/spec
- YAML source used by Redoc: https://developer.salesforce.com/static/datacloud/connectapi/spec/cdp-connect-api-Swagger.yaml

The Salesforce CDN returns the YAML to Redoc-style browser requests, so the sync script sends the same referer and user-agent headers that the official page uses. The script also trims trailing whitespace from the downloaded YAML before writing it, while printing the raw upstream SHA when normalization occurs.

```bash
# Crawl official Salesforce content pages and sync the API reference
npm run sync:all

# Download the official spec and regenerate Connect API pages/navigation
npm run sync:apis

# Download configured official content pages
npm run sync:content

# Check that the checked-in spec still matches Salesforce
npm run check:connect-api

# Check official content pages still match local synced MDX
npm run check:content

# Check MDX openapi frontmatter against the checked-in spec
npm run check:openapi-bindings

# Check docs.json navigation points at real pages
npm run check:navigation

# Run all API sync checks
npm test
```

Generated Connect API pages live in `apis/connect-api/`, synced official content pages include `source_*` frontmatter, and the official source spec stays in `openapi/data360-api.yaml`. The rendered Mintlify playground uses the generated `openapi/data360-api.mintlify.yaml` copy, which only normalizes official path parameters that are missing `required: true` so Mintlify's OpenAPI validator can build the site.

## Deployment

This site is deployed on Mintlify. Push changes to the main branch to trigger deployment.

## License

MIT License - See [LICENSE](LICENSE) for details.

## Credits

Documentation sourced from [Salesforce Developer Documentation](https://developer.salesforce.com/docs/data/data-cloud-dev/guide/dc-get-started.html).
