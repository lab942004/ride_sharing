const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { invalidateDomainCache } = require('../utils/domain.utils');
const { generateSecurePassword } = require('../utils/password.utils');

const DOMAIN_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

const appError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const normalizeDomainName = (name) => {
  const normalized = String(name || '').trim().toLowerCase();
  console.log('[domain debug] raw:', JSON.stringify(name), 'normalized:', JSON.stringify(normalized), 'pass:', DOMAIN_NAME_REGEX.test(normalized));
  if (!DOMAIN_NAME_REGEX.test(normalized)) {
    throw appError('Invalid domain name. Use a bare domain like "college.ac.in" (no @, no protocol, no path).', 400);
  }
  return normalized;
};

class AdminService {
  // ─── Dashboard ──────────────────────────────────────────────────────────────
  async getAdminDashboard(admin) {
    const isSuperAdmin = admin.role === 'SUPER_ADMIN';
    const domainWhere = isSuperAdmin ? {} : { domain: admin.domain };
    const [totalUsers, activeUsers, totalRides, pendingRequests, totalAdmins, totalDomains, totalChats] =
      await Promise.all([
        prisma.user.count({ where: domainWhere }),
        prisma.user.count({ where: { ...domainWhere, isVerified: true, isSuspended: false, isBanned: false } }),
        prisma.ride.count({ where: domainWhere }),
        !isSuperAdmin && admin.domain
          ? prisma.request.count({ where: { ride: { domain: admin.domain }, status: 'PENDING' } })
          : prisma.request.count({ where: { status: 'PENDING' } }),
        isSuperAdmin ? prisma.admin.count() : Promise.resolve(0),
        isSuperAdmin ? prisma.domain.count() : Promise.resolve(0),
        !isSuperAdmin && admin.domain
          ? prisma.chat.count({ where: { request: { ride: { domain: admin.domain } } } })
          : prisma.chat.count(),
      ]);

    // Today's rides
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayRides = await prisma.ride.count({
      where: { ...domainWhere, date: { gte: today, lt: tomorrow } },
    });

    // Domain-specific counts for admin
    let domainStats = null;
    if (!isSuperAdmin && admin.domain) {
      const domainUserCount = await prisma.user.count({ where: { domain: admin.domain } });
      const domainRideCount = await prisma.ride.count({ where: { domain: admin.domain } });
      domainStats = { name: admin.domain, users: domainUserCount, rides: domainRideCount };
    }

    // Global stats for super admin
    let globalStats = null;
    if (isSuperAdmin) {
      const domains = await prisma.domain.findMany({ where: { isActive: true } });
      const domainStatsArr = await Promise.all(
        domains.map(async (d) => ({
          name: d.name,
          users: await prisma.user.count({ where: { domain: d.name } }),
          rides: await prisma.ride.count({ where: { domain: d.name } }),
        }))
      );
      globalStats = { domains: domainStatsArr };
    }

    // Recent activity
    const recentActivity = await prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    return {
      stats: {
        totalUsers,
        activeUsers,
        totalRides,
        todayRides,
        pendingRequests,
        totalAdmins,
        totalDomains,
        totalChats,
      },
      domainStats,
      globalStats,
      recentActivity,
    };
  }

  // ─── Domain Management ──────────────────────────────────────────────────────
  async getDomains() {
    const domains = await prisma.domain.findMany({
      orderBy: { name: 'asc' },
    });
    const domainsWithCounts = await Promise.all(
      domains.map(async (d) => ({
        ...d,
        userCount: await prisma.user.count({ where: { domain: d.name } }),
        rideCount: await prisma.ride.count({ where: { domain: d.name } }),
        adminCount: await prisma.admin.count({ where: { domain: d.name } }),
      }))
    );
    return { domains: domainsWithCounts };
  }

  async createDomain(data) {
    const name = normalizeDomainName(data.name);

    const existing = await prisma.domain.findUnique({ where: { name } });
    if (existing) throw appError('This domain already exists', 409);

    const domain = await prisma.domain.create({
      data: { name, description: data.description || '', isActive: data.isActive !== false },
    });

    // Take effect immediately for send-otp/register checks — do not wait
    // for the cache TTL to expire.
    invalidateDomainCache();

    return { domain };
  }

  async updateDomain(id, data) {
    const updateData = {};
    if (data.name !== undefined) updateData.name = normalizeDomainName(data.name);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    if (updateData.name) {
      const existing = await prisma.domain.findFirst({ where: { name: updateData.name, NOT: { id } } });
      if (existing) throw appError('Another domain with this name already exists', 409);
    }

    const domain = await prisma.domain.update({ where: { id }, data: updateData });

    invalidateDomainCache();

    return { domain };
  }

  async deleteDomain(id) {
    const domain = await prisma.domain.findUnique({ where: { id } });
    if (!domain) throw Object.assign(new Error('Domain not found'), { statusCode: 404 });
    const userCount = await prisma.user.count({ where: { domain: domain.name } });
    if (userCount > 0) {
      throw Object.assign(new Error('Cannot delete domain with associated users. Transfer users first.'), { statusCode: 400 });
    }
    await prisma.domain.delete({ where: { id } });

    invalidateDomainCache();
  }

  // ─── Admin Management ───────────────────────────────────────────────────────
  async getAdmins(query) {
    const { page = 1, limit = 10, search, status, role } = query;
    const skip = (page - 1) * limit;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (role) where.role = role;

    const [admins, total] = await Promise.all([
      prisma.admin.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, phone: true, role: true,
          status: true, domain: true, profilePic: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.admin.count({ where }),
    ]);

    return { admins, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } };
  }

  async createAdmin(data, creator) {
    const existing = await prisma.admin.findUnique({ where: { email: data.email } });
    if (existing) throw Object.assign(new Error('Admin with this email already exists'), { statusCode: 400 });

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const admin = await prisma.admin.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        phone: data.phone || null,
        role: data.role || 'ADMIN',
        domain: data.domain || null,
        createdById: creator.id,
      },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        status: true, domain: true, createdAt: true,
      },
    });

    await this._logActivity('ADMIN_CREATED', 'Admin', admin.id, creator, { email: admin.email, role: admin.role });

    return { admin, temporaryPassword: data.password };
  }

  async updateAdmin(id, data, updater) {
    const admin = await prisma.admin.findUnique({ where: { id } });
    if (!admin) throw Object.assign(new Error('Admin not found'), { statusCode: 404 });

    const updateData = {};
    if (data.name) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.domain !== undefined) updateData.domain = data.domain;
    if (data.role) updateData.role = data.role;

    const updated = await prisma.admin.update({
      where: { id },
      data: updateData,
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        status: true, domain: true, updatedAt: true,
      },
    });

    await this._logActivity('ADMIN_UPDATED', 'Admin', id, updater, { changes: updateData });
    return { admin: updated };
  }

  async deleteAdmin(id, deleter) {
    const admin = await prisma.admin.findUnique({ where: { id } });
    if (!admin) throw Object.assign(new Error('Admin not found'), { statusCode: 404 });
    if (id === deleter.id) throw Object.assign(new Error('Cannot delete your own account'), { statusCode: 400 });

    await prisma.adminRefreshToken.deleteMany({ where: { adminId: id } });
    await prisma.admin.delete({ where: { id } });
    await this._logActivity('ADMIN_DELETED', 'Admin', id, deleter, { email: admin.email });
  }

  async suspendAdmin(id, suspender) {
    const admin = await prisma.admin.findUnique({ where: { id } });
    if (!admin) throw Object.assign(new Error('Admin not found'), { statusCode: 404 });
    if (admin.role === 'SUPER_ADMIN') throw Object.assign(new Error('Cannot suspend super admin'), { statusCode: 400 });

    const updated = await prisma.admin.update({
      where: { id },
      data: { status: 'SUSPENDED' },
      select: { id: true, name: true, email: true, status: true },
    });

    await prisma.adminRefreshToken.updateMany({
      where: { adminId: id, isRevoked: false },
      data: { isRevoked: true },
    });

    await this._logActivity('ADMIN_SUSPENDED', 'Admin', id, suspender, { email: admin.email });
    return { admin: updated };
  }

  async activateAdmin(id, activator) {
    const updated = await prisma.admin.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: { id: true, name: true, email: true, status: true },
    });
    await this._logActivity('ADMIN_ACTIVATED', 'Admin', id, activator, { email: updated.email });
    return { admin: updated };
  }

  async resetAdminPassword(id, reseter, newPassword) {
    const admin = await prisma.admin.findUnique({ where: { id } });
    if (!admin) throw Object.assign(new Error('Admin not found'), { statusCode: 404 });

    const password = newPassword || generateSecurePassword();
    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.admin.update({ where: { id }, data: { password: hashedPassword } });
    await prisma.adminRefreshToken.updateMany({
      where: { adminId: id, isRevoked: false },
      data: { isRevoked: true },
    });

    await this._logActivity('ADMIN_PASSWORD_RESET', 'Admin', id, reseter, { email: admin.email });
    return { temporaryPassword: password };
  }

  // ─── User Management ────────────────────────────────────────────────────────
  async getUsers(query, admin) {
    const { page = 1, limit = 10, search, status, domain: filterDomain } = query;
    const skip = (page - 1) * limit;

    const where = {};
    if (admin.role !== 'SUPER_ADMIN' && admin.domain) {
      where.domain = admin.domain;
    }
    if (filterDomain && admin.role === 'SUPER_ADMIN') {
      where.domain = filterDomain;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { rollNo: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status === 'suspended') where.isSuspended = true;
    else if (status === 'banned') where.isBanned = true;
    else if (status === 'active') where.isVerified = true;
    else if (status === 'unverified') where.isVerified = false;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, rollNo: true, phone: true,
          domain: true, isVerified: true, isBanned: true, isSuspended: true, isMuted: true,
          profilePic: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } };
  }

  async getUserById(id, admin) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, rollNo: true, phone: true,
        domain: true, isVerified: true, isBanned: true, isSuspended: true, isMuted: true,
        profilePic: true, createdAt: true, updatedAt: true,
        _count: { select: { rides: true, sentRequests: true, messages: true } },
      },
    });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== user.domain) {
      throw Object.assign(new Error('Access denied. User not in your domain.'), { statusCode: 403 });
    }
    return { user };
  }

  async suspendUser(id, admin) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== user.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { isSuspended: true },
      select: { id: true, name: true, email: true, isSuspended: true },
    });
    await this._logActivity('USER_SUSPENDED', 'User', id, admin, { email: user.email });
    return { user: updated };
  }

  async activateUser(id, admin) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== user.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { isSuspended: false },
      select: { id: true, name: true, email: true, isSuspended: true },
    });
    await this._logActivity('USER_ACTIVATED', 'User', id, admin, { email: user.email });
    return { user: updated };
  }

  async banUser(id, admin) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN') {
      throw Object.assign(new Error('Only super admin can ban users'), { statusCode: 403 });
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { isBanned: true, isSuspended: true },
      select: { id: true, name: true, email: true, isBanned: true },
    });
    await this._logActivity('USER_BANNED', 'User', id, admin, { email: user.email });
    return { user: updated };
  }

  async verifyUser(id, admin) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== user.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { isVerified: true },
      select: { id: true, name: true, email: true, isVerified: true },
    });
    await this._logActivity('USER_VERIFIED', 'User', id, admin, { email: user.email });
    return { user: updated };
  }

  async createUser(data, admin) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw appError('User with this email already exists', 409);

    const rollNoExists = await prisma.user.findUnique({ where: { rollNo: data.rollNo } });
    if (rollNoExists) throw appError('Roll number already in use', 409);

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        rollNo: data.rollNo,
        email: data.email,
        password: hashedPassword,
        phone: data.phone || null,
        domain: data.domain,
        isVerified: data.isVerified !== false,
      },
      select: {
        id: true, name: true, email: true, rollNo: true, phone: true,
        domain: true, isVerified: true, createdAt: true,
      },
    });

    await this._logActivity('USER_CREATED', 'User', user.id, admin, { email: user.email });
    return { user, temporaryPassword: data.password };
  }

  async resetUserPassword(id, admin) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== user.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const newPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: hashedPassword } });
    await this._logActivity('USER_PASSWORD_RESET', 'User', id, admin, { email: user.email });
    return { temporaryPassword: newPassword };
  }

  // ─── Ride Management ────────────────────────────────────────────────────────
  async getRides(query, admin) {
    const { page = 1, limit = 10, search, status, domain: filterDomain } = query;
    const skip = (page - 1) * limit;
    const where = {};
    if (admin.role !== 'SUPER_ADMIN' && admin.domain) where.domain = admin.domain;
    if (filterDomain && admin.role === 'SUPER_ADMIN') where.domain = filterDomain;
    if (status === 'cancelled') where.isCancelled = true;
    else if (status === 'expired') where.isExpired = true;
    else if (status === 'active') where.isExpired = false;
    if (search) {
      where.OR = [
        { from: { contains: search, mode: 'insensitive' } },
        { to: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true, email: true, rollNo: true } },
          _count: { select: { requests: true } },
        },
      }),
      prisma.ride.count({ where }),
    ]);

    return { rides, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } };
  }

  async getRideById(id, admin) {
    const ride = await prisma.ride.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, rollNo: true, phone: true } },
        requests: {
          include: {
            requester: { select: { id: true, name: true, email: true, rollNo: true } },
          },
        },
      },
    });
    if (!ride) throw Object.assign(new Error('Ride not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== ride.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    return { ride };
  }

  async deleteRide(id, admin) {
    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) throw Object.assign(new Error('Ride not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== ride.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    await prisma.ride.delete({ where: { id } });
    await this._logActivity('RIDE_DELETED', 'Ride', id, admin, { from: ride.from, to: ride.to });
  }

  async cancelRide(id, admin) {
    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) throw Object.assign(new Error('Ride not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== ride.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const updated = await prisma.ride.update({
      where: { id },
      data: { isCancelled: true, isExpired: true },
    });
    await this._logActivity('RIDE_CANCELLED', 'Ride', id, admin, { from: ride.from, to: ride.to });
    return { ride: updated };
  }

  async completeRide(id, admin) {
    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) throw Object.assign(new Error('Ride not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== ride.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const updated = await prisma.ride.update({
      where: { id },
      data: { isExpired: true },
    });
    await this._logActivity('RIDE_COMPLETED', 'Ride', id, admin, { from: ride.from, to: ride.to });
    return { ride: updated };
  }

  // ─── Request Management ─────────────────────────────────────────────────────
  async getRequests(query, admin) {
    const { page = 1, limit = 10, status: filterStatus, search } = query;
    const skip = (page - 1) * limit;
    const where = {};
    if (admin.role !== 'SUPER_ADMIN' && admin.domain) {
      where.ride = { domain: admin.domain };
    }
    if (filterStatus) where.status = filterStatus;
    if (search) {
      where.ride = {
        ...(where.ride || {}),
        OR: [
          { from: { contains: search, mode: 'insensitive' } },
          { to: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          ride: { select: { id: true, from: true, to: true, date: true, time: true, domain: true } },
          requester: { select: { id: true, name: true, email: true, rollNo: true } },
        },
      }),
      prisma.request.count({ where }),
    ]);

    return { requests, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } };
  }

  async approveRequest(id, admin) {
    const request = await prisma.request.findUnique({ where: { id }, include: { ride: true } });
    if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== request.ride.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const updated = await prisma.request.update({ where: { id }, data: { status: 'ACCEPTED' } });
    await this._logActivity('REQUEST_APPROVED', 'Request', id, admin);
    return { request: updated };
  }

  async rejectRequest(id, admin) {
    const request = await prisma.request.findUnique({ where: { id }, include: { ride: true } });
    if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== request.ride.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const updated = await prisma.request.update({ where: { id }, data: { status: 'REJECTED' } });
    await this._logActivity('REQUEST_REJECTED', 'Request', id, admin);
    return { request: updated };
  }

  async cancelRequest(id, admin) {
    const request = await prisma.request.findUnique({ where: { id }, include: { ride: true } });
    if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== request.ride.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const updated = await prisma.request.update({ where: { id }, data: { status: 'REJECTED' } });
    await this._logActivity('REQUEST_CANCELLED', 'Request', id, admin);
    return { request: updated };
  }

  // ─── Chat Management ────────────────────────────────────────────────────────
  async getChats(query, admin) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;
    const where = {};
    if (admin.role !== 'SUPER_ADMIN' && admin.domain) {
      where.request = { ride: { domain: admin.domain } };
    }
    if (search) {
      where.request = {
        ...(where.request || {}),
        ride: {
          ...(where.request?.ride || {}),
          OR: [
            { from: { contains: search, mode: 'insensitive' } },
            { to: { contains: search, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [chats, total] = await Promise.all([
      prisma.chat.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          request: {
            select: {
              id: true, status: true,
              ride: { select: { id: true, from: true, to: true, domain: true } },
              requester: { select: { id: true, name: true, email: true } },
            },
          },
          _count: { select: { messages: true } },
        },
      }),
      prisma.chat.count({ where }),
    ]);

    return { chats, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } };
  }

  async getChatMessages(chatId, admin) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { request: { include: { ride: { select: { domain: true } } } } },
    });
    if (!chat) throw Object.assign(new Error('Chat not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== chat.request.ride.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { id: true, name: true, email: true, profilePic: true } } },
    });

    return { messages };
  }

  async deleteMessage(id, admin) {
    const message = await prisma.message.findUnique({
      where: { id },
      include: { chat: { include: { request: { include: { ride: { select: { domain: true } } } } } } },
    });
    if (!message) throw Object.assign(new Error('Message not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== message.chat.request.ride.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    await prisma.message.update({ where: { id }, data: { isDeleted: true } });
    await this._logActivity('MESSAGE_DELETED', 'Message', id, admin);
  }

  async deleteConversation(chatId, admin) {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: { request: { include: { ride: { select: { domain: true } } } } },
    });
    if (!chat) throw Object.assign(new Error('Chat not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== chat.request.ride.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    await prisma.message.deleteMany({ where: { chatId } });
    await prisma.chat.delete({ where: { id: chatId } });
    await this._logActivity('CONVERSATION_DELETED', 'Chat', chatId, admin);
  }

  async muteUser(id, admin) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== user.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { isMuted: true },
      select: { id: true, name: true, email: true, isMuted: true },
    });
    await this._logActivity('USER_MUTED', 'User', id, admin);
    return { user: updated };
  }

  async unmuteUser(id, admin) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== user.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { isMuted: false },
      select: { id: true, name: true, email: true, isMuted: true },
    });
    await this._logActivity('USER_UNMUTED', 'User', id, admin);
    return { user: updated };
  }

  async blockUser(id, admin) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN') {
      throw Object.assign(new Error('Only super admin can block users'), { statusCode: 403 });
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { isBanned: true, isSuspended: true },
      select: { id: true, name: true, email: true, isBanned: true },
    });
    await this._logActivity('USER_BLOCKED', 'User', id, admin, { email: user.email });
    return { user: updated };
  }

  // ─── Announcements ──────────────────────────────────────────────────────────
  async getAnnouncements(query, admin) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;
    const where = {};
    if (admin.role !== 'SUPER_ADMIN' && admin.domain) {
      where.OR = [{ type: 'GLOBAL' }, { domain: admin.domain }];
    }
    if (search) {
      where.AND = [
        where.OR ? { OR: where.OR } : {},
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
      delete where.OR;
    }

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.announcement.count({ where }),
    ]);

    return { announcements, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } };
  }

  async createAnnouncement(data, admin) {
    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        type: data.type || 'GLOBAL',
        status: data.status || 'ACTIVE',
        domain: data.domain || null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        createdById: admin.id,
      },
    });
    await this._logActivity('ANNOUNCEMENT_CREATED', 'Announcement', announcement.id, admin, { title: data.title });
    return { announcement };
  }

  async updateAnnouncement(id, data, admin) {
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) throw Object.assign(new Error('Announcement not found'), { statusCode: 404 });

    const updateData = {};
    if (data.title) updateData.title = data.title;
    if (data.content) updateData.content = data.content;
    if (data.type) updateData.type = data.type;
    if (data.status) updateData.status = data.status;
    if (data.domain !== undefined) updateData.domain = data.domain;
    if (data.scheduledAt) updateData.scheduledAt = new Date(data.scheduledAt);

    const updated = await prisma.announcement.update({ where: { id }, data: updateData });
    await this._logActivity('ANNOUNCEMENT_UPDATED', 'Announcement', id, admin, { title: data.title });
    return { announcement: updated };
  }

  async deleteAnnouncement(id, admin) {
    await prisma.announcement.delete({ where: { id } });
    await this._logActivity('ANNOUNCEMENT_DELETED', 'Announcement', id, admin);
  }

  // ─── User Notifications (Push to specific users) ────────────────────────────
  async sendUserNotification(data, admin) {
    const { userId, title, content } = data;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (admin.role !== 'SUPER_ADMIN' && admin.domain !== user.domain) {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }

    const notification = await prisma.userNotification.create({
      data: { title, content, userId },
    });
    await this._logActivity('NOTIFICATION_SENT', 'UserNotification', notification.id, admin, { userId, title });
    return { notification };
  }

  async sendBulkNotifications(data, admin) {
    const { userIds, title, content } = data;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw Object.assign(new Error('User IDs required'), { statusCode: 400 });
    }

    const notifications = await prisma.userNotification.createMany({
      data: userIds.map((userId) => ({ title, content, userId })),
    });
    await this._logActivity('BULK_NOTIFICATION_SENT', 'UserNotification', null, admin, { count: userIds.length, title });
    return { count: notifications.count };
  }

  async getUserNotifications(query, admin) {
    const { page = 1, limit = 20, userId } = query;
    const skip = (page - 1) * limit;
    const where = {};
    if (userId) where.userId = userId;

    const [notifications, total] = await Promise.all([
      prisma.userNotification.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.userNotification.count({ where }),
    ]);

    return { notifications, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } };
  }

  // ─── Reports ────────────────────────────────────────────────────────────────
  async getReports(query, admin) {
    const { page = 1, limit = 10, type, status } = query;
    const skip = (page - 1) * limit;
    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          reportedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.report.count({ where }),
    ]);

    return { reports, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } };
  }

  async resolveReport(id, admin) {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 });

    const updated = await prisma.report.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedById: admin.id, resolvedAt: new Date() },
    });
    await this._logActivity('REPORT_RESOLVED', 'Report', id, admin);
    return { report: updated };
  }

  async closeReport(id, admin) {
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) throw Object.assign(new Error('Report not found'), { statusCode: 404 });

    const updated = await prisma.report.update({
      where: { id },
      data: { status: 'CLOSED', resolvedById: admin.id, resolvedAt: new Date() },
    });
    await this._logActivity('REPORT_CLOSED', 'Report', id, admin);
    return { report: updated };
  }

  async deleteReport(id, admin) {
    await prisma.report.delete({ where: { id } });
    await this._logActivity('REPORT_DELETED', 'Report', id, admin);
  }

  // ─── Home Management - Banners ──────────────────────────────────────────────
  async getBanners() {
    const banners = await prisma.banner.findMany({ orderBy: { order: 'asc' } });
    return { banners };
  }

  async createBanner(data) {
    const banner = await prisma.banner.create({
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        order: data.order || 0,
        domain: data.domain || null,
      },
    });
    return { banner };
  }

  async updateBanner(id, data) {
    const updateData = {};
    if (data.title) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.imageUrl) updateData.imageUrl = data.imageUrl;
    if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.order !== undefined) updateData.order = data.order;

    const banner = await prisma.banner.update({ where: { id }, data: updateData });
    return { banner };
  }

  async deleteBanner(id) {
    await prisma.banner.delete({ where: { id } });
  }

  // ─── Home Management - Carousel ─────────────────────────────────────────────
  async getCarouselItems() {
    const items = await prisma.carouselItem.findMany({ orderBy: { order: 'asc' } });
    return { carouselItems: items };
  }

  async createCarouselItem(data) {
    const item = await prisma.carouselItem.create({
      data: {
        title: data.title,
        subtitle: data.subtitle || null,
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        order: data.order || 0,
      },
    });
    return { carouselItem: item };
  }

  async updateCarouselItem(id, data) {
    const updateData = {};
    if (data.title) updateData.title = data.title;
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.imageUrl) updateData.imageUrl = data.imageUrl;
    if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.order !== undefined) updateData.order = data.order;

    const item = await prisma.carouselItem.update({ where: { id }, data: updateData });
    return { carouselItem: item };
  }

  async deleteCarouselItem(id) {
    await prisma.carouselItem.delete({ where: { id } });
  }

  // ─── Home Management - Featured Cards ───────────────────────────────────────
  async getFeaturedCards() {
    const cards = await prisma.featuredCard.findMany({ orderBy: { order: 'asc' } });
    return { featuredCards: cards };
  }

  async createFeaturedCard(data) {
    const card = await prisma.featuredCard.create({
      data: {
        title: data.title,
        description: data.description || null,
        icon: data.icon || null,
        linkUrl: data.linkUrl || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        order: data.order || 0,
      },
    });
    return { featuredCard: card };
  }

  async updateFeaturedCard(id, data) {
    const updateData = {};
    if (data.title) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.order !== undefined) updateData.order = data.order;

    const card = await prisma.featuredCard.update({ where: { id }, data: updateData });
    return { featuredCard: card };
  }

  async deleteFeaturedCard(id) {
    await prisma.featuredCard.delete({ where: { id } });
  }

  // ─── Activity Logs ──────────────────────────────────────────────────────────
  async getActivityLogs(query, admin) {
    const { page = 1, limit = 20, action } = query;
    const skip = (page - 1) * limit;
    const where = {};
    if (action) where.action = action;

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return { logs, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } };
  }

  // ─── System Settings ────────────────────────────────────────────────────────
  async getSystemSettings() {
    const settings = await prisma.systemSetting.findMany();
    const settingsMap = {};
    settings.forEach((s) => { settingsMap[s.key] = s.value; });
    return { settings: settingsMap };
  }

  async updateSystemSetting(key, value) {
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return { setting };
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────
  async getAnalytics(query, admin) {
    const { period = 'daily', startDate, endDate } = query;
    const isSuperAdmin = admin.role === 'SUPER_ADMIN';
    const domainFilter = isSuperAdmin ? {} : { domain: admin.domain };

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const [userGrowth, rideGrowth, domainComparison] = await Promise.all([
      prisma.user.findMany({
        where: { ...domainFilter, createdAt: { gte: start, lte: end } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.ride.findMany({
        where: { ...domainFilter, createdAt: { gte: start, lte: end } },
        select: { createdAt: true, domain: true },
        orderBy: { createdAt: 'asc' },
      }),
      isSuperAdmin
        ? (async () => {
            const domains = await prisma.domain.findMany({ select: { name: true } });
            return Promise.all(
              domains.map(async (d) => ({
                name: d.name,
                _count: {
                  users: await prisma.user.count({ where: { domain: d.name } }),
                  rides: await prisma.ride.count({ where: { domain: d.name } }),
                },
              }))
            );
          })()
        : Promise.resolve(null),
    ]);

    return {
      userGrowth: this._aggregateByPeriod(userGrowth, period),
      rideGrowth: this._aggregateByPeriod(rideGrowth, period),
      domainComparison,
    };
  }

  // ─── Storage ────────────────────────────────────────────────────────────────
  async getStorageStats() {
    const [totalFiles, totalBytes, recentFiles] = await Promise.all([
      prisma.storageFile.count(),
      prisma.storageFile.aggregate({ _sum: { bytes: true } }),
      prisma.storageFile.findMany({ take: 20, orderBy: { createdAt: 'desc' } }),
    ]);
    return {
      stats: { totalFiles, totalBytes: totalBytes._sum.bytes || 0 },
      recentFiles,
    };
  }

  async cleanupStorage(daysOld = 30) {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await prisma.storageFile.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return { deletedCount: result.count };
  }

  // ─── Security ───────────────────────────────────────────────────────────────
  async getSecurityLogs(query) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.loginAttempt.findMany({
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.loginAttempt.count(),
    ]);

    return { logs, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } };
  }

  // ─── Database Stats ─────────────────────────────────────────────────────────
  async getDatabaseStats() {
    const [userCount, rideCount, requestCount, chatCount, messageCount, adminCount, domainCount, reportCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.ride.count(),
        prisma.request.count(),
        prisma.chat.count(),
        prisma.message.count(),
        prisma.admin.count(),
        prisma.domain.count(),
        prisma.report.count(),
      ]);

    return {
      stats: {
        users: userCount,
        rides: rideCount,
        requests: requestCount,
        chats: chatCount,
        messages: messageCount,
        admins: adminCount,
        domains: domainCount,
        reports: reportCount,
      },
    };
  }

  // ─── API Monitor Stats ──────────────────────────────────────────────────────
  async getApiMonitorStats() {
    const recentLogs = await prisma.activityLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    const actionCounts = {};
    recentLogs.forEach((log) => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });

    return {
      recentActivity: recentLogs,
      actionCounts,
      totalLoggedActions: await prisma.activityLog.count(),
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  async _logActivity(action, entity, entityId, admin, details = {}) {
    try {
      await prisma.activityLog.create({
        data: {
          action,
          entity,
          entityId,
          details,
          adminId: admin.id,
          adminName: admin.name,
          adminRole: admin.role,
        },
      });
    } catch (e) {
      console.error('Failed to log activity:', e.message);
    }
  }

  _aggregateByPeriod(data, period) {
    const grouped = {};
    data.forEach((item) => {
      const date = new Date(item.createdAt);
      let key;
      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = date.toISOString().split('T')[0];
      }
      grouped[key] = (grouped[key] || 0) + 1;
    });
    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
  }
}

module.exports = new AdminService();