const { z } = require('zod');
const { VEHICLE_TYPES, MAX_RIDE_DAYS_AHEAD } = require('../config/constants');

/**
 * POST /rides — create a new ride.
 *
 * Business rules enforced here (and re-checked in service):
 *  - date must not be in the past
 *  - date must not be more than MAX_RIDE_DAYS_AHEAD days ahead
 *  - time must be HH:MM 24-hour format
 *  - seats must be 1–10
 *  - from/to must be picked from the autosuggest dropdown (not free text)
 *  - pickup and destination must not be the same place name
 */
const createRideSchema = z
  .object({
    from          : z.string({ required_error: 'Pickup location is required' }).min(2).max(200).trim(),
    to            : z.string({ required_error: 'Destination is required' }).min(2).max(200).trim(),
    date          : z
      .string({ required_error: 'Date is required' })
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format. Use YYYY-MM-DD' }),
    time          : z
      .string({ required_error: 'Time is required' })
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM 24-hour format'),
    vehicleType   : z.enum(VEHICLE_TYPES, {
      required_error: 'Vehicle type is required',
      invalid_type_error: `Vehicle type must be one of: ${VEHICLE_TYPES.join(', ')}`,
    }),
    availableSeats: z
      .number({ required_error: 'Available seats is required', invalid_type_error: 'Seats must be a number' })
      .int('Seats must be a whole number')
      .min(1, 'At least 1 seat must be available')
      .max(10, 'Maximum 10 seats allowed'),
  })
  .superRefine((data, ctx) => {
    const now     = new Date();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + MAX_RIDE_DAYS_AHEAD);

    // Combine date + time for a precise future-check
    const [hours, minutes] = data.time.split(':').map(Number);
    const departure        = new Date(data.date);
    departure.setHours(hours, minutes, 0, 0);

    if (departure < now) {
      ctx.addIssue({
        code   : z.ZodIssueCode.custom,
        path   : ['date'],
        message: 'Ride date and time cannot be in the past',
      });
    }

    if (departure > maxDate) {
      ctx.addIssue({
        code   : z.ZodIssueCode.custom,
        path   : ['date'],
        message: `Ride can only be scheduled up to ${MAX_RIDE_DAYS_AHEAD} days in advance`,
      });
    }

    // Reject rides where pickup and destination are the same place name.
    if (data.from.trim().toLowerCase() === data.to.trim().toLowerCase()) {
      ctx.addIssue({
        code   : z.ZodIssueCode.custom,
        path   : ['to'],
        message: 'Pickup and destination cannot be the same place',
      });
    }
  });

/**
 * GET /rides — query parameters for searching/filtering rides.
 */
const findRideSchema = z.object({
  from       : z.string().trim().optional(),
  to         : z.string().trim().optional(),
  date       : z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' })
    .optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
  page       : z.coerce.number().int().min(1).default(1),
  limit      : z.coerce.number().int().min(1).max(50).default(10),
});

module.exports = { createRideSchema, findRideSchema };
