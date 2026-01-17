import { router, protectedProcedure, type ProtectedContext } from "../trpc.js";
import { sessionService } from "../services/session.service.js";

export const sessionsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const userId = (ctx as ProtectedContext).user.id;
    return await sessionService.getSessions(ctx.db.prisma, userId);
  }),
});
