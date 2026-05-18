export const query = `
query GetSKU ($identifier: SKUUniqueIdentifier!) {
  sku (identifier: $identifier) {
    id
    productId
    isActive
    name
    height
    length
    width
    weightKg
    packagedHeight
    packagedWidth
    packagedLength
    packagedWeightKg
    cubicWeight
    isKit
    creationDate
    rewardValue
    manufacturerCode
    commercialConditionId
    measurementUnit
    unitMultiplier
    modalType
    kitItensSellApart
  }
}
`

export interface SKU {
  id: string
  productId: string
  isActive: boolean
  name: string
  height?: number
  length?: number
  width?: number
  weightKg?: number
  packagedHeight?: number
  packagedWidth?: number
  packagedLength?: number
  packagedWeightKg?: number
  cubicWeight: number
  isKit: boolean
  creationDate: string
  rewardValue?: number
  estimatedDateArrival?: string
  manufacturerCode: string
  commercialConditionId: string
  measurementUnit: string
  unitMultiplier: number
  modalType?: string
  kitItensSellApart: boolean
}
