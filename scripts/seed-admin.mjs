import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hash(password) {
  return bcrypt.hash(password, 10);
}

async function main() {
  const username = 'TEST';
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Usuario '${username}' ya existe. Actualizando contraseña...`);
    const hashed = await hash('1234');
    await prisma.user.update({
      where: { username },
      data: { password: hashed, role: 'ADMIN', isActive: true },
    });
    console.log('Contraseña actualizada.');
  } else {
    console.log(`Creando usuario '${username}'...`);
    const hashed = await hash('1234');
    await prisma.user.create({
      data: {
        username,
        password: hashed,
        name: 'Administrador TEST',
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('Usuario creado exitosamente.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
