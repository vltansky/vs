import express from 'express';
import { getSession, setSession } from './sessions/service';
import { CachedFlags } from './flags/service';
import { snapshot } from './cache/metrics';

const app = express();
app.use(express.json());

const flags = new CachedFlags({
  async resolve(_name, _userId) {
    return false;
  },
});

app.get('/session/:sid', (req, res) => {
  const s = getSession(req.params.sid);
  res.json(s ?? {});
});

app.post('/session/:sid', (req, res) => {
  setSession(req.params.sid, req.body);
  res.status(204).end();
});

app.get('/flag/:name/:userId', async (req, res) => {
  const enabled = await flags.isEnabled(req.params.name, req.params.userId);
  res.json({ enabled });
});

app.get('/_metrics/cache', (_req, res) => {
  res.json(snapshot());
});

app.listen(Number(process.env.PORT ?? 3000));
