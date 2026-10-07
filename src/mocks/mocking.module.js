import { randomUUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { createHash } from '../utils/index.js';
import CustomError from '../errors/CustomError.js';
import ErrorsEnum from '../errors/enum.js';

const PET_SPECIES = ['dog', 'cat', 'bird', 'fish', 'hamster'];

// Contraseña lógica de todos los usuarios mock (nunca se expone ni se guarda en texto plano).
export const MOCK_PASSWORD = 'coder123';
export const DEFAULT_QUANTITY = 50;
// Tope de seguridad para evitar pedidos absurdos que tumben el proceso.
export const MAX_QUANTITY = 10000;

/**
 * Valida y normaliza una cantidad recibida por query/body.
 * Acepta enteros >= 0 (0 es válido: permite generar solo usuarios o solo mascotas)
 * y strings numéricos enteros ("20"). Rechaza ausentes, negativos, decimales,
 * no numéricos y valores mayores a MAX_QUANTITY lanzando un error 400 (INVALID_TYPE_ERROR)
 * que resuelve el errorHandler global.
 */
export const parseQuantity = (value, field = 'quantity') => {
  const invalid = (message) =>
    CustomError.createError({
      name: 'InvalidQuantityError',
      cause: `Received ${field}: ${JSON.stringify(value)}`,
      message,
      code: ErrorsEnum.INVALID_TYPE_ERROR,
    });

  if (value === undefined) throw invalid(`"${field}" is required`);

  const parsed = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_QUANTITY) {
    throw invalid(`"${field}" must be an integer between 0 and ${MAX_QUANTITY}`);
  }
  return parsed;
};

const toSlug = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

// Sufijo aleatorio: el email es unique en el schema y un contador en memoria
// se reinicia con cada proceso (o worker de pm2), generando duplicados entre ejecuciones.
const generateUniqueEmail = (firstName, lastName) =>
  `${toSlug(firstName)}.${toSlug(lastName)}.${randomUUID().slice(0, 8)}@example.com`;

const buildUser = (password) => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    first_name: firstName,
    last_name: lastName,
    email: generateUniqueEmail(firstName, lastName),
    age: faker.number.int({ min: 18, max: 80 }),
    password,
    role: faker.helpers.arrayElement(['user', 'admin']),
    pets: [],
  };
};

// Usuario individual con password aleatoria en texto plano: lo consume /mock-user
// (artillery lo envía a /api/sessions/register, que se encarga del hash). Sin bcrypt a propósito.
export const generateUser = () => buildUser(faker.internet.password());

export const generatePet = () => {
  return {
    name: faker.person.firstName(),
    specie: faker.helpers.arrayElement(PET_SPECIES),
    birthDate: faker.date.past(),
    adopted: false,
  };
};

export const generatePets = (quantity) => {
  return Array.from({ length: quantity }, generatePet);
};

// Genera exactamente `quantity` usuarios con password "coder123" hasheada con el mismo
// createHash (bcrypt) que usa el registro real. Se hashea una sola vez por lote
// y se reutiliza: bcrypt es costoso y el valor lógico es idéntico para todos.
export const generateUsers = async (quantity) => {
  const hashedPassword = await createHash(MOCK_PASSWORD);
  return Array.from({ length: quantity }, () => buildUser(hashedPassword));
};
