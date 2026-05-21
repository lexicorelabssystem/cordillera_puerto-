import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Error interno del servidor";

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case "P2002":
          status = HttpStatus.CONFLICT;
          const target = (exception.meta?.target as string[])?.join(", ") ?? "campo";
          message = `Ya existe un registro con el mismo ${target}.`;
          break;
        case "P2003":
          status = HttpStatus.BAD_REQUEST;
          message = "La referencia a una entidad relacionada no es válida.";
          break;
        case "P2025":
          status = HttpStatus.NOT_FOUND;
          message = "El registro que intentas modificar no existe.";
          break;
        case "P2004":
          status = HttpStatus.BAD_REQUEST;
          message = "La consulta incluye una restricción inválida.";
          break;
        case "P2014":
          status = HttpStatus.BAD_REQUEST;
          message = "La relación entre entidades no es válida.";
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = "Error inesperado en la base de datos.";
      }
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = "Los datos enviados no tienen el formato correcto.";
    }

    this.logger.error(
      `${request.method} ${request.url} → Prisma ${status}`,
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? `Code: ${exception.code}, Meta: ${JSON.stringify(exception.meta)}`
        : exception.message,
    );

    reply.status(status).send({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
