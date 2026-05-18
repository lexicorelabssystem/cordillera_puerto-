import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface JwtPayload {
  sub: string;
  role: string;
  email: string;
  name: string;
  institutionId?: string;
}

export const CurrentUser = createParamDecorator((data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | JwtPayload[keyof JwtPayload] | null => {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user as JwtPayload | undefined;
  if (!user) return null;
  return data ? user[data] : user;
});
