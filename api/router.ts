import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { simulationRouter } from "./simulation-router";
import { builderRouter } from "./builder-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  simulations: simulationRouter,
  builder: builderRouter,

  // TODO: add feature routers here, e.g.
  // todo: createRouter({
  //   list: publicQuery.query(() => findTodos()),
  // }),
});

export type AppRouter = typeof appRouter;
