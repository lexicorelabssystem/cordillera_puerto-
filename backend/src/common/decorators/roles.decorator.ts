import { applyDecorators, SetMetadata } from "@nestjs/common";
import { UserRole } from "@prisma/client";

export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRole[]) => applyDecorators(SetMetadata(ROLES_KEY, roles));
