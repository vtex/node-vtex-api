export const query = `
query GetCategory($id: ID!) {
  category (id: $id) {
    id
    name
    title
    parentCategoryId
    description
    isActive
    globalCategoryId
    score
  }
}
`

export interface Category {
  id: string
  name: string
  title?: string
  parentCategoryId?: string
  description?: string
  isActive: boolean
  globalCategoryId: number
  score?: number
}
