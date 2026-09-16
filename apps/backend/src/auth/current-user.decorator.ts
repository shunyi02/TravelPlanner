import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Reads the authenticated user id from req.user, set by JwtAuthGuard after
 * validating the bearer token (see jwt.strategy.ts). Controllers using this
 * must be guarded with @UseGuards(JwtAuthGuard).
 */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const userId = request.user?.userId;
  if (!userId) {
    throw new UnauthorizedException('Not authenticated');
  }
  return userId;
});
