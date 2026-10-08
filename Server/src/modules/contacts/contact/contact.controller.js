import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import contactService from './contact.service.js';
import notificationEvents from '../../notifications/notification.events.js';

const createContact = asyncHandler(async (req, res) => {
  const contact = await contactService.create(req.user.id, req.body);
  res.status(201).json(new ApiResponse(201, contact, 'Contact created successfully'));
});

const getContacts = asyncHandler(async (req, res) => {
  const result = await contactService.list(req.user.id, req.query);
  res.status(200).json(new ApiResponse(200, result, 'Contacts fetched successfully'));
});

const getContact = asyncHandler(async (req, res) => {
  const contact = await contactService.getById(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, contact, 'Contact fetched successfully'));
});

const updateContact = asyncHandler(async (req, res) => {
  const contact = await contactService.update(req.user.id, req.params.id, req.body);
  res.status(200).json(new ApiResponse(200, contact, 'Contact updated successfully'));
});

const deleteContact = asyncHandler(async (req, res) => {
  await contactService.remove(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, null, 'Contact deleted successfully'));
});

const importContacts = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'CSV file is required (multipart form field name: "file")');
  }
  const result = await contactService.importFromCsv(req.user.id, req.file.buffer);

  notificationEvents.contactImportCompleted(req.user.id, result);

  res.status(200).json(new ApiResponse(200, result, 'Import completed'));
});

const exportContacts = asyncHandler(async (req, res) => {
  const csv = await contactService.exportToCsv(req.user.id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
  res.status(200).send(csv);
});

export {
  createContact,
  getContacts,
  getContact,
  updateContact,
  deleteContact,
  importContacts,
  exportContacts,
};
