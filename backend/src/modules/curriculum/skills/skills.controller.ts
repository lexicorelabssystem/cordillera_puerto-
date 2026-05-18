import {
  Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus,
  UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SkillsService } from "./skills.service.js";
import { CreateSkillDto, UpdateSkillDto } from "./dto/create-skill.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";

@ApiTags("Curriculum")
@Controller("skills")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class SkillsController {
  constructor(private readonly service: SkillsService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Crear habilidad" })
  create(@Body() dto: CreateSkillDto) {
    return this.service.create(dto);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Listar todas las habilidades" })
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP", "TEACHER")
  @ApiOperation({ summary: "Obtener habilidad por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Actualizar habilidad" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateSkillDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Eliminar habilidad" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
