import { SetMetadata } from "@nestjs/common";
import { PermissionAction } from "@prisma/client";

export const PERMISSIONS_KEY = "permissions";
export const Permissions = (...actions: PermissionAction[]) => SetMetadata(PERMISSIONS_KEY, actions);
