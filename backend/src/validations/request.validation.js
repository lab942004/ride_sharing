const { z } = require('zod');

/**
 * POST /requests — send a ride request.
 */
const createRequestSchema = z.object({
  rideId: z
    .string({ required_error: 'Ride ID is required' })
    .uuid('Invalid ride ID format'),
});

/**
 * PATCH /requests/:id — accept or reject a request.
 */
const updateRequestSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED'], {
    required_error  : 'Status is required',
    invalid_type_error: 'Status must be either ACCEPTED or REJECTED',
  }),
});

/**
 * POST /chats/:requestId/messages — send a chat message.
 */
const sendMessageSchema = z.object({
  text: z
    .string({ required_error: 'Message text is required' })
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message cannot exceed 1000 characters')
    .trim(),
});

/**
 * PATCH /profile — update profile.
 */
const updateProfileSchema = z
  .object({
    name      : z.string().min(2, 'Name must be at least 2 characters').max(50).trim().optional(),
    phone     : z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian phone number')
      .optional()
      .nullable(),
    profilePic: z.string().optional(),
  })
  .refine((data) => data.name !== undefined || data.phone !== undefined || data.profilePic !== undefined, {
    message: 'At least one profile field must be provided',
  });

/**
 * PATCH /profile/change-password
 */
const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: 'Current password is required' })
      .max(128, 'Current password must not exceed 128 characters'),
    newPassword    : z
      .string({ required_error: 'New password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(128)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: z.string({ required_error: 'Please confirm your new password' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path   : ['confirmPassword'],
  });

module.exports = {
  createRequestSchema,
  updateRequestSchema,
  sendMessageSchema,
  updateProfileSchema,
  changePasswordSchema,
};
