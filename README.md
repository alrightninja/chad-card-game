# Gigachad TCG

Turn-based multiplayer trading card game. Play vs AI locally or against friends (live / correspondence).

- **Site (Vercel):** static React app in `frontend/`
- **API (Render):** Express + Socket.IO in `backend/`
- **Data:** MongoDB Atlas for users, matches, and social. Card catalog is `backend/cards.json`.

Living rules: [`RULEBOOK.md`](RULEBOOK.md).

## Local development

1. Allowlist your IP in MongoDB Atlas.
2. Copy env files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set `MONGO_URI` and `JWT_SECRET` in `backend/.env`. Keep `FRONTEND_URL=http://localhost:3000`.

3. Run API then site:

```bash
cd backend && npm start
cd frontend && npm start
```

- API: `http://localhost:4000` (`GET /health`)
- App: `http://localhost:3000`

Restart the backend after catalog or engine changes (no hot reload).

## Production layout

| Piece | Host | Notes |
| --- | --- | --- |
| `frontend/` | Vercel | Root Directory = `frontend`. Framework = Create React App. |
| `backend/` | Render Web Service | Binds `0.0.0.0:$PORT`. Blueprint: `render.yaml`. |
| MongoDB | Atlas | Allow `0.0.0.0/0` (or Render outbound IPs). |

### Render env

| Variable | Required | Notes |
| --- | --- | --- |
| `MONGO_URI` | yes | Atlas connection string |
| `JWT_SECRET` | yes | Long random string (Blueprint can generate) |
| `ADMIN_SECRET` | yes | For OG/admin verify routes |
| `FRONTEND_URL` | yes | Vercel origin, comma-separated if you have a custom domain too |
| `DEV_TOOLS` | yes | Must be `false` in production |
| `PORT` | no | Render sets this |

### Vercel env (set **before** the production build)

| Variable | Example |
| --- | --- |
| `REACT_APP_API_URL` | `https://gigachad-tcg-api.onrender.com` |
| `REACT_APP_WS_URL` | same as API URL |

Create React App inlines these at **build** time. Changing them requires a new Vercel deploy.

### Order that works

1. Push this repo to GitHub.
2. Apply the Render Blueprint (or create a Node web service with root `backend`). Fill secrets. Confirm `GET https://YOUR-API.onrender.com/health`.
3. Create the Vercel project with root `frontend`, set the two `REACT_APP_*` vars, deploy.
4. Set Render `FRONTEND_URL` to `https://YOUR-APP.vercel.app` (and any custom domain). Redeploy the API if CORS was cached at boot.

Free Render instances sleep after idle time. **Live** matches drop when the API sleeps; **correspondence** matches persist in Mongo.

## What not to commit

Never commit `backend/.env` or `frontend/.env`.
