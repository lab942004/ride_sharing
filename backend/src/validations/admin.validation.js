const { z } = require('zod');

// ─── Reusable base fields ─────────────────────────────────────────────────────

// Every list endpoint destructures `limit` straight from req.query and passes
// it to Prisma's `take` uncapped. A `limit=100000` (or a load-test fuzzer, or
// a typo in a script) forces Postgres to materialize and serialize huge result
// sets. Coerce to a number and cap it — 100 is generous for an admin table view.
const paginationSchema = z
  .object({
    page : z.coerce.number().int('Page must be an integer').min(1, 'Page must be at least 1').default(1),
    limit: z.coerce
      .number()
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit cannot exceed 100')
      .default(10),
  })
  // List endpoints also read search/status/domain/action/etc. straight off
  // req.query — passthrough so those keep flowing to the service layer
  // instead of being stripped by the schema.
  .passthrough();

const adminRoleField = z.enum(['ADMIN', 'SUPER_ADMIN'], {
  invalid_type_error: 'Role must be either ADMIN or SUPER_ADMIN',
});

const strongPasswordField = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  );

const emailField = z.string({ required_error: 'Email is required' }).email('Please provide a valid email address').toLowerCase().trim();

const indianPhoneField = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian phone number')
  .optional()
  .nullable();

const uuidField = (label) => z.string({ required_error: `${label} is required` }).uuid(`Invalid ${label} format`);

// ─── Domains ──────────────────────────────────────────────────────────────────
const createDomainSchema = z.object({
  name       : z.string({ required_error: 'Domain name is required' }).min(3).max(255).trim(),
  description: z.string().max(500).trim().optional(),
  isActive   : z.boolean().optional(),
});

const updateDomainSchema = z
  .object({
    name       : z.string().min(3).max(255).trim().optional(),
    description: z.string().max(500).trim().optional(),
    isActive   : z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// ─── Admins ───────────────────────────────────────────────────────────────────
const createAdminSchema = z.object({
  name    : z.string({ required_error: 'Name is required' }).min(2).max(50).trim(),
  email   : emailField,
  password: strongPasswordField,
  phone   : indianPhoneField,
  role    : adminRoleField.optional(),
  domain  : z.string().max(255).trim().optional().nullable(),
});

const updateAdminSchema = z
  .object({
    name  : z.string().min(2).max(50).trim().optional(),
    phone : indianPhoneField,
    domain: z.string().max(255).trim().optional().nullable(),
    role  : adminRoleField.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

const resetAdminPasswordSchema = z.object({
  newPassword: strongPasswordField.optional(),
});

// ─── Users ────────────────────────────────────────────────────────────────────
const createUserSchema = z.object({
  name          : z.string({ required_error: 'Name is required' }).min(2).max(50).trim(),
  identifier    : z.string({ required_error: 'Identifier is required' }).min(3).max(20).trim(),
  identifierType: z.enum(['SEQUENCE', 'ROLL_OR_EMP_ID']).optional(),
  accountType   : z.enum(['ORGANIZATION', 'GENERAL']).optional(),
  email         : emailField,
  password      : strongPasswordField,
  phone         : indianPhoneField,
  domain        : z.string({ required_error: 'Domain is required' }).max(255).trim(),
  isVerified    : z.boolean().optional(),
});

// ─── Notifications ────────────────────────────────────────────────────────────
const sendNotificationSchema = z.object({
  userId : uuidField('User ID'),
  title  : z.string({ required_error: 'Title is required' }).min(1).max(200).trim(),
  content: z.string({ required_error: 'Content is required' }).min(1).max(2000).trim(),
});

const sendBulkNotificationsSchema = z.object({
  userIds: z
    .array(z.string().uuid('Each user ID must be a valid UUID'), { required_error: 'User IDs are required' })
    .min(1, 'At least one user ID is required')
    // Hard cap matches the service-layer guard (defense in depth) — keeps a
    // single request from fanning out to an unbounded number of createMany rows.
    .max(500, 'Cannot notify more than 500 users in a single request'),
  title  : z.string({ required_error: 'Title is required' }).min(1).max(200).trim(),
  content: z.string({ required_error: 'Content is required' }).min(1).max(2000).trim(),
});

// ─── Announcements ────────────────────────────────────────────────────────────
const createAnnouncementSchema = z.object({
  title      : z.string({ required_error: 'Title is required' }).min(1).max(200).trim(),
  content    : z.string({ required_error: 'Content is required' }).min(1).max(5000).trim(),
  type       : z.enum(['GLOBAL', 'DOMAIN', 'SCHEDULED']).optional(),
  status     : z.enum(['ACTIVE', 'INACTIVE', 'SCHEDULED']).optional(),
  domain     : z.string().max(255).trim().optional().nullable(),
  scheduledAt: z.coerce.date().optional(),
});

const updateAnnouncementSchema = z
  .object({
    title      : z.string().min(1).max(200).trim().optional(),
    content    : z.string().min(1).max(5000).trim().optional(),
    type       : z.enum(['GLOBAL', 'DOMAIN', 'SCHEDULED']).optional(),
    status     : z.enum(['ACTIVE', 'INACTIVE', 'SCHEDULED']).optional(),
    domain     : z.string().max(255).trim().optional().nullable(),
    scheduledAt: z.coerce.date().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// ─── Home management (banners / carousel / featured cards) ───────────────────
const homeItemBase = {
  title   : z.string({ required_error: 'Title is required' }).min(1).max(200).trim(),
  imageUrl: z.string({ required_error: 'Image URL is required' }).url('Must be a valid URL').max(1000),
  linkUrl : z.string().url('Must be a valid URL').max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  order   : z.coerce.number().int().min(0).max(10000).optional(),
};

const createBannerSchema = z.object({
  ...homeItemBase,
  subtitle: z.string().max(300).trim().optional().nullable(),
  domain  : z.string().max(255).trim().optional().nullable(),
});

const updateBannerSchema = z
  .object({
    title   : homeItemBase.title.optional(),
    subtitle: z.string().max(300).trim().optional().nullable(),
    imageUrl: homeItemBase.imageUrl.optional(),
    linkUrl : homeItemBase.linkUrl,
    isActive: homeItemBase.isActive,
    order   : homeItemBase.order,
    domain  : z.string().max(255).trim().optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

const createCarouselItemSchema = z.object({
  ...homeItemBase,
  subtitle: z.string().max(300).trim().optional().nullable(),
});

const updateCarouselItemSchema = z
  .object({
    title   : homeItemBase.title.optional(),
    subtitle: z.string().max(300).trim().optional().nullable(),
    imageUrl: homeItemBase.imageUrl.optional(),
    linkUrl : homeItemBase.linkUrl,
    isActive: homeItemBase.isActive,
    order   : homeItemBase.order,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

const createFeaturedCardSchema = z.object({
  title      : homeItemBase.title,
  description: z.string().max(500).trim().optional().nullable(),
  icon       : z.string().max(100).trim().optional().nullable(),
  linkUrl    : homeItemBase.linkUrl,
  isActive   : homeItemBase.isActive,
  order      : homeItemBase.order,
});

const updateFeaturedCardSchema = z
  .object({
    title      : homeItemBase.title.optional(),
    description: z.string().max(500).trim().optional().nullable(),
    icon       : z.string().max(100).trim().optional().nullable(),
    linkUrl    : homeItemBase.linkUrl,
    isActive   : homeItemBase.isActive,
    order      : homeItemBase.order,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'At least one field must be provided' });

// ─── System settings ──────────────────────────────────────────────────────────
const updateSystemSettingSchema = z.object({
  value: z.string({ required_error: 'Value is required' }).max(5000),
});

// ─── Storage ──────────────────────────────────────────────────────────────────
const cleanupStorageSchema = z.object({
  daysOld: z.coerce.number().int().min(1).max(3650).optional(),
});

module.exports = {
  paginationSchema,
  createDomainSchema,
  updateDomainSchema,
  createAdminSchema,
  updateAdminSchema,
  resetAdminPasswordSchema,
  createUserSchema,
  sendNotificationSchema,
  sendBulkNotificationsSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  createBannerSchema,
  updateBannerSchema,
  createCarouselItemSchema,
  updateCarouselItemSchema,
  createFeaturedCardSchema,
  updateFeaturedCardSchema,
  updateSystemSettingSchema,
  cleanupStorageSchema,
};
