import { describe, expect, it } from 'vitest'
import {
  parseReviewerRule,
  ReviewerResolver,
  type ResolvableLine,
} from '../src/modules/access/reviewer-resolver.js'

/**
 * FR-B-009 · reviewer assignment, tested as pure logic.
 *
 * The three business rules on top of the five assignment rules are where the
 * mistakes live, and all three are failure-shaped: an item with no resolvable
 * reviewer, a reviewer asked to review themselves, a reviewer who is inactive.
 * Each has to land somewhere sensible rather than nowhere.
 */
const resolver = new ReviewerResolver(null as never)

// employee -> user, manager chains, and application ownership.
const STAFF = 'emp-staff'
const MANAGER = 'emp-manager'
const OWNER = 'emp-owner'
const DIRECTOR = 'emp-director'
const APP = 'app-1'
const FALLBACK = 'user-fallback'

const directory = {
  userByEmployee: new Map([
    [STAFF, 'user-staff'],
    [MANAGER, 'user-manager'],
    [OWNER, 'user-owner'],
    [DIRECTOR, 'user-director'],
  ]),
  employeeByUser: new Map([
    ['user-staff', STAFF],
    ['user-manager', MANAGER],
    ['user-owner', OWNER],
    ['user-director', DIRECTOR],
  ]),
  managerOf: new Map<string, string | null>([
    [STAFF, MANAGER],
    [MANAGER, DIRECTOR],
    [OWNER, DIRECTOR],
    [DIRECTOR, null],
  ]),
  ownerOf: new Map([[APP, OWNER]]),
}

function line(overrides: Partial<ResolvableLine> = {}): ResolvableLine {
  return {
    snapshotLineId: 'line-1',
    employeeId: STAFF,
    applicationId: APP,
    isPrivileged: false,
    ...overrides,
  }
}

describe('FR-B-009 · aturan penugasan reviewer', () => {
  it('RA-01 · item diarahkan ke atasan langsung', () => {
    const [a] = resolver.resolve([line()], { code: 'RA-01' }, FALLBACK, directory)
    expect(a).toMatchObject({ reviewerUserId: 'user-manager', via: 'RULE', layerNo: 1 })
  })

  it('RA-02 · item diarahkan ke pemilik aplikasi', () => {
    const [a] = resolver.resolve([line()], { code: 'RA-02' }, FALLBACK, directory)
    expect(a).toMatchObject({ reviewerUserId: 'user-owner', via: 'RULE' })
  })

  it('RA-03 · dua lapis: atasan lalu pemilik aplikasi', () => {
    const result = resolver.resolve([line()], { code: 'RA-03' }, FALLBACK, directory)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ layerNo: 1, reviewerUserId: 'user-manager' })
    expect(result[1]).toMatchObject({ layerNo: 2, reviewerUserId: 'user-owner' })
  })

  it('RA-05 · reviewer khusus dipakai apa adanya', () => {
    const [a] = resolver.resolve(
      [line()],
      { code: 'RA-05', specificReviewerUserId: 'user-director' },
      FALLBACK,
      directory,
    )
    expect(a).toMatchObject({ reviewerUserId: 'user-director', via: 'RULE' })
  })

  it('RA-04 · belum didukung, jatuh ke cadangan secara terlihat', () => {
    // entitlement_catalog carries no owner column, so RA-04 cannot resolve.
    // It must land on the fallback visibly rather than quietly behaving like
    // RA-02, which would let an author believe they configured something else.
    const [a] = resolver.resolve([line()], { code: 'RA-04' }, FALLBACK, directory)
    expect(a).toMatchObject({ reviewerUserId: FALLBACK, via: 'FALLBACK_NO_REVIEWER' })
  })
})

describe('FR-B-009 · aturan bisnis di atas aturan penugasan', () => {
  it('aturan 1 · item tanpa reviewer yang dapat ditentukan jatuh ke cadangan', () => {
    // An account with no linked employee has no manager to route to.
    const [a] = resolver.resolve([line({ employeeId: null })], { code: 'RA-01' }, FALLBACK, directory)
    expect(a).toMatchObject({ reviewerUserId: FALLBACK, via: 'FALLBACK_NO_REVIEWER' })
  })

  it('aturan 2 · reviewer tidak meninjau hak aksesnya sendiri; item naik ke atasannya', () => {
    // The application owner holds access to their own application -- the most
    // common way a self-review appears in practice.
    const [a] = resolver.resolve(
      [line({ employeeId: OWNER })],
      { code: 'RA-02' },
      FALLBACK,
      directory,
    )
    expect(a).toMatchObject({ reviewerUserId: 'user-director', via: 'ESCALATED_SELF_REVIEW' })
  })

  it('aturan 2 · tanpa atasan, tinjauan diri jatuh ke cadangan, bukan tetap pada dirinya', () => {
    const [a] = resolver.resolve(
      [line({ employeeId: DIRECTOR })],
      { code: 'RA-05', specificReviewerUserId: 'user-director' },
      FALLBACK,
      directory,
    )
    expect(a).toMatchObject({ reviewerUserId: FALLBACK, via: 'FALLBACK_SELF_REVIEW' })
  })

  it('aturan 3 · reviewer nonaktif tidak pernah menjadi kandidat', () => {
    // loadDirectory only maps active users, so an inactive manager is simply
    // absent from the map and the line falls through.
    const withoutManager = { ...directory, userByEmployee: new Map(directory.userByEmployee) }
    withoutManager.userByEmployee.delete(MANAGER)

    const [a] = resolver.resolve([line()], { code: 'RA-01' }, FALLBACK, withoutManager)
    expect(a).toMatchObject({ reviewerUserId: FALLBACK, via: 'FALLBACK_NO_REVIEWER' })
  })
})

describe('FR-B-017 aturan 3 · akses istimewa selalu dua lapis', () => {
  it('hak akses istimewa memperoleh dua lapis walau aturannya satu lapis', () => {
    // The stricter treatment is a property of the entitlement, not a campaign
    // setting somebody can forget to switch on.
    const result = resolver.resolve(
      [line({ isPrivileged: true })],
      { code: 'RA-02' },
      FALLBACK,
      directory,
    )
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.layerNo)).toEqual([1, 2])
  })
})

describe('parseReviewerRule', () => {
  it('menerima bentuk lama dan baru, dengan bawaan yang aman', () => {
    expect(parseReviewerRule({ code: 'RA-03' }).code).toBe('RA-03')
    expect(parseReviewerRule({ type: 'RA-01' }).code).toBe('RA-01')
    expect(parseReviewerRule({ code: 'RA-05', specific_reviewer_user_id: 'u1' })).toMatchObject({
      code: 'RA-05',
      specificReviewerUserId: 'u1',
    })
    // An unreadable rule resolves to RA-02 rather than throwing at launch. It
    // is the only rule that needs no per-employee data, so it degrades to
    // "somebody accountable reviews this" rather than to nothing.
    expect(parseReviewerRule(null).code).toBe('RA-02')
  })
})
