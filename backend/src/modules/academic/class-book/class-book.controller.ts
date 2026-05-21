import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards, ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { ClassBookService } from "./class-book.service.js";
import { CreateClassBookEntryDto, UpdateClassBookEntryDto } from "./dto/class-book.dto.js";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../../common/guards/roles.guard.js";
import { Roles } from "../../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../../common/decorators/current-user.decorator.js";

@ApiTags("ClassBook")
@Controller("class-book")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class ClassBookController {
  constructor(private readonly service: ClassBookService) {}

  @Post()
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Crear entrada del libro de clases" })
  create(@Body() dto: CreateClassBookEntryDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Listar entradas del libro de clases con filtros" })
  @ApiQuery({ name: "courseId", required: false })
  @ApiQuery({ name: "subjectId", required: false })
  @ApiQuery({ name: "date", required: false })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  findAll(
    @Query("courseId") courseId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("date") date?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.findAll({ courseId, subjectId, date, from, to });
  }

  @Get(":id")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "DIRECTION", "UTP")
  @ApiOperation({ summary: "Obtener entrada del libro de clases por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Patch(":id")
  @Roles("TEACHER", "ADMIN", "SUPER_ADMIN", "UTP")
  @ApiOperation({ summary: "Actualizar entrada del libro de clases" })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateClassBookEntryDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Eliminar entrada del libro de clases" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
