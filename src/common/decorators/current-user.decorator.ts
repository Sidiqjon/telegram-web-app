import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Usage: @CurrentUser() user: AuthUser
 * Pulls the user object attached to the request by JwtAccessStrategy.
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
