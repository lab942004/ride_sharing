require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcryptjs');
const { generateSecurePassword } = require('../src/utils/password.utils');

const prisma = new PrismaClient();

/**
 * SECURITY NOTE
 * ─────────────
 * This script is for LOCAL DEVELOPMENT ONLY. It refuses to run when
 * NODE_ENV=production, because seed scripts are a common source of
 * accidental backdoor accounts if ever pointed at a real database
 * (e.g. via a post-deploy hook).
 *
 * It never hardcodes credentials. Every account gets a fresh,
 * cryptographically-random password that is printed to the console exactly
 * once. Store it somewhere safe (a password manager) or change it
 * immediately after first login — it is not saved anywhere by this script.
 */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run prisma/seed.js with NODE_ENV=production.');
    console.error('   Seed data (including admin accounts) must never be created this way in production.');
    process.exit(1);
  }

  console.log('🌱 Seeding local development database…\n');

  const generatedCredentials = [];

  const seedDomainName = (process.env.SEED_ADMIN_DOMAIN || 'nitkkr.ac.in').trim().toLowerCase();
  const seedAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL || 'ankit238219@gmail.com';

  // ── Domain (super admin must have at least one allowed domain to manage) ──
  await prisma.domain.upsert({
    where : { name: seedDomainName },
    update: {},
    create: {
      name       : seedDomainName,
      description: 'Seeded local development domain',
      isActive   : true,
    },
  });
  console.log(`   🌐 Domain: ${seedDomainName} (active)`);

  // ── Super Admin ─────────────────────────────────────────────────────────
  const superAdminPassword = generateSecurePassword();
  const hashedAdminPassword = await bcrypt.hash(superAdminPassword, 12);
  await prisma.admin.upsert({
    where : { email: seedAdminEmail },
    update: { password: hashedAdminPassword },
    create: {
      name    : 'Super Admin',
      email   : seedAdminEmail,
      password: hashedAdminPassword,
      role    : 'SUPER_ADMIN',
      status  : 'ACTIVE',
    },
  });
  generatedCredentials.push({ role: 'SUPER_ADMIN', email: seedAdminEmail, password: superAdminPassword });

  // ── Two test students (only if you want sample data to click around) ────
  if (process.env.SEED_SAMPLE_DATA !== 'false') {
    const studentPassword = generateSecurePassword();
    const hashedStudentPassword = await bcrypt.hash(studentPassword, 12);

    const user1 = await prisma.user.upsert({
      where : { email: `student1@${seedDomainName}` },
      update: {},
      create: {
        name      : 'Rahul Sharma',
        rollNo    : '21CS001',
        email     : `student1@${seedDomainName}`,
        password  : hashedStudentPassword,
        phone     : '9876543210',
        domain    : seedDomainName,
        isVerified: true,
      },
    });
    generatedCredentials.push({ role: 'STUDENT', email: `student1@${seedDomainName}`, password: studentPassword });

    await prisma.user.upsert({
      where : { email: `student2@${seedDomainName}` },
      update: {},
      create: {
        name      : 'Priya Singh',
        rollNo    : '21EC042',
        email     : `student2@${seedDomainName}`,
        password  : hashedStudentPassword,
        phone     : '9123456789',
        domain    : seedDomainName,
        isVerified: true,
      },
    });
    generatedCredentials.push({ role: 'STUDENT', email: `student2@${seedDomainName}`, password: studentPassword });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    await prisma.ride.upsert({
      where : { id: 'seed-ride-001' },
      update: {},
      create: {
        id            : 'seed-ride-001',
        from          : `${seedDomainName.split('.')[0].toUpperCase()} Campus`,
        to            : 'City Center',
        fromLat       : 29.9457,
        fromLng       : 76.8172,
        toLat         : 29.9639,
        toLng         : 76.8481,
        date          : tomorrow,
        time          : '08:30',
        vehicleType   : 'Car',
        availableSeats: 3,
        domain        : seedDomainName,
        createdById   : user1.id,
      },
    });
  }

  console.log('\n✅ Seed complete! Generated credentials (shown once — save them now):\n');
  for (const c of generatedCredentials) {
    console.log(`   ${c.role.padEnd(11)} ${c.email}  /  ${c.password}`);
  }
  console.log('\n⚠️  These are LOCAL DEV credentials only. Never reuse them anywhere real.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
