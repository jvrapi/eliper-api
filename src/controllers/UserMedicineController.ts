import { Request, Response } from 'express';
import moment from 'moment';
import { getRepository } from 'typeorm';
import * as Yup from 'yup';

import handleErrors from '../errors';
import UserDisease from '../models/UserDisease';
import UserMedicine from '../models/UserMedicine';
import UserMedicineView from '../views/UserMedicineView';

const userMedicineView = new UserMedicineView();

class UserMedicineController {
	async list(request: Request, response: Response) {
		const { id } = request.params;

		const requestUserId = request.userId;

		const repository = getRepository(UserMedicine);
		const schema = Yup.string()
			.uuid('Id informado inválido')
			.required('Informe o id');

		try {
			await schema.validate(id, { abortEarly: false });

			if (id !== requestUserId) {
				return response
					.status(401)
					.json({ message: 'Você não possui acesso a essas informações' });
			}

			const medicines = await repository
				.createQueryBuilder('um')
				.leftJoinAndSelect('um.medicine', 'm')
				.leftJoinAndSelect('um.userDisease', 'ud')
				.leftJoinAndSelect('ud.disease', 'd')
				.where(`ud.userId = '${id}'`)
				.getMany();

			return response.json(userMedicineView.list(medicines));
		} catch (error) {
			handleErrors(
				error,
				response,
				'Erro ao tentar listar os medicamentos do usuário'
			);
		}
	}

	async getById(request: Request, response: Response) {
		const { id } = request.params;
		const requestUserId = request.userId;
		const repository = getRepository(UserMedicine);

		const schema = Yup.string()
			.uuid('Id informado inválido')
			.required('Informe o id ');

		try {
			await schema.validate(id, { abortEarly: false });

			const userMedicine = await repository.findOne({
				where: { id },
				relations: ['medicine', 'userDisease', 'userDisease.disease'],
			});

			if (userMedicine?.userDisease.userId !== requestUserId) {
				return response
					.status(401)
					.json({ message: 'Você não possui acesso a essas informações' });
			}

			return response.json(userMedicineView.details(userMedicine));
		} catch (error) {
			handleErrors(error, response, 'Erro ao tentar listar as informações');
		}
	}

	async saveMany(request: Request, response: Response) {
		const userMedicines: UserMedicine[] = request.body;
		const requestUserId = request.userId;
		const repository = getRepository(UserMedicine);
		const userDiseaseRepository = getRepository(UserDisease);

		const schema = Yup.array()
			.min(1, 'Informe pelo menos um medicamento que o usuario toma')
			.of(
				Yup.object().shape({
					userDiseaseId: Yup.string()
						.uuid('Id informado inválido')
						.required('Informe o id da doença do usuario'),

					medicineId: Yup.string()
						.uuid()
						.required('Informe o nome da medicação'),

					amount: Yup.string().required('Informe a quantidade tomada'),

					instruction: Yup.string().required(
						'Informe como você deve tomar o medicamento'
					),

					beginDate: Yup.string()
						.required('Informe a data em que começou a tomar esse medicamento')
						.test('date-validation', 'Data não é valida', (date) => {
							const dateIsValid = moment(
								moment(date).toDate(),
								'YYYY-MM-DDThh:mm:ssZ',
								true
							).isValid();
							return dateIsValid;
						}),

					endDate: Yup.string()
						.nullable()
						.test('date-validation', 'Data não é valida', (date) => {
							if (date) {
								const dateIsValid = moment(
									moment(date).toDate(),
									'YYYY-MM-DDThh:mm:ssZ',
									true
								).isValid();
								return dateIsValid;
							}
							return true;
						}),
				})
			);
		try {
			await schema.validate(userMedicines, { abortEarly: false });

			const userMedicinesSaved = await Promise.all(
				userMedicines.map(async (userMedicine) => {
					const dbInfo = await userDiseaseRepository.findOne({
						id: userMedicine.userDiseaseId,
					});

					if (dbInfo?.userId !== requestUserId) {
						return response.json({
							message: 'Não não pode realizar essa operação',
						});
					}
					const data = {
						userDiseaseId: userMedicine.userDiseaseId,
						medicineId: userMedicine.medicineId,
						amount: userMedicine.amount,
						beginDate: moment(userMedicine.beginDate).toDate(),
						endDate: userMedicine.endDate
							? moment(userMedicine.endDate).toDate()
							: null,
						instruction: userMedicine.instruction,
					};

					const saveUserMedicine = repository.create(data);

					await repository.save(saveUserMedicine);

					return saveUserMedicine;
				})
			);
			return response.status(201).json(userMedicinesSaved);
		} catch (error) {
			handleErrors(error, response, 'Erro ao salvar as medicamentos');
		}
	}

	async update(request: Request, response: Response) {
		const {
			id,
			amount,
			instruction,
			beginDate,
			endDate,
			userDiseaseId,
			medicineId,
		} = request.body;

		const requestUserId = request.userId;

		const repository = getRepository(UserMedicine);

		const userDiseaseRepository = getRepository(UserDisease);

		const schema = Yup.object().shape({
			id: Yup.string()
				.uuid()
				.required('Informe o id da relação entre usuario e medicamento'),

			userDiseaseId: Yup.string().uuid().required('Informe o id da doença'),

			medicineId: Yup.string().uuid().required('Informe o id do medicamento'),

			amount: Yup.string().required('Informe a quantidade que você toma'),

			instruction: Yup.string().required(
				'Informe como você toma o medicamento'
			),

			beginDate: Yup.string()
				.nullable()
				.required('Informe quando começou a tomar o medicamento')
				.test('date-validation', 'Data não é valida', (date) => {
					const dateIsValid = moment(
						new Date(date as string),
						'YYYY-MM-DDThh:mm:ssZ',
						true
					).isValid();
					return dateIsValid;
				}),

			endDate: Yup.string()
				.nullable()
				.test('date-validation', 'Data não é valida', (date) => {
					const dateIsValid = moment(
						new Date(date as string),
						'YYYY-MM-DDThh:mm:ssZ',
						true
					).isValid();
					return dateIsValid;
				}),
		});

		const data = {
			id,
			amount,
			instruction,
			beginDate,
			endDate,
			userDiseaseId,
			medicineId,
		};

		try {
			await schema.validate(data, { abortEarly: false });

			const userDiseaseInfo = await userDiseaseRepository.findOne({
				id: userDiseaseId,
			});

			if (userDiseaseInfo?.userId !== requestUserId) {
				return response
					.status(401)
					.json({ message: 'Você não pode atualizar esses dados' });
			}

			data.beginDate = moment(beginDate).toDate();
			data.endDate = data.endDate ? moment(endDate).toDate() : null;

			const userMedicine = repository.create(data);

			await repository.save(userMedicine);

			const userMedicineResponse = await repository.findOne({
				where: { id: userMedicine.id },
				relations: ['medicine', 'userDisease', 'userDisease.disease'],
			});

			return response.json(
				userMedicineView.details(userMedicineResponse as UserMedicine)
			);
		} catch (error) {
			handleErrors(error, response, 'Erro ao atualizar os medicamentos');
		}
	}

	async delete(request: Request, response: Response) {
		const { id } = request.params;
		const requestUserId = request.userId;
		const repository = getRepository(UserMedicine);
		const schema = Yup.string()
			.uuid()
			.required('Informe id do medicamento do usuario que deseja excluir');

		try {
			await schema.validate(id, { abortEarly: false });

			const dbInfo = await repository.findOne({
				where: { id },
				relations: ['userDisease'],
			});

			if (dbInfo?.userDisease.userId !== requestUserId) {
				return response
					.status(401)
					.json({ message: 'Você não pode atualizar esses dados' });
			}
			await repository.delete(id);

			return response.json({ message: 'medicamento excluído com sucesso' });
		} catch (error) {
			handleErrors(
				error,
				response,
				'Erro ao tentar excluir o medicamento do usuario'
			);
		}
	}

	async deleteMany(request: Request, response: Response) {
		const userMedicineIds: string[] = request.body;

		const requestUserId = request.userId;

		const repository = getRepository(UserMedicine);

		const schema = Yup.array()
			.min(1, "Informe uma lista com os ID's das doenças")
			.of(Yup.string().uuid('Id informado inválido').required('Informe o id '));

		try {
			await schema.validate(userMedicineIds, { abortEarly: false });

			const res = await Promise.all(
				userMedicineIds.map(async (userMedicine) => {
					const dbInfo = await repository.findOne({
						where: { id: userMedicine },
						relations: ['medicine', 'userDisease'],
					});

					const res: Record<string, string> = {};

					if (dbInfo?.userDisease.userId !== requestUserId) {
						res[dbInfo?.medicine.name as string] =
							'Você não pode excluir esse item';
					} else {
						await repository.delete(userMedicine);
						res[dbInfo?.medicine.name as string] =
							'Medicamento excluído com sucesso';
					}

					return res;
				})
			);
			return response.json(res);
		} catch (error) {
			return handleErrors(
				error,
				response,
				'Erro ao excluir os medicamentos do usuário'
			);
		}
	}
}

export default UserMedicineController;
