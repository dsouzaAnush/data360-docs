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

## Deployment

This site is deployed on Mintlify. Push changes to the main branch to trigger deployment.

## License

MIT License - See [LICENSE](LICENSE) for details.

## Credits

Documentation sourced from [Salesforce Developer Documentation](https://developer.salesforce.com/docs/data/data-cloud-dev/guide/dc-get-started.html).
