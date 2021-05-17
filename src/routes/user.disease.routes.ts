import { Router } from 'express';

import UserDiseaseController from '../controllers/UserDiseaseController';

const routes = Router();
const userDiseaseController = new UserDiseaseController();

routes.get('/:userId', userDiseaseController.list);
routes.get('/unrecordedDiseases/:id', userDiseaseController.unrecordedDiseases);
routes.get('/details/:id', userDiseaseController.getById);
routes.post('/saveMany', userDiseaseController.saveMany);
routes.delete('/:id', userDiseaseController.delete);
routes.delete('/', userDiseaseController.deleteMany);
export default routes;
