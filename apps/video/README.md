# LumaThread launch video

Remotion composition for the 29-second LumaThread product presentation.

```bash
bun run video:dev
bun run video:render
```

The composition is 1920x1080 at 30 fps. Every renderer animation is driven by
Remotion's frame clock so renders are deterministic. The final product-reveal
scene recreates the current LumaThread landing hero.
