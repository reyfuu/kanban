import { randomUUID } from 'node:crypto'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { CoverageLevel } from '@prisma/client'
import { PrismaService, UnitOfWork, type Principal } from '../shared/index.js'

export interface MappingInput {
  readonly frameworkItemId: string
  readonly coverageLevel: CoverageLevel
  readonly note?: string
}

export interface FrameworkItemImport {
  readonly ref: string
  readonly title: string
  readonly description?: string
  readonly parentRef?: string
  readonly sortOrder?: number
}

/**
 * FR-A-002 and FR-A-003 · frameworks, their clauses, and control mapping.
 *
 * The coverage view (FR-A-003 rule 4) is the reason this module earns its keep.
 * "Which clauses are covered by no control at all" is the question an auditor
 * actually asks, and it is a LEFT JOIN from framework_item to control_mapping:
 * an item with no active-control mapping is a gap. A view built only from the
 * mappings that exist can never show an absence, so the join starts from the
 * clauses, not the mappings.
 *
 * Only leaf clauses count toward coverage. A parent clause (bab/pasal) is a
 * heading; mapping a control to "Chapter 5" rather than to a specific control
 * requirement would let a heading mask the uncovered leaves beneath it.
 */
@Injectable()
export class FrameworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /** FR-A-002 · `GET /frameworks`. */
  async listFrameworks(_principal: Principal) {
    const frameworks = await this.prisma.framework.findMany({
      orderBy: [{ code: 'asc' }],
      include: { _count: { select: { items: true } } },
    })
    return frameworks.map((f) => ({
      id: f.id,
      code: f.code,
      name: f.name,
      description: f.description,
      is_active: f.isActive,
      item_count: f._count.items,
    }))
  }

  /** FR-A-002 aturan 2 · the clause tree of one framework. */
  async listItems(_principal: Principal, frameworkId: string) {
    await this.requireFramework(frameworkId)
    const items = await this.prisma.frameworkItem.findMany({
      where: { frameworkId },
      orderBy: [{ sortOrder: 'asc' }, { ref: 'asc' }],
      include: { _count: { select: { children: true, mappings: true } } },
    })
    return items.map((i) => ({
      id: i.id,
      ref: i.ref,
      title: i.title,
      description: i.description,
      parent_id: i.parentId,
      is_leaf: i._count.children === 0,
      mapping_count: i._count.mappings,
    }))
  }

  /**
   * FR-A-002 aturan 3 · import clauses from a structured payload.
   *
   * Two passes: create every item first, then wire parents by ref. That order
   * lets a payload list a child before its parent without failing, and a
   * parent_ref that matches nothing is reported rather than silently dropped, so
   * a typo in the hierarchy does not quietly flatten the tree.
   */
  async importItems(
    principal: Principal,
    frameworkId: string,
    rows: readonly FrameworkItemImport[],
  ): Promise<{ imported: number }> {
    await this.requireFramework(frameworkId)
    if (rows.length === 0) throw new BadRequestException('Tidak ada butir ketentuan untuk diimpor.')

    const refs = new Set<string>()
    for (const row of rows) {
      if (refs.has(row.ref)) {
        throw new BadRequestException(`Referensi butir ganda dalam unggahan: ${row.ref}.`)
      }
      refs.add(row.ref)
    }

    const existing = await this.prisma.frameworkItem.findMany({
      where: { frameworkId },
      select: { ref: true },
    })
    for (const e of existing) {
      if (refs.has(e.ref)) {
        throw new ConflictException(`Referensi butir ${e.ref} sudah ada pada framework ini.`)
      }
    }

    // Validate parent refs resolve to something in this framework (existing or
    // in this same payload) before writing anything.
    const known = new Set<string>([...existing.map((e) => e.ref), ...refs])
    for (const row of rows) {
      if (row.parentRef && !known.has(row.parentRef)) {
        throw new BadRequestException(
          `Butir ${row.ref} merujuk induk ${row.parentRef} yang tidak ada.`,
        )
      }
    }

    const idByRef = new Map<string, string>()
    for (const row of rows) idByRef.set(row.ref, randomUUID())

    await this.uow.write(async (tx, audit) => {
      // Pass 1: insert without parents.
      for (const row of rows) {
        await tx.frameworkItem.create({
          data: {
            id: idByRef.get(row.ref)!,
            frameworkId,
            ref: row.ref,
            title: row.title,
            description: row.description ?? null,
            sortOrder: row.sortOrder ?? 0,
          },
        })
      }
      // Pass 2: wire parents. A parent already in the database resolves by
      // lookup; one in this payload resolves from idByRef.
      for (const row of rows) {
        if (!row.parentRef) continue
        let parentId = idByRef.get(row.parentRef)
        if (!parentId) {
          const parent = await tx.frameworkItem.findFirst({
            where: { frameworkId, ref: row.parentRef },
            select: { id: true },
          })
          parentId = parent?.id
        }
        if (parentId) {
          await tx.frameworkItem.update({ where: { id: idByRef.get(row.ref)! }, data: { parentId } })
        }
      }
      await audit.record({
        action: 'IMPOR_BUTIR_FRAMEWORK',
        objectType: 'FRAMEWORK',
        objectId: frameworkId,
        after: { imported: rows.length },
      })
    })

    return { imported: rows.length }
  }

  /**
   * FR-A-003 aturan 4 · coverage view for a framework.
   *
   * Counts only leaf clauses. Each leaf is PENUH / SEBAGIAN / TIDAK_TERTUTUP
   * from the best active-control mapping it has: a leaf with any PENUH mapping
   * is fully covered, one with only SEBAGIAN/MENDUKUNG is partial, and one with
   * no active-control mapping is a gap. Mappings to retired controls do not
   * count, because a retired control is not evidence of coverage.
   */
  async coverage(_principal: Principal, frameworkId: string) {
    const framework = await this.requireFramework(frameworkId)

    const items = await this.prisma.frameworkItem.findMany({
      where: { frameworkId },
      orderBy: [{ sortOrder: 'asc' }, { ref: 'asc' }],
      include: {
        _count: { select: { children: true } },
        mappings: {
          where: { control: { isActive: true } },
          include: { control: { select: { id: true, code: true, title: true, isActive: true } } },
        },
      },
    })

    const leaves = items.filter((i) => i._count.children === 0)

    let fullyCovered = 0
    let partiallyCovered = 0
    let notCovered = 0

    const rendered = leaves.map((leaf) => {
      const levels = leaf.mappings.map((m) => m.coverageLevel)
      let status: 'PENUH' | 'SEBAGIAN' | 'TIDAK_TERTUTUP'
      if (levels.includes('PENUH')) {
        status = 'PENUH'
        fullyCovered += 1
      } else if (levels.length > 0) {
        status = 'SEBAGIAN'
        partiallyCovered += 1
      } else {
        status = 'TIDAK_TERTUTUP'
        notCovered += 1
      }
      return {
        id: leaf.id,
        ref: leaf.ref,
        title: leaf.title,
        coverage_status: status,
        controls: leaf.mappings.map((m) => ({
          id: m.control.id,
          code: m.control.code,
          title: m.control.title,
          coverage_level: m.coverageLevel,
        })),
      }
    })

    const total = leaves.length
    const coveragePercentage =
      total === 0 ? 0 : Math.round(((fullyCovered + partiallyCovered) / total) * 1000) / 10

    return {
      framework: { id: framework.id, code: framework.code, name: framework.name },
      summary: {
        total_items: total,
        fully_covered: fullyCovered,
        partially_covered: partiallyCovered,
        not_covered: notCovered,
        coverage_percentage: coveragePercentage,
      },
      items: rendered,
    }
  }

  /** FR-A-003 · map a control to a framework clause. */
  async createMapping(
    principal: Principal,
    controlId: string,
    input: MappingInput,
  ): Promise<{ id: string }> {
    const control = await this.prisma.control.findUnique({
      where: { id: controlId },
      select: { id: true, isActive: true },
    })
    if (!control) throw new NotFoundException('Kontrol tidak ditemukan.')
    if (!control.isActive) {
      throw new ConflictException('Kontrol yang sudah dinonaktifkan tidak dapat dipetakan.')
    }

    const item = await this.prisma.frameworkItem.findUnique({
      where: { id: input.frameworkItemId },
      select: { id: true, _count: { select: { children: true } } },
    })
    if (!item) throw new NotFoundException('Butir ketentuan tidak ditemukan.')
    if (item._count.children > 0) {
      // A heading, not a requirement. Mapping to it would hide the uncovered
      // leaves beneath it from the coverage view.
      throw new BadRequestException(
        'Pemetaan hanya boleh ke butir ketentuan terdalam (leaf), bukan ke judul bab.',
      )
    }

    const existing = await this.prisma.controlMapping.findUnique({
      where: { controlId_frameworkItemId: { controlId, frameworkItemId: input.frameworkItemId } },
      select: { id: true },
    })
    if (existing) throw new ConflictException('Kontrol ini sudah dipetakan ke butir tersebut.')

    const id = randomUUID()
    await this.uow.write(async (tx, audit) => {
      await tx.controlMapping.create({
        data: {
          id,
          controlId,
          frameworkItemId: input.frameworkItemId,
          coverageLevel: input.coverageLevel,
          note: input.note ?? null,
          mappedBy: principal.userId,
        },
      })
      await audit.record({
        action: 'PETAKAN_KONTROL',
        objectType: 'CONTROL_MAPPING',
        objectId: id,
        after: {
          control_id: controlId,
          framework_item_id: input.frameworkItemId,
          coverage_level: input.coverageLevel,
        },
      })
    })
    return { id }
  }

  /** FR-A-003 · remove a mapping (does not delete either side). */
  async deleteMapping(_principal: Principal, mappingId: string): Promise<void> {
    const mapping = await this.prisma.controlMapping.findUnique({
      where: { id: mappingId },
      select: { id: true, controlId: true, frameworkItemId: true },
    })
    if (!mapping) throw new NotFoundException('Pemetaan tidak ditemukan.')

    await this.uow.write(async (tx, audit) => {
      await tx.controlMapping.delete({ where: { id: mappingId } })
      await audit.record({
        action: 'HAPUS_PEMETAAN_KONTROL',
        objectType: 'CONTROL_MAPPING',
        objectId: mappingId,
        before: {
          control_id: mapping.controlId,
          framework_item_id: mapping.frameworkItemId,
        },
      })
    })
  }

  private async requireFramework(id: string) {
    const framework = await this.prisma.framework.findUnique({ where: { id } })
    if (!framework) throw new NotFoundException('Framework tidak ditemukan.')
    return framework
  }
}
