# Game engines

Each game lives in its own folder here, named after its id in `../catalog.ts`.

```
engines/
  chess/
    index.tsx      default export: the game component (receives GameEngineProps)
    rules.ts       pure game logic, no React
    Board.tsx      3D board, rendered inside <GameCanvas> from src/three
```

To make a game playable:

1. Add the folder and its default export.
2. Register it in `../registry.ts`.
3. Set its `status` to `'available'` in `../catalog.ts`.

The route `/games/<id>` loads the engine on demand, so nothing else needs to change.
Live rooms connect with `roomSocketUrl()` from `src/lib/api.ts`.
