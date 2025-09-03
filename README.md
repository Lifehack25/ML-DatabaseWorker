# ML-DatabaseWorker

A Cloudflare Worker with D1 Database for the Memory Locks project.

## Overview

This worker provides a fast, edge-deployed API for Memory Locks data operations using:
- **Cloudflare Workers** - Edge compute runtime
- **Hono Framework** - Express-like routing for Workers  
- **D1 Database** - SQLite at the edge with global replication
- **TypeScript** - Type safety and modern JS features
