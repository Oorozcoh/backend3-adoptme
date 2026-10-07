import { Router } from 'express';
import compression from 'compression';
import {
  generateUser,
  generatePets,
  generateUsers,
  parseQuantity,
  DEFAULT_QUANTITY,
} from '../mocks/mocking.module.js';
import { usersService, petsService } from '../services/index.js';
import CustomError from '../errors/CustomError.js';
import ErrorsEnum from '../errors/enum.js';

const router = Router();

// ?quantity opcional: si no viene, se usa el valor por defecto (50).
const getQueryQuantity = (query) =>
  query.quantity === undefined ? DEFAULT_QUANTITY : parseQuantity(query.quantity);

router.get('/mockingpets', compression(), async (req, res, next) => {
  try {
    const pets = generatePets(getQueryQuantity(req.query));
    res.send({ status: 'success', payload: pets });
  } catch (error) {
    next(error);
  }
});

// Solo genera y devuelve usuarios (no los persiste).
router.get('/mockingusers', compression(), async (req, res, next) => {
  try {
    const users = await generateUsers(getQueryQuantity(req.query));
    res.send({ status: 'success', payload: users });
  } catch (error) {
    next(error);
  }
});

router.get('/mock-user', async (req, res) => {
  const user = generateUser();
  res.json({ status: 'success', user });
});

// Body: { "users": <entero>, "pets": <entero> }. Ambos obligatorios; 0 es válido.
// Inserta en MongoDB a través de los services existentes (Model.create acepta arrays).
router.post('/generateData', async (req, res, next) => {
  try {
    const { users, pets } = req.body ?? {};
    const usersQuantity = parseQuantity(users, 'users');
    const petsQuantity = parseQuantity(pets, 'pets');

    // Se genera todo antes de tocar la DB: si algo falla acá no se inserta nada.
    const generatedUsers = await generateUsers(usersQuantity);
    const generatedPets = generatePets(petsQuantity);

    let createdUsers = [];
    let createdPets = [];
    try {
      if (usersQuantity > 0) createdUsers = await usersService.create(generatedUsers);
      if (petsQuantity > 0) createdPets = await petsService.create(generatedPets);
    } catch (error) {
      throw CustomError.createError({
        name: 'MockDataPersistenceError',
        cause: error.message,
        message: 'Error inserting generated data',
        code: ErrorsEnum.DATABASE_ERROR,
      });
    }

    res.status(201).send({
      status: 'success',
      message: 'Data generated successfully',
      users: createdUsers.length,
      pets: createdPets.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
