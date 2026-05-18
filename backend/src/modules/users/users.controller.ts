import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { UsersService } from "./users.service.js";
import { CreateUserDto, UpdateUserDto, UserResponseDto } from "./dto/create-user.dto.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../../common/guards/roles.guard.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CurrentUser, JwtPayload } from "../../common/decorators/current-user.decorator.js";

@ApiTags("Users")
@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("access-token")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Crear usuario" })
  @ApiResponse({ status: 201, description: "Usuario creado", type: UserResponseDto })
  @ApiResponse({ status: 409, description: "Email ya registrado" })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION")
  @ApiOperation({ summary: "Listar usuarios" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "role", required: false, enum: UserRole })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("role") role?: UserRole,
  ) {
    return this.usersService.findAll(page ?? 1, limit ?? 20, role);
  }

  @Get("me")
  @ApiOperation({ summary: "Obtener perfil del usuario autenticado" })
  async me(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  @Get(":id")
  @Roles("ADMIN", "SUPER_ADMIN", "DIRECTION")
  @ApiOperation({ summary: "Obtener usuario por ID" })
  async findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Patch(":id")
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Actualizar usuario" })
  async update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles("ADMIN", "SUPER_ADMIN")
  @ApiOperation({ summary: "Eliminar usuario (soft delete)" })
  async remove(@Param("id", ParseUUIDPipe) id: string) {
    await this.usersService.softDelete(id);
  }
}
