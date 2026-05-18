import {
  Controller, Get, Query, UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { AdminService } from "./admin.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../common/decorators/current-user.decorator.js";

@ApiTags("Admin")
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get("overview")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Dashboard administrativo con datos institucionales reales" })
  @ApiQuery({ name: "institutionId", required: false })
  async getOverview(
    @CurrentUser() user: JwtPayload,
    @Query("institutionId") institutionId?: string,
  ) {
    const effectiveInstitutionId =
      institutionId || user.institutionId || undefined;
    return this.service.getOverview(effectiveInstitutionId);
  }
}
