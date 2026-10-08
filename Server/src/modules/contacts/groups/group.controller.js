import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import groupService from './group.service.js';

const createGroup = asyncHandler(async (req, res) => {
  const group = await groupService.create(req.user.id, req.body);
  res.status(201).json(new ApiResponse(201, group, 'Group created successfully'));
});

const getGroups = asyncHandler(async (req, res) => {
  const result = await groupService.list(req.user.id, req.query);
  res.status(200).json(new ApiResponse(200, result, 'Groups fetched successfully'));
});

const getGroup = asyncHandler(async (req, res) => {
  const group = await groupService.getById(req.user.id, req.params.id, req.query);
  res.status(200).json(new ApiResponse(200, group, 'Group fetched successfully'));
});

const updateGroup = asyncHandler(async (req, res) => {
  const group = await groupService.update(req.user.id, req.params.id, req.body);
  res.status(200).json(new ApiResponse(200, group, 'Group updated successfully'));
});

const deleteGroup = asyncHandler(async (req, res) => {
  await groupService.remove(req.user.id, req.params.id);
  res.status(200).json(new ApiResponse(200, null, 'Group deleted successfully'));
});

const getMembers = asyncHandler(async (req, res) => {
  const result = await groupService.listMembers(
    req.user.id,
    req.params.id,
    req.query,
  );
  res.status(200).json(new ApiResponse(200, result, 'Members fetched successfully'));
});

const getAvailableContacts = asyncHandler(async (req, res) => {
  const result = await groupService.listAvailableContacts(
    req.user.id,
    req.params.id,
    req.query,
  );
  res
    .status(200)
    .json(new ApiResponse(200, result, 'Available contacts fetched successfully'));
});

const addMembers = asyncHandler(async (req, res) => {
  const result = await groupService.addContacts(
    req.user.id,
    req.params.id,
    req.body,
  );
  const message =
    result.added === 0
      ? 'No new contacts were added'
      : `${result.added} contact(s) added to group`;
  res.status(200).json(new ApiResponse(200, result, message));
});

const removeMembers = asyncHandler(async (req, res) => {
  const result = await groupService.removeContacts(
    req.user.id,
    req.params.id,
    req.body,
  );
  res
    .status(200)
    .json(
      new ApiResponse(200, result, `${result.removed} contact(s) removed from group`),
    );
});

const assignContact = asyncHandler(async (req, res) => {
  const { groupId, contactId } = req.params;
  const membership = await groupService.assignContact(req.user.id, groupId, contactId);
  res.status(201).json(new ApiResponse(201, membership, 'Contact assigned to group successfully'));
});

const removeContact = asyncHandler(async (req, res) => {
  const { groupId, contactId } = req.params;
  await groupService.removeContact(req.user.id, groupId, contactId);
  res.status(200).json(new ApiResponse(200, null, 'Contact removed from group successfully'));
});

export {
  createGroup,
  getGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  getMembers,
  getAvailableContacts,
  addMembers,
  removeMembers,
  assignContact,
  removeContact,
};