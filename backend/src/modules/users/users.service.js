// src/modules/users/users.service.js
// User & access management. Multi-tenant and branch scoped.

import crypto from 'crypto';
import prisma from '../../config/prisma.js';
import { auditLog } from '../../lib/audit.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/AppError.js';
import { assertBranchAccess, resolveWriteBranch } from '../../lib/scope.js';
import { hashPassword } from '../auth/auth.service.js';
import { toUserDTO } from '../auth/auth.mapper.js';

const DEFAULT_PASSWORD = 'Salon@2026';
const include = { branch: { select: { name: true } } };

const strip = ({ passwordHash, plainPassword, ...rest }) => rest;

const assertTenantUserAccess = (actor, target) => {
  if (!actor?.tenantId) {
    throw forbidden('TENANT_REQUIRED', 'Access Denied: Verified tenant context is required.');
  }
  const belongs = target?.tenantMemberships?.some((m) => m.tenantId === actor.tenantId);
  if (!belongs) {
    throw forbidden('FORBIDDEN_TENANT_ACCESS', 'Access Denied: User belongs to another salon company.');
  }
};

const getOrThrow = async (tx, id) => {
  const user = await tx.user.findUnique({
    where: { id },
    include: {
      ...include,
      tenantMemberships: true,
    },
  });
  if (!user) throw notFound('USER_NOT_FOUND', `User '${id}' not found.`);
  return user;
};

/** ADMIN may only manage ACCOUNTANT/STAFF users of their own branch. */
const assertAdminCanManage = (actor, target, verb) => {
  if (actor.role !== 'ADMIN') return;
  if (target.role === 'SUPER_ADMIN' || target.role === 'ADMIN') {
    throw forbidden('FORBIDDEN', `Access Denied: Branch Administrators cannot ${verb} Administrator accounts.`);
  }
  if (!target.branchId || target.branchId !== actor.branchId) {
    throw forbidden('BRANCH_FORBIDDEN', `Access Denied: Cannot ${verb} user from another branch.`);
  }
};

export const listUsers = async (actor, branchId) => {
  if (!actor?.tenantId) throw forbidden('TENANT_REQUIRED', 'Access Denied: Verified tenant context is required.');

  if (branchId && branchId !== 'ALL') {
    assertBranchAccess(actor, branchId, 'Access Denied: Cannot view users of another branch.');
  }

  let targetBranch = null;
  if (actor.role === 'ADMIN') {
    targetBranch = actor.branchId;
  } else if (branchId && branchId !== 'ALL') {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.tenantId !== actor.tenantId) {
      throw forbidden('FORBIDDEN_TENANT_ACCESS', 'Access Denied: Branch belongs to another salon company.');
    }
    targetBranch = branchId;
  }

  const where = {
    tenantMemberships: { some: { tenantId: actor.tenantId } },
    ...(targetBranch ? { branchId: targetBranch } : {}),
  };
  const users = await prisma.user.findMany({ where, include, orderBy: { createdAt: 'asc' } });
  return users.map((u) => toUserDTO(u, actor.role));
};

export const getUser = async (actor, id) => {
  if (!actor?.tenantId) throw forbidden('TENANT_REQUIRED', 'Access Denied: Verified tenant context is required.');

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      ...include,
      tenantMemberships: true,
    },
  });
  if (!user) return null;

  assertTenantUserAccess(actor, user);

  if (actor.role === 'ADMIN' && user.branchId !== actor.branchId) {
    throw forbidden('BRANCH_FORBIDDEN', 'Access Denied: Cannot view user from another branch.');
  }
  return toUserDTO(user, actor.role);
};

export const createUser = async (params, actor) => {
  if (!actor?.tenantId) throw forbidden('TENANT_REQUIRED', 'Access Denied: Verified tenant context is required.');
  const input = { ...params };

  if (actor.role === 'ADMIN') {
    if (input.role === 'SUPER_ADMIN' || input.role === 'ADMIN') {
      throw forbidden('FORBIDDEN', 'Access Denied: Branch Administrators can only create Accountant and Staff accounts.');
    }
    input.branchId = resolveWriteBranch(actor, input.branchId, 'Access Denied: Cannot create user in another branch.');
  } else if (!input.branchId || input.branchId === 'ALL') {
    if (input.role !== 'SUPER_ADMIN') throw badRequest('BRANCH_REQUIRED', 'Please select a specific branch for this user.');
    input.branchId = null;
  }

  return prisma.$transaction(async (tx) => {
    if (input.branchId) {
      const branch = await tx.branch.findUnique({ where: { id: input.branchId } });
      if (!branch || branch.tenantId !== actor.tenantId) {
        throw forbidden('FORBIDDEN_TENANT_ACCESS', 'Access Denied: Branch belongs to another salon company.');
      }
    }

    const emailOwner = await tx.user.findUnique({
      where: { email: input.email },
      include: { tenantMemberships: true },
    });

    // STAFF logins: exactly one login per employee profile.
    if (input.role === 'STAFF') {
      if (!input.staffId) throw badRequest('STAFF_REQUIRED', 'Staff accounts must be linked to a valid employee profile.');
      const staff = await tx.staff.findUnique({ where: { id: input.staffId }, include: { user: true } });
      if (!staff) throw notFound('STAFF_NOT_FOUND', `Employee profile '${input.staffId}' not found.`);
      if (staff.tenantId !== actor.tenantId) {
        throw forbidden('FORBIDDEN_TENANT_ACCESS', 'Access Denied: Employee profile belongs to another salon company.');
      }
      if (staff.branchId !== input.branchId) {
        throw badRequest('BRANCH_MISMATCH', 'Employee branch assignment does not match requested user branch.');
      }
      if (!staff.isActive) throw badRequest('STAFF_INACTIVE', `Cannot create login for inactive employee '${staff.name}'.`);

      if (staff.user) {
        // Re-enable the existing linked login instead of creating a duplicate.
        if (emailOwner && emailOwner.id !== staff.user.id) {
          throw conflict('EMAIL_TAKEN', `Login identifier '${input.email}' is already registered to another account.`);
        }
        const data = { isActive: true, email: input.email, name: input.name };
        if (input.password) {
          data.passwordHash = await hashPassword(input.password);
          data.plainPassword = null;
        }
        const user = await tx.user.update({ where: { id: staff.user.id }, data, include });
        await tx.staff.update({ where: { id: staff.id }, data: { hasPortalAccess: true } });
        await tx.tenantMembership.upsert({
          where: { tenantId_userId: { tenantId: actor.tenantId, userId: user.id } },
          create: { tenantId: actor.tenantId, userId: user.id, role: 'STAFF', status: 'ACTIVE' },
          update: { status: 'ACTIVE' },
        });
        await auditLog(tx, {
          userId: actor.id, userName: actor.name, action: 'USER_REACTIVATED', entity: 'User',
          entityId: user.id, branchId: user.branchId, after: strip(user),
        });
        return toUserDTO(user, actor.role);
      }
    } else {
      input.staffId = undefined;
    }

    if (emailOwner) {
      throw conflict('EMAIL_TAKEN', `Login identifier '${input.email}' is already registered to another account.`);
    }

    const user = await tx.user.create({
      data: {
        name:         input.name,
        email:        input.email,
        role:         input.role,
        branchId:     input.branchId,
        staffId:      input.staffId ?? null,
        title:        input.title,
        phone:        input.phone || null,
        passwordHash: await hashPassword(input.password || DEFAULT_PASSWORD),
        plainPassword: null,
      },
      include,
    });

    const tenantRole = input.role === 'SUPER_ADMIN' ? 'TENANT_OWNER' : input.role === 'ADMIN' ? 'TENANT_ADMIN' : 'STAFF';
    await tx.tenantMembership.create({
      data: {
        tenantId: actor.tenantId,
        userId: user.id,
        role: tenantRole,
        status: 'ACTIVE',
      },
    });

    if (input.role === 'STAFF') {
      await tx.staff.update({ where: { id: input.staffId }, data: { hasPortalAccess: true } });
    }

    if (input.role === 'ADMIN' && input.branchId) {
      await tx.branch.updateMany({
        where: { id: input.branchId, assignedAdminId: null },
        data: { assignedAdminId: user.id },
      });
    }

    await auditLog(tx, {
      userId: actor.id, userName: actor.name, action: 'USER_CREATED', entity: 'User',
      entityId: user.id, branchId: user.branchId, after: strip(user),
    });
    return toUserDTO(user, actor.role);
  });
};

export const updateUser = async (id, params, actor) => {
  if (!actor?.tenantId) throw forbidden('TENANT_REQUIRED', 'Access Denied: Verified tenant context is required.');
  return prisma.$transaction(async (tx) => {
    const target = await getOrThrow(tx, id);
    assertTenantUserAccess(actor, target);
    assertAdminCanManage(actor, target, 'edit');

    const data = {};
    if (params.email) {
      const clash = await tx.user.findFirst({ where: { email: params.email, NOT: { id } } });
      if (clash) throw conflict('EMAIL_TAKEN', `Login identifier '${params.email}' is already in use.`);
      data.email = params.email;
    }
    if (params.name) data.name = params.name;
    if (params.phone !== undefined) data.phone = params.phone || null;
    if (params.title) data.title = params.title;
    if (params.password) {
      data.passwordHash = await hashPassword(params.password.trim());
      data.plainPassword = null;
    }
    if (params.isActive !== undefined) {
      data.isActive = Boolean(params.isActive);
      if (data.isActive && target.staffId) {
        const staff = await tx.staff.findUnique({ where: { id: target.staffId } });
        if (staff && !staff.isActive) {
          throw badRequest('STAFF_INACTIVE', `Cannot reactivate login: linked employee profile '${staff.name}' is inactive.`);
        }
        await tx.staff.update({ where: { id: target.staffId }, data: { hasPortalAccess: true } });
      } else if (!data.isActive && target.staffId) {
        await tx.staff.update({ where: { id: target.staffId }, data: { hasPortalAccess: false } });
      }
      await tx.tenantMembership.updateMany({
        where: { tenantId: actor.tenantId, userId: id },
        data: { status: data.isActive ? 'ACTIVE' : 'SUSPENDED' },
      });
    }

    // Role and branch assignment updates (permitted for SUPER_ADMIN)
    if (actor.role === 'SUPER_ADMIN') {
      if (params.role) {
        if (target.role === 'SUPER_ADMIN' && params.role !== 'SUPER_ADMIN') {
          throw badRequest('PROTECTED_ACCOUNT', 'Cannot demote the primary Super Administrator account.');
        }
        data.role = params.role;
        const newTenantRole = params.role === 'SUPER_ADMIN' ? 'TENANT_OWNER' : params.role === 'ADMIN' ? 'TENANT_ADMIN' : 'STAFF';
        await tx.tenantMembership.updateMany({
          where: { tenantId: actor.tenantId, userId: id },
          data: { role: newTenantRole },
        });
      }

      if (params.branchId !== undefined) {
        const nextRole = data.role || target.role;
        if (nextRole === 'SUPER_ADMIN' || params.branchId === 'ALL' || !params.branchId) {
          data.branchId = null;
        } else {
          const branch = await tx.branch.findUnique({ where: { id: params.branchId } });
          if (!branch || branch.tenantId !== actor.tenantId) {
            throw forbidden('FORBIDDEN_TENANT_ACCESS', 'Access Denied: Branch belongs to another salon company.');
          }
          data.branchId = params.branchId;
        }

        // If branch changed and target is linked to a staff record, sync staff branch
        if (target.staffId && data.branchId && data.branchId !== target.branchId) {
          await tx.staff.update({
            where: { id: target.staffId },
            data: { branchId: data.branchId },
          });
        }

        // If target was assigned admin of their previous branch, clear old assignment
        if (target.branchId && data.branchId !== target.branchId) {
          await tx.branch.updateMany({
            where: { id: target.branchId, assignedAdminId: id },
            data: { assignedAdminId: null },
          });
        }

        if (data.branchId && (data.role === 'ADMIN' || (!data.role && target.role === 'ADMIN'))) {
          await tx.branch.updateMany({
            where: { id: data.branchId, assignedAdminId: null },
            data: { assignedAdminId: id },
          });
        }
      }
    }

    const user = await tx.user.update({ where: { id }, data, include });
    const auditAction = (params.isActive === true && !target.isActive) ? 'USER_REACTIVATED' : 'USER_UPDATED';
    await auditLog(tx, {
      userId: actor.id, userName: actor.name, action: auditAction, entity: 'User',
      entityId: id, branchId: user.branchId, before: strip(target), after: strip(user),
    });
    return toUserDTO(user, actor.role);
  });
};

export const deactivateUser = async (id, actor) => {
  if (!actor?.tenantId) throw forbidden('TENANT_REQUIRED', 'Access Denied: Verified tenant context is required.');
  return prisma.$transaction(async (tx) => {
    const target = await getOrThrow(tx, id);
    assertTenantUserAccess(actor, target);

    if (id === actor.id) {
      throw badRequest('SELF_DEACTIVATION', 'Operation Blocked: You cannot deactivate your own account.');
    }
    if (target.role === 'SUPER_ADMIN') {
      throw badRequest('PROTECTED_ACCOUNT', 'Operation Blocked: Cannot deactivate the primary Super Administrator account.');
    }
    assertAdminCanManage(actor, target, 'deactivate');

    await tx.user.update({ where: { id }, data: { isActive: false } });
    await tx.tenantMembership.updateMany({
      where: { tenantId: actor.tenantId, userId: id },
      data: { status: 'SUSPENDED' },
    });
    await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });

    // Linked employee keeps their records; only the portal flag is revoked.
    if (target.staffId) {
      await tx.staff.update({ where: { id: target.staffId }, data: { hasPortalAccess: false } });
    }
    await auditLog(tx, {
      userId: actor.id, userName: actor.name, action: 'USER_DEACTIVATED', entity: 'User', entityId: id, branchId: target.branchId,
    });
    return { success: true, message: `User account '${target.name}' (${target.email}) deactivated.` };
  });
};

export const reactivateUser = async (id, actor) => {
  if (!actor?.tenantId) throw forbidden('TENANT_REQUIRED', 'Access Denied: Verified tenant context is required.');
  return prisma.$transaction(async (tx) => {
    const target = await getOrThrow(tx, id);
    assertTenantUserAccess(actor, target);
    assertAdminCanManage(actor, target, 'reactivate');

    if (target.staffId) {
      const staff = await tx.staff.findUnique({ where: { id: target.staffId } });
      if (staff && !staff.isActive) {
        throw badRequest('STAFF_INACTIVE', `Cannot reactivate login: linked employee profile '${staff.name}' is inactive.`);
      }
      await tx.staff.update({ where: { id: target.staffId }, data: { hasPortalAccess: true } });
    }

    const user = await tx.user.update({ where: { id }, data: { isActive: true }, include });
    await tx.tenantMembership.updateMany({
      where: { tenantId: actor.tenantId, userId: id },
      data: { status: 'ACTIVE' },
    });
    await auditLog(tx, {
      userId: actor.id, userName: actor.name, action: 'USER_REACTIVATED', entity: 'User',
      entityId: id, branchId: user.branchId, before: strip(target), after: strip(user),
    });
    return { success: true, user: toUserDTO(user, actor.role), message: `User account '${target.name}' (${target.email}) reactivated.` };
  });
};

export const deleteUser = async (id, actor) => {
  if (!actor?.tenantId) throw forbidden('TENANT_REQUIRED', 'Access Denied: Verified tenant context is required.');
  return prisma.$transaction(async (tx) => {
    const target = await getOrThrow(tx, id);
    assertTenantUserAccess(actor, target);

    if (id === actor.id) {
      throw badRequest('SELF_DELETION', 'Operation Blocked: You cannot delete your own account.');
    }
    if (target.role === 'SUPER_ADMIN') {
      throw badRequest('PROTECTED_ACCOUNT', 'Operation Blocked: Cannot delete Super Administrator accounts.');
    }
    assertAdminCanManage(actor, target, 'delete');

    // If linked to staff member, revoke portal access flag without deleting employee records
    if (target.staffId) {
      await tx.staff.update({ where: { id: target.staffId }, data: { hasPortalAccess: false } });
    }

    // Clear branch assignedAdminId if this user is assigned
    await tx.branch.updateMany({
      where: { assignedAdminId: id },
      data: { assignedAdminId: null },
    });

    // Delete user tokens and memberships
    await tx.refreshToken.deleteMany({ where: { userId: id } });
    await tx.passwordResetToken.deleteMany({ where: { userId: id } });
    await tx.tenantMembership.deleteMany({ where: { userId: id } });

    // Delete the user record
    await tx.user.delete({ where: { id } });

    await auditLog(tx, {
      userId: actor.id, userName: actor.name, action: 'USER_DELETED', entity: 'User',
      entityId: id, branchId: target.branchId, before: strip(target),
    });

    return { success: true, message: `User account '${target.name}' (${target.email}) permanently deleted.` };
  });
};

export const resetUserPassword = async (id, password, actor) => {
  if (!actor?.tenantId) throw forbidden('TENANT_REQUIRED', 'Access Denied: Verified tenant context is required.');
  return prisma.$transaction(async (tx) => {
    const target = await getOrThrow(tx, id);
    assertTenantUserAccess(actor, target);
    if (actor.role === 'ADMIN') {
      if (target.role === 'SUPER_ADMIN' || target.role === 'ADMIN') {
        throw forbidden('FORBIDDEN', 'Access Denied: Branch Administrators cannot reset credentials for Administrator accounts.');
      }
      if (target.branchId !== actor.branchId) {
        throw forbidden('BRANCH_FORBIDDEN', 'Access Denied: Branch Administrators cannot reset credentials for users in another branch.');
      }
    }

    const finalPassword = password && password.trim() ? password.trim() : `Temp@${crypto.randomInt(1000, 10000)}`;
    await tx.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(finalPassword),
        plainPassword: null,
      },
    });
    await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await auditLog(tx, {
      userId: actor.id, userName: actor.name, action: 'USER_PASSWORD_RESET', entity: 'User', entityId: id, branchId: target.branchId,
    });

    return {
      success: true,
      temporaryPassword: finalPassword,
      password: finalPassword,
      message: `Password for ${target.name} has been updated successfully.`,
    };
  });
};
