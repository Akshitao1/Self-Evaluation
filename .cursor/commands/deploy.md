---
description: Deploy application using local deploy script
alwaysApply: false
---
# Deploy Application

Run the project deployment workflow from the repository root.

## Execute

```bash
npm run deploy
```

## Notes

- This command expects a clean git working tree because `deploy.sh` enforces it.
- `PM2_APP_NAME` can be set before running if you want a custom PM2 process name.
