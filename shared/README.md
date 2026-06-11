# StudyHub — Shared

This directory contains constants and type definitions shared between frontend and backend.

## Files

- `constants.js` — All enum-like constants (statuses, roles, limits)
- `types.js` — JSDoc type definitions for all main entities

## Usage

### In Backend (Node.js ESM)
```js
import { ROLES, SEAT_STATUSES, AUTH_LOCKOUT } from '../../shared/constants.js';
```

### In Frontend (Vite)
```js
import { ROLES, STUDENT_STATUSES } from '../../../shared/constants.js';
```

## Notes

This is a plain JS shared directory — not an npm package.
In a monorepo setup (Turborepo/Nx), this would be a workspace package.
For this project, import using relative paths.
