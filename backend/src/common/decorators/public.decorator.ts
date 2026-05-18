import { applyDecorators, SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => applyDecorators(SetMetadata(IS_PUBLIC_KEY, true));
