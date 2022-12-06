import * as TypeMoq from 'typemoq'

import { VBase } from '../clients/infra/VBase'
import { MineWinsConflictsResolver } from './MineWinsConflictsResolver'
import { getMockConflicts } from './conflicts.test'

describe('MineWinsConflictsResolver', () => {
  const VBaseMock = TypeMoq.Mock.ofType<VBase>()

  const ctx = {
    clients: {
      vbase: {
        getConflicts: jest.fn(),
        resolveConflict: jest.fn(),
      },
    },
  }

  const resolver = class extends MineWinsConflictsResolver<unknown> {
    constructor(filePath: string) {
      super(ctx.clients.vbase as any, 'test', filePath, ['a'])
    }

    public mergeMineWins(base: any, master: any, mine: any) {
      return super.mergeMineWins(base, master, mine)
    }

    public resolve(logger?: any) {
      return super.resolve(logger)
    }
  }

  const contentResolver = new resolver('store/content.json')
  const routesResolver = new resolver('store/routes.json')

  describe('Test mergeMineWins algorithm', () => {
    it('Should merge object master and mine additions', async () => {
      const master = { a: 1, b: 3 }
      const base = { b: 3 }
      const mine = { b: 2 }
      const expected = { a: 1, b: 2 }

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)
    })

    it('Should keep mine object over master on keys conflict', async () => {
      const master = { a: 0, b: 1 }
      const base = {}
      const mine = { b: 2, c: 3 }
      const expected = { a: 0, b: 2, c: 3 }

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)
    })

    it('Should only add master object to mine if it wasnt deleted', async () => {
      const master = { b: 1 }
      const base = { b: 1 }
      const mine = {}
      const expected = {}

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)
    })

    it('Should delete object from mine when it is deleted from master and there is no conflict', async () => {
      const master = {}
      const base = { a: 1 }
      const mine = { a: 1, b: 2 }
      const expected = { b: 2 }

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)
    })

    it('Should keep mine object when it is deleted from master and there is conflict', async () => {
      const master = {}
      const base = { a: 1 }
      const mine = { a: 2 }
      const expected = { a: 2 }

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)
    })

    it('Should append master array values to mine arrays when they dont already exist', async () => {
      const master = [{ a: 1 }]
      const base = [{}]
      const mine = [{ b: 2 }]
      const expected = [{ b: 2 }, { a: 1 }]
      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)

      const master1 = { a: [{ z: [{ stuff0: 0 }, { stuff1: 1 }] }] }
      const base1 = { a: [{ z: [{ stuff0: 0 }] }] }
      const mine1 = { a: [{ z: [{ stuff0: 0 }] }] }
      const expected1 = { a: [{ z: [{ stuff0: 0 }, { stuff1: 1 }] }] }

      const result1 = contentResolver.mergeMineWins(base1, master1, mine1)
      expect(result1).toEqual(expected1)

      const master2 = { b: [{ z: [{ stuff0: 0 }, { stuff1: 1 }] }] }
      const base2 = { b: [{ z: [{ stuff0: 0 }] }] }
      const mine2 = { b: [{ z: [{ stuff0: 0 }] }] }
      const expected2 = { b: [{ z: [{ stuff0: 0 }, { stuff1: 1 }] }] }

      const result2 = contentResolver.mergeMineWins(base2, master2, mine2)
      expect(result2).toEqual(expected2)
    })

    it('Should not append master array values when they already exist in mine', async () => {
      const master = [{ a: 1 }, { b: 2 }]
      const base = [{}]
      const mine = [{ b: 2 }]
      const expected = [{ b: 2 }, { a: 1 }]

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)
    })

    it('Should keep mine array values in case of conflicts on comparableKeys', async () => {
      const master = [{ a: 1, c: 3 }, { b: 2 }]
      const base = [] as any
      const mine = [{ a: 1 }]
      const expected = [{ a: 1 }, { b: 2 }]

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)
    })

    it('Should delete from mine array values deleted from master with no conflict', async () => {
      const master = [] as any[]
      const base = [{ a: 1 }]
      const mine = [{ a: 1 }, { b: 2 }]
      const expected = [{ b: 2 }]

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)
    })

    it('Should delete from mine array values deleted from master and update values that were updated on master but left untouch on mine', async () => {
      const master = { lala: [{ a: 1, c: 4 }] }
      const base = { lala: [{ a: 1, c: 3 }, { b: 2 }] } as any
      const mine = { lala: [{ a: 1, c: 3 }, { b: 2 }] }
      const expected = { lala: [{ a: 1, c: 4 }] }

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)
    })

    it('Should only append array value to mine if it wasnt deleted from it', async () => {
      const master = [{ b: 1 }]
      const base = [{ b: 1 }]
      const mine = [] as any
      const expected = [] as any

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)
    })

    it('Should delete from mine array values deleted from master and update values that were updated on master but left untouch on mine', async () => {
      const master = { lala: [{ a: 1, c: 4 }] }
      const base = { lala: [{ a: 1, c: 3 }, { b: 2 }] } as any
      const mine = { lala: [{ a: 1, c: 3 }, { b: 2 }, { c: 3 }] }
      const expected = { lala: [{ c: 3 }, { a: 1, c: 4 }] }

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)
    })

    it('Should work with nullable inner objects', async () => {
      const master = { a: [{ b: 1 }] }
      const base = {}
      const mine = {}
      const expected = { a: [{ b: 1 }] }

      const result = contentResolver.mergeMineWins(base, master, mine)
      expect(result).toEqual(expected)

      const master2 = { a: { b: 1 } }
      const base2 = {}
      const mine2 = {}
      const expected2 = { a: { b: 1 } }

      const result2 = contentResolver.mergeMineWins(base2, master2, mine2)
      expect(result2).toEqual(expected2)

      const master3 = { a: { b: 1 } }
      const base3 = { a: {} }
      const mine3 = {}
      const expected3 = {}

      const result3 = contentResolver.mergeMineWins(base3, master3, mine3)
      expect(result3).toEqual(expected3)
    })
  })

  describe('Test conflict resolver method using Site Editor nested data', () => {
    test('Should merge object master and mine additions', async () => {
      const base = {
        j3UfCfDieDqqVpXwZSD5Aw: [
          {
            status: 'ACTIVE',
            blockContentMapId: 'j3UfCfDieDqqVpXwZSD5Aw',
            content: {
              infinite: true,
              showNavigationArrows: 'desktopOnly',
            },
            contentId: 'j3UfCfDieDqqVpXwZSD5Aw~xvQEdYpCzccFgGHe1kF2uo',
          },
        ],
      }

      const master = {
        j3UfCfDieDqqVpXwZSD5Aw: base.j3UfCfDieDqqVpXwZSD5Aw,
        vuDqMA5LCwgnmTjxkH7ird: [
          {
            blockContentMapId: '3uDqMA5LCwgnmTjxkH7ird',
            content: {
              url: 'https://storecomponents.vteximg.com.br/arquivos/store-theme-logo.png',
              title: 'Logo',
            },
            contentId: '3uDqMA5LCwgnmTjxkH7ird~8tVpGKkeKSJgYks5xqvJb1',
          },
        ],
      }

      const mine = {
        j3UfCfDieDqqVpXwZSD5Aw: [
          {
            status: 'INACTIVE',
            blockContentMapId: 'j3UfCfDieDqqVpXwZSD5Aw',
            content: {
              infinite: true,
              showNavigationArrows: 'desktopOnly',
            },
            contentId: 'j3UfCfDieDqqVpXwZSD5Aw~xvQEdYpCzccFgGHe1kF2uo',
          },
          {
            status: 'ACTIVE',
            blockContentMapId: 'j3UfCfDieDqqVpXwZSD5Aw',
            content: {
              infinite: false,
              showNavigationArrows: 'desktopOnly',
            },
            contentId: 'j3UfCfDieDqqVpXwZSD5Aw~fvQEdfpCZceFgGbe4kF2yt',
          },
        ],
      }

      const { getConflicts } = ctx.clients.vbase
      getConflicts.mockResolvedValue(getMockConflicts('store/content.json', base, mine, master))

      const contentResolved = await contentResolver.resolve()
      const expected = {
        vuDqMA5LCwgnmTjxkH7ird: master.vuDqMA5LCwgnmTjxkH7ird,
        j3UfCfDieDqqVpXwZSD5Aw: mine.j3UfCfDieDqqVpXwZSD5Aw,
      }

      expect(contentResolved).toEqual(expected)
    })

    test('Should merge only object master additions', async () => {
      const base = {
        vuDqMA5LCwgnmTjxkH7ird: [
          {
            blockContentMapId: '3uDqMA5LCwgnmTjxkH7ird',
            content: {
              url: 'https://storecomponents.vteximg.com.br/arquivos/store-theme-logo.png',
              title: 'Logo',
            },
            contentId: '3uDqMA5LCwgnmTjxkH7ird~8tVpGKkeKSJgYks5xqvJb1',
          },
        ],
        j3UfCfDieDqqVpXwZSD5Aw: [
          {
            status: 'ACTIVE',
            blockContentMapId: 'j3UfCfDieDqqVpXwZSD5Aw',
            content: {
              infinite: true,
              showNavigationArrows: 'desktopOnly',
            },
            contentId: 'j3UfCfDieDqqVpXwZSD5Aw~xvQEdYpCzccFgGHe1kF2uo',
          },
        ],
      }

      const master = {
        vuDqMA5LCwgnmTjxkH7ird: [
          {
            blockContentMapId: '3uDqMA5LCwgnmTjxkH7ird',
            content: {
              url: 'https://storecomponents.vteximg.com.br/arquivos/store-theme-logo.png',
              title: 'Logo',
            },
            contentId: '3uDqMA5LCwgnmTjxkH7ird~8tVpGKkeKSJgYks5xqvJb1',
          },
        ],
        j3UfCfDieDqqVpXwZSD5Aw: [
          {
            status: 'ACTIVE',
            blockContentMapId: 'j3UfCfDieDqqVpXwZSD5Aw',
            content: {
              infinite: false,
              showNavigationArrows: 'desktopOnly',
            },
            contentId: 'ABCfCfDieDqqVpXwZSD5Aw~xvQEdYpCzccFgGHe1kF2uo',
          },
        ],
      }

      const mine = {
        vuDqMA5LCwgnmTjxkH7ird: [
          {
            blockContentMapId: '3uDqMA5LCwgnmTjxkH7ird',
            content: {
              url: '/logo.png',
              title: 'Logo',
            },
            contentId: 'WSDAdqMA5LCwgnmTjxkH7ird~8tVpGKkeKSJgYks5xqvJb1',
          },
        ],
        j3UfCfDieDqqVpXwZSD5Aw: [
          {
            status: 'ACTIVE',
            blockContentMapId: 'j3UfCfDieDqqVpXwZSD5Aw',
            content: {
              infinite: true,
              showNavigationArrows: 'desktopOnly',
            },
            contentId: 'j3UfCfDieDqqVpXwZSD5Aw~xvQEdYpCzccFgGHe1kF2uo',
          },
        ],
      }

      const { getConflicts } = ctx.clients.vbase
      getConflicts.mockResolvedValue(getMockConflicts('store/content.json', base, mine, master))

      const contentResolved = await contentResolver.resolve()
      const expected = {
        vuDqMA5LCwgnmTjxkH7ird: mine.vuDqMA5LCwgnmTjxkH7ird,
        j3UfCfDieDqqVpXwZSD5Aw: master.j3UfCfDieDqqVpXwZSD5Aw,
      }

      expect(contentResolved).toEqual(expected)
    })

    test('Should delete object from mine when it is deleted from master', async () => {
      const base = {
        jFaq7QAw4U1QjrrdWDT2XZ: {
          uuid: 'jFaq7QAw4U1QjrrdWDT2XZ',
          blockId: 'vtex.store-theme@5.x:store.home',
          declarer: 'vtex.store@2.x',
          domain: 'store',
          interfaceId: 'vtex.store@2.x:store.home',
          path: '/',
          routeId: 'store.home',
          title: 'Home',
          dataSource: 'vtex.rewriter',
        },
        '9DdgY23LkRh68cvpncUfL4': {
          uuid: '9DdgY23LkRh68cvpncUfL4',
          blockId: 'vtex.store-theme@5.x:store.custom#about-us',
          domain: 'store',
          interfaceId: 'vtex.store@2.x:store.custom',
          path: '/test/custom/:collection_id',
          routeId: 'vtex.store@2.x:store.custom#collection-collection_id',
          title: 'Custom Pages',
          dataSource: 'vtex.rewriter',
          label: 'collection-collection_id',
          pathId: '/test/custom/:p3',
        },
      }

      const master = {
        jFaq7QAw4U1QjrrdWDT2XZ: {
          uuid: 'jFaq7QAw4U1QjrrdWDT2XZ',
          blockId: 'vtex.store-theme@6.x:store.home',
          declarer: 'vtex.store@2.x',
          domain: 'store',
          interfaceId: 'vtex.store@2.x:store.home',
          path: '/',
          routeId: 'store.home',
          title: 'Home',
          dataSource: 'vtex.rewriter',
        },
      }

      const mine = {
        jFaq7QAw4U1QjrrdWDT2XZ: {
          uuid: 'jFaq7QAw4U1QjrrdWDT2XZ',
          blockId: 'vtex.store-theme@6.x:store.home',
          declarer: 'vtex.store@2.x',
          domain: 'store',
          interfaceId: 'vtex.store@2.x:store.home',
          path: '/',
          routeId: 'store.home',
          title: 'New home',
          dataSource: 'vtex.rewriter',
        },
        '9DdgY23LkRh68cvpncUfL4': {
          uuid: '9DdgY23LkRh68cvpncUfL4',
          blockId: 'vtex.store-theme@5.x:store.custom#about-us',
          domain: 'store',
          interfaceId: 'vtex.store@2.x:store.custom',
          path: '/test/custom/:collection_id',
          routeId: 'vtex.store@2.x:store.custom#collection-collection_id',
          title: 'Custom Pages',
          dataSource: 'vtex.rewriter',
          label: 'collection-collection_id',
          pathId: '/test/custom/:p3',
        },
      }

      const { getConflicts } = ctx.clients.vbase
      getConflicts.mockResolvedValue(getMockConflicts('store/routes.json', base, mine, master))

      const expected = {
        jFaq7QAw4U1QjrrdWDT2XZ: {
          uuid: 'jFaq7QAw4U1QjrrdWDT2XZ',
          blockId: 'vtex.store-theme@6.x:store.home',
          declarer: 'vtex.store@2.x',
          domain: 'store',
          interfaceId: 'vtex.store@2.x:store.home',
          path: '/',
          routeId: 'store.home',
          title: 'New home',
          dataSource: 'vtex.rewriter',
        },
      }

      const routesResolved = await routesResolver.resolve()

      expect(routesResolved).toEqual(expected)
    })
  })
})
