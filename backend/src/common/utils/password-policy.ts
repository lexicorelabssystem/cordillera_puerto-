import { BadRequestException } from "@nestjs/common";

export function validatePasswordPolicy(password: string): true {
  if (password.length < 10) {
    throw new BadRequestException("La contraseña debe tener al menos 10 caracteres");
  }
  if (!/[a-z]/.test(password)) {
    throw new BadRequestException("La contraseña debe incluir al menos una letra minúscula");
  }
  if (!/[A-Z]/.test(password)) {
    throw new BadRequestException("La contraseña debe incluir al menos una letra mayúscula");
  }
  if (!/[0-9]/.test(password)) {
    throw new BadRequestException("La contraseña debe incluir al menos un número");
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    throw new BadRequestException("La contraseña debe incluir al menos un símbolo");
  }
  return true;
}
