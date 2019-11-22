import * as TypeMoq from 'typemoq'
import { VBase } from '../clients/VBase'
import { MineWinsConflictsResolver } from './MineWinsConflictsResolver'

describe('MineWinsConflictsResolver', () => {
  const VBaseMock = TypeMoq.Mock.ofType<VBase>()

  const resolver = new (class extends MineWinsConflictsResolver {
    constructor() {
      super(VBaseMock.object, 'test', '/test', ['a'])
    }

    public mergeMineWins(base: any, master: any, mine: any) {
      return super.mergeMineWins(base, master, mine)
    }
  })()

  it('Should merge object master and mine additions', async () => {
    const master = { a: 1 }
    const base = {}
    const mine = { b: 2 }
    const expected = { a: 1, b: 2 }

    const result = resolver.mergeMineWins(base, master, mine)
    expect(result).toEqual(expected)
  })

  it('Should keep mine object over master on keys conflict', async () => {
    const master = { a: 0, b: 1 }
    const base = {}
    const mine = { b: 2, c: 3 }
    const expected = { a: 0, b: 2, c: 3 }

    const result = resolver.mergeMineWins(base, master, mine)
    expect(result).toEqual(expected)
  })

  it('Should only add master object to mine if it wasn\'t deleted', async () => {
    const master = { b: 1 }
    const base = { b: 1 }
    const mine = {}
    const expected = {}

    const result = resolver.mergeMineWins(base, master, mine)
    expect(result).toEqual(expected)
  })

  it('Should delete object from mine when it is deleted from master and there is no conflict', async () => {
    const master = {}
    const base = { a: 1 }
    const mine = { a: 1, b: 2 }
    const expected = { b: 2 }

    const result = resolver.mergeMineWins(base, master, mine)
    expect(result).toEqual(expected)
  })

  it('Should keep mine object when it is deleted from master and there is conflict', async () => {
    const master = {}
    const base = { a: 1 }
    const mine = { a: 2 }
    const expected = { a: 2 }

    const result = resolver.mergeMineWins(base, master, mine)
    expect(result).toEqual(expected)
  })

  it('Should append master array values to mine arrays when they dont already exist', async () => {
    const master4 = { b: [{ z: [{ stuff0: 0 }, { stuff1: 1 }] }] }
    const base4 = { b: [{ z: [{ stuff0: 0 }] }] }
    const mine4 = { b: [{ z: [{ stuff0: 1 }] }] }
    const expected4 = { b: [{ z: [{ stuff0: 1 }, { stuff1: 1 }] }] }

    const result4 = resolver.mergeMineWins(base4, master4, mine4)
    expect(result4).toEqual(expected4)
  })

  it('Should not append master array values when they already exist in mine', async () => {
    const master = [{ b: 2 }, { a: 1 }]
    const base = [] as any
    const mine = [{ b: 2 }]
    const expected = [{ b: 2 }, { a: 1 }]

    const result = resolver.mergeMineWins(base, master, mine)
    expect(result).toEqual(expected)
  })

  it('Should keep mine array values in case of conflicts on comparableKeys', async () => {
    const master = [{ a: 2, c: 3 }, { b: 2 }]
    const base = [] as any
    const mine = [{ a: 1 }]
    const expected = [{ a: 1, c: 3}, { b: 2 }]

    const result = resolver.mergeMineWins(base, master, mine)
    expect(result).toEqual(expected)
  })

  it('Should delete from mine array values deleted from master with no conflict', async () => {
    const master = [] as any[]
    const base = [{ a: 1 }]
    const mine = [{ a: 1 }, { b: 2 }]
    const expected = [{ b: 2 }]

    const result = resolver.mergeMineWins(base, master, mine)
    expect(result).toEqual(expected)
  })

  it('Should only append array value to mine if it wasnt deleted from it', async () => {
    const master = [{ b: 1 }]
    const base = [{ b: 1 }]
    const mine = [] as any
    const expected = [] as any

    const result = resolver.mergeMineWins(base, master, mine)
    expect(result).toEqual(expected)
  })

  it('Should work with nullable inner objects', async () => {
    const master = { a: [{ b: 1 }] }
    const base = {}
    const mine = {}
    const expected = { a: [{ b: 1 }] }

    const result = resolver.mergeMineWins(base, master, mine)
    expect(result).toEqual(expected)

    const master2 = { a: { b: 1 } }
    const base2 = {}
    const mine2 = {}
    const expected2 = { a: { b: 1 } }

    const result2 = resolver.mergeMineWins(base2, master2, mine2)
    expect(result2).toEqual(expected2)

    const master3 = { a: { b: 1 } }
    const base3 = { a: {} }
    const mine3 = {}
    const expected3 = {}

    const result3 = resolver.mergeMineWins(base3, master3, mine3)
    expect(result3).toEqual(expected3)
  })
})
