# mintsy docs

mintsy turns nonfiction books into short video series. Every book is a show, and every chapter is a narrated, animated episode of about 5 minutes with a synced transcript.

* [System overview](overview.md): the services, how they connect, environments and accounts.
* [Contracts](contracts.md): what services must agree on. Read this before changing anything that crosses a service.
* [Backend](backend/index.md), [Studio](services/studio.md), [Admin](services/admin.md), [Mobile](services/mobile.md), [Web](services/web.md), [Brand](services/brand.md): how each service and shared package works.

Current state isn't recorded here. Check it live: `gh run list -R castroaillc/<repo>`, `vercel ls mintsy-web`, and `gcloud run services describe mintsy-api --project mintsy-prod --region us-central1`.
