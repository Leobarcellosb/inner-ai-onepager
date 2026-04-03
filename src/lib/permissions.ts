import type { AppRole } from '@/types';

/**
 * Permission matrix: what each role can do.
 * admin: full access to everything
 * operator: can create/edit content, use AI, manage pipeline — cannot manage users or system config
 */

const PERMISSIONS = {
  // Content operations
  'content:create':   ['admin', 'operator', 'social_media'],
  'content:edit':     ['admin', 'operator', 'social_media'],
  'content:delete':   ['admin'],
  'content:approve':  ['admin', 'operator'],
  'content:publish':  ['admin', 'operator'],

  // AI features
  'ai:improve':       ['admin', 'operator', 'social_media'],
  'ai:optimize':      ['admin', 'operator'],
  'ai:generate':      ['admin', 'operator'],
  'ai:autopilot':     ['admin'],
  'ai:review':        ['admin', 'operator'],

  // Design
  'design:view':      ['admin', 'operator', 'designer'],
  'design:deliver':   ['admin', 'designer'],

  // Brain / Config
  'brain:view':       ['admin', 'operator'],
  'brain:edit':       ['admin'],
  'knowledge:upload': ['admin', 'operator'],

  // System
  'users:manage':     ['admin'],
  'audit:view':       ['admin'],
  'settings:edit':    ['admin'],
} as const;

type Permission = keyof typeof PERMISSIONS;

export function hasPermission(roles: AppRole[], permission: Permission): boolean {
  const allowed = PERMISSIONS[permission];
  return roles.some(role => (allowed as readonly string[]).includes(role));
}

export function isAdmin(roles: AppRole[]): boolean {
  return roles.includes('admin');
}

export function isOperator(roles: AppRole[]): boolean {
  return roles.includes('operator') || roles.includes('admin');
}
